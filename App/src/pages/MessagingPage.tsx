import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '../components/ActionButton';
import { AuthCard } from '../components/AuthCard';
import { ConversationPage } from './ConversationPage';
import { DropdownMenu } from '../components/DropdownMenu';
import type { DropdownMenuItem } from '../components/DropdownMenu';
import { FormField } from '../components/FormField';
import { createMessageHash, decryptField } from '../services/chatCrypto';
import {
  decryptWithSignal,
  encryptWithSignal,
  ensureSignalIdentity,
  initSignalProtocol,
} from '../services/signalStore';
import {
  getLastSyncedAtUtc,
  getDatabase,
  initializeChatStore,
  listConversationMessages,
  listConversationPreviews,
  markConversationAsRead,
  markFriend,
  setLastSyncedAtUtc,
  upsertKnownProfiles,
  upsertMessage,
} from '../services/chatStore';
import {
  ackMessage,
  openConversationSocket,
  openSyncSocket,
  searchProfiles,
  sendMessage,
  syncDelta,
} from '../services/messagingApi';
import {
  ConversationPreview,
  JwtSession,
  LocalConversationMessage,
  PublicKeyProfile,
  SyncDelta,
} from '../types/messaging';
import { StoredRegistration } from '../types/registration';
import { usePrivateKeySession } from '../context/PrivateKeySessionContext';
import { useLoadingOverlay } from '../context/LoadingOverlayContext';
import { useError } from '../context/ErrorOverlayContext';
import { extractErrorMessage, createUserFriendlyMessage } from '../utils/errorHandler';

type MessagingPageProps = {
  savedRegistration: StoredRegistration;
  session: JwtSession;
  privateKeyPem: string;
  onLogout: () => void;
  onGoToSecuritySettings: () => void;
};

function getConversationInitials(userName: string): string {
  const chunks = userName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(chunk => chunk.charAt(0).toUpperCase());

  if (chunks.length > 0) {
    return chunks.join('');
  }

  return userName.slice(0, 2).toUpperCase();
}

function toPreviewMessage(
  preview: ConversationPreview,
  ownerFingerprint: string,
): string {
  if (!preview.lastMessageText) {
    return 'Rozpocznij rozmowe';
  }

  const prefix =
    preview.lastMessageFromPublicKey === ownerFingerprint ? 'Ty: ' : '';
  const text = `${prefix}${preview.lastMessageText}`;

  if (text.length <= 64) {
    return text;
  }

  return `${text.slice(0, 61)}...`;
}

function formatPreviewDate(createdAt: string | null): string {
  if (!createdAt) {
    return '';
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isSameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

export function MessagingPage({
  savedRegistration,
  session,
  privateKeyPem,
  onLogout,
  onGoToSecuritySettings,
}: MessagingPageProps) {
  const ownerFingerprint = savedRegistration.fingerprintSha512;
  const insets = useSafeAreaInsets();
  const { storageKey } = usePrivateKeySession();
  const { showError, isDeveloperMode } = useError();
  const { isLoading: busy, runWithLoading } = useLoadingOverlay();

  const [status, setStatus] = useState('Połączono. Możesz wyszukiwać profile.');

  const [searchUserName, setSearchUserName] = useState('');
  const [searchUserTag, setSearchUserTag] = useState('');
  const [searchResults, setSearchResults] = useState<PublicKeyProfile[]>([]);

  const [conversationPreviews, setConversationPreviews] = useState<
    ConversationPreview[]
  >([]);
  const [activePeer, setActivePeer] = useState<PublicKeyProfile | null>(null);
  const [screenMode, setScreenMode] = useState<'inbox' | 'conversation'>(
    'inbox',
  );
  const [activeTab, setActiveTab] = useState<'inbox' | 'search'>('inbox');
  const [conversation, setConversation] = useState<LocalConversationMessage[]>(
    [],
  );
  const [composerText, setComposerText] = useState('');
  const [syncReady, setSyncReady] = useState(false);

  const canSearch = searchUserName.trim().length >= 2;

  const totalUnread = useMemo(
    () => conversationPreviews.reduce((sum, p) => sum + p.unreadCount, 0),
    [conversationPreviews],
  );

  const refreshConversationPreviews = useCallback(async () => {
    const loadedPreviews = await listConversationPreviews(ownerFingerprint, storageKey);
    setConversationPreviews(loadedPreviews);

    setActivePeer(previousPeer => {
      if (!previousPeer) {
        return previousPeer;
      }

      const stillExists = loadedPreviews.find(
        preview =>
          preview.profile.fingerprintSha512 === previousPeer.fingerprintSha512,
      );

      if (!stillExists) {
        return null;
      }

      const nextPeer = stillExists.profile;

      if (
        nextPeer.fingerprintSha512 === previousPeer.fingerprintSha512 &&
        nextPeer.userName === previousPeer.userName &&
        nextPeer.userTag === previousPeer.userTag &&
        nextPeer.publicKeyDerBase64 === previousPeer.publicKeyDerBase64
      ) {
        return previousPeer;
      }

      return nextPeer;
    });
  }, [ownerFingerprint]);

  const loadConversation = useCallback(
    async (peerFingerprint: string) => {
      const messages = await listConversationMessages(
        ownerFingerprint,
        peerFingerprint,
        storageKey,
      );
      setConversation(messages);
    },
    [ownerFingerprint, storageKey],
  );

  const applyDelta = useCallback(
    async (delta: SyncDelta, activePeerFingerprint?: string) => {
      await upsertKnownProfiles(ownerFingerprint, delta.profiles);

      const db = await getDatabase();
      const processedHashes = new Set<string>();

      for (const message of delta.messages) {
        if (processedHashes.has(message.messageHash)) {
          continue;
        }
        processedHashes.add(message.messageHash);

        const peerFingerprint =
          message.fromPublicKey === ownerFingerprint
            ? message.toPublicKey
            : message.fromPublicKey;

        let plaintext: string | null = null;

        if (message.toPublicKey === ownerFingerprint) {
          await markFriend(ownerFingerprint, message.fromPublicKey);

          if (message.signalMessageType != null) {
            const [existing] = await db.executeSql(
              'SELECT plaintext FROM messages_local WHERE owner_fingerprint = ? AND message_hash = ? LIMIT 1;',
              [ownerFingerprint, message.messageHash],
            );

            if (existing.rows.length > 0) {
              const row = existing.rows.item(0) as { plaintext: string | null };
              plaintext = row.plaintext
                ? (storageKey ? decryptField(row.plaintext, storageKey) : row.plaintext) ?? null
                : null;
            } else {
              plaintext = await decryptWithSignal(
                message.encryptedContentBase64,
                message.signalMessageType,
                ownerFingerprint,
                peerFingerprint,
              );
            }
          }
        }

        await upsertMessage({
          ownerFingerprint,
          messageHash: message.messageHash,
          peerFingerprint,
          fromPublicKey: message.fromPublicKey,
          toPublicKey: message.toPublicKey,
          encryptedContentBase64: message.encryptedContentBase64,
          plaintext,
          createdAt: message.createdAt,
          storageKey,
          signalMessageType: message.signalMessageType,
        });

        if (message.toPublicKey === ownerFingerprint) {
          void ackMessage({
            apiBaseUrl: savedRegistration.apiBaseUrl,
            token: session.token,
            messageHash: message.messageHash,
          });
        }
      }

      await setLastSyncedAtUtc(ownerFingerprint, delta.serverTimeUtc);
      await refreshConversationPreviews();

      if (activePeerFingerprint) {
        await loadConversation(activePeerFingerprint);
      }
    },
    [
      loadConversation,
      ownerFingerprint,
      refreshConversationPreviews,
      savedRegistration.apiBaseUrl,
      session.token,
      storageKey,
    ],
  );

  const runSync = useCallback(
    async (activePeerFingerprint?: string) => {
      const lastSyncedAtUtc = await getLastSyncedAtUtc(ownerFingerprint);

      const delta = await syncDelta({
        apiBaseUrl: savedRegistration.apiBaseUrl,
        token: session.token,
        since: lastSyncedAtUtc ?? undefined,
        limit: 700,
      });

      await applyDelta(delta, activePeerFingerprint);
    },
    [applyDelta, ownerFingerprint, savedRegistration.apiBaseUrl, session.token],
  );

  useEffect(() => {
    let cancelled = false;

    initSignalProtocol();

    initializeChatStore()
      .then(() => ensureSignalIdentity(
        ownerFingerprint,
        savedRegistration.apiBaseUrl,
        session.token,
      ))
      .then(() => refreshConversationPreviews())
      .then(() => runSync())
      .then(() => {
        if (!cancelled) {
          setSyncReady(true);
          setStatus('Synchronizacja zakończona.');
        }
      })
      .catch(error => {
        if (!cancelled) {
          const apiError = extractErrorMessage(error);
          const userMessage = isDeveloperMode ? apiError.message : createUserFriendlyMessage(apiError);
          showError(userMessage, apiError.code, isDeveloperMode ? apiError.details : undefined);
          setStatus(userMessage);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSyncReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshConversationPreviews, runSync]);

  useEffect(() => {
    if (!syncReady) {
      return;
    }

    let closed = false;
    let subscription: { close: () => void } | null = null;

    void (async () => {
      const lastSyncedAtUtc = await getLastSyncedAtUtc(ownerFingerprint);

      if (closed) {
        return;
      }

      const handleDelta = (delta: SyncDelta) => {
        const conversationFingerprint =
          screenMode === 'conversation'
            ? activePeer?.fingerprintSha512
            : undefined;

        void applyDelta(delta, conversationFingerprint).catch(error => {
          if (!closed) {
            const apiError = extractErrorMessage(error);
            const userMessage = isDeveloperMode ? apiError.message : createUserFriendlyMessage(apiError);
            showError(userMessage, apiError.code, isDeveloperMode ? apiError.details : undefined);
            setStatus(userMessage);
          }
        });
      };

      const handleError = (error: Error) => {
        if (!closed) {
          const apiError = extractErrorMessage(error);
          const userMessage = isDeveloperMode ? apiError.message : createUserFriendlyMessage(apiError);
          showError(userMessage, apiError.code, isDeveloperMode ? apiError.details : undefined);
          setStatus(userMessage);
        }
      };

      if (screenMode === 'conversation' && activePeer) {
        subscription = openConversationSocket({
          apiBaseUrl: savedRegistration.apiBaseUrl,
          token: session.token,
          peerFingerprint: activePeer.fingerprintSha512,
          since: lastSyncedAtUtc ?? undefined,
          onDelta: handleDelta,
          onError: handleError,
        });
        return;
      }

      subscription = openSyncSocket({
        apiBaseUrl: savedRegistration.apiBaseUrl,
        token: session.token,
        since: lastSyncedAtUtc ?? undefined,
        onDelta: handleDelta,
        onError: handleError,
      });
    })();

    return () => {
      closed = true;
      subscription?.close();
    };
  }, [
    activePeer,
    applyDelta,
    ownerFingerprint,
    savedRegistration.apiBaseUrl,
    screenMode,
    session.token,
    syncReady,
  ]);

  useEffect(() => {
    if (!activePeer || screenMode !== 'conversation') {
      setConversation([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await loadConversation(activePeer.fingerprintSha512);
        await markConversationAsRead(
          ownerFingerprint,
          activePeer.fingerprintSha512,
        );
        await refreshConversationPreviews();
      } catch {
        if (!cancelled) {
          setConversation([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activePeer,
    loadConversation,
    ownerFingerprint,
    refreshConversationPreviews,
    screenMode,
  ]);

  const openConversation = useCallback((peer: PublicKeyProfile) => {
    setActivePeer(peer);
    setScreenMode('conversation');
  }, []);

  async function handleSync() {
    if (busy) {
      return;
    }

    try {
      await runWithLoading('Synchronizuję nowe wiadomości i klucze...', () =>
        runSync(
          screenMode === 'conversation'
            ? activePeer?.fingerprintSha512
            : undefined,
        ),
      );
      setStatus('Synchronizacja zakończona.');
    } catch (error) {
      const apiError = extractErrorMessage(error);
      const userMessage = isDeveloperMode ? apiError.message : createUserFriendlyMessage(apiError);
      showError(userMessage, apiError.code, isDeveloperMode ? apiError.details : undefined);
      setStatus(userMessage);
    }
  }

  async function handleSearch() {
    if (!canSearch || busy) {
      return;
    }

    try {
      await runWithLoading('Szukam profili...', async () => {
        const parsedTag = Number.parseInt(searchUserTag, 10);
        const results = await searchProfiles({
          apiBaseUrl: savedRegistration.apiBaseUrl,
          token: session.token,
          userName: searchUserName.trim(),
          userTag: Number.isInteger(parsedTag) ? parsedTag : undefined,
        });

        const filtered = results.filter(
          result => result.fingerprintSha512 !== ownerFingerprint,
        );

        setSearchResults(filtered);
        await upsertKnownProfiles(ownerFingerprint, filtered);
        await refreshConversationPreviews();
        setStatus(`Znaleziono ${filtered.length} profili.`);
      });
    } catch (error) {
      const apiError = extractErrorMessage(error);
      const userMessage = isDeveloperMode ? apiError.message : createUserFriendlyMessage(apiError);
      showError(userMessage, apiError.code, isDeveloperMode ? apiError.details : undefined);
      setStatus(userMessage);
    }
  }

  async function handleAddFriendAndSend(peer: PublicKeyProfile) {
    const trimmedMessage = composerText.trim();

    if (!trimmedMessage) {
      await markFriend(ownerFingerprint, peer.fingerprintSha512);
      await refreshConversationPreviews();
      openConversation(peer);
      setStatus('Kontakt dodany. Wpisz wiadomość, żeby ją wysłać.');
      return;
    }

    if (busy) {
      return;
    }

    try {
      await runWithLoading('Wysyłam pierwszą wiadomość i aktualizuję klucze...', async () => {
        const signalResult = await encryptWithSignal(
          trimmedMessage,
          ownerFingerprint,
          peer.fingerprintSha512,
          savedRegistration.apiBaseUrl,
          session.token,
        );

        if (!signalResult) {
          throw new Error('Odbiorca nie ma jeszcze kluczy Signal. Spróbuj ponownie za chwilę.');
        }

        const encryptedContentBase64 = signalResult.encryptedContentBase64;
        const messageHash = createMessageHash(encryptedContentBase64);
        const signalMessageType = signalResult.signalMessageType;

        await sendMessage({
          apiBaseUrl: savedRegistration.apiBaseUrl,
          token: session.token,
          toPublicKey: peer.fingerprintSha512,
          encryptedContentBase64,
          messageHash,
          signalMessageType,
        });

        const createdAt = new Date().toISOString();

        await upsertMessage({
          ownerFingerprint,
          messageHash,
          peerFingerprint: peer.fingerprintSha512,
          fromPublicKey: ownerFingerprint,
          toPublicKey: peer.fingerprintSha512,
          encryptedContentBase64,
          plaintext: trimmedMessage,
          createdAt,
          storageKey,
          signalMessageType,
        });

        await loadConversation(peer.fingerprintSha512);
        openConversation(peer);
        await refreshConversationPreviews();
        setComposerText('');
        setStatus('Wiadomość wysłana.');
      });
    } catch (error) {
      const apiError = extractErrorMessage(error);
      const userMessage = isDeveloperMode ? apiError.message : createUserFriendlyMessage(apiError);
      showError(userMessage, apiError.code, isDeveloperMode ? apiError.details : undefined);
      setStatus(userMessage);
    }
  }

  const visibleMessages = useMemo(
    () =>
      conversation.map(message => ({
        ...message,
        fromMe: message.fromPublicKey === ownerFingerprint,
      })),
    [conversation, ownerFingerprint],
  );

  const menuItems: DropdownMenuItem[] = [
    {
      type: 'action',
      label: busy ? 'Synchronizowanie...' : 'Synchronizuj',
      disabled: busy,
      onPress: () => {
        void handleSync();
      },
    },
    { type: 'separator' },
    {
      type: 'info',
      label: 'Sesja JWT',
      sublabel: `Ważna do: ${new Date(session.expiresAtUtc).toLocaleString()}`,
    },
    {
      type: 'info',
      label: 'Status',
      sublabel: status,
    },
    {
      type: 'action',
      label: 'Ustawienia bezpieczeństwa',
      onPress: onGoToSecuritySettings,
    },
    { type: 'separator' },
    {
      type: 'action',
      label: 'Wyloguj',
      variant: 'danger',
      disabled: busy,
      onPress: onLogout,
    },
  ];

  if (screenMode === 'conversation' && activePeer) {
    return (
      <ConversationPage
        peer={activePeer}
        messages={visibleMessages}
        composerText={composerText}
        onComposerTextChange={setComposerText}
        onBack={() => setScreenMode('inbox')}
        onSend={() => {
          void handleAddFriendAndSend(activePeer);
        }}
        busy={busy}
      />
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.bgGlowLeft} />
      <View style={styles.bgGlowRight} />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.kicker}>MESSAGER</Text>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>
              {activeTab === 'inbox' ? 'Czaty' : 'Szukaj'}
            </Text>
            <View
              style={[
                styles.statusDot,
                busy ? styles.statusDotBusy : styles.statusDotIdle,
              ]}
            />
          </View>
        </View>

        <DropdownMenu items={menuItems} topOffset={insets.top + 60}>
          <View style={styles.menuTrigger}>
            <Text style={styles.menuTriggerIcon}>{'⋮'}</Text>
          </View>
        </DropdownMenu>
      </View>

      <View style={styles.tabBar}>
        <Pressable style={styles.tab} onPress={() => setActiveTab('inbox')}>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'inbox' && styles.tabLabelActive,
            ]}
          >
            {`Czaty${totalUnread > 0 ? ` (${totalUnread})` : ''}`}
          </Text>
          {activeTab === 'inbox' && <View style={styles.tabIndicator} />}
        </Pressable>
        <Pressable style={styles.tab} onPress={() => setActiveTab('search')}>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'search' && styles.tabLabelActive,
            ]}
          >
            {'Szukaj'}
          </Text>
          {activeTab === 'search' && <View style={styles.tabIndicator} />}
        </Pressable>
      </View>

      {activeTab === 'inbox' && (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {conversationPreviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Brak rozmów</Text>
              <Text style={styles.emptyHint}>
                Przejdź do zakładki Szukaj, żeby znaleźć i dodać kontakty.
              </Text>
            </View>
          ) : (
            <View style={styles.inboxList}>
              {conversationPreviews.map(preview => {
                const isUnread = preview.unreadCount > 0;
                const isActive =
                  activePeer?.fingerprintSha512 ===
                    preview.profile.fingerprintSha512 &&
                  screenMode === 'conversation';

                return (
                  <Pressable
                    key={preview.profile.fingerprintSha512}
                    style={({ pressed }) => [
                      styles.inboxRow,
                      isUnread && styles.inboxRowUnread,
                      isActive && styles.inboxRowActive,
                      pressed && styles.inboxRowPressed,
                    ]}
                    onPress={() => openConversation(preview.profile)}
                  >
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>
                        {getConversationInitials(preview.profile.userName)}
                      </Text>
                    </View>

                    <View style={styles.inboxBody}>
                      <View style={styles.inboxTopRow}>
                        <Text
                          style={[
                            styles.inboxName,
                            isUnread && styles.inboxNameUnread,
                          ]}
                        >
                          {preview.profile.userName}#{preview.profile.userTag}
                        </Text>

                        <Text style={styles.inboxTime}>
                          {formatPreviewDate(preview.lastMessageCreatedAt)}
                        </Text>
                      </View>

                      <View style={styles.inboxBottomRow}>
                        <Text
                          style={[
                            styles.inboxPreview,
                            isUnread && styles.inboxPreviewUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {toPreviewMessage(preview, ownerFingerprint)}
                        </Text>

                        {isUnread ? (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                              {preview.unreadCount > 9
                                ? '9+'
                                : preview.unreadCount}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'search' && (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.searchContent,
              { paddingBottom: insets.bottom + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <AuthCard>
              <Text style={styles.sectionTitle}>Szukaj profilu</Text>

              <FormField
                label="User name"
                value={searchUserName}
                onChangeText={setSearchUserName}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="np. adam"
              />

              <FormField
                label="Tag (opcjonalnie)"
                value={searchUserTag}
                onChangeText={setSearchUserTag}
                keyboardType="number-pad"
                placeholder="np. 12345"
              />

              <ActionButton
                label="Szukaj"
                onPress={() => void handleSearch()}
                disabled={!canSearch || busy}
                isLoading={busy}
              />

              <View style={styles.searchResultsBox}>
                {searchResults.length === 0 ? (
                  <Text style={styles.statusText}>Brak wyników.</Text>
                ) : (
                  searchResults.map(profile => (
                    <View
                      key={profile.fingerprintSha512}
                      style={styles.profileRow}
                    >
                      <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>
                          {profile.userName}#{profile.userTag}
                        </Text>
                        <Text style={styles.monoText}>
                          {profile.fingerprintSha512}
                        </Text>
                      </View>

                      <ActionButton
                        label="Dodaj i otworz"
                        onPress={() => {
                          void handleAddFriendAndSend(profile);
                        }}
                        variant="primary"
                        disabled={busy}
                      />
                    </View>
                  ))
                )}
              </View>
            </AuthCard>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#08111F',
  },
  bgGlowLeft: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  bgGlowRight: {
    position: 'absolute',
    top: 80,
    right: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(244, 114, 182, 0.16)',
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
    backgroundColor: 'rgba(8, 17, 31, 0.96)',
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotIdle: {
    backgroundColor: '#22C55E',
  },
  statusDotBusy: {
    backgroundColor: '#FBBF24',
  },
  menuTrigger: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  menuTriggerIcon: {
    color: '#F8FAFC',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.14)',
    backgroundColor: 'rgba(8, 17, 31, 0.96)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabLabel: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#7DD3FC',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#7DD3FC',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 72,
    gap: 12,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyHint: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  inboxList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.1)',
  },
  inboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
  },
  inboxRowUnread: {
    backgroundColor: 'rgba(30, 64, 175, 0.18)',
  },
  inboxRowActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  inboxRowPressed: {
    opacity: 0.85,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.45)',
  },
  avatarText: {
    color: '#EFF6FF',
    fontSize: 15,
    fontWeight: '800',
  },
  inboxBody: {
    flex: 1,
    gap: 3,
  },
  inboxTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inboxName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  inboxNameUnread: {
    fontWeight: '800',
  },
  inboxTime: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '600',
  },
  inboxBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inboxPreview: {
    color: '#64748B',
    fontSize: 13,
    flex: 1,
  },
  inboxPreviewUnread: {
    color: '#CBD5E1',
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#EFF6FF',
    fontSize: 11,
    fontWeight: '800',
  },
  searchContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 21,
  },
  searchResultsBox: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    gap: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
  },
  profileRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.2)',
    padding: 10,
    gap: 10,
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
  },
  profileInfo: {
    gap: 6,
  },
  profileName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  monoText: {
    color: '#E2E8F0',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
});
