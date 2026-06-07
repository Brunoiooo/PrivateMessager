import { PublicKeyProfile, SyncDelta } from '../types/messaging';

type SyncSocketHandlers = {
  onDelta: (delta: SyncDelta) => void;
  onError?: (error: Error) => void;
};

type SyncSocketSubscription = {
  close: () => void;
};

export async function searchProfiles(params: {
  apiBaseUrl: string;
  token: string;
  userName: string;
  userTag?: number;
  limit?: number;
}): Promise<PublicKeyProfile[]> {
  const query = new URLSearchParams({
    userName: params.userName,
    limit: String(params.limit ?? 25),
  });

  if (typeof params.userTag === 'number') {
    query.set('userTag', String(params.userTag));
  }

  const response = await fetch(
    `${params.apiBaseUrl}/api/public-keys/search?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${params.token}`,
      },
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | PublicKeyProfile[]
    | { message?: string }
    | null;

  if (!response.ok || !Array.isArray(payload)) {
    throw new Error(
      (payload as { message?: string } | null)?.message ??
        `Wyszukiwanie nie powiodło się (${response.status}).`,
    );
  }

  return payload;
}

export async function sendKeyExchange(params: {
  apiBaseUrl: string;
  token: string;
  toPublicKey: string;
  encryptedPrivateKeyBase64: string;
}): Promise<void> {
  const response = await fetch(`${params.apiBaseUrl}/api/key-exchanges/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      toPublicKey: params.toPublicKey,
      encryptedPrivateKeyBase64: params.encryptedPrivateKeyBase64,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      payload?.message ??
        `Nie udało się wysłać key exchange (${response.status}).`,
    );
  }
}

export async function sendMessage(params: {
  apiBaseUrl: string;
  token: string;
  toPublicKey: string;
  encryptedContentBase64: string;
  messageHash: string;
  signalMessageType?: number | null;
}): Promise<void> {
  const response = await fetch(`${params.apiBaseUrl}/api/messages/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      toPublicKey: params.toPublicKey,
      encryptedContentBase64: params.encryptedContentBase64,
      messageHash: params.messageHash,
      signalMessageType: params.signalMessageType ?? null,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      payload?.message ??
        `Nie udało się wysłać wiadomości (${response.status}).`,
    );
  }
}

export async function syncDelta(params: {
  apiBaseUrl: string;
  token: string;
  since?: string;
  limit?: number;
}): Promise<SyncDelta> {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 700),
  });

  if (params.since) {
    query.set('since', params.since);
  }

  const response = await fetch(
    `${params.apiBaseUrl}/api/sync/delta?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${params.token}`,
      },
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | SyncDelta
    | { message?: string }
    | null;

  if (!response.ok || !payload || !('serverTimeUtc' in payload)) {
    throw new Error(
      (payload as { message?: string } | null)?.message ??
        `Synchronizacja nie powiodła się (${response.status}).`,
    );
  }

  return payload;
}

export function openSyncSocket(
  params: {
    apiBaseUrl: string;
    token: string;
    since?: string;
    limit?: number;
  } & SyncSocketHandlers,
): SyncSocketSubscription {
  return openSocket({
    apiBaseUrl: params.apiBaseUrl,
    token: params.token,
    path: '/ws/sync',
    since: params.since,
    limit: params.limit ?? 700,
    onDelta: params.onDelta,
    onError: params.onError,
  });
}

export function openConversationSocket(
  params: {
    apiBaseUrl: string;
    token: string;
    peerFingerprint: string;
    since?: string;
    limit?: number;
  } & SyncSocketHandlers,
): SyncSocketSubscription {
  return openSocket({
    apiBaseUrl: params.apiBaseUrl,
    token: params.token,
    path: `/ws/conversations/${encodeURIComponent(params.peerFingerprint)}`,
    since: params.since,
    limit: params.limit ?? 300,
    onDelta: params.onDelta,
    onError: params.onError,
  });
}

function openSocket(params: {
  apiBaseUrl: string;
  token: string;
  path: string;
  since?: string;
  limit: number;
  onDelta: (delta: SyncDelta) => void;
  onError?: (error: Error) => void;
}): SyncSocketSubscription {
  const wsBaseUrl = toWebSocketBaseUrl(params.apiBaseUrl);
  const query = new URLSearchParams({
    access_token: params.token,
    limit: String(params.limit),
  });

  if (params.since) {
    query.set('since', params.since);
  }

  const wsUrl = `${wsBaseUrl}${params.path}?${query.toString()}`;
  const socket = new WebSocket(wsUrl);

  socket.onerror = () => {
    params.onError?.(new Error('WebSocket sync connection error.'));
  };

  socket.onmessage = event => {
    try {
      const message = JSON.parse(String(event.data)) as
        | { type: 'sync-delta'; payload: SyncDelta }
        | { type: 'error'; message: string };

      if (message.type === 'error') {
        params.onError?.(new Error(message.message));
        return;
      }

      if (message.type === 'sync-delta' && message.payload?.serverTimeUtc) {
        params.onDelta(message.payload);
        return;
      }

      params.onError?.(new Error('Invalid WebSocket sync response payload.'));
    } catch {
      params.onError?.(new Error('Failed to parse WebSocket sync response.'));
    }
  };

  socket.onclose = event => {
    if (event.code === 1000) {
      return;
    }

    params.onError?.(new Error(`WebSocket closed (${event.code}).`));
  };

  return {
    close: () => {
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    },
  };
}

function toWebSocketBaseUrl(apiBaseUrl: string): string {
  const trimmed = apiBaseUrl.trim().replace(/\/+$/, '');

  if (trimmed.startsWith('https://')) {
    return `wss://${trimmed.slice('https://'.length)}`;
  }

  if (trimmed.startsWith('http://')) {
    return `ws://${trimmed.slice('http://'.length)}`;
  }

  return trimmed;
}

export async function ackMessage(params: {
  apiBaseUrl: string;
  token: string;
  messageHash: string;
}): Promise<void> {
  await fetch(
    `${params.apiBaseUrl}/api/messages/${params.messageHash}/ack`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${params.token}` },
    },
  );
}

export type PreKeyBundleResponse = {
  identityKeyDerBase64: string;
  signedPreKeyId: number;
  signedPreKeyPublicBase64: string;
  signatureBase64: string;
  otpId: string | null;
  otpPublicBase64: string | null;
};

export async function fetchPreKeyBundle(params: {
  apiBaseUrl: string;
  token: string;
  fingerprint: string;
}): Promise<PreKeyBundleResponse | null> {
  const response = await fetch(
    `${params.apiBaseUrl}/api/prekeys/${encodeURIComponent(params.fingerprint)}`,
    { headers: { Authorization: `Bearer ${params.token}` } },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return (await response.json().catch(() => null)) as PreKeyBundleResponse | null;
}

export async function uploadPreKeyBundle(params: {
  apiBaseUrl: string;
  token: string;
  signedPreKeyId: number;
  signedPreKeyPublicBase64: string;
  signatureBase64: string;
  oneTimePreKeys: Array<{ preKeyId: number; publicBase64: string }>;
}): Promise<void> {
  await fetch(`${params.apiBaseUrl}/api/prekeys/bundle`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      signedPreKeyId: params.signedPreKeyId,
      signedPreKeyPublicBase64: params.signedPreKeyPublicBase64,
      signatureBase64: params.signatureBase64,
      oneTimePreKeys: params.oneTimePreKeys,
    }),
  });
}
