import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { AuthCard } from '../components/AuthCard';
import { FormField } from '../components/FormField';
import { ProfilePicker } from '../components/ProfilePicker';
import { ScreenShell } from '../components/ScreenShell';
import { useLoadingOverlay } from '../context/LoadingOverlayContext';
import { LocalProfile } from '../types/profile';
import { StoredRegistration } from '../types/registration';

type AuthGatewayPageProps = {
  profiles: LocalProfile[];
  activeProfileId: number | null;
  activeProfile: LocalProfile | null;
  savedRegistration: StoredRegistration | null;
  onCreateProfile: (displayName: string) => Promise<void>;
  onSelectProfile: (profileId: number) => Promise<void>;
  onGoToRegistration: () => void;
  onGoToLocalLogin: () => void;
};

export function AuthGatewayPage({
  profiles,
  activeProfileId,
  activeProfile,
  savedRegistration,
  onCreateProfile,
  onSelectProfile,
  onGoToRegistration,
  onGoToLocalLogin,
}: AuthGatewayPageProps) {
  const { isLoading, runWithLoading } = useLoadingOverlay();
  const [newProfileName, setNewProfileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [profileNameError, setProfileNameError] = useState<string | undefined>(
    undefined,
  );
  const [status, setStatus] = useState(
    'Utwórz profil lub wybierz istniejący, aby pracować na lokalnym kluczu.',
  );

  async function handleCreateProfile() {
    setProfileNameError(undefined);

    if (isProcessing || isLoading) {
      return;
    }

    if (!newProfileName.trim()) {
      const message = 'Podaj nazwę profilu.';
      setProfileNameError(message);
      setStatus(message);
      return;
    }

    setIsProcessing(true);

    try {
      await runWithLoading('Tworzenie profilu...', async () => {
        await onCreateProfile(newProfileName);
      });

      setNewProfileName('');
      setStatus('Profil został utworzony i ustawiony jako aktywny.');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Nie udało się utworzyć profilu.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSelectProfile(profileId: number) {
    if (isProcessing || isLoading) {
      return;
    }

    setIsProcessing(true);

    try {
      await runWithLoading('Przełączanie profilu...', async () => {
        await onSelectProfile(profileId);
      });

      setStatus('Przełączono aktywny profil.');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Nie udało się przełączyć profilu.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ScreenShell
      kicker="Messager"
      title="Profile lokalne"
      subtitle="Możesz utworzyć wiele profili i przełączać aktywny profil przed rejestracją lub logowaniem lokalnym."
    >
      <AuthCard>
        <Text style={styles.sectionTitle}>Nowy profil</Text>
        <FormField
          label="Nazwa profilu"
          value={newProfileName}
          onChangeText={setNewProfileName}
          placeholder="np. Telefon prywatny"
          autoCorrect={false}
          errorMessage={profileNameError}
        />
        <ActionButton
          label="Utwórz profil"
          onPress={() => void handleCreateProfile()}
          variant="primary"
          disabled={isProcessing || isLoading}
        />
      </AuthCard>

      <AuthCard>
        <Text style={styles.sectionTitle}>Wybór profilu</Text>
        <ProfilePicker
          profiles={profiles}
          activeProfileId={activeProfileId}
          onSelectProfile={profileId => void handleSelectProfile(profileId)}
        />
      </AuthCard>

      <AuthCard>
        <Text style={styles.sectionTitle}>Start</Text>
        <Text style={styles.statusText}>
          Rejestracja tworzy parę kluczy i zapisuje prywatny klucz zaszyfrowany
          w AsyncStorage. Logowanie lokalne odszyfrowuje go PIN-em.
        </Text>

        <ActionButton
          label="Rejestracja"
          onPress={onGoToRegistration}
          variant="primary"
          disabled={!activeProfile}
        />

        <ActionButton
          label="Lokalne logowanie"
          onPress={onGoToLocalLogin}
          variant="secondary"
          disabled={!activeProfile || !savedRegistration}
        />
      </AuthCard>

      <AuthCard>
        <Text style={styles.sectionTitle}>Aktywny profil</Text>

        {activeProfile ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Profil</Text>
            <Text style={styles.monoText}>{activeProfile.displayName}</Text>
          </View>
        ) : (
          <Text style={styles.statusText}>
            Brak aktywnego profilu. Najpierw utwórz profil i wybierz go.
          </Text>
        )}

        <Text style={styles.sectionTitle}>Zapisany zestaw kluczy</Text>

        {activeProfile && savedRegistration ? (
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
            Aktywny profil nie ma jeszcze lokalnego zestawu kluczy.
          </Text>
        )}

        <Text style={styles.statusText}>{status}</Text>
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
});
