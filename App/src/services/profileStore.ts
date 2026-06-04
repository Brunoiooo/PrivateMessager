import SQLite from 'react-native-sqlite-storage';

import { StoredRegistration } from '../types/registration';
import { LocalProfile } from '../types/profile';

const DB_NAME = 'messager_profiles.db';
const ACTIVE_PROFILE_KEY = 'active_profile_id';

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

export async function initializeProfileStore(): Promise<void> {
  const db = await getDatabase();

  await db.executeSql(
    `CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      registration_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
  );

  await db.executeSql(
    `CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );`,
  );
}

export async function listProfiles(): Promise<LocalProfile[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    `SELECT
      id,
      display_name,
      registration_json,
      created_at,
      updated_at
    FROM profiles
    ORDER BY updated_at DESC, id DESC;`,
  );

  return mapRows<{
    id: number;
    display_name: string;
    registration_json: string | null;
    created_at: number;
    updated_at: number;
  }>(result).map(row => ({
    id: row.id,
    displayName: row.display_name,
    hasRegistration: Boolean(row.registration_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createProfile(
  displayName: string,
): Promise<LocalProfile> {
  const trimmedDisplayName = displayName.trim();

  if (!trimmedDisplayName) {
    throw new Error('Nazwa profilu nie może być pusta.');
  }

  const now = Date.now();
  const db = await getDatabase();
  const [result] = await db.executeSql(
    `INSERT INTO profiles (display_name, registration_json, created_at, updated_at)
     VALUES (?, NULL, ?, ?);`,
    [trimmedDisplayName, now, now],
  );

  return {
    id: result.insertId,
    displayName: trimmedDisplayName,
    hasRegistration: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function setActiveProfile(
  profileId: number | null,
): Promise<void> {
  const db = await getDatabase();

  if (profileId === null) {
    await db.executeSql('DELETE FROM app_state WHERE key = ?;', [
      ACTIVE_PROFILE_KEY,
    ]);
    return;
  }

  await db.executeSql(
    `INSERT INTO app_state (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [ACTIVE_PROFILE_KEY, String(profileId)],
  );

  await db.executeSql('UPDATE profiles SET updated_at = ? WHERE id = ?;', [
    Date.now(),
    profileId,
  ]);
}

export async function getActiveProfileId(): Promise<number | null> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    'SELECT value FROM app_state WHERE key = ? LIMIT 1;',
    [ACTIVE_PROFILE_KEY],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const rawValue = result.rows.item(0).value as string | null;

  if (!rawValue) {
    return null;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export async function getRegistrationForProfile(
  profileId: number,
): Promise<StoredRegistration | null> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    'SELECT registration_json FROM profiles WHERE id = ? LIMIT 1;',
    [profileId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const registrationJson = result.rows.item(0).registration_json as
    | string
    | null;

  if (!registrationJson) {
    return null;
  }

  return JSON.parse(registrationJson) as StoredRegistration;
}

export async function saveRegistrationForProfile(
  profileId: number,
  registration: StoredRegistration,
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    'UPDATE profiles SET registration_json = ?, updated_at = ? WHERE id = ?;',
    [JSON.stringify(registration), Date.now(), profileId],
  );
}

export async function clearRegistrationForProfile(
  profileId: number,
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    'UPDATE profiles SET registration_json = NULL, updated_at = ? WHERE id = ?;',
    [Date.now(), profileId],
  );
}
