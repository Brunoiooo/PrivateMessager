import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenShellProps = {
  kicker: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function ScreenShell({
  kicker,
  title,
  subtitle,
  children,
}: ScreenShellProps) {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={styles.shell}>
      <View style={styles.backgroundGlowLeft} />
      <View style={styles.backgroundGlowRight} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: safeAreaInsets.top + 20,
              paddingBottom: safeAreaInsets.bottom + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroCard}>
            <Text style={styles.kicker}>{kicker}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  shell: {
    flex: 1,
    backgroundColor: '#08111F',
  },
  backgroundGlowLeft: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  backgroundGlowRight: {
    position: 'absolute',
    top: 80,
    right: -100,
    width: 200,
    height: 200,
    borderRadius: 200,
    backgroundColor: 'rgba(244, 114, 182, 0.16)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: 'rgba(10, 18, 35, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  kicker: {
    color: '#7DD3FC',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '700',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
  },
});
