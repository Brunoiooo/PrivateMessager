import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { AuthCard } from '../components/AuthCard';
import { FormField } from '../components/FormField';
import { ScreenShell } from '../components/ScreenShell';
import { API_BASE_URL } from '../config/env';
import { useLoadingOverlay } from '../context/LoadingOverlayContext';
import { useError } from '../context/ErrorOverlayContext';
import { usePrivateKeySession } from '../context/PrivateKeySessionContext';
import { extractErrorMessage, createUserFriendlyMessage } from '../utils/errorHandler';
import {
  enableBiometricUnlock,
  isBiometricAvailable,
} from '../services/biometricAuth';
import {
  decryptPrivateKey,
  generateRegistrationBundle,
} from '../services/registrationCrypto';
import { LocalProfile } from '../types/profile';
import { StoredRegistration } from '../types/registration';

type RegistrationPageProps = {
  activeProfile: LocalProfile | null;
  savedRegistration: StoredRegistration | null;
  onRegistered: (registration: StoredRegistration) => Promise<void>;
  onGoToLogin: () => void;
};

const KEY_GENERATION_TIMEOUT_MS = 30000;
const API_REGISTER_TIMEOUT_MS = 15000;

type RegistrationFieldErrors = {
  apiBaseUrl?: string;
  userName?: string;
  userTag?: string;
  pin?: string;
  pinConfirm?: string;
};

export function RegistrationPage({
  activeProfile,
  savedRegistration,
  onRegistered,
  onGoToLogin,
}: RegistrationPageProps) {
  const { clearUnlockedPrivateKeyPem } = usePrivateKeySession();
  const { isLoading, runWithLoading, showLoading } = useLoadingOverlay();
  const { showError, isDeveloperMode } = useError();
  const [apiBaseUrl, setApiBaseUrl] = useState(API_BASE_URL);
  const [userName, setUserName] = useState('');
  const [userTag, setUserTag] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [status, setStatus] = useState(
    'Wpisz dane i wygeneruj lokalny zestaw kluczy.',
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingBiometricSetup, setPendingBiometricSetup] = useState<{
    privateKeyPem: string;
    biometryLabel: string;
  } | null>(null);

  function showStatus(message: string) {
    setStatus(message);
  }

  function clearErrors() {
    setFieldErrors({});
    setFormError(null);
  }

  useEffect(() => {
    if (!savedRegistration) {
      return;
    }

    setApiBaseUrl(savedRegistration.apiBaseUrl);
    setUserName(savedRegistration.userName);
    setUserTag(String(savedRegistration.userTag));
    setStatus(
      'Znaleziono zapisany zestaw kluczy. Możesz przejść do lokalnego logowania.',
    );
  }, [savedRegistration]);

  async function handleRegister() {
    if (isProcessing || isLoading) {
      return;
    }

    clearErrors();

    if (!activeProfile) {
      const message = 'Najpierw wybierz aktywny profil.';
      setFormError(message);
      showStatus(message);
      return;
    }

    const trimmedApiBaseUrl = apiBaseUrl.trim().replace(/\/+$/, '');
    const trimmedUserName = userName.trim();
    const trimmedUserTag = Number.parseInt(userTag, 10);

    if (!trimmedApiBaseUrl) {
      const message = 'Podaj adres API.';
      setFieldErrors(previous => ({ ...previous, apiBaseUrl: message }));
      showStatus(message);
      return;
    }

    if (!/^https?:\/\//i.test(trimmedApiBaseUrl)) {
      const message = 'Adres API musi zaczynać się od http:// albo https://.';
      setFieldErrors(previous => ({ ...previous, apiBaseUrl: message }));
      showStatus(message);
      return;
    }

    if (
      !trimmedUserName ||
      trimmedUserName.length < 3 ||
      trimmedUserName.length > 32 ||
      !/^[a-zA-Z0-9_-]+$/.test(trimmedUserName)
    ) {
      const message =
        'UserName musi mieć 3-32 znaki i może zawierać tylko litery, cyfry, _ oraz -.';
      setFieldErrors(previous => ({ ...previous, userName: message }));
      showStatus(message);
      return;
    }

    if (
      !Number.isInteger(trimmedUserTag) ||
      trimmedUserTag <= 0 ||
      trimmedUserTag > 99999
    ) {
      const message = 'UserTag musi być liczbą od 1 do 99999.';
      setFieldErrors(previous => ({ ...previous, userTag: message }));
      showStatus(message);
      return;
    }

    if (!pin || pin.length < 4) {
      const message = 'PIN musi mieć co najmniej 4 znaki.';
      setFieldErrors(previous => ({ ...previous, pin: message }));
      showStatus(message);
      return;
    }

    if (pin !== pinConfirm) {
      const message = 'PIN i potwierdzenie PIN muszą być takie same.';
      setFieldErrors(previous => ({ ...previous, pinConfirm: message }));
      showStatus(message);
      return;
    }

    setIsProcessing(true);
    showStatus('Tworzenie nowego klucza...');

    try {
      let registeredFingerprint = '';

      await runWithLoading('Tworzenie nowego klucza...', async () => {
        const keyGenerationStartedAt = Date.now();

        const registration = await withTimeout(
          generateRegistrationBundle({
            apiBaseUrl: trimmedApiBaseUrl,
            userName: trimmedUserName,
            userTag: trimmedUserTag,
            pin,
          }),
          KEY_GENERATION_TIMEOUT_MS,
          'Generowanie klucza trwa zbyt długo. Spróbuj ponownie lub uruchom aplikację ponownie.',
        );

        const keyGenerationDurationSeconds = (
          (Date.now() - keyGenerationStartedAt) /
          1000
        ).toFixed(1);

        showStatus(`Klucz wygenerowany (${keyGenerationDurationSeconds}s).`);
        showLoading('Rejestrowanie klucza publicznego...');

        const response = await fetchWithTimeout(
          `${trimmedApiBaseUrl}/api/auth/register`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              derBase64: registration.publicKeyDerBase64,
              userName: registration.userName,
              userTag: registration.userTag,
            }),
          },
          API_REGISTER_TIMEOUT_MS,
        );

        const responseJson = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;

        if (!response.ok) {
          throw new Error(
            responseJson?.message ??
              `Rejestracja nie powiodła się (${response.status}).`,
          );
        }

        clearUnlockedPrivateKeyPem();
        await onRegistered(registration);
        registeredFingerprint = registration.fingerprintSha512;

        const biometryType = await isBiometricAvailable();

        if (biometryType) {
          const label =
            biometryType === 'FaceID'
              ? 'Face ID'
              : biometryType === 'TouchID'
                ? 'Touch ID'
                : 'odcisk palca';
          const privateKeyPem = decryptPrivateKey(registration.privateKey, pin);
          setPendingBiometricSetup({ privateKeyPem, biometryLabel: label });
        }
      });

      showStatus(
        `Zarejestrowano konto i zapisano zaszyfrowany klucz prywatny. Fingerprint: ${registeredFingerprint}`,
      );

      if (!pendingBiometricSetup) {
        onGoToLogin();
      }
    } catch (error) {
      const apiError = extractErrorMessage(error);
      const userMessage = isDeveloperMode ? apiError.message : createUserFriendlyMessage(apiError);
      showError(userMessage, apiError.code, isDeveloperMode ? apiError.details : undefined);
      setFormError(userMessage);
      showStatus(userMessage);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ScreenShell
      kicker="Messager"
      title="Rejestracja z własnym kluczem RSA"
      subtitle="Klucz publiczny trafia do API, a prywatny pozostaje lokalnie w bezpiecznym magazynie systemowym."
    >
      <AuthCard>
        <Text style={styles.sectionTitle}>Dane rejestracji</Text>

        <View style={styles.profileSummaryBox}>
          <Text style={styles.summaryLabel}>Aktywny profil</Text>
          <Text style={styles.monoText}>
            {activeProfile ? activeProfile.displayName : 'brak'}
          </Text>
        </View>

        <FormField
          label="Adres API"
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          placeholder={API_BASE_URL}
          autoCapitalize="none"
          autoCorrect={false}
          errorMessage={fieldErrors.apiBaseUrl}
        />

        <FormField
          label="Nazwa użytkownika"
          value={userName}
          onChangeText={setUserName}
          placeholder="jan_kowalski"
          autoCapitalize="none"
          autoCorrect={false}
          errorMessage={fieldErrors.userName}
        />

        <FormField
          label="Tag użytkownika"
          value={userTag}
          onChangeText={setUserTag}
          placeholder="12345"
          keyboardType="number-pad"
          errorMessage={fieldErrors.userTag}
        />

        <FormField
          label="PIN do szyfrowania klucza prywatnego"
          value={pin}
          onChangeText={setPin}
          placeholder="PIN"
          secureTextEntry
          autoCapitalize="none"
          errorMessage={fieldErrors.pin}
        />

        <FormField
          label="Potwierdzenie PIN"
          value={pinConfirm}
          onChangeText={setPinConfirm}
          placeholder="PIN"
          secureTextEntry
          autoCapitalize="none"
          errorMessage={fieldErrors.pinConfirm}
        />

        {formError ? (
          <Text style={styles.formErrorText}>{formError}</Text>
        ) : null}

        <ActionButton
          label="Generuj i zarejestruj"
          onPress={handleRegister}
          disabled={isProcessing || isLoading || !activeProfile}
        />
      </AuthCard>

      <AuthCard>
        <Text style={styles.sectionTitle}>Status</Text>
        <Text style={styles.statusText}>{status}</Text>

        {savedRegistration ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Fingerprint</Text>
            <Text style={styles.monoText}>
              {savedRegistration.fingerprintSha512}
            </Text>

            <Text style={styles.summaryLabel}>Publiczny klucz</Text>
            <Text style={styles.monoText}>
              {savedRegistration.publicKeyDerBase64.slice(0, 64)}...
            </Text>
          </View>
        ) : null}

        <ActionButton
          label="Przejdź do lokalnego logowania"
          onPress={onGoToLogin}
          variant="secondary"
          disabled={!savedRegistration}
        />
      </AuthCard>

      {pendingBiometricSetup ? (
        <AuthCard>
          <Text style={styles.sectionTitle}>
            Włączyć {pendingBiometricSetup.biometryLabel}?
          </Text>
          <Text style={styles.statusText}>
            Możesz odblokować aplikację za pomocą {pendingBiometricSetup.biometryLabel}{' '}
            zamiast wpisywać PIN. Klucz prywatny zostanie zapisany w bezpiecznym
            magazynie sprzętowym systemu. PIN pozostaje jako zapasowa metoda.
          </Text>
          <ActionButton
            label={`Włącz ${pendingBiometricSetup.biometryLabel}`}
            onPress={() => {
              void (async () => {
                if (!pendingBiometricSetup) {
                  return;
                }

                await enableBiometricUnlock(pendingBiometricSetup.privateKeyPem);
                setPendingBiometricSetup(null);
                onGoToLogin();
              })();
            }}
            variant="primary"
          />
          <ActionButton
            label="Nie, tylko PIN"
            onPress={() => {
              setPendingBiometricSetup(null);
              onGoToLogin();
            }}
            variant="secondary"
          />
        </AuthCard>
      ) : null}
    </ScreenShell>
  );
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutErrorMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutErrorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Przekroczono czas oczekiwania na odpowiedź API.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
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
  profileSummaryBox: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
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
});
