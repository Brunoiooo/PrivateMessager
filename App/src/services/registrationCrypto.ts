import * as forge from 'node-forge';
import { RSA } from 'react-native-rsa-native';

import { PrivateKeyEnvelope, StoredRegistration } from '../types/registration';

// Use RSA-2048 for all builds for consistent security
const KEY_BITS = 2048;
const PBKDF2_ITERATIONS = 150000;
const PBKDF2_KEY_SIZE = 32;

type RegistrationInput = {
  apiBaseUrl: string;
  userName: string;
  userTag: number;
  pin: string;
};

export async function generateRegistrationBundle({
  apiBaseUrl,
  userName,
  userTag,
  pin,
}: RegistrationInput): Promise<StoredRegistration> {
  const nativeKeyPair = await RSA.generateKeys(KEY_BITS);
  const publicKey = forge.pki.publicKeyFromPem(nativeKeyPair.public);
  const publicKeyAsn1 = forge.pki.publicKeyToAsn1(publicKey);
  const publicKeyDerBinary = forge.asn1.toDer(publicKeyAsn1).getBytes();
  const publicKeyDerBase64 = forge.util.encode64(publicKeyDerBinary);
  const fingerprintSha512 = forge.md.sha512
    .create()
    .update(publicKeyDerBinary, 'raw')
    .digest()
    .toHex();
  const privateKeyPem = nativeKeyPair.private;

  return {
    version: 1,
    apiBaseUrl,
    userName,
    userTag,
    fingerprintSha512,
    publicKeyDerBase64,
    privateKey: encryptPrivateKey(privateKeyPem, pin),
  };
}

export function decryptPrivateKey(
  envelope: PrivateKeyEnvelope,
  pin: string,
): string {
  const salt = forge.util.decode64(envelope.saltBase64);
  const iv = forge.util.decode64(envelope.ivBase64);
  const tag = forge.util.decode64(envelope.tagBase64);
  const ciphertext = forge.util.decode64(envelope.ciphertextBase64);
  const derivedKey = forge.pkcs5.pbkdf2(
    forge.util.encodeUtf8(pin),
    salt,
    envelope.iterations,
    PBKDF2_KEY_SIZE,
    forge.md.sha256.create(),
  );

  const decipher = forge.cipher.createDecipher('AES-GCM', derivedKey);
  decipher.start({ iv, tagLength: 128, tag: forge.util.createBuffer(tag) });
  decipher.update(forge.util.createBuffer(ciphertext));

  if (!decipher.finish()) {
    throw new Error('Nieprawidłowy PIN lub uszkodzony zapis klucza.');
  }

  return decipher.output.toString();
}

export function encryptPrivateKey(
  privateKeyPem: string,
  pin: string,
): PrivateKeyEnvelope {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const derivedKey = forge.pkcs5.pbkdf2(
    forge.util.encodeUtf8(pin),
    bytesToBinary(salt),
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_SIZE,
    forge.md.sha256.create(),
  );

  const cipher = forge.cipher.createCipher('AES-GCM', derivedKey);
  cipher.start({ iv: bytesToBinary(iv), tagLength: 128 });
  cipher.update(forge.util.createBuffer(privateKeyPem, 'utf8'));

  if (!cipher.finish()) {
    throw new Error('Nie udało się zaszyfrować klucza prywatnego.');
  }

  return {
    algorithm: 'AES-GCM',
    iterations: PBKDF2_ITERATIONS,
    saltBase64: forge.util.encode64(bytesToBinary(salt)),
    ivBase64: forge.util.encode64(bytesToBinary(iv)),
    tagBase64: forge.util.encode64(cipher.mode.tag.getBytes()),
    ciphertextBase64: forge.util.encode64(cipher.output.getBytes()),
  };
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBinary(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i] & 0xff);
  }
  return result;
}
