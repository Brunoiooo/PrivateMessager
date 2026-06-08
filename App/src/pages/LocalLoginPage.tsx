import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { AuthCard } from '../components/AuthCard';
import { FormField } from '../components/FormField';
import { ScreenShell } from '../components/ScreenShell';
import { useLoadingOverlay } from '../context/LoadingOverlayContext';
import { usePrivateKeySession } from '../context/PrivateKeySessionContext';
import {
  BiometryType,
  isBiometricAvailable,
  isBiometricEnabled,
  unlockWithBiometrics,
} from '../services/biometricAuth';
import { decryptPrivateKey } from '../services/registrationCrypto';
import { LocalProfile } from '../types/profile';
import { StoredRegistration } from '../types/registration';

const MAX_BIOMETRIC_ATTEMPTS = 5;

type LocalLoginPageProps = {
  activeProfile: LocalProfile | null;
  savedRegistration: StoredRegistration | null;
  onBackToRegistration: () => void;
  onForgetSavedRegistration: () => Promise<void>;
  onAuthenticated: (privateKeyPem: string) => Promise<void>;
};

export function LocalLoginPage({
  activeProfile,
  savedRegistration,
  onBackToRegistration,
  onForgetSavedRegistration,
  onAuthenticated,
}: LocalLoginPageProps) {
  const { isLoading, runWithLoading, showLoading, hideLoading } = useLoadingOverlay();
  const { unlockedPrivateKeyPem, setUnlockedPrivateKeyPem, lastAutoLockAt } =
    usePrivateKeySession();
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState(
    'Wpisz PIN, żeby odszyfrować zapisany lokalnie klucz prywatny.',
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [pinError, setPinError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [biometryType, setBiometryType] = useState<BiometryType>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showPinForm, setShowPinForm] = useState(false);
  const biometricAttemptsRef = useRef(0);

  useEffect(() => {
    void (async () => {
      const [type, enabled] = await Promise.all([
        isBiometricAvailable(),
        isBiometricEnabled(),
      ]);
      setBiometryType(type);
      setBiometricEnabled(enabled);

      if (enabled && type) {
        void handleBiometricUnlock();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!savedRegistration) {
      setStatus('Brak zapisanego zestawu. Wróć do rejestracji.');
    }
  }, [savedRegistration]);

  useEffect(() => {
    if (!lastAutoLockAt) {
      return;
    }

    setStatus(
      'Sesja lokalnego klucza wygasła po bezczynności. Zaloguj się ponownie.',
    );

    if (biometricEnabled && biometryType) {
      void handleBiometricUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAutoLockAt]);

  async function handleBiometricUnlock() {
    if (!savedRegistration || isProcessing || isLoading) {
      return;
    }

    if (biometricAttemptsRef.current >= MAX_BIOMETRIC_ATTEMPTS) {
      setShowPinForm(true);
      setStatus('Zbyt wiele nieudanych prób biometrii. Użyj PIN-u.');
      return;
    }

    setIsProcessing(true);

    try {
      const biometricLabel = biometryTypeName(biometryType);
      setStatus(`Oczekiwanie na ${biometricLabel}...`);

      const privateKeyPem = await unlockWithBiometrics(
        `Odblokuj Messager (${biometricLabel})`,
      );

      if (!privateKeyPem) {
        biometricAttemptsRef.current += 1;

        if (biometricAttemptsRef.current >= MAX_BIOMETRIC_ATTEMPTS) {
          setShowPinForm(true);
          setStatus('Zbyt wiele nieudanych prób. Użyj PIN-u.');
        } else {
          setStatus('Biometria anulowana. Spróbuj ponownie lub użyj PIN-u.');
        }

        return;
      }

      biometricAttemptsRef.current = 0;
      await finishUnlock(privateKeyPem);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handlePinUnlock() {
    setPinError(undefined);
    setFormError(null);

    if (!savedRegistration) {
      setStatus('Brak zapisanego zestawu. Wróć do rejestracji.');
      return;
    }

    if (!pin) {
      const message = 'Podaj PIN.';
      setPinError(message);
      setStatus(message);
      return;
    }

    if (isProcessing || isLoading) {
      return;
    }

    setIsProcessing(true);

    try {
      await runWithLoading('Odszyfrowywanie klucza...', async () => {
        const privateKeyPem = decryptPrivateKey(savedRegistration.privateKey, pin);
        await finishUnlock(privateKeyPem);
      });
    } catch (error) {
      setUnlockedPrivateKeyPem('');
      const message =
        error instanceof Error
          ? error.message
          : 'Nie udało się odszyfrować klucza.';
      setFormError(message);
      setStatus(message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function finishUnlock(privateKeyPem: string) {
    setUnlockedPrivateKeyPem(privateKeyPem);
    setStatus('Klucz odszyfrowany. Trwa logowanie do API (JWT)...');
    showLoading('Logowanie do API (JWT)...');
    try {
      await onAuthenticated(privateKeyPem);
      setStatus('Zalogowano do API.');
    } finally {
      hideLoading();
    }
  }

  const showBiometricButton =
    biometricEnabled && biometryType && !showPinForm && savedRegistration;

  return (
    <ScreenShell
      kicker="Messager"
      title="Lokalne logowanie"
      subtitle="Ten ekran odszyfrowuje zapisany prywatny klucz bez wysyłania go na serwer."
    >
      <AuthCard>
        <Text style={styles.sectionTitle}>Dostęp do klucza prywatnego</Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Aktywny profil</Text>
          <Text style={styles.monoText}>
            {activeProfile ? activeProfile.displayName : 'brak'}
          </Text>
        </View>

        {savedRegistration ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>User</Text>
            <Text style={styles.monoText}>
              {savedRegistration.userName}#{savedRegistration.userTag}
            </Text>
            <Text style={styles.summaryLabel}>Fingerprint</Text>
            <Text style={styles.monoText}>
              {savedRegistration.fingerprintSha512}
            </Text>
          </View>
        ) : (
          <Text style={styles.statusText}>
            Nie znaleziono zapisanego zestawu kluczy. Najpierw zarejestruj konto.
          </Text>
        )}

        {showBiometricButton ? (
          <>
            <ActionButton
              label={`Odblokuj ${biometryTypeName(biometryType)}`}
              onPress={() => void handleBiometricUnlock()}
              variant="primary"
              disabled={isProcessing || isLoading}
            />
            <TouchableOpacity
              style={styles.pinFallbackLink}
              onPress={() => setShowPinForm(true)}
            >
              <Text style={styles.pinFallbackText}>Użyj PIN-u zamiast tego</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <FormField
              label="PIN"
              value={pin}
              onChangeText={setPin}
              placeholder="PIN"
              secureTextEntry
              autoCapitalize="none"
              errorMessage={pinError}
            />

            {formError ? (
              <Text style={styles.formErrorText}>{formError}</Text>
            ) : null}

            <ActionButton
              label="Odszyfruj klucz"
              onPress={() => void handlePinUnlock()}
              variant="primary"
              disabled={isProcessing || isLoading || !savedRegistration}
            />

            {biometricEnabled && biometryType && (
              <TouchableOpacity
                style={styles.pinFallbackLink}
                onPress={() => {
                  setShowPinForm(false);
                  biometricAttemptsRef.current = 0;
                  void handleBiometricUnlock();
                }}
              >
                <Text style={styles.pinFallbackText}>
                  Użyj {biometryTypeName(biometryType)} zamiast tego
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <ActionButton
          label="Wróć do rejestracji"
          onPress={onBackToRegistration}
          variant="secondary"
          disabled={isProcessing || isLoading}
        />

        <ActionButton
          label="Usuń zapisany zestaw"
          onPress={() => void onForgetSavedRegistration()}
          variant="danger"
          disabled={isProcessing || isLoading}
        />
      </AuthCard>

      <AuthCard>
        <Text style={styles.sectionTitle}>Status</Text>
        <Text style={styles.statusText}>{status}</Text>

        {unlockedPrivateKeyPem ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Prywatny klucz</Text>
            <Text style={styles.privateKeyPreview}>
              {unlockedPrivateKeyPem.slice(0, 240)}...
            </Text>
          </View>
        ) : null}
      </AuthCard>
    </ScreenShell>
  );
}

function biometryTypeName(type: BiometryType): string {
  if (!type) {
    return 'biometrię';
  }

  switch (type) {
    case 'FaceID':
      return 'Face ID';
    case 'TouchID':
      return 'Touch ID';
    case 'Fingerprint':
      return 'odcisk palca';
    default:
      return 'biometrię';
  }
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 21,
  },
  formErrorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    backgroundColor: 'rgba(127, 29, 29, 0.22)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryBox: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.18)',
    gap: 8,
  },
  summaryLabel: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  monoText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  privateKeyPreview: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  pinFallbackLink: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  pinFallbackText: {
    color: '#7DD3FC',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
