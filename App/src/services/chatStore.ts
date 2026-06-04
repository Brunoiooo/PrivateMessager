import SQLite from 'react-native-sqlite-storage';

import {
  ConversationPreview,
  ConversationState,
  LocalConversationMessage,
  PublicKeyProfile,
} from '../types/messaging';

const DB_NAME = 'messager_profiles.db';

SQLite.enablePromise(true);

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabase({
      name: DB_NAME,
      location: 'default',
    });
  }

  return databasePromise;
}

function mapRows<T>(resultSet: SQLite.ResultSet): T[] {
  const rows: T[] = [];

  for (let index = 0; index < resultSet.rows.length; index += 1) {
    rows.push(resultSet.rows.item(index) as T);
  }

  return rows;
}

export async function initializeChatStore(): Promise<void> {
  const db = await getDatabase();

  await db.executeSql(
    `CREATE TABLE IF NOT EXISTS known_profiles (
      owner_fingerprint TEXT NOT NULL,
      fingerprint_sha512 TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_tag INTEGER NOT NULL,
      public_key_der_base64 TEXT NOT NULL,
      is_friend INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (owner_fingerprint, fingerprint_sha512)
    );`,
  );

  await db.executeSql(
    `CREATE TABLE IF NOT EXISTS conversation_state (
      owner_fingerprint TEXT NOT NULL,
      peer_fingerprint TEXT NOT NULL,
      outgoing_chain_key_base64 TEXT,
      incoming_chain_key_base64 TEXT,
      last_read_incoming_at_utc TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (owner_fingerprint, peer_fingerprint)
    );`,
  );

  try {
    await db.executeSql(
      'ALTER TABLE conversation_state ADD COLUMN last_read_incoming_at_utc TEXT;',
    );
  } catch {
    // Column already exists on migrated databases.
  }

  await db.executeSql(
    `CREATE TABLE IF NOT EXISTS messages_local (
      owner_fingerprint TEXT NOT NULL,
      message_hash TEXT NOT NULL,
      peer_fingerprint TEXT NOT NULL,
      from_public_key TEXT NOT NULL,
      to_public_key TEXT NOT NULL,
      encrypted_content_base64 TEXT NOT NULL,
      plaintext TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (owner_fingerprint, message_hash)
    );`,
  );

  await db.executeSql(
    `CREATE TABLE IF NOT EXISTS key_exchanges_local (
      owner_fingerprint TEXT NOT NULL,
      from_public_key TEXT NOT NULL,
      to_public_key TEXT NOT NULL,
      encrypted_private_key_base64 TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (owner_fingerprint, from_public_key, to_public_key, created_at)
    );`,
  );

  await db.executeSql(
    `CREATE TABLE IF NOT EXISTS sync_state (
      owner_fingerprint TEXT PRIMARY KEY NOT NULL,
      last_synced_at_utc TEXT
    );`,
  );
}

export async function upsertKnownProfiles(
  ownerFingerprint: string,
  profiles: PublicKeyProfile[],
): Promise<void> {
  if (profiles.length === 0) {
    return;
  }

  const now = Date.now();
  const db = await getDatabase();

  for (const profile of profiles) {
    await db.executeSql(
      `INSERT INTO known_profiles (
         owner_fingerprint,
         fingerprint_sha512,
         user_name,
         user_tag,
         public_key_der_base64,
         is_friend,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(owner_fingerprint, fingerprint_sha512)
       DO UPDATE SET
         user_name = excluded.user_name,
         user_tag = excluded.user_tag,
         public_key_der_base64 = excluded.public_key_der_base64,
         updated_at = excluded.updated_at;`,
      [
        ownerFingerprint,
        profile.fingerprintSha512,
        profile.userName,
        profile.userTag,
        profile.publicKeyDerBase64,
        now,
      ],
    );
  }
}

export async function markFriend(
  ownerFingerprint: string,
  peerFingerprint: string,
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `UPDATE known_profiles
     SET is_friend = 1, updated_at = ?
     WHERE owner_fingerprint = ? AND fingerprint_sha512 = ?;`,
    [Date.now(), ownerFingerprint, peerFingerprint],
  );
}

export async function listFriends(
  ownerFingerprint: string,
): Promise<PublicKeyProfile[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    `SELECT fingerprint_sha512, user_name, user_tag, public_key_der_base64
     FROM known_profiles
     WHERE owner_fingerprint = ? AND is_friend = 1
     ORDER BY user_name, user_tag;`,
    [ownerFingerprint],
  );

  return mapRows<{
    fingerprint_sha512: string;
    user_name: string;
    user_tag: number;
    public_key_der_base64: string;
  }>(result).map(row => ({
    fingerprintSha512: row.fingerprint_sha512,
    userName: row.user_name,
    userTag: row.user_tag,
    publicKeyDerBase64: row.public_key_der_base64,
  }));
}

export async function getConversationState(
  ownerFingerprint: string,
  peerFingerprint: string,
): Promise<ConversationState> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    `SELECT outgoing_chain_key_base64, incoming_chain_key_base64
     FROM conversation_state
     WHERE owner_fingerprint = ? AND peer_fingerprint = ?
     LIMIT 1;`,
    [ownerFingerprint, peerFingerprint],
  );

  if (result.rows.length === 0) {
    return {
      peerFingerprint,
      outgoingChainKeyBase64: null,
      incomingChainKeyBase64: null,
    };
  }

  const row = result.rows.item(0) as {
    outgoing_chain_key_base64: string | null;
    incoming_chain_key_base64: string | null;
  };

  return {
    peerFingerprint,
    outgoingChainKeyBase64: row.outgoing_chain_key_base64,
    incomingChainKeyBase64: row.incoming_chain_key_base64,
  };
}

export async function saveConversationState(
  ownerFingerprint: string,
  state: ConversationState,
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `INSERT INTO conversation_state (
       owner_fingerprint,
       peer_fingerprint,
       outgoing_chain_key_base64,
       incoming_chain_key_base64,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(owner_fingerprint, peer_fingerprint)
     DO UPDATE SET
       outgoing_chain_key_base64 = excluded.outgoing_chain_key_base64,
       incoming_chain_key_base64 = excluded.incoming_chain_key_base64,
       updated_at = excluded.updated_at;`,
    [
      ownerFingerprint,
      state.peerFingerprint,
      state.outgoingChainKeyBase64,
      state.incomingChainKeyBase64,
      Date.now(),
    ],
  );
}

export async function upsertKeyExchange(params: {
  ownerFingerprint: string;
  fromPublicKey: string;
  toPublicKey: string;
  encryptedPrivateKeyBase64: string;
  createdAt: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `INSERT OR IGNORE INTO key_exchanges_local (
       owner_fingerprint,
       from_public_key,
       to_public_key,
       encrypted_private_key_base64,
       created_at
     )
     VALUES (?, ?, ?, ?, ?);`,
    [
      params.ownerFingerprint,
      params.fromPublicKey,
      params.toPublicKey,
      params.encryptedPrivateKeyBase64,
      params.createdAt,
    ],
  );
}

export async function upsertMessage(params: {
  ownerFingerprint: string;
  messageHash: string;
  peerFingerprint: string;
  fromPublicKey: string;
  toPublicKey: string;
  encryptedContentBase64: string;
  plaintext: string | null;
  createdAt: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `INSERT INTO messages_local (
       owner_fingerprint,
       message_hash,
       peer_fingerprint,
       from_public_key,
       to_public_key,
       encrypted_content_base64,
       plaintext,
       created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_fingerprint, message_hash)
     DO UPDATE SET
       plaintext = COALESCE(messages_local.plaintext, excluded.plaintext),
       encrypted_content_base64 = excluded.encrypted_content_base64,
       created_at = excluded.created_at;`,
    [
      params.ownerFingerprint,
      params.messageHash,
      params.peerFingerprint,
      params.fromPublicKey,
      params.toPublicKey,
      params.encryptedContentBase64,
      params.plaintext,
      params.createdAt,
    ],
  );
}

export async function listConversationMessages(
  ownerFingerprint: string,
  peerFingerprint: string,
): Promise<LocalConversationMessage[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    `SELECT
       message_hash,
       peer_fingerprint,
       from_public_key,
       to_public_key,
       encrypted_content_base64,
       plaintext,
       created_at
     FROM messages_local
     WHERE owner_fingerprint = ? AND peer_fingerprint = ?
     ORDER BY created_at ASC;`,
    [ownerFingerprint, peerFingerprint],
  );

  return mapRows<{
    message_hash: string;
    peer_fingerprint: string;
    from_public_key: string;
    to_public_key: string;
    encrypted_content_base64: string;
    plaintext: string | null;
    created_at: string;
  }>(result).map(row => ({
    messageHash: row.message_hash,
    peerFingerprint: row.peer_fingerprint,
    fromPublicKey: row.from_public_key,
    toPublicKey: row.to_public_key,
    encryptedContentBase64: row.encrypted_content_base64,
    plaintext: row.plaintext,
    createdAt: row.created_at,
  }));
}

export async function listConversationPreviews(
  ownerFingerprint: string,
): Promise<ConversationPreview[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    `SELECT
       kp.fingerprint_sha512,
       kp.user_name,
       kp.user_tag,
       kp.public_key_der_base64,
       lm.plaintext AS last_message_text,
       lm.created_at AS last_message_created_at,
       lm.from_public_key AS last_message_from_public_key,
       COALESCE(unread.unread_count, 0) AS unread_count
     FROM known_profiles kp
     LEFT JOIN messages_local lm
       ON lm.owner_fingerprint = kp.owner_fingerprint
      AND lm.peer_fingerprint = kp.fingerprint_sha512
      AND lm.message_hash = (
        SELECT inner_m.message_hash
        FROM messages_local inner_m
        WHERE inner_m.owner_fingerprint = kp.owner_fingerprint
          AND inner_m.peer_fingerprint = kp.fingerprint_sha512
        ORDER BY inner_m.created_at DESC, inner_m.message_hash DESC
        LIMIT 1
      )
     LEFT JOIN (
       SELECT
         m.peer_fingerprint,
         COUNT(*) AS unread_count
       FROM messages_local m
       LEFT JOIN conversation_state cs
         ON cs.owner_fingerprint = m.owner_fingerprint
        AND cs.peer_fingerprint = m.peer_fingerprint
       WHERE m.owner_fingerprint = ?
         AND m.to_public_key = ?
         AND (
           cs.last_read_incoming_at_utc IS NULL
           OR m.created_at > cs.last_read_incoming_at_utc
         )
       GROUP BY m.peer_fingerprint
     ) unread
       ON unread.peer_fingerprint = kp.fingerprint_sha512
     WHERE kp.owner_fingerprint = ?
       AND kp.is_friend = 1
     ORDER BY
       CASE WHEN lm.created_at IS NULL THEN 1 ELSE 0 END,
       lm.created_at DESC,
       kp.user_name ASC,
       kp.user_tag ASC;`,
    [ownerFingerprint, ownerFingerprint, ownerFingerprint],
  );

  return mapRows<{
    fingerprint_sha512: string;
    user_name: string;
    user_tag: number;
    public_key_der_base64: string;
    last_message_text: string | null;
    last_message_created_at: string | null;
    last_message_from_public_key: string | null;
    unread_count: number;
  }>(result).map(row => ({
    profile: {
      fingerprintSha512: row.fingerprint_sha512,
      userName: row.user_name,
      userTag: row.user_tag,
      publicKeyDerBase64: row.public_key_der_base64,
    },
    lastMessageText: row.last_message_text,
    lastMessageCreatedAt: row.last_message_created_at,
    lastMessageFromPublicKey: row.last_message_from_public_key,
    unreadCount: Number(row.unread_count) || 0,
  }));
}

export async function markConversationAsRead(
  ownerFingerprint: string,
  peerFingerprint: string,
): Promise<void> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    `SELECT MAX(created_at) AS last_incoming_created_at
     FROM messages_local
     WHERE owner_fingerprint = ?
       AND peer_fingerprint = ?
       AND to_public_key = ?;`,
    [ownerFingerprint, peerFingerprint, ownerFingerprint],
  );

  const row = result.rows.item(0) as {
    last_incoming_created_at: string | null;
  };

  await db.executeSql(
    `INSERT INTO conversation_state (
       owner_fingerprint,
       peer_fingerprint,
       outgoing_chain_key_base64,
       incoming_chain_key_base64,
       last_read_incoming_at_utc,
       updated_at
     )
     VALUES (?, ?, NULL, NULL, ?, ?)
     ON CONFLICT(owner_fingerprint, peer_fingerprint)
     DO UPDATE SET
       last_read_incoming_at_utc = excluded.last_read_incoming_at_utc,
       updated_at = excluded.updated_at;`,
    [
      ownerFingerprint,
      peerFingerprint,
      row.last_incoming_created_at,
      Date.now(),
    ],
  );
}

export async function getLastSyncedAtUtc(
  ownerFingerprint: string,
): Promise<string | null> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    `SELECT last_synced_at_utc FROM sync_state WHERE owner_fingerprint = ? LIMIT 1;`,
    [ownerFingerprint],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows.item(0) as { last_synced_at_utc: string | null };
  return row.last_synced_at_utc;
}

export async function setLastSyncedAtUtc(
  ownerFingerprint: string,
  lastSyncedAtUtc: string,
): Promise<void> {
  const db = await getDatabase();

  await db.executeSql(
    `INSERT INTO sync_state (owner_fingerprint, last_synced_at_utc)
     VALUES (?, ?)
     ON CONFLICT(owner_fingerprint)
     DO UPDATE SET last_synced_at_utc = excluded.last_synced_at_utc;`,
    [ownerFingerprint, lastSyncedAtUtc],
  );
}
