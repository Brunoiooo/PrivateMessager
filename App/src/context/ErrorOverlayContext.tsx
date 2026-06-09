import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Modal, StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ErrorType = 'error' | 'warning' | 'info';

export type AppError = {
  message: string;
  code?: string;
  details?: string;
  timestamp: number;
};

type ErrorOverlayContextValue = {
  isDeveloperMode: boolean;
  setIsDeveloperMode: (enabled: boolean) => void;
  showError: (message: string, code?: string, details?: string) => void;
  showErrorFromException: (error: unknown) => void;
  clearError: () => void;
  error: AppError | null;
};

const ErrorOverlayContext = createContext<ErrorOverlayContextValue | null>(null);
const DEV_MODE_KEY = '@messager_dev_mode';

type ErrorOverlayProviderProps = {
  children: ReactNode;
};

export function ErrorOverlayProvider({ children }: ErrorOverlayProviderProps) {
  const [error, setError] = useState<AppError | null>(null);
  const [isDeveloperMode, setIsDeveloperModeState] = useState(false);

  const setIsDeveloperMode = useCallback(async (enabled: boolean) => {
    setIsDeveloperModeState(enabled);
    try {
      await AsyncStorage.setItem(DEV_MODE_KEY, JSON.stringify(enabled));
    } catch (e) {
      console.error('Failed to save developer mode preference:', e);
    }
  }, []);

  const showError = useCallback(
    (message: string, code?: string, details?: string) => {
      setError({
        message,
        code,
        details,
        timestamp: Date.now(),
      });
    },
    []
  );

  const showErrorFromException = useCallback((error: unknown) => {
    let message = 'Nieznany błąd';
    let code: string | undefined;
    let details: string | undefined;

    if (error instanceof Error) {
      message = error.message;
      details = error.stack;
      if ('code' in error && typeof error.code === 'string') {
        code = error.code;
      }
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String(error.message);
      if ('code' in error) {
        code = String(error.code);
      }
      if ('details' in error) {
        details = String(error.details);
      }
    }

    showError(message, code, details);
  }, [showError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      isDeveloperMode,
      setIsDeveloperMode,
      showError,
      showErrorFromException,
      clearError,
      error,
    }),
    [isDeveloperMode, setIsDeveloperMode, showError, showErrorFromException, clearError, error]
  );

  return (
    <ErrorOverlayContext.Provider value={value}>
      <View style={styles.container}>
        {children}
        {error && <ErrorModal error={error} isDeveloperMode={isDeveloperMode} onClose={clearError} />}
      </View>
    </ErrorOverlayContext.Provider>
  );
}

type ErrorModalProps = {
  error: AppError;
  isDeveloperMode: boolean;
  onClose: () => void;
};

function ErrorModal({ error, isDeveloperMode, onClose }: ErrorModalProps) {
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>⚠️ Błąd</Text>
            {error.code && (
              <Text style={styles.code}>{error.code}</Text>
            )}
          </View>

          <Text style={styles.message}>{error.message}</Text>

          {isDeveloperMode && error.details && (
            <View style={styles.detailsContainer}>
              <Text style={styles.detailsLabel}>Developer Details:</Text>
              <ScrollView style={styles.detailsScroll}>
                <Text style={styles.detailsText}>{error.details}</Text>
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function useError() {
  const context = useContext(ErrorOverlayContext);

  if (!context) {
    throw new Error('useError must be used within ErrorOverlayProvider.');
  }

  return context;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 17, 31, 0.7)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(8, 17, 31, 0.95)',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#FCA5A5',
    fontSize: 18,
    fontWeight: '700',
  },
  code: {
    color: '#FB7185',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  message: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 12,
    gap: 8,
  },
  detailsLabel: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsScroll: {
    maxHeight: 200,
  },
  detailsText: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
  button: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
});
