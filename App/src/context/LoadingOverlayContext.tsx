import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

type LoadingOverlayContextValue = {
  isLoading: boolean;
  message: string;
  showLoading: (message: string) => void;
  hideLoading: () => void;
  runWithLoading: <T>(message: string, action: () => Promise<T>) => Promise<T>;
};

const LoadingOverlayContext = createContext<LoadingOverlayContextValue | null>(
  null,
);

type LoadingOverlayProviderProps = {
  children: ReactNode;
};

export function LoadingOverlayProvider({
  children,
}: LoadingOverlayProviderProps) {
  const [message, setMessage] = useState('');

  const showLoading = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
  }, []);

  const hideLoading = useCallback(() => {
    setMessage('');
  }, []);

  const runWithLoading = useCallback(
    async <T,>(nextMessage: string, action: () => Promise<T>) => {
      showLoading(nextMessage);
      await waitForOverlayFrame();

      try {
        return await action();
      } finally {
        hideLoading();
      }
    },
    [hideLoading, showLoading],
  );

  const value = useMemo(
    () => ({
      isLoading: Boolean(message),
      message,
      showLoading,
      hideLoading,
      runWithLoading,
    }),
    [hideLoading, message, runWithLoading, showLoading],
  );

  return (
    <LoadingOverlayContext.Provider value={value}>
      <View style={styles.container}>
        {children}
        <Modal
          transparent
          visible={value.isLoading}
          animationType="fade"
          statusBarTranslucent
        >
          <View style={styles.overlay}>
            <View style={styles.card}>
              <ActivityIndicator color="#F8FAFC" size="large" />
              <Text style={styles.message}>{value.message}</Text>
            </View>
          </View>
        </Modal>
      </View>
    </LoadingOverlayContext.Provider>
  );
}

function waitForOverlayFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

export function useLoadingOverlay() {
  const context = useContext(LoadingOverlayContext);

  if (!context) {
    throw new Error(
      'useLoadingOverlay must be used within LoadingOverlayProvider.',
    );
  }

  return context;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 17, 31, 0.52)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(248, 250, 252, 0.2)',
    backgroundColor: 'rgba(8, 17, 31, 0.86)',
  },
  message: {
    color: '#F8FAFC',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
});
