import AsyncStorage from '@react-native-async-storage/async-storage';

import { StoredRegistration } from '../types/registration';

const STORAGE_KEY = 'messager.registration.bundle.v1';

export async function loadSavedRegistration(): Promise<StoredRegistration | null> {
  const storedValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  return JSON.parse(storedValue) as StoredRegistration;
}

export async function saveRegistration(
  registration: StoredRegistration,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(registration));
}

export async function clearSavedRegistration(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
