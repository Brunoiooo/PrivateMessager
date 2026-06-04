import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type DropdownMenuItem =
  | {
      type: 'action';
      label: string;
      onPress: () => void;
      variant?: 'default' | 'danger';
      disabled?: boolean;
    }
  | { type: 'info'; label: string; sublabel: string }
  | { type: 'separator' };

type DropdownMenuProps = {
  items: DropdownMenuItem[];
  topOffset?: number;
  children: React.ReactNode;
};

export function DropdownMenu({
  items,
  topOffset = 60,
  children,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable onPress={() => setOpen(v => !v)} hitSlop={8}>
        {children}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: topOffset }]}>
            {items.map((item, i) => {
              if (item.type === 'separator') {
                return <View key={i} style={styles.separator} />;
              }

              if (item.type === 'info') {
                return (
                  <View key={i} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={styles.infoValue}>{item.sublabel}</Text>
                  </View>
                );
              }

              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.actionRow,
                    pressed && styles.actionRowPressed,
                    item.disabled && styles.actionRowDisabled,
                  ]}
                  onPress={() => {
                    if (!item.disabled) {
                      item.onPress();
                      setOpen(false);
                    }
                  }}
                  disabled={item.disabled}
                >
                  <Text
                    style={[
                      styles.actionLabel,
                      item.variant === 'danger' && styles.actionLabelDanger,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menu: {
    position: 'absolute',
    right: 12,
    minWidth: 248,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: 'rgba(8, 14, 32, 0.97)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 28,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    marginHorizontal: 12,
    marginVertical: 2,
  },
  infoRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 3,
  },
  infoLabel: {
    color: '#7DD3FC',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoValue: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionRowPressed: {
    backgroundColor: 'rgba(148, 163, 184, 0.10)',
  },
  actionRowDisabled: {
    opacity: 0.45,
  },
  actionLabel: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  actionLabelDanger: {
    color: '#FCA5A5',
  },
});
