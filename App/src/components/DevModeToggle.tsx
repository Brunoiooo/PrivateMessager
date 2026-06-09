import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useError } from '../context/ErrorOverlayContext';

const DEV_MODE_KEY = '@messager_dev_mode';

export function DevModeToggle() {
  const { isDeveloperMode, setIsDeveloperMode } = useError();
  const [pressCount, setPressCount] = useState(0);
  const [lastPressTime, setLastPressTime] = useState(0);

  useEffect(() => {
    loadDevMode();
  }, []);

  async function loadDevMode() {
    try {
      const stored = await AsyncStorage.getItem(DEV_MODE_KEY);
      if (stored !== null) {
        setIsDeveloperMode(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load dev mode:', e);
    }
  }

  function handleVersionPress() {
    const now = Date.now();
    if (now - lastPressTime > 1000) {
      setPressCount(1);
    } else {
      setPressCount(pressCount + 1);
    }
    setLastPressTime(now);

    if (pressCount >= 6) {
      setIsDeveloperMode(!isDeveloperMode);
      setPressCount(0);
    }
  }

  return (
    <TouchableOpacity
      style={[styles.container, isDeveloperMode && styles.containerActive]}
      onPress={handleVersionPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={styles.label}>v1.0.0</Text>
        {isDeveloperMode && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>DEV</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(125, 211, 252, 0.1)',
  },
  containerActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.5)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.6)',
  },
  badgeText: {
    color: '#86EFAC',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
