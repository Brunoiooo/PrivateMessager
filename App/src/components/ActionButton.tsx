import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
};

const buttonStyles: Record<
  NonNullable<ActionButtonProps['variant']>,
  ViewStyle
> = {
  primary: {
    backgroundColor: '#F8FAFC',
  },
  secondary: {
    backgroundColor: '#1D4ED8',
  },
  danger: {
    backgroundColor: '#7F1D1D',
  },
};

const buttonTextStyles: Record<
  NonNullable<ActionButtonProps['variant']>,
  TextStyle
> = {
  primary: {
    color: '#08111F',
  },
  secondary: {
    color: '#F8FAFC',
  },
  danger: {
    color: '#FEE2E2',
  },
};

export function ActionButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
  isLoading,
}: ActionButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        buttonStyles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, buttonTextStyles[variant]]}>
        {isLoading ? 'Przetwarzanie...' : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.65,
  },
  text: {
    fontWeight: '800',
    fontSize: 15,
  },
});
