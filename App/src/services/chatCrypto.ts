import * as forge from 'node-forge';

const CHAIN_KEY_SIZE = 32;
const AES_GCM_IV_SIZE = 12;
const AES_GCM_TAG_SIZE = 16;

export function generateChainSeedBase64(): string {
  return forge.util.encode64(randomBytes(CHAIN_KEY_SIZE));
}

export function deriveNextChainKeyBase64(previousKeyBase64: string): string {
  const previous = forge.util.decode64(previousKeyBase64);
  const digest = forge.md.sha256.create().update(previous, 'raw').digest();
  return forge.util.encode64(digest.getBytes());
}

export function encryptChainSeedForRecipient(
  chainSeedBase64: string,
  recipientPublicKeyDerBase64: string,
  recipientFingerprintSha512: string,
): string {
  const recipientPublicKeyDerBinary = forge.util.decode64(
    recipientPublicKeyDerBase64,
  );
  const computedRecipientFingerprint = forge.md.sha512
    .create()
    .update(recipientPublicKeyDerBinary, 'raw')
    .digest()
    .toHex();

  if (computedRecipientFingerprint !== recipientFingerprintSha512) {
    throw new Error(
      'Klucz publiczny odbiorcy nie zgadza sie z jego fingerprintem.',
    );
  }

  const recipientPublicKey = forge.pki.publicKeyFromAsn1(
    forge.asn1.fromDer(recipientPublicKeyDerBinary),
  );

  const encryptedBinary = recipientPublicKey.encrypt(
    forge.util.decode64(chainSeedBase64),
    'RSA-OAEP',
    {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create(),
      },
    },
  );

  return forge.util.encode64(encryptedBinary);
}

export function decryptIncomingChainSeed(
  encryptedPrivateKeyBase64: string,
  privateKeyPem: string,
): string {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const decryptedBinary = privateKey.decrypt(
    forge.util.decode64(encryptedPrivateKeyBase64),
    'RSA-OAEP',
    {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create(),
      },
    },
  );

  return forge.util.encode64(decryptedBinary);
}

export function encryptMessageWithChainKey(
  plaintext: string,
  chainKeyBase64: string,
): string {
  const chainKeyBinary = forge.util.decode64(chainKeyBase64);
  const ivBinary = randomBytes(AES_GCM_IV_SIZE);
  const cipher = forge.cipher.createCipher('AES-GCM', chainKeyBinary);

  cipher.start({
    iv: ivBinary,
    tagLength: AES_GCM_TAG_SIZE * 8,
  });

  cipher.update(forge.util.createBuffer(plaintext, 'utf8'));

  if (!cipher.finish()) {
    throw new Error('Nie udało się zaszyfrować wiadomości.');
  }

  const payloadBinary =
    ivBinary + cipher.mode.tag.getBytes() + cipher.output.getBytes();

  return forge.util.encode64(payloadBinary);
}

export function decryptMessageWithChainKey(
  encryptedContentBase64: string,
  chainKeyBase64: string,
): string {
  const payloadBinary = forge.util.decode64(encryptedContentBase64);
  const minLength = AES_GCM_IV_SIZE + AES_GCM_TAG_SIZE;

  if (payloadBinary.length <= minLength) {
    throw new Error('Nieprawidłowy format szyfrogramu wiadomości.');
  }

  const ivBinary = payloadBinary.slice(0, AES_GCM_IV_SIZE);
  const tagBinary = payloadBinary.slice(AES_GCM_IV_SIZE, minLength);
  const ciphertextBinary = payloadBinary.slice(minLength);

  const decipher = forge.cipher.createDecipher(
    'AES-GCM',
    forge.util.decode64(chainKeyBase64),
  );

  decipher.start({
    iv: ivBinary,
    tagLength: AES_GCM_TAG_SIZE * 8,
    tag: forge.util.createBuffer(tagBinary),
  });

  decipher.update(forge.util.createBuffer(ciphertextBinary));

  if (!decipher.finish()) {
    throw new Error('Nie udało się odszyfrować wiadomości.');
  }

  return decipher.output.toString();
}

export function createMessageHash(encryptedContentBase64: string): string {
  return forge.md.sha512
    .create()
    .update(forge.util.decode64(encryptedContentBase64), 'raw')
    .digest()
    .toHex();
}

function randomBytes(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return String.fromCharCode(...bytes);
}
