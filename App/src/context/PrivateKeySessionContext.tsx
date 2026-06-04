import React, {
  useCallback,
  createContext,
  ReactNode,
  useEffect,
  useContext,
  useMemo,
  useState,
} from 'react';
import { AppState, StyleSheet, View } from 'react-native';

const AUTO_LOCK_AFTER_MS = 5 * 60 * 1000;
const AUTO_LOCK_CHECK_INTERVAL_MS = 5000;

type PrivateKeySessionContextValue = {
  unlockedPrivateKeyPem: string;
  setUnlockedPrivateKeyPem: (privateKeyPem: string) => void;
  clearUnlockedPrivateKeyPem: () => void;
  markSessionActivity: () => void;
  lastAutoLockAt: number | null;
};

const PrivateKeySessionContext =
  createContext<PrivateKeySessionContextValue | null>(null);

type PrivateKeySessionProviderProps = {
  children: ReactNode;
};

export function PrivateKeySessionProvider({
  children,
}: PrivateKeySessionProviderProps) {
  const [unlockedPrivateKeyPem, setUnlockedPrivateKeyPem] = useState('');
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);
  const [lastAutoLockAt, setLastAutoLockAt] = useState<number | null>(null);

  const clearUnlockedPrivateKeyPem = useCallback(() => {
    setUnlockedPrivateKeyPem('');
    setLastActivityAt(null);
  }, []);

  const markSessionActivity = useCallback(() => {
    setLastActivityAt(currentLastActivityAt => {
      if (!unlockedPrivateKeyPem || currentLastActivityAt === null) {
        return currentLastActivityAt;
      }

      return Date.now();
    });
  }, [unlockedPrivateKeyPem]);

  const upsertUnlockedPrivateKeyPem = useCallback((privateKeyPem: string) => {
    setUnlockedPrivateKeyPem(privateKeyPem);

    if (privateKeyPem) {
      setLastActivityAt(Date.now());
      setLastAutoLockAt(null);
      return;
    }

    setLastActivityAt(null);
  }, []);

  const evaluateAutoLock = useCallback(() => {
    setLastActivityAt(currentLastActivityAt => {
      if (!currentLastActivityAt) {
        return currentLastActivityAt;
      }

      if (Date.now() - currentLastActivityAt < AUTO_LOCK_AFTER_MS) {
        return currentLastActivityAt;
      }

      setUnlockedPrivateKeyPem('');
      setLastAutoLockAt(Date.now());
      return null;
    });
  }, []);

  useEffect(() => {
    if (!unlockedPrivateKeyPem || !lastActivityAt) {
      return;
    }

    const intervalId = setInterval(
      evaluateAutoLock,
      AUTO_LOCK_CHECK_INTERVAL_MS,
    );

    return () => clearInterval(intervalId);
  }, [evaluateAutoLock, lastActivityAt, unlockedPrivateKeyPem]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState !== 'active') {
          return;
        }

        evaluateAutoLock();
      },
    );

    return () => {
      appStateSubscription.remove();
    };
  }, [evaluateAutoLock]);

  const value = useMemo<PrivateKeySessionContextValue>(
    () => ({
      unlockedPrivateKeyPem,
      setUnlockedPrivateKeyPem: upsertUnlockedPrivateKeyPem,
      clearUnlockedPrivateKeyPem,
      markSessionActivity,
      lastAutoLockAt,
    }),
    [
      clearUnlockedPrivateKeyPem,
      lastAutoLockAt,
      markSessionActivity,
      unlockedPrivateKeyPem,
      upsertUnlockedPrivateKeyPem,
    ],
  );

  return (
    <PrivateKeySessionContext.Provider value={value}>
      {children}
    </PrivateKeySessionContext.Provider>
  );
}

export function usePrivateKeySession(): PrivateKeySessionContextValue {
  const context = useContext(PrivateKeySessionContext);

  if (!context) {
    throw new Error(
      'usePrivateKeySession must be used inside PrivateKeySessionProvider.',
    );
  }

  return context;
}

type PrivateKeySessionActivityBoundaryProps = {
  children: ReactNode;
};

export function PrivateKeySessionActivityBoundary({
  children,
}: PrivateKeySessionActivityBoundaryProps) {
  const { markSessionActivity } = usePrivateKeySession();

  return (
    <View style={styles.flex} onTouchStart={markSessionActivity}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
