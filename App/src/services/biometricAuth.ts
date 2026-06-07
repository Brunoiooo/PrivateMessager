import * as Keychain from 'react-native-keychain';

const BIOMETRIC_SERVICE = 'messager.biometric.v1';

export type BiometryType = Keychain.BIOMETRY_TYPE | null;

export async function isBiometricAvailable(): Promise<BiometryType> {
  return Keychain.getSupportedBiometryType();
}

export async function isBiometricEnabled(): Promise<boolean> {
  const result = await Keychain.getGenericPassword({
    service: BIOMETRIC_SERVICE,
  });
  return !!result;
}

export async function enableBiometricUnlock(
  privateKeyPem: string,
): Promise<void> {
  await Keychain.setGenericPassword('privateKey', privateKeyPem, {
    service: BIOMETRIC_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    accessControl:
      Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  });
}

export async function disableBiometricUnlock(): Promise<void> {
  await Keychain.resetGenericPassword({ service: BIOMETRIC_SERVICE });
}

export async function unlockWithBiometrics(
  promptTitle: string = 'Odblokuj Messager',
): Promise<string | null> {
  try {
    const result = await Keychain.getGenericPassword({
      service: BIOMETRIC_SERVICE,
      authenticationPrompt: {
        title: promptTitle,
        subtitle: 'Użyj biometrii lub kodu urządzenia',
        cancel: 'Anuluj',
      },
    });

    if (!result) {
      return null;
    }

    return result.password;
  } catch {
    return null;
  }
}
