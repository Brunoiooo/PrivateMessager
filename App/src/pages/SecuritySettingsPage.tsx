import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { AuthCard } from '../components/AuthCard';
import { FormField } from '../components/FormField';
import { ScreenShell } from '../components/ScreenShell';
import { useLoadingOverlay } from '../context/LoadingOverlayContext';
import {
  BiometryType,
  disableBiometricUnlock,
  enableBiometricUnlock,
  isBiometricAvailable,
  isBiometricEnabled,
} from '../services/biometricAuth';
import {
  decryptPrivateKey,
  encryptPrivateKey,
} from '../services/registrationCrypto';
import { StoredRegistration } from '../types/registration';

type SecuritySettingsPageProps = {
  savedRegistration: StoredRegistration;
  privateKeyPem: string;
  onBack: () => void;
  onPinChanged: (updated: StoredRegistration) => Promise<void>;
};

export function SecuritySettingsPage({
  savedRegistration,
  privateKeyPem,
  onBack,
  onPinChanged,
}: SecuritySettingsPageProps) {
  const { isLoading, runWithLoading } = useLoadingOverlay();
  const [biometryType, setBiometryType] = useState<BiometryType>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [type, enabled] = await Promise.all([
        isBiometricAvailable(),
        isBiometricEnabled(),
      ]);
      setBiometryType(type);
      setBiometricEnabled(enabled);
    })();
  }, []);

  async function handleToggleBiometric() {
    if (isProcessing || isLoading) {
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      if (biometricEnabled) {
        await disableBiometricUnlock();
        setBiometricEnabled(false);
        setStatusMessage('Odblokowanie biometryczne wyłączone.');
      } else {
        await enableBiometricUnlock(privateKeyPem);
        setBiometricEnabled(true);
        setStatusMessage(`Odblokowanie ${biometryTypeName(biometryType)} włączone.`);
      }
    } catch {
      setStatusMessage('Nie udało się zmienić ustawienia biometrii.');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleChangePin() {
    setPinError(null);
    setPinSuccess(null);

    if (!oldPin) {
      setPinError('Podaj aktualny PIN.');
      return;
    }

    if (!newPin || newPin.length < 4) {
      setPinError('Nowy PIN musi mieć co najmniej 4 znaki.');
      return;
    }

    if (newPin !== newPinConfirm) {
      setPinError('Nowy PIN i potwierdzenie muszą być takie same.');
      return;
    }

    if (isProcessing || isLoading) {
      return;
    }

    setIsProcessing(true);

    try {
      await runWithLoading('Zmiana PIN-u...', async () => {
        const verifiedPem = decryptPrivateKey(savedRegistration.privateKey, oldPin);

        if (verifiedPem !== privateKeyPem) {
          throw new Error('Aktualny PIN jest nieprawidłowy.');
        }

        const newEnvelope = encryptPrivateKey(privateKeyPem, newPin);
        const updated: StoredRegistration = {
          ...savedRegistration,
          privateKey: newEnvelope,
        };

        await onPinChanged(updated);

        if (biometricEnabled) {
          await enableBiometricUnlock(privateKeyPem);
        }

        setOldPin('');
        setNewPin('');
        setNewPinConfirm('');
        setPinSuccess('PIN zmieniony pomyślnie.');
      });
    } catch (error) {
      setPinError(
        error instanceof Error ? error.message : 'Nie udało się zmienić PIN-u.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const biometryLabel = biometryTypeName(biometryType);

  return (
    <ScreenShell
      kicker="Messager"
      title="Ustawienia bezpieczeństwa"
      subtitle="Zarządzaj metodami odblokowywania klucza prywatnego."
    >
      {biometryType ? (
        <AuthCard>
          <Text style={styles.sectionTitle}>Odblokowanie biometryczne</Text>
          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Text style={styles.biometryName}>{biometryLabel}</Text>
              <Text style={styles.biometryStatus}>
                {biometricEnabled ? 'Włączone' : 'Wyłączone'}
              </Text>
            </View>
            <ActionButton
              label={biometricEnabled ? 'Wyłącz' : 'Włącz'}
              onPress={() => void handleToggleBiometric()}
              variant={biometricEnabled ? 'danger' : 'primary'}
              disabled={isProcessing || isLoading}
            />
          </View>
          {statusMessage ? (
            <Text style={styles.statusText}>{statusMessage}</Text>
          ) : null}
        </AuthCard>
      ) : (
        <AuthCard>
          <Text style={styles.sectionTitle}>Odblokowanie biometryczne</Text>
          <Text style={styles.statusText}>
            Biometria nie jest dostępna na tym urządzeniu.
          </Text>
        </AuthCard>
      )}

      <AuthCard>
        <Text style={styles.sectionTitle}>Zmień PIN</Text>

        <FormField
          label="Aktualny PIN"
          value={oldPin}
          onChangeText={setOldPin}
          placeholder="Aktualny PIN"
          secureTextEntry
          autoCapitalize="none"
        />

        <FormField
          label="Nowy PIN"
          value={newPin}
          onChangeText={setNewPin}
          placeholder="Nowy PIN (min. 4 znaki)"
          secureTextEntry
          autoCapitalize="none"
        />

        <FormField
          label="Potwierdź nowy PIN"
          value={newPinConfirm}
          onChangeText={setNewPinConfirm}
          placeholder="Nowy PIN"
          secureTextEntry
          autoCapitalize="none"
        />

        {pinError ? (
          <Text style={styles.errorText}>{pinError}</Text>
        ) : null}

        {pinSuccess ? (
          <Text style={styles.successText}>{pinSuccess}</Text>
        ) : null}

        <ActionButton
          label="Zmień PIN"
          onPress={() => void handleChangePin()}
          variant="primary"
          disabled={isProcessing || isLoading}
        />
      </AuthCard>

      <AuthCard>
        <Text style={styles.sectionTitle}>Sesja</Text>
        <Text style={styles.statusText}>
          Klucz prywatny jest automatycznie blokowany po 5 minutach bezczynności
          lub gdy aplikacja trafia w tło.
        </Text>
      </AuthCard>

      <AuthCard>
        <ActionButton
          label="Wróć"
          onPress={onBack}
          variant="secondary"
          disabled={isProcessing || isLoading}
        />
      </AuthCard>
    </ScreenShell>
  );
}

function biometryTypeName(type: BiometryType): string {
  if (!type) {
    return 'biometria';
  }

  switch (type) {
    case 'FaceID':
      return 'Face ID';
    case 'TouchID':
      return 'Touch ID';
    case 'Fingerprint':
      return 'Odcisk palca';
    default:
      return 'Biometria';
  }
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    gap: 4,
  },
  biometryName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  biometryStatus: {
    color: '#94A3B8',
    fontSize: 13,
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
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
  successText: {
    color: '#86EFAC',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    backgroundColor: 'rgba(20, 83, 45, 0.22)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
