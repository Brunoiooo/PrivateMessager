export type JwtSession = {
  token: string;
  expiresAtUtc: string;
};

export type PublicKeyProfile = {
  fingerprintSha512: string;
  userName: string;
  userTag: number;
  publicKeyDerBase64: string;
};

export type SyncKeyExchange = {
  fromPublicKey: string;
  toPublicKey: string;
  encryptedPrivateKeyBase64: string;
  createdAt: string;
};

export type SyncMessage = {
  fromPublicKey: string;
  toPublicKey: string;
  encryptedContentBase64: string;
  messageHash: string;
  createdAt: string;
  signalMessageType: number | null;
};

export type SyncDelta = {
  serverTimeUtc: string;
  profiles: PublicKeyProfile[];
  keyExchanges: SyncKeyExchange[];
  messages: SyncMessage[];
};

export type LocalConversationMessage = {
  messageHash: string;
  peerFingerprint: string;
  fromPublicKey: string;
  toPublicKey: string;
  encryptedContentBase64: string;
  plaintext: string | null;
  createdAt: string;
  signalMessageType: number | null;
};

export type ConversationPreview = {
  profile: PublicKeyProfile;
  lastMessageText: string | null;
  lastMessageCreatedAt: string | null;
  lastMessageFromPublicKey: string | null;
  unreadCount: number;
};

export type ConversationState = {
  peerFingerprint: string;
  outgoingChainKeyBase64: string | null;
  incomingChainKeyBase64: string | null;
};
