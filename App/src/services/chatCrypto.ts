import * as forge from 'node-forge';

const CHAIN_KEY_SIZE = 32;
const AES_GCM_IV_SIZE = 12;
const AES_GCM_TAG_SIZE = 16;

// ---------------------------------------------------------------------------
// Storage key derivation (HKDF-SHA256)
// Derives a symmetric key from the RSA private key PEM for encrypting local
// SQLite fields. The key is deterministic so the same private key always
// produces the same storage key — no additional state needed.
// ---------------------------------------------------------------------------

export function deriveStorageKey(privateKeyPem: string): string {
  const ikm = forge.md.sha512
    .create()
    .update(privateKeyPem, 'utf8')
    .digest()
    .getBytes();

  const hmacExtract = forge.hmac.create();
  hmacExtract.start('sha256', 'messager-storage-salt-v1');
  hmacExtract.update(ikm);
  const prk = hmacExtract.digest().getBytes();

  const hmacExpand = forge.hmac.create();
  hmacExpand.start('sha256', prk);
  hmacExpand.update('messager-local-storage\x01');
  const okm = hmacExpand.digest().getBytes();

  return forge.util.encode64(okm);
}

export function encryptField(value: string, storageKeyBase64: string): string {
  const keyBinary = forge.util.decode64(storageKeyBase64);
  const ivBinary = randomBytes(AES_GCM_IV_SIZE);
  const cipher = forge.cipher.createCipher('AES-GCM', keyBinary);

  cipher.start({ iv: ivBinary, tagLength: AES_GCM_TAG_SIZE * 8 });
  cipher.update(forge.util.createBuffer(value, 'utf8'));

  if (!cipher.finish()) {
    throw new Error('Nie udało się zaszyfrować pola.');
  }

  const payload = ivBinary + cipher.mode.tag.getBytes() + cipher.output.getBytes();
  return forge.util.encode64(payload);
}

export function decryptField(
  encryptedBase64: string,
  storageKeyBase64: string,
): string | null {
  try {
    const keyBinary = forge.util.decode64(storageKeyBase64);
    const payload = forge.util.decode64(encryptedBase64);
    const minLen = AES_GCM_IV_SIZE + AES_GCM_TAG_SIZE;

    if (payload.length <= minLen) {
      return null;
    }

    const ivBinary = payload.slice(0, AES_GCM_IV_SIZE);
    const tagBinary = payload.slice(AES_GCM_IV_SIZE, minLen);
    const ciphertextBinary = payload.slice(minLen);

    const decipher = forge.cipher.createDecipher('AES-GCM', keyBinary);
    decipher.start({
      iv: ivBinary,
      tagLength: AES_GCM_TAG_SIZE * 8,
      tag: forge.util.createBuffer(tagBinary),
    });
    decipher.update(forge.util.createBuffer(ciphertextBinary));

    if (!decipher.finish()) {
      return null;
    }

    return decipher.output.toString();
  } catch {
    return null;
  }
}

export function generateChainSeedBase64(): string {
  return forge.util.encode64(randomBytes(CHAIN_KEY_SIZE));
}

export function deriveNextChainKeyBase64(previousKeyBase64: string): string {
  const previous = forge.util.decode64(previousKeyBase64);
  const digest = forge.md.sha256.create().update(previous, 'raw').digest();
  return forge.util.encode64(digest.getBytes());
}

export function encryptChainSeedForRecipient(
  chainSeedBase64: string,
  recipientPublicKeyDerBase64: string,
  recipientFingerprintSha512: string,
): string {
  const recipientPublicKeyDerBinary = forge.util.decode64(
    recipientPublicKeyDerBase64,
  );
  const computedRecipientFingerprint = forge.md.sha512
    .create()
    .update(recipientPublicKeyDerBinary, 'raw')
    .digest()
    .toHex();

  if (computedRecipientFingerprint !== recipientFingerprintSha512) {
    throw new Error(
      'Klucz publiczny odbiorcy nie zgadza sie z jego fingerprintem.',
    );
  }

  const recipientPublicKey = forge.pki.publicKeyFromAsn1(
    forge.asn1.fromDer(recipientPublicKeyDerBinary),
  );

  const encryptedBinary = recipientPublicKey.encrypt(
    forge.util.decode64(chainSeedBase64),
    'RSA-OAEP',
    {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create(),
      },
    },
  );

  return forge.util.encode64(encryptedBinary);
}

export function decryptIncomingChainSeed(
  encryptedPrivateKeyBase64: string,
  privateKeyPem: string,
): string {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const decryptedBinary = privateKey.decrypt(
    forge.util.decode64(encryptedPrivateKeyBase64),
    'RSA-OAEP',
    {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create(),
      },
    },
  );

  return forge.util.encode64(decryptedBinary);
}

export function encryptMessageWithChainKey(
  plaintext: string,
  chainKeyBase64: string,
): string {
  const chainKeyBinary = forge.util.decode64(chainKeyBase64);
  const ivBinary = randomBytes(AES_GCM_IV_SIZE);
  const cipher = forge.cipher.createCipher('AES-GCM', chainKeyBinary);

  cipher.start({
    iv: ivBinary,
    tagLength: AES_GCM_TAG_SIZE * 8,
  });

  cipher.update(forge.util.createBuffer(plaintext, 'utf8'));

  if (!cipher.finish()) {
    throw new Error('Nie udało się zaszyfrować wiadomości.');
  }

  const payloadBinary =
    ivBinary + cipher.mode.tag.getBytes() + cipher.output.getBytes();

  return forge.util.encode64(payloadBinary);
}

export function decryptMessageWithChainKey(
  encryptedContentBase64: string,
  chainKeyBase64: string,
): string {
  const payloadBinary = forge.util.decode64(encryptedContentBase64);
  const minLength = AES_GCM_IV_SIZE + AES_GCM_TAG_SIZE;

  if (payloadBinary.length <= minLength) {
    throw new Error('Nieprawidłowy format szyfrogramu wiadomości.');
  }

  const ivBinary = payloadBinary.slice(0, AES_GCM_IV_SIZE);
  const tagBinary = payloadBinary.slice(AES_GCM_IV_SIZE, minLength);
  const ciphertextBinary = payloadBinary.slice(minLength);

  const decipher = forge.cipher.createDecipher(
    'AES-GCM',
    forge.util.decode64(chainKeyBase64),
  );

  decipher.start({
    iv: ivBinary,
    tagLength: AES_GCM_TAG_SIZE * 8,
    tag: forge.util.createBuffer(tagBinary),
  });

  decipher.update(forge.util.createBuffer(ciphertextBinary));

  if (!decipher.finish()) {
    throw new Error('Nie udało się odszyfrować wiadomości.');
  }

  return decipher.output.toString();
}

export function createMessageHash(encryptedContentBase64: string): string {
  return forge.md.sha512
    .create()
    .update(forge.util.decode64(encryptedContentBase64), 'raw')
    .digest()
    .toHex();
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return forge.util.encode64(String.fromCharCode(...new Uint8Array(buffer)));
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = forge.util.decode64(base64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buf;
}

function randomBytes(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return String.fromCharCode(...bytes);
}
