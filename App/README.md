# App

React Native mobile client for Messager (Android & iOS). The app handles key generation, PIN-protected private key storage, RSA challenge-response login, and end-to-end encrypted messaging — all cryptographic operations happen on-device.

## Features

- **Multiple local profiles** — multiple identities on one device
- **RSA key pair generation** — 2048-bit keys (1024-bit in dev mode for emulator speed)
- **PIN-protected private key** — PBKDF2-SHA256 (150 000 iterations) + AES-256-GCM
- **Challenge-response login** — signs server challenge with RSA private key, receives JWT
- **Contact discovery** — search by username and tag
- **Chain-key message encryption** — AES-256-GCM per message; forward secrecy via key derivation
- **Local SQLite cache** — conversations and chain key state persist across sessions
- **Delta sync** — HTTP polling or WebSocket for new messages

## Project Structure

```
App/
├── App.tsx                        # Root state machine (gateway | registration | login | chat)
├── index.js                       # React Native entry point
├── src/
│   ├── components/                # Reusable UI components
│   │   ├── ActionButton.tsx
│   │   ├── AuthCard.tsx
│   │   ├── DropdownMenu.tsx
│   │   ├── FormField.tsx
│   │   ├── ProfilePicker.tsx
│   │   └── ScreenShell.tsx
│   ├── config/
│   │   └── env.ts                 # API base URL from react-native-dotenv
│   ├── context/
│   │   ├── LoadingOverlayContext.tsx
│   │   └── PrivateKeySessionContext.tsx   # In-memory unlocked private key
│   ├── pages/
│   │   ├── AuthGatewayPage.tsx    # Profile selection screen
│   │   ├── RegistrationPage.tsx   # Key generation & upload
│   │   ├── LocalLoginPage.tsx     # PIN entry → private key unlock
│   │   ├── MessagingPage.tsx      # Contact list + conversation threads
│   │   └── ConversationPage.tsx   # Chat UI for a single peer
│   ├── services/
│   │   ├── authApi.ts             # HTTP calls: register, challenge, login
│   │   ├── messagingApi.ts        # HTTP calls: send/fetch messages & key exchanges
│   │   ├── chatCrypto.ts          # AES-256-GCM encrypt/decrypt; chain key derivation
│   │   ├── registrationCrypto.ts  # RSA key generation; PIN-based key protection
│   │   ├── profileStore.ts        # SQLite: profile & app state management
│   │   ├── chatStore.ts           # SQLite: message cache & conversation state
│   │   └── registrationStore.ts   # SQLite: registration bundle persistence
│   └── types/
│       ├── profile.ts
│       ├── registration.ts
│       ├── messaging.ts
│       └── env.d.ts
├── android/                       # Android native project
├── ios/                           # iOS native project
├── patches/                       # Dependency patches (patch-package)
├── package.json
└── Dockerfile.android             # Android APK build container
```

## Prerequisites

Complete the [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment) for your target platform before proceeding.

**Required tools:**
- Node.js 20+ / npm 10+
- JDK 17 (Android)
- Android Studio + SDK (Android)
- Xcode 15+ (iOS / macOS only)

## Getting Started

```bash
cd App
npm install
```

### Start Metro bundler

```bash
npm start
```

### Run on Android

```bash
npm run android
```

If using a physical device, forward the API port:

```bash
adb reverse tcp:5000 tcp:5000
```

### Run on iOS (macOS only)

```bash
cd ios && pod install && cd ..
npm run ios
```

## Configuration

Create a `.env` file in `App/`:

```env
MESSAGER_API_BASE_URL=http://10.0.2.2:5000
```

- Android emulator: `http://10.0.2.2:5000` (host loopback)
- Physical Android device: `http://<your-machine-ip>:5000`
- iOS simulator: `http://localhost:5000`

The variable is read via `react-native-dotenv` and typed in `src/types/env.d.ts`.

## Cryptography

### Private Key Protection

```
User PIN
  ↓  PBKDF2-SHA256 (150 000 iterations, 32-byte key)
  ↓  AES-256-GCM encrypt(private_key_pem)
  ↓  stored: { salt, iv, tag, ciphertext }  (all Base64, in SQLite)
```

The private key is decrypted into memory only during an active session and cleared on logout.

### Message Encryption (Chain Keys)

```
First message:
  RSA-OAEP(recipient_public_key, chain_key_seed)  →  KeyExchange record

Subsequent messages:
  chain_key_n  →  SHA-256(chain_key_{n-1})
  AES-256-GCM(chain_key_n, plaintext)  →  EncryptedContent
```

Each conversation maintains an independent outbound and inbound chain key stored in SQLite (`conversation_state` table).

## Local Database (SQLite)

File: `messager_profiles.db`

| Table | Description |
|-------|-------------|
| `profiles` | Local user profiles; `registration_json` holds key material |
| `app_state` | Active profile pointer |
| `known_profiles` | Contact list per profile |
| `conversation_state` | Chain key state per peer |
| `messages_local` | Message cache; plaintext stored after decryption |
| `key_exchanges_local` | Key exchange cache |
| `sync_state` | `last_synced_at_utc` timestamp |

## Building a Release APK with Docker

The `android-builder` service in `docker-compose.yml` builds a release APK inside a Linux container — no local Android SDK required.

### Prerequisites

Create a `.env` file in the **repo root** (next to `docker-compose.yml`) with all required variables:

```env
# PostgreSQL
POSTGRES_DB=messager
POSTGRES_USER=messager
POSTGRES_PASSWORD=changeme

# JWT
JWT_SIGNING_KEY=<min-32-char-secret>

# Nginx
APP_PORT=443
APP_DOMAIN=localhost
NGINX_USE_SSL=true

# Mobile — URL the APK will use to reach the API
MESSAGER_API_BASE_URL=https://<your-server-ip>:443
SSL_CA_CERT_FILE=ca.pem
```

### Run the build

```bash
docker-compose --profile release up --build
```

This will:
1. Start PostgreSQL and the API server
2. Start the `android-builder` container
3. Run `npm ci` inside the container
4. Write `.env` with `MESSAGER_API_BASE_URL` baked into the APK
5. Run `./gradlew assembleRelease`
6. Copy the resulting APK to `releases/android/` on the host

### Output

```
releases/
└── android/
    └── app-release.apk
```

Install on a device:

```bash
adb install releases/android/app-release.apk
```

### Build only (skip API startup)

If you only need the APK and already have a running API elsewhere:

```bash
docker-compose --profile release run --rm android-builder
```

### Gradle cache

The `android-gradle` Docker volume caches Gradle dependencies between builds. A clean first build can take 10–20 minutes; subsequent builds are significantly faster.

## Running Tests

```bash
npm test
```

Tests are located in `src/__tests__/` and use Jest + React Native Testing Library.

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react-native | 0.85.3 | Mobile framework |
| react | 19.2.3 | UI rendering |
| typescript | 5.8.3 | Type safety |
| node-forge | 1.3.1 | AES-GCM, PBKDF2, SHA |
| react-native-rsa-native | 2.0.5 | Native RSA key generation & signing |
| react-native-sqlite-storage | — | Local SQLite database |
| @react-native-async-storage/async-storage | 2.2.0 | Key-value storage |
| react-native-dotenv | — | Environment variable injection |
