export type PrivateKeyEnvelope = {
  algorithm: 'AES-GCM';
  iterations: number;
  saltBase64: string;
  ivBase64: string;
  tagBase64: string;
  ciphertextBase64: string;
};

export type StoredRegistration = {
  version: 1;
  apiBaseUrl: string;
  userName: string;
  userTag: number;
  fingerprintSha512: string;
  publicKeyDerBase64: string;
  privateKey: PrivateKeyEnvelope;
};
