import {
  Direction,
  KeyHelper,
  KeyPairType,
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
  StorageType,
  setWebCrypto,
  type SessionRecordType,
} from '@privacyresearch/libsignal-protocol-typescript';

import { arrayBufferToBase64, base64ToArrayBuffer } from './chatCrypto';
import { getDatabase } from './chatStore';
import {
  fetchPreKeyBundle,
  uploadPreKeyBundle,
} from './messagingApi';

// ---------------------------------------------------------------------------
// WebCrypto setup
// The msrcrypto polyfill is needed because React Native's globalThis.crypto
// does not expose crypto.subtle (SubtleCrypto API).
// ---------------------------------------------------------------------------

let cryptoInitialised = false;

export function initSignalProtocol(): void {
  if (cryptoInitialised) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const msrcrypto = require('@privacyresearch/libsignal-protocol-typescript/lib/msrcrypto');
  setWebCrypto(msrcrypto);
  cryptoInitialised = true;
}

// ---------------------------------------------------------------------------
// SqliteSignalStore — implements StorageType backed by SQLite
// ---------------------------------------------------------------------------

export class SqliteSignalStore implements StorageType {
  constructor(private readonly ownerFingerprint: string) {}

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    const db = await getDatabase();
    const [result] = await db.executeSql(
      'SELECT key_pair_pub_base64, key_pair_priv_base64 FROM signal_identity WHERE owner_fingerprint = ? LIMIT 1;',
      [this.ownerFingerprint],
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows.item(0) as {
      key_pair_pub_base64: string;
      key_pair_priv_base64: string;
    };

    return {
      pubKey: base64ToArrayBuffer(row.key_pair_pub_base64),
      privKey: base64ToArrayBuffer(row.key_pair_priv_base64),
    };
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    const db = await getDatabase();
    const [result] = await db.executeSql(
      'SELECT registration_id FROM signal_identity WHERE owner_fingerprint = ? LIMIT 1;',
      [this.ownerFingerprint],
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows.item(0) as { registration_id: number };
    return row.registration_id;
  }

  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
    _direction: Direction,
  ): Promise<boolean> {
    const db = await getDatabase();
    const peerIdentifier = identifier.split('.')[0];
    const [result] = await db.executeSql(
      'SELECT identity_key_base64 FROM signal_trusted_identities WHERE owner_fingerprint = ? AND peer_identifier = ? LIMIT 1;',
      [this.ownerFingerprint, peerIdentifier],
    );

    if (result.rows.length === 0) {
      return true;
    }

    const row = result.rows.item(0) as { identity_key_base64: string };
    const stored = new Uint8Array(base64ToArrayBuffer(row.identity_key_base64));
    const incoming = new Uint8Array(identityKey);

    if (stored.length !== incoming.length) {
      return false;
    }

    for (let i = 0; i < stored.length; i++) {
      if (stored[i] !== incoming[i]) {
        return false;
      }
    }

    return true;
  }

  async saveIdentity(
    encodedAddress: string,
    publicKey: ArrayBuffer,
    _nonblockingApproval?: boolean,
  ): Promise<boolean> {
    const peerIdentifier = encodedAddress.split('.')[0];
    const db = await getDatabase();
    const [existing] = await db.executeSql(
      'SELECT 1 FROM signal_trusted_identities WHERE owner_fingerprint = ? AND peer_identifier = ? LIMIT 1;',
      [this.ownerFingerprint, peerIdentifier],
    );

    await db.executeSql(
      `INSERT INTO signal_trusted_identities (owner_fingerprint, peer_identifier, identity_key_base64)
       VALUES (?, ?, ?)
       ON CONFLICT(owner_fingerprint, peer_identifier)
       DO UPDATE SET identity_key_base64 = excluded.identity_key_base64;`,
      [this.ownerFingerprint, peerIdentifier, arrayBufferToBase64(publicKey)],
    );

    return existing.rows.length > 0;
  }

  async loadPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const db = await getDatabase();
    const [result] = await db.executeSql(
      'SELECT key_pair_pub_base64, key_pair_priv_base64 FROM signal_prekeys WHERE owner_fingerprint = ? AND prekey_id = ? LIMIT 1;',
      [this.ownerFingerprint, Number(keyId)],
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows.item(0) as {
      key_pair_pub_base64: string;
      key_pair_priv_base64: string;
    };

    return {
      pubKey: base64ToArrayBuffer(row.key_pair_pub_base64),
      privKey: base64ToArrayBuffer(row.key_pair_priv_base64),
    };
  }

  async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    const db = await getDatabase();
    await db.executeSql(
      `INSERT INTO signal_prekeys (owner_fingerprint, prekey_id, key_pair_pub_base64, key_pair_priv_base64)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_fingerprint, prekey_id)
       DO UPDATE SET
         key_pair_pub_base64 = excluded.key_pair_pub_base64,
         key_pair_priv_base64 = excluded.key_pair_priv_base64;`,
      [
        this.ownerFingerprint,
        Number(keyId),
        arrayBufferToBase64(keyPair.pubKey),
        arrayBufferToBase64(keyPair.privKey),
      ],
    );
  }

  async removePreKey(keyId: number | string): Promise<void> {
    const db = await getDatabase();
    await db.executeSql(
      'DELETE FROM signal_prekeys WHERE owner_fingerprint = ? AND prekey_id = ?;',
      [this.ownerFingerprint, Number(keyId)],
    );
  }

  async storeSession(encodedAddress: string, record: SessionRecordType): Promise<void> {
    const db = await getDatabase();
    await db.executeSql(
      `INSERT INTO signal_sessions (owner_fingerprint, peer_address, session_record)
       VALUES (?, ?, ?)
       ON CONFLICT(owner_fingerprint, peer_address)
       DO UPDATE SET session_record = excluded.session_record;`,
      [this.ownerFingerprint, encodedAddress, record],
    );
  }

  async loadSession(encodedAddress: string): Promise<SessionRecordType | undefined> {
    const db = await getDatabase();
    const [result] = await db.executeSql(
      'SELECT session_record FROM signal_sessions WHERE owner_fingerprint = ? AND peer_address = ? LIMIT 1;',
      [this.ownerFingerprint, encodedAddress],
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows.item(0) as { session_record: string };
    return row.session_record;
  }

  async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const db = await getDatabase();
    const [result] = await db.executeSql(
      'SELECT key_pair_pub_base64, key_pair_priv_base64 FROM signal_signed_prekeys WHERE owner_fingerprint = ? AND prekey_id = ? LIMIT 1;',
      [this.ownerFingerprint, Number(keyId)],
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    const row = result.rows.item(0) as {
      key_pair_pub_base64: string;
      key_pair_priv_base64: string;
    };

    return {
      pubKey: base64ToArrayBuffer(row.key_pair_pub_base64),
      privKey: base64ToArrayBuffer(row.key_pair_priv_base64),
    };
  }

  async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    const db = await getDatabase();
    await db.executeSql(
      `INSERT INTO signal_signed_prekeys (owner_fingerprint, prekey_id, key_pair_pub_base64, key_pair_priv_base64)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_fingerprint, prekey_id)
       DO UPDATE SET
         key_pair_pub_base64 = excluded.key_pair_pub_base64,
         key_pair_priv_base64 = excluded.key_pair_priv_base64;`,
      [
        this.ownerFingerprint,
        Number(keyId),
        arrayBufferToBase64(keyPair.pubKey),
        arrayBufferToBase64(keyPair.privKey),
      ],
    );
  }

  async removeSignedPreKey(keyId: number | string): Promise<void> {
    const db = await getDatabase();
    await db.executeSql(
      'DELETE FROM signal_signed_prekeys WHERE owner_fingerprint = ? AND prekey_id = ?;',
      [this.ownerFingerprint, Number(keyId)],
    );
  }
}

// ---------------------------------------------------------------------------
// High-level helpers
// ---------------------------------------------------------------------------

const ONE_TIME_PREKEY_COUNT = 50;

export async function ensureSignalIdentity(
  ownerFingerprint: string,
  apiBaseUrl: string,
  token: string,
): Promise<void> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    'SELECT 1 FROM signal_identity WHERE owner_fingerprint = ? LIMIT 1;',
    [ownerFingerprint],
  );

  if (result.rows.length > 0) {
    return;
  }

  const store = new SqliteSignalStore(ownerFingerprint);
  const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  const registrationId = KeyHelper.generateRegistrationId();

  await db.executeSql(
    `INSERT INTO signal_identity (owner_fingerprint, key_pair_pub_base64, key_pair_priv_base64, registration_id)
     VALUES (?, ?, ?, ?);`,
    [
      ownerFingerprint,
      arrayBufferToBase64(identityKeyPair.pubKey),
      arrayBufferToBase64(identityKeyPair.privKey),
      registrationId,
    ],
  );

  const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, 1);
  await store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

  const oneTimePreKeys = await Promise.all(
    Array.from({ length: ONE_TIME_PREKEY_COUNT }, (_, i) =>
      KeyHelper.generatePreKey(i + 1),
    ),
  );

  for (const preKey of oneTimePreKeys) {
    await store.storePreKey(preKey.keyId, preKey.keyPair);
  }

  try {
    await uploadPreKeyBundle({
      apiBaseUrl,
      token,
      signedPreKeyId: signedPreKey.keyId,
      signedPreKeyPublicBase64: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
      signatureBase64: arrayBufferToBase64(signedPreKey.signature),
      oneTimePreKeys: oneTimePreKeys.map(k => ({
        preKeyId: k.keyId,
        publicBase64: arrayBufferToBase64(k.keyPair.pubKey),
      })),
    });
  } catch {
    // Prekey upload failures are non-fatal — we'll retry on the next session start.
  }
}

export async function encryptWithSignal(
  plaintext: string,
  ownerFingerprint: string,
  peerFingerprint: string,
  apiBaseUrl: string,
  token: string,
): Promise<{ encryptedContentBase64: string; signalMessageType: number } | null> {
  try {
    const store = new SqliteSignalStore(ownerFingerprint);
    const address = new SignalProtocolAddress(peerFingerprint, 1);
    const cipher = new SessionCipher(store, address);

    if (!(await cipher.hasOpenSession())) {
      const bundle = await fetchPreKeyBundle({ apiBaseUrl, token, fingerprint: peerFingerprint });

      if (!bundle) {
        return null;
      }

      const device = {
        identityKey: base64ToArrayBuffer(bundle.identityKeyDerBase64),
        signedPreKey: {
          keyId: bundle.signedPreKeyId,
          publicKey: base64ToArrayBuffer(bundle.signedPreKeyPublicBase64),
          signature: base64ToArrayBuffer(bundle.signatureBase64),
        },
        preKey: bundle.otpPublicBase64
          ? {
              keyId: 0,
              publicKey: base64ToArrayBuffer(bundle.otpPublicBase64),
            }
          : undefined,
        registrationId: 0,
      };

      const builder = new SessionBuilder(store, address);
      await builder.processPreKey(device);
    }

    const encoder = new TextEncoder();
    const plaintextBuffer = encoder.encode(plaintext).buffer as ArrayBuffer;
    const encrypted = await cipher.encrypt(plaintextBuffer);

    if (!encrypted.body) {
      return null;
    }

    return {
      encryptedContentBase64: encrypted.body,
      signalMessageType: encrypted.type,
    };
  } catch {
    return null;
  }
}

export async function decryptWithSignal(
  encryptedContentBase64: string,
  signalMessageType: number,
  ownerFingerprint: string,
  peerFingerprint: string,
): Promise<string | null> {
  try {
    const store = new SqliteSignalStore(ownerFingerprint);
    const address = new SignalProtocolAddress(peerFingerprint, 1);
    const cipher = new SessionCipher(store, address);

    let plaintextBuffer: ArrayBuffer;

    if (signalMessageType === 3) {
      plaintextBuffer = await cipher.decryptPreKeyWhisperMessage(
        encryptedContentBase64,
        'base64',
      );
    } else {
      plaintextBuffer = await cipher.decryptWhisperMessage(
        encryptedContentBase64,
        'base64',
      );
    }

    const decoder = new TextDecoder();
    return decoder.decode(plaintextBuffer);
  } catch {
    return null;
  }
}
