import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LocalProfile } from '../types/profile';
import { ActionButton } from './ActionButton';

type ProfilePickerProps = {
  profiles: LocalProfile[];
  activeProfileId: number | null;
  onSelectProfile: (profileId: number) => void;
};

export function ProfilePicker({
  profiles,
  activeProfileId,
  onSelectProfile,
}: ProfilePickerProps) {
  if (profiles.length === 0) {
    return (
      <Text style={styles.emptyText}>
        Brak profili. Utwórz pierwszy profil, aby zacząć.
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {profiles.map(profile => (
        <View key={profile.id} style={styles.row}>
          <View style={styles.meta}>
            <Text style={styles.name}>{profile.displayName}</Text>
            <Text style={styles.details}>
              {profile.hasRegistration ? 'ma klucz lokalny' : 'bez rejestracji'}
            </Text>
          </View>
          <View style={styles.action}>
            <ActionButton
              label={activeProfileId === profile.id ? 'Aktywny' : 'Wybierz'}
              onPress={() => onSelectProfile(profile.id)}
              variant={activeProfileId === profile.id ? 'primary' : 'secondary'}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    padding: 12,
    gap: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  meta: {
    gap: 4,
  },
  name: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 14,
  },
  details: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  action: {
    marginTop: 4,
  },
  emptyText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
  },
});
