import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '../components/ActionButton';
import { LocalConversationMessage, PublicKeyProfile } from '../types/messaging';

type VisibleConversationMessage = LocalConversationMessage & {
  fromMe: boolean;
};

type ConversationPageProps = {
  peer: PublicKeyProfile;
  messages: VisibleConversationMessage[];
  composerText: string;
  onComposerTextChange: (value: string) => void;
  onBack: () => void;
  onSend: () => void;
  busy: boolean;
};

function getInitials(userName: string): string {
  const chunks = userName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(chunk => chunk.charAt(0).toUpperCase());

  return chunks.length > 0 ? chunks.join('') : userName.slice(0, 2).toUpperCase();
}

export function ConversationPage({
  peer,
  messages,
  composerText,
  onComposerTextChange,
  onBack,
  onSend,
  busy,
}: ConversationPageProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.shell}>
      <View style={styles.backgroundGlowLeft} />
      <View style={styles.backgroundGlowRight} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={onBack}
            hitSlop={8}
          >
            <Text style={styles.backArrow}>{'←'}</Text>
            <Text style={styles.backLabel}>Wróć</Text>
          </Pressable>

          <View style={styles.headerPeerInfo}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {getInitials(peer.userName)}
              </Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {peer.userName}#{peer.userTag}
              </Text>
              <Text style={styles.headerSubtitle}>Konwersacja</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.messagesScroll}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: 8 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyHint}>
                Brak wiadomości. Napisz pierwszą!
              </Text>
            </View>
          ) : (
            messages.map(message => (
              <View
                key={message.messageHash}
                style={[
                  styles.messageBubble,
                  message.fromMe ? styles.myBubble : styles.theirBubble,
                ]}
              >
                <Text style={styles.messageMeta}>
                  {message.fromMe ? 'Ty' : peer.userName} •{' '}
                  {new Date(message.createdAt).toLocaleString()}
                </Text>
                <Text style={styles.messageText}>
                  {message.plaintext ??
                    '[Nie udalo sie odszyfrowac wiadomosci]'}
                </Text>
              </View>
            ))
          )}
        </ScrollView>

        <View
          style={[
            styles.composerBar,
            {
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <TextInput
            style={styles.composerInput}
            value={composerText}
            onChangeText={onComposerTextChange}
            placeholder="Napisz wiadomosc..."
            placeholderTextColor="#64748B"
            multiline
          />
          <ActionButton
            label="Wyslij"
            onPress={onSend}
            disabled={!composerText.trim() || busy}
            isLoading={busy}
          />
        </View>
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
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  backgroundGlowRight: {
    position: 'absolute',
    top: 80,
    right: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(244, 114, 182, 0.16)',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(8, 17, 31, 0.96)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backArrow: {
    color: '#7DD3FC',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  backLabel: {
    color: '#7DD3FC',
    fontSize: 13,
    fontWeight: '600',
  },
  headerPeerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.45)',
  },
  headerAvatarText: {
    color: '#EFF6FF',
    fontSize: 13,
    fontWeight: '800',
  },
  headerMeta: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '600',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  emptyState: {
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyHint: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },
  messageBubble: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  myBubble: {
    backgroundColor: 'rgba(14, 116, 144, 0.25)',
    borderColor: 'rgba(125, 211, 252, 0.25)',
    marginLeft: 32,
  },
  theirBubble: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderColor: 'rgba(148, 163, 184, 0.2)',
    marginRight: 32,
  },
  messageMeta: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '700',
  },
  messageText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
  },
  composerBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    paddingTop: 10,
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: 'rgba(10, 18, 35, 0.98)',
  },
  composerInput: {
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    backgroundColor: '#0F172A',
    fontSize: 15,
  },
});
