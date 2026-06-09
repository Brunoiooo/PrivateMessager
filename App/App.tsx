import 'react-native-get-random-values';

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  PrivateKeySessionActivityBoundary,
  PrivateKeySessionProvider,
  usePrivateKeySession,
} from './src/context/PrivateKeySessionContext';
import { LoadingOverlayProvider } from './src/context/LoadingOverlayContext';
import { ErrorOverlayProvider } from './src/context/ErrorOverlayContext';
import {
  AuthGatewayPage,
  LocalLoginPage,
  MessagingPage,
  RegistrationPage,
  SecuritySettingsPage,
} from './src/pages';
import { loginWithPrivateKey } from './src/services/authApi';
import {
  clearRegistrationForProfile,
  createProfile,
  getActiveProfileId,
  getRegistrationForProfile,
  initializeProfileStore,
  listProfiles,
  saveRegistrationForProfile,
  setActiveProfile,
} from './src/services/profileStore';import { LocalProfile } from './src/types/profile';
import { JwtSession } from './src/types/messaging';
import { StoredRegistration } from './src/types/registration';

type AppPage = 'gateway' | 'registration' | 'login' | 'chat' | 'security-settings';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ErrorOverlayProvider>
        <PrivateKeySessionProvider>
          <LoadingOverlayProvider>
            <PrivateKeySessionActivityBoundary>
              <AppContent />
            </PrivateKeySessionActivityBoundary>
          </LoadingOverlayProvider>
        </PrivateKeySessionProvider>
      </ErrorOverlayProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { clearUnlockedPrivateKeyPem, unlockedPrivateKeyPem } =
    usePrivateKeySession();
  const [page, setPage] = useState<AppPage>('gateway');
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<number | null>(
    null,
  );
  const [activeProfile, setActiveProfileState] = useState<LocalProfile | null>(
    null,
  );
  const [savedRegistration, setSavedRegistration] =
    useState<StoredRegistration | null>(null);
  const [jwtSession, setJwtSession] = useState<JwtSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (page !== 'chat') {
      return;
    }

    if (unlockedPrivateKeyPem) {
      return;
    }

    setJwtSession(null);
    setPage('login');
  }, [page, unlockedPrivateKeyPem]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await initializeProfileStore();
      const [loadedProfiles, loadedActiveProfileId] = await Promise.all([
        listProfiles(),
        getActiveProfileId(),
      ]);

      const loadedRegistration = loadedActiveProfileId
        ? await getRegistrationForProfile(loadedActiveProfileId)
        : null;

      if (cancelled) {
        return;
      }

      setProfiles(loadedProfiles);
      setActiveProfileIdState(loadedActiveProfileId);
      setActiveProfileState(
        loadedProfiles.find(profile => profile.id === loadedActiveProfileId) ??
          null,
      );
      setSavedRegistration(loadedRegistration);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshProfilesAndActiveRegistration(
    explicitActiveProfileId?: number | null,
  ) {
    const [loadedProfiles, loadedActiveProfileId] = await Promise.all([
      listProfiles(),
      explicitActiveProfileId === undefined
        ? getActiveProfileId()
        : Promise.resolve(explicitActiveProfileId),
    ]);

    const loadedRegistration = loadedActiveProfileId
      ? await getRegistrationForProfile(loadedActiveProfileId)
      : null;

    setProfiles(loadedProfiles);
    setActiveProfileIdState(loadedActiveProfileId);
    setActiveProfileState(
      loadedProfiles.find(profile => profile.id === loadedActiveProfileId) ??
        null,
    );
    setSavedRegistration(loadedRegistration);
  }

  async function handleCreateProfile(displayName: string) {
    const createdProfile = await createProfile(displayName);
    await setActiveProfile(createdProfile.id);
    clearUnlockedPrivateKeyPem();
    setJwtSession(null);
    await refreshProfilesAndActiveRegistration(createdProfile.id);
  }

  async function handleSelectProfile(profileId: number) {
    await setActiveProfile(profileId);
    clearUnlockedPrivateKeyPem();
    setJwtSession(null);
    await refreshProfilesAndActiveRegistration(profileId);
  }

  async function handleForgetSavedRegistration() {
    if (!activeProfileId) {
      return;
    }

    await clearRegistrationForProfile(activeProfileId);
    clearUnlockedPrivateKeyPem();
    setJwtSession(null);
    await refreshProfilesAndActiveRegistration(activeProfileId);
    setPage('gateway');
  }

  async function handleLocalLogin(privateKeyPem: string) {
    if (!savedRegistration) {
      throw new Error('Brak zapisanej rejestracji dla aktywnego profilu.');
    }

    const session = await loginWithPrivateKey({
      apiBaseUrl: savedRegistration.apiBaseUrl,
      fingerprintSha512: savedRegistration.fingerprintSha512,
      privateKeyPem,
    });

    setJwtSession(session);
    setPage('chat');
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#F8FAFC" />
      </View>
    );
  }

  if (page === 'gateway') {
    return (
      <AuthGatewayPage
        profiles={profiles}
        activeProfileId={activeProfileId}
        activeProfile={activeProfile}
        savedRegistration={savedRegistration}
        onCreateProfile={handleCreateProfile}
        onSelectProfile={handleSelectProfile}
        onGoToRegistration={() => setPage('registration')}
        onGoToLocalLogin={() => setPage('login')}
      />
    );
  }

  if (page === 'login') {
    return (
      <LocalLoginPage
        activeProfile={activeProfile}
        savedRegistration={savedRegistration}
        onBackToRegistration={() => setPage('gateway')}
        onForgetSavedRegistration={handleForgetSavedRegistration}
        onAuthenticated={handleLocalLogin}
      />
    );
  }

  if (
    page === 'chat' &&
    savedRegistration &&
    jwtSession &&
    unlockedPrivateKeyPem
  ) {
    return (
      <MessagingPage
        savedRegistration={savedRegistration}
        session={jwtSession}
        privateKeyPem={unlockedPrivateKeyPem}
        onLogout={() => {
          setJwtSession(null);
          clearUnlockedPrivateKeyPem();
          setPage('login');
        }}
        onGoToSecuritySettings={() => setPage('security-settings')}
      />
    );
  }

  if (
    page === 'security-settings' &&
    savedRegistration &&
    jwtSession &&
    unlockedPrivateKeyPem
  ) {
    return (
      <SecuritySettingsPage
        savedRegistration={savedRegistration}
        privateKeyPem={unlockedPrivateKeyPem}
        onBack={() => setPage('chat')}
        onPinChanged={async updated => {
          if (!activeProfileId) {
            return;
          }

          await saveRegistrationForProfile(activeProfileId, updated);
          await refreshProfilesAndActiveRegistration(activeProfileId);
        }}
      />
    );
  }

  return (
    <RegistrationPage
      activeProfile={activeProfile}
      savedRegistration={savedRegistration}
      onRegistered={async storedRegistration => {
        if (!activeProfileId) {
          return;
        }

        await saveRegistrationForProfile(activeProfileId, storedRegistration);
        await refreshProfilesAndActiveRegistration(activeProfileId);
        setPage('login');
      }}
      onGoToLogin={() => setPage('login')}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#08111F',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;
