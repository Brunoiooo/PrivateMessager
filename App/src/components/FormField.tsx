import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

type FormFieldProps = TextInputProps & {
  label: string;
  errorMessage?: string;
};

export function FormField({
  label,
  style,
  errorMessage,
  ...props
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, errorMessage ? styles.inputError : null, style]}
        placeholderTextColor="#6B7280"
      />
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
