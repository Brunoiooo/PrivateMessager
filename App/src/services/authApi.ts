import * as forge from 'node-forge';

import { JwtSession } from '../types/messaging';

type ChallengeResponse = {
  challengeBase64: string;
};

type LoginResponse = {
  token: string;
  expiresAtUtc: string;
};

export async function loginWithPrivateKey(params: {
  apiBaseUrl: string;
  fingerprintSha512: string;
  privateKeyPem: string;
}): Promise<JwtSession> {
  const challengeResponse = await fetch(
    `${params.apiBaseUrl}/api/auth/challenge`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fingerprintSha512: params.fingerprintSha512,
      }),
    },
  );

  const challengePayload = (await challengeResponse
    .json()
    .catch(() => null)) as ChallengeResponse | { message?: string } | null;

  if (
    !challengeResponse.ok ||
    !challengePayload ||
    !('challengeBase64' in challengePayload)
  ) {
    throw new Error(
      (challengePayload as { message?: string } | null)?.message ??
        `Nie udało się pobrać challenge (${challengeResponse.status}).`,
    );
  }

  const signatureBase64 = signChallengeBase64(
    params.privateKeyPem,
    challengePayload.challengeBase64,
  );

  const loginResponse = await fetch(`${params.apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fingerprintSha512: params.fingerprintSha512,
      challengeBase64: challengePayload.challengeBase64,
      signatureBase64,
    }),
  });

  const loginPayload = (await loginResponse.json().catch(() => null)) as
    | LoginResponse
    | { message?: string }
    | null;

  if (!loginResponse.ok || !loginPayload || !('token' in loginPayload)) {
    throw new Error(
      (loginPayload as { message?: string } | null)?.message ??
        `Logowanie nie powiodło się (${loginResponse.status}).`,
    );
  }

  return {
    token: loginPayload.token,
    expiresAtUtc: loginPayload.expiresAtUtc,
  };
}

function signChallengeBase64(
  privateKeyPem: string,
  challengeBase64: string,
): string {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const challengeBinary = forge.util.decode64(challengeBase64);
  const digest = forge.md.sha512.create();
  digest.update(challengeBinary, 'raw');
  const signatureBinary = privateKey.sign(digest);
  return forge.util.encode64(signatureBinary);
}
