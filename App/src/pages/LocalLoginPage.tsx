import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { AuthCard } from '../components/AuthCard';
import { FormField } from '../components/FormField';
import { ScreenShell } from '../components/ScreenShell';
import { useLoadingOverlay } from '../context/LoadingOverlayContext';
import { usePrivateKeySession } from '../context/PrivateKeySessionContext';
import { decryptPrivateKey } from '../services/registrationCrypto';
import { LocalProfile } from '../types/profile';
import { StoredRegistration } from '../types/registration';

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
  const { isLoading, runWithLoading, showLoading } = useLoadingOverlay();
  const { unlockedPrivateKeyPem, setUnlockedPrivateKeyPem, lastAutoLockAt } =
    usePrivateKeySession();
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState(
    'Wpisz PIN, żeby odszyfrować zapisany lokalnie klucz prywatny.',
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [pinError, setPinError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);

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
      'Sesja lokalnego klucza wygasła po bezczynności. Wpisz PIN ponownie.',
    );
  }, [lastAutoLockAt]);

  async function handleUnlock() {
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
        const privateKeyPem = decryptPrivateKey(
          savedRegistration.privateKey,
          pin,
        );

        setUnlockedPrivateKeyPem(privateKeyPem);
        setStatus('Klucz odszyfrowany. Trwa logowanie do API (JWT)...');
        showLoading('Logowanie do API (JWT)...');
        await onAuthenticated(privateKeyPem);
      });

      setStatus('Zalogowano do API.');
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

  return (
    <ScreenShell
      kicker="Messager"
      title="Lokalne logowanie"
      subtitle="Ten ekran odszyfrowuje zapisany prywatny klucz PIN-em bez wysyłania go na serwer."
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
            Nie znaleziono zapisanego zestawu kluczy. Najpierw zarejestruj
            konto.
          </Text>
        )}

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
          onPress={() => void handleUnlock()}
          variant="primary"
          disabled={isProcessing || isLoading || !savedRegistration}
        />

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
});
