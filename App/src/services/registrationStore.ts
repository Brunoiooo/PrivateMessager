import * as Keychain from 'react-native-keychain';

import { StoredRegistration } from '../types/registration';

const KEYCHAIN_SERVICE = 'messager.registration.v1';

export async function loadSavedRegistration(): Promise<StoredRegistration | null> {
  const result = await Keychain.getGenericPassword({
    service: KEYCHAIN_SERVICE,
  });

  if (!result) {
    return null;
  }

  return JSON.parse(result.password) as StoredRegistration;
}

export async function saveRegistration(
  registration: StoredRegistration,
): Promise<void> {
  await Keychain.setGenericPassword(
    'registration',
    JSON.stringify(registration),
    {
      service: KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
}

export async function clearSavedRegistration(): Promise<void> {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
}
