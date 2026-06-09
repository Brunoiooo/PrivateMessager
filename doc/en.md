# Messager — Academic System Documentation

**Project title:** Messager — multi-layer messenger with end-to-end encryption  
**Project type:** Web and mobile application (monorepo)  
**Documentation date:** 2026-06-09  

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Introduction](#2-introduction)
3. [Technological and Cryptographic Background](#3-technological-and-cryptographic-background)
4. [System Architecture](#4-system-architecture)
5. [Domain Model](#5-domain-model)
6. [Application Layer — Use Cases](#6-application-layer--use-cases)
7. [Infrastructure Layer — Technical Implementation](#7-infrastructure-layer--technical-implementation)
8. [API Layer — HTTP and WebSocket Interface](#8-api-layer--http-and-websocket-interface)
9. [Mobile Client](#9-mobile-client)
10. [Cryptographic Model — Detailed Analysis](#10-cryptographic-model--detailed-analysis)
11. [Database Schema](#11-database-schema)
12. [Synchronization and Real-Time Communication](#12-synchronization-and-real-time-communication)
13. [Environment Configuration and Deployment](#13-environment-configuration-and-deployment)
14. [Security Analysis](#14-security-analysis)
15. [Limitations and Future Development](#15-limitations-and-future-development)
16. [Conclusions](#16-conclusions)
17. [Glossary](#17-glossary)

---

## 1. Abstract

This document is the academic documentation for the Messager system — a messenger implementing end-to-end message encryption (E2EE) using asymmetric RSA cryptography and symmetric chain keys. The system consists of a backend written in ASP.NET Core (.NET 10) with a PostgreSQL database, and a mobile client based on React Native with a local SQLite data store.

The backend architecture follows the Clean Architecture pattern, separating the domain layer (Domain), use-case layer (Application), infrastructure layer (Infrastructure), and HTTP interface layer (API). The mobile client implements the full cryptographic flow: RSA key-pair generation, private key protection via PBKDF2+AES-GCM, challenge-response authentication with an RSA/SHA-512 signature, RSA-OAEP key-material exchange, and AES-GCM message encryption with chain-key derivation using SHA-256.

This document describes each layer of the system, analyzes the chosen architectural and cryptographic solutions, presents database schemas and API specifications, and discusses security aspects and limitations of the current implementation.

---

## 2. Introduction

### 2.1 Project Goals

The Messager project fulfills the classic goals of a secure peer-to-peer communication system:

- **Identification** of participants via their RSA public key,
- **Authentication** using a cryptographic signature (challenge-response),
- **Key-material exchange** between conversation partners using asymmetric encryption,
- **Secure message transmission** encrypted with a symmetric key and providing forward secrecy,
- **Incremental synchronization** of data between the mobile device and the server,
- **History storage** in a local SQLite database that the server cannot read.

The system is designed to be resilient to server compromise with respect to message content: the server stores only encrypted data and holds no keys capable of decrypting it.

### 2.2 Documentation Scope

The documentation covers the entire source code of the repository (`c:\Users\Blazej\sources\Messager`):

| Directory | Role |
|---|---|
| `Domain/` | Domain entities and business rules |
| `Application/` | Use-case handlers and service interfaces |
| `Infrastructure/` | EF Core, PostgreSQL, cryptographic service implementations |
| `API/` | ASP.NET Core Minimal API, JWT, WebSockets, DTOs |
| `App/` | React Native mobile client (Android/iOS) |

### 2.3 Technologies

| Layer | Technology | Version |
|---|---|---|
| Backend runtime | .NET | 10.0 |
| HTTP framework | ASP.NET Core Minimal APIs | 10.0 |
| ORM | Entity Framework Core + Npgsql | 10.x (preview) |
| Server database | PostgreSQL | 17 |
| Mobile runtime | React Native | 0.85.3 |
| Mobile language | TypeScript / React | 19.2.3 |
| Client database | SQLite | react-native-sqlite-storage |
| Client cryptography | node-forge, react-native-rsa-native | — |

---

## 3. Technological and Cryptographic Background

### 3.1 RSA Asymmetric Cryptography

RSA (Rivest–Shamir–Adleman) is a cryptographic algorithm based on the difficulty of factoring large integers. A key pair consists of a public key (published openly) and a private key (stored locally). Key properties:

- **Encryption:** a message is encrypted with the recipient's public key; only the recipient holding the private key can decrypt it.
- **Signing:** the owner of the private key signs data; anyone with the public key can verify the signature.

In Messager, RSA serves two roles:
1. User identification (the public key as identity, its SHA-512 fingerprint as an identifier),
2. Encryption of the chain-key seed (RSA-OAEP — Optimal Asymmetric Encryption Padding scheme).

### 3.2 AES-GCM Symmetric Cryptography

AES (Advanced Encryption Standard) in GCM (Galois/Counter Mode) combines encryption with message authentication (AEAD — Authenticated Encryption with Associated Data). Parameters:

- **Key:** 256-bit (32 bytes),
- **Initialization Vector (IV):** 96-bit (12 bytes), randomly generated per message,
- **Authentication tag:** 128-bit (16 bytes), ensures integrity and authenticity.

Ciphertext structure: `IV (12B) || Tag (16B) || Ciphertext (nB)`.

### 3.3 PBKDF2 — Key Derivation from a Password

PBKDF2 (Password-Based Key Derivation Function 2) strengthens a user's password or PIN through repeated iterations of a pseudorandom function (here HMAC-SHA256). Parameters in Messager: 150,000 iterations, 32-byte output key.

### 3.4 Chain Keys and Forward Secrecy

The chain-key scheme is similar to the Double Ratchet algorithm (used in the Signal Protocol) and provides *forward secrecy* — compromising the current key does not reveal the content of earlier messages. Derivation: `K_{n+1} = SHA-256(K_n)`.

### 3.5 Challenge-Response

An authentication mechanism that avoids transmitting a password over the network. The server generates a random challenge; the client signs it with its private key; the server verifies the signature with the public key. This authenticates the user without exposing any secret.

---

## 4. System Architecture

### 4.1 High-Level Architecture

Messager is a client-server architecture with all cryptographic logic located exclusively on the client side.

```
┌─────────────────────────────────────────────────────────┐
│                   Klient mobilny (App)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  Pages   │  │Services  │  │  Crypto  │  │SQLite  │  │
│  │  (UI)   │  │  (API)   │  │(E2EE)   │  │(local) │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/WebSocket (JWT)
┌────────────────────────▼────────────────────────────────┐
│                     Backend (API)                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │         ASP.NET Core Minimal API                 │   │
│  │  ┌────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │Endpts  │  │  JWT + Auth  │  │  WebSockets │  │   │
│  │  └───┬────┘  └──────────────┘  └─────────────┘  │   │
│  └──────┼───────────────────────────────────────────┘   │
│  ┌──────▼─────────────────────────────────────────────┐ │
│  │          Application (Handlers)                    │ │
│  └──────┬─────────────────────────────────────────────┘ │
│  ┌──────▼─────────────────────────────────────────────┐ │
│  │          Domain (Entities + Business Rules)        │ │
│  └──────┬─────────────────────────────────────────────┘ │
│  ┌──────▼─────────────────────────────────────────────┐ │
│  │    Infrastructure (EF Core + Services)             │ │
│  └──────┬─────────────────────────────────────────────┘ │
└─────────┼───────────────────────────────────────────────┘
          │
┌─────────▼──────────┐
│  PostgreSQL (DB)   │
└────────────────────┘
```

### 4.2 Backend Clean Architecture

The backend applies the Clean Architecture pattern with a unidirectional dependency flow:

```
API  ──▶  Application  ──▶  Domain
Infrastructure  ──▶  Application  ──▶  Domain
```

Principles:
- **Domain** has no dependency on any other layer; it encapsulates business rules,
- **Application** defines use cases and service interfaces; it has no knowledge of technical details,
- **Infrastructure** implements the interfaces defined in Application; it depends on EF Core and PostgreSQL,
- **API** maps HTTP requests to Application handler calls; it contains no business logic.

### 4.3 Mobile Client Architecture

The React Native client is divided into functional layers:

| Layer | Files | Responsibility |
|---|---|---|
| Pages (UI) | `src/pages/` | Screens, navigation, user interaction |
| Services (API) | `src/services/authApi.ts`, `messagingApi.ts` | HTTP/WebSocket communication with the backend |
| Services (Crypto) | `src/services/registrationCrypto.ts`, `chatCrypto.ts` | Cryptographic operations |
| Services (Store) | `src/services/profileStore.ts`, `chatStore.ts` | Local SQLite storage |
| Context | `src/context/` | Global session state (private key, loading overlay) |
| Components | `src/components/` | Reusable UI components |
| Types | `src/types/` | TypeScript type definitions |

---

## 5. Domain Model

### 5.1 Base Entity — `BaseEntity`

An abstract class that serves as the foundation for all domain entities. It provides timestamp fields:

```csharp
// Domain/BaseEntity.cs
public abstract class BaseEntity
{
    public DateTime CreatedAt { get; protected set; }
    public DateTime UpdatedAt { get; protected set; }
}
```

### 5.2 `PublicKey` Entity — User Identity

The central aggregate representing a registered participant in the system. It encapsulates both identity data and the associated collections of messages and key exchanges.

**Properties:**

| Property | Type | Description |
|---|---|---|
| `FingerprintSha512` | `string` (128 hex characters) | Global user identifier (SHA-512 of DER) |
| `Der` | `byte[]` | RSA public key in DER format |
| `UserName` | `string` (3–32 characters) | Username (alphanumeric, `_`, `-`) |
| `UserTag` | `uint` (1–99999) | Numeric tag distinguishing users with the same name |
| `MyKeyExchanges` | `IReadOnlyList<KeyExchange>` | Key exchanges sent by this user |
| `YourKeyExchanges` | `IReadOnlyList<KeyExchange>` | Key exchanges received by this user |
| `MyMessages` | `IReadOnlyList<Message>` | Messages sent by this user |
| `YourMessages` | `IReadOnlyList<Message>` | Messages received by this user |

**Business rules validated in the constructor:**

- SHA-512 fingerprint: exactly 128 characters, only hexadecimal characters `[0-9a-fA-F]`,
- DER: non-empty byte array,
- UserName: 3–32 characters, only `[a-zA-Z0-9_-]`,
- UserTag: range 1–99,999.

**Domain methods:**

```csharp
// Sending a message — requires a prior key exchange with the recipient
public Message SendMessage(string toPublicKey, byte[] encryptedContent, string messageHash)
{
    bool hasKeyExchangeForRecipient = _myKeyExchanges.Any(x => x.ToPublicKey == toPublicKey);
    if (!hasKeyExchangeForRecipient)
        throw new InvalidOperationException("Cannot send message without a key exchange from owner to recipient.");
    // ...
}

// Adding a key exchange record
public void AddKeyExchange(string toPublicKey, byte[] encryptedPrivateKey) { ... }

// Retrieving messages with an optional date filter
public IReadOnlyList<Message> GetMessages(string toPublicKey, DateTime? fromDate, DateTime? toDate) { ... }
```

Domain rule: sending a message without a prior key exchange is **impossible**. The aggregate independently enforces the key-exchange existence invariant.

### 5.3 `Message` Entity — Encrypted Message

Represents a single message stored on the server in exclusively encrypted form.

**Properties:**

| Property | Type | Description |
|---|---|---|
| `FromPublicKey` | `string` | Sender fingerprint |
| `ToPublicKey` | `string` | Recipient fingerprint |
| `EncryptedContent` | `byte[]` | Encrypted content (AES-GCM: IV+Tag+Ciphertext) |
| `MessageHash` | `string` | SHA-512 of `EncryptedContent` (hex, 128 characters) — unique identifier |

Composite natural key: `(FromPublicKey, ToPublicKey, MessageHash)` guarantees idempotency — re-sending the same message does not create a duplicate.

### 5.4 `KeyExchange` Entity — Key Material Exchange

Represents a one-time (per pair of conversation partners) transmission of an encrypted chain-key seed.

**Properties:**

| Property | Type | Description |
|---|---|---|
| `FromPublicKey` | `string` | Initiator fingerprint |
| `ToPublicKey` | `string` | Recipient fingerprint |
| `EncryptedPrivateKey` | `byte[]` | Seed encrypted with the recipient's RSA-OAEP public key |

Composite natural key: `(FromPublicKey, ToPublicKey)` — a pair of conversation partners has at most one active exchange record per direction.

---

## 6. Application Layer — Use Cases

This layer defines use-case handlers and service interfaces. It has no dependencies on infrastructure.

### 6.1 Service Interfaces

| Interface | Location | Purpose |
|---|---|---|
| `ICurrentPublicKey` | `Interfaces/` | Access to the fingerprint of the current request's authenticated user |
| `ILoginChallengeService` | `Interfaces/` | Generating and validating login challenges |
| `ILoginService` | `Interfaces/` | RSA signature verification during the login process |
| `IPublicKeyRepository` | `Interfaces/` | Reading and writing `PublicKey` aggregates |
| `IPublicKeySecurityService` | `Interfaces/` | RSA import and SHA-512 fingerprint calculation |

### 6.2 Handlers

#### `RegisterHandler`

Registers a new identity. Steps:

1. Validate the DER key format and size,
2. Import the RSA key (`IPublicKeySecurityService.ImportPublicKey`),
3. Calculate the SHA-512 fingerprint,
4. Check uniqueness of the `userTag` for the given `userName` (conflict check),
5. Persist the `PublicKey` entity via the repository.

#### `GetLoginChallengeHandler`

Generates a challenge for a given fingerprint:

1. Validate that the fingerprint exists in the registry,
2. Remove expired challenges (cleanup),
3. Generate 64 cryptographically secure random bytes,
4. Save the challenge with an expiry of `+5 minutes`.

#### `LoginHandler`

Verifies the signature and issues a JWT:

1. Retrieve an unconsumed, valid challenge for the fingerprint,
2. `ILoginService.Login` — verify the RSA/SHA-512 signature,
3. On success: mark the challenge as consumed (`ConsumedAt`),
4. Issue a JWT (`JwtTokenIssuer`).

#### `SendMessageHandler`

Sends an encrypted message:

1. Retrieve the sender's `PublicKey` aggregate (including the `MyKeyExchanges` collection),
2. Call `publicKey.SendMessage(...)` — verifies the existence of a key exchange,
3. Persist the message via the repository,
4. Notify WebSocket subscribers (`SyncNotificationHub`).

#### `SendKeyExchangeHandler`

Transmits an encrypted seed:

1. Validate that the recipient's fingerprint exists,
2. `publicKey.AddKeyExchange(...)`,
3. Persist via the repository.

#### `GetMessagesHandler` / `GetKeyExchangesHandler`

Retrieve data with an optional `since` (from-date) filter for incremental synchronization.

---

## 7. Infrastructure Layer — Technical Implementation

### 7.1 `MessagerDbContext` — EF Core Context

The `DbContext` configures the mapping of record entities to PostgreSQL tables:

```csharp
public sealed class MessagerDbContext(DbContextOptions<MessagerDbContext> options) : DbContext(options)
{
    public DbSet<PublicKeyRecord> PublicKeys => Set<PublicKeyRecord>();
    public DbSet<MessageRecord> Messages => Set<MessageRecord>();
    public DbSet<KeyExchangeRecord> KeyExchanges => Set<KeyExchangeRecord>();
    public DbSet<LoginChallengeRecord> LoginChallenges => Set<LoginChallengeRecord>();
}
```

Composite key configuration for messages:

```csharp
entity.HasKey(x => new { x.FromPublicKey, x.ToPublicKey, x.MessageHash });
```

Foreign keys (FK) are defined in both directions of the `messages → public_keys` and `key_exchanges → public_keys` relationships, with an `OnDelete.Restrict` policy (no cascading deletes).

### 7.2 `PublicKeyRepository`

Implements `IPublicKeyRepository`. A key aspect: the `PublicKey` aggregate has private collections such as `_myMessages` and `_myKeyExchanges`. EF Core cannot populate them directly due to the lack of setters. The repository uses reflection to set these private fields after loading records from the database.

```csharp
// Infrastructure/Services/PublicKeyRepository.cs
// After constructing the domain object via its constructor, private fields are set via reflection:
typeof(PublicKey)
    .GetField("_myMessages", BindingFlags.NonPublic | BindingFlags.Instance)
    ?.SetValue(publicKey, messages);
```

This technique preserves domain invariants (private collections) while still allowing the aggregate to be hydrated from relational data.

### 7.3 `LoginService`

RSA signature verification:

```csharp
using RSA rsa = RSA.Create();
try {
    rsa.ImportSubjectPublicKeyInfo(publicKey.Der, out _);   // X.509 SubjectPublicKeyInfo
} catch (CryptographicException) {
    rsa.ImportRSAPublicKey(publicKey.Der, out _);           // PKCS#1 RSAPublicKey (fallback)
}
bool verified = rsa.VerifyData(challenge, signature, HashAlgorithmName.SHA512, RSASignaturePadding.Pkcs1);
```

The two-step import handles both X.509 SubjectPublicKeyInfo keys and the raw PKCS#1 RSAPublicKey format, ensuring compatibility with different client libraries.

### 7.4 `PublicKeySecurityService`

Calculates the SHA-512 fingerprint from the DER byte array of a public key:

```csharp
byte[] hash = SHA512.HashData(der);
return Convert.ToHexString(hash).ToLowerInvariant();
```

The result is a 128-character hex string that serves as the user's identity identifier.

### 7.5 `LoginChallengeService`

Generates a random 64-byte challenge using `RandomNumberGenerator.GetBytes(64)` (cryptographically secure PRNG). A challenge is valid for 5 minutes; expired records are deleted on every `GetChallenge` call.

### 7.6 `CurrentPublicKeyAccessor`

A current-request context based on `AsyncLocal<string?>`. It provides access to the authenticated user's fingerprint anywhere in the request-processing pipeline without passing the value as an explicit parameter.

### 7.7 `DependencyInjection`

The static extension method `AddInfrastructure(connectionString)` registers the following services in the DI container:

- `MessagerDbContext` (Scoped),
- `IPublicKeyRepository` → `PublicKeyRepository` (Scoped),
- `ILoginService` → `LoginService` (Scoped),
- `ILoginChallengeService` → `LoginChallengeService` (Scoped),
- `ICurrentPublicKey` → `CurrentPublicKeyAccessor` (Scoped),
- `IPublicKeySecurityService` → `PublicKeySecurityService` (Singleton).

---

## 8. API Layer — HTTP and WebSocket Interface

### 8.1 Application Configuration (`Program.cs`)

The entry point configures:

1. **Kestrel** — listens internally on `0.0.0.0:5000`; external access is handled by nginx,
2. **JWT Bearer Authentication** — HS256, issuer/audience/signature/lifetime validation, 30-second clock tolerance,
3. **Rate Limiting** — sliding window:
   - `auth`: 10 requests/minute (6 segments),
   - `search`: 30 requests/minute,
4. **WebSockets** — keep-alive every 30 seconds,
5. **Application handler registration** — Scoped DI,
6. **`EnsureCreated`** — automatic schema creation on startup.

### 8.2 DTO Contracts

#### `AuthContracts.cs`

```
RegisterRequest  { UserName, UserTag, PublicKeyDerBase64 }
RegisterResponse { FingerprintSha512 }
ChallengeRequest { FingerprintSha512 }
ChallengeResponse { ChallengeBase64 }
LoginRequest     { FingerprintSha512, SignatureBase64 }
LoginResponse    { AccessToken }
ErrorResponse    { Error }
```

#### `MessageContracts.cs`

```
SendMessageRequest  { ToPublicKey, EncryptedContentBase64, MessageHash }
MessageResponse     { FromPublicKey, ToPublicKey, EncryptedContentBase64,
                      MessageHash, CreatedAt }
```

#### `KeyExchangeContracts.cs`

```
SendKeyExchangeRequest { ToPublicKey, EncryptedPrivateKeyBase64 }
KeyExchangeResponse    { FromPublicKey, ToPublicKey,
                         EncryptedPrivateKeyBase64, CreatedAt }
```

#### `SyncContracts.cs`

```
SyncDeltaResponse { Messages: MessageResponse[], KeyExchanges: KeyExchangeResponse[] }
```

### 8.3 Endpoint Specification

#### Authentication (`/api/auth`)

| Method | Path | Rate Limit | Authorization | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | `auth` | Anonymous | Register a public key |
| `POST` | `/api/auth/challenge` | `auth` | Anonymous | Retrieve a challenge |
| `POST` | `/api/auth/login` | `auth` | Anonymous | Login (challenge-response → JWT) |

#### Messages (`/api/messages`)

| Method | Path | Authorization | Parameters | Description |
|---|---|---|---|---|
| `POST` | `/api/messages/` | Bearer JWT | Body: `SendMessageRequest` | Send an encrypted message |
| `GET` | `/api/messages/` | Bearer JWT | Query: `peerFingerprint`, `since?` | Retrieve messages to/from the specified peer |

#### Key Exchanges (`/api/key-exchanges`)

| Method | Path | Authorization | Parameters | Description |
|---|---|---|---|---|
| `POST` | `/api/key-exchanges/` | Bearer JWT | Body: `SendKeyExchangeRequest` | Send or update a key exchange |
| `GET` | `/api/key-exchanges/` | Bearer JWT | Query: `peerFingerprint`, `since?` | Retrieve key exchanges with a peer |

#### Public Profiles (`/api/public-keys`)

| Method | Path | Rate Limit | Authorization | Parameters | Description |
|---|---|---|---|---|---|
| `GET` | `/api/public-keys/search` | `search` | Bearer JWT | Query: `userName`, `userTag?` | Search for profiles |

#### Synchronization and WebSocket (`/api/sync`, `/ws`)

| Protocol | Path | Authorization | Description |
|---|---|---|---|
| HTTP GET | `/api/sync/delta` | Bearer JWT | Incremental synchronization (query: `since?`) |
| WebSocket | `/ws/sync` | `access_token` query param | Full inbox synchronization |
| WebSocket | `/ws/conversations/{peerFingerprint}` | `access_token` query param | Stream a single conversation |

### 8.4 `JwtTokenIssuer`

Issues JWT tokens with the following parameters:

| Parameter | Value |
|---|---|
| Algorithm | HS256 (HMAC-SHA256) |
| Issuer | `messager` |
| Audience | `messager` |
| Validity | 12 hours |
| Claim | `sub` (NameIdentifier) = SHA-512 fingerprint |

### 8.5 `SyncNotificationHub`

An in-memory pub/sub broker for WebSocket notifications, built on `System.Threading.Channels`. Each authenticated WebSocket client subscribes to a channel keyed by its fingerprint. When a message or key exchange is received, the backend publishes a notification that is immediately forwarded to connected clients.

---

## 9. Mobile Client

### 9.1 Profile Management (`App.tsx`, `profileStore.ts`)

The application supports multiple local profiles on a single device. Each profile contains:

- `id` — local UUID,
- `displayName`,
- `hasRegistration` — whether the profile is registered on the server,
- `registrationJson` — a JSON block containing: `apiBaseUrl`, `userName`, `userTag`, `fingerprintSha512`, `publicKeyDerBase64`, and `privateKey` (AES-GCM envelope).

Persistence: SQLite (tables `profiles`, `app_state`).

### 9.2 Registration Flow (`RegistrationPage.tsx`, `registrationCrypto.ts`)

```
User provides: userName, userTag, PIN, apiBaseUrl
                │
                ▼
RSA.generateKeys(KEY_BITS)           ← react-native-rsa-native
                │
                ▼
DER ← forge.asn1.toDer(publicKeyAsn1)
fingerprintSha512 ← SHA-512(DER)
                │
                ▼
privateKeyEnvelope ← PBKDF2(pin, salt, 150000) → AES-GCM encrypt(privateKeyPem)
                │
                ▼
POST /api/auth/register { UserName, UserTag, PublicKeyDerBase64 }
                │
                ▼
StoredRegistration saved to SQLite profiles
```

`KEY_BITS` = 1024 in `__DEV__` mode, 2048 in production (for emulator performance).

### 9.3 Login Flow (`LocalLoginPage.tsx`, `authApi.ts`)

```
PIN entered by user
         │
         ▼
AES-GCM decrypt(privateKeyEnvelope, PBKDF2(pin)) → privateKeyPem
         │
         ▼
GET /api/auth/challenge { FingerprintSha512 }
         │
         ▼
challengeBytes ← Base64decode(challengeBase64)
signature ← forge.pki.sign(challenge, privateKey, SHA-512)
         │
         ▼
POST /api/auth/login { FingerprintSha512, SignatureBase64 } → { AccessToken }
         │
         ▼
JWT stored in PrivateKeySessionContext (in-memory, auto-lock after 5 min)
```

### 9.4 Message Cryptography (`chatCrypto.ts`)

#### Conversation Initiation (Key Exchange)

```
Sender generates: chainSeedBase64 ← randomBytes(32) → Base64
encryptedSeed ← RSA-OAEP(SHA-256, chainSeedBase64, recipientPublicKeyDer)
POST /api/key-exchanges/ { ToPublicKey, EncryptedPrivateKeyBase64: encryptedSeed }
```

Integrity check: before encrypting the seed, the SHA-512 fingerprint of the recipient's DER key is computed and compared against the value retrieved from the server — a safeguard against key substitution.

#### Sending a Message

```
currentChainKey ← conversation_state (SQLite) or decryptIncomingChainSeed(...)
IV ← randomBytes(12)
ciphertext ← AES-GCM(key=currentChainKey, iv=IV, plaintext)
payload ← Base64(IV || tag || ciphertext)
messageHash ← SHA-512(encryptedPayloadBytes) → hex

POST /api/messages/ { ToPublicKey, EncryptedContentBase64: payload, MessageHash: hash }

nextChainKey ← SHA-256(currentChainKey)
UPDATE conversation_state SET outgoing_chain_key = nextChainKey
```

#### Receiving and Decrypting

```
GET /api/sync/delta or WebSocket
         │
         ▼
encryptedContentBase64 ← from API response
decryptedText ← AES-GCM decrypt(
                  key = incomingChainKey,
                  iv = payload[0:12],
                  tag = payload[12:28],
                  ct = payload[28:]
                )
nextIncomingKey ← SHA-256(incomingChainKey)
UPDATE conversation_state SET incoming_chain_key = nextIncomingKey
```

### 9.5 Local Data Store (`chatStore.ts`)

The SQLite database `messager_profiles.db` stores:

| Table | Description |
|---|---|
| `known_profiles` | Known fingerprint + DER + userName/Tag for each peer |
| `conversation_state` | Current outgoing/incoming chain keys per conversation pair |
| `messages_local` | Message cache with an optional `plaintext` field after decryption |
| `key_exchanges_local` | Key exchange record cache |
| `sync_state` | `last_synced_at_utc` timestamp per profile pair |

### 9.6 Private Key Session (`PrivateKeySessionContext.tsx`)

The private key unlocked by PIN is stored exclusively in memory within a React Context. Security mechanisms:

- Auto-lock after **5 minutes of inactivity**,
- The timer is reset on every cryptographic operation (*touch*),
- After the session expires, the app returns to the local login screen.

---

## 10. Cryptographic Model — Detailed Analysis

### 10.1 Cryptographic Identity Scheme

```
RSA Key (2048 bit)
      │
      ├── Public Key (DER, X.509 SubjectPublicKeyInfo)
      │       │
      │       └── SHA-512(DER) → FingerprintSha512 (128 hex) = user identifier
      │
      └── Private Key (PEM)
              │
              └── PBKDF2-SHA256(pin, salt, 150000, 32B) → K_wrap
                      │
                      └── AES-GCM(key=K_wrap, iv=12B) → PrivateKeyEnvelope
                              {saltBase64, ivBase64, tagBase64, ciphertextBase64}
```

### 10.2 Challenge-Response Login Protocol

```
Client                          Server
  │                               │
  │── POST /challenge ──────────▶ │
  │     {FingerprintSha512}        │  Generates: challenge = randomBytes(64)
  │◀── {ChallengeBase64} ─────── │  Stores: expires_at = now + 5min
  │                               │
  │  signature = RSA-sign(        │
  │    data = challengeBytes,     │
  │    key = privateKey,          │
  │    hash = SHA-512,            │
  │    padding = PKCS#1-v1.5)     │
  │                               │
  │── POST /login ──────────────▶ │
  │   {FingerprintSha512,         │  Checks: challenge valid, not consumed
  │    SignatureBase64}            │  RSA.VerifyData(challenge, signature,
  │                               │    SHA512, PKCS1)
  │◀── {AccessToken: JWT} ─────── │  Marks challenge as consumed
  │                               │
```

Security properties:
- Challenge is single-use (consumed_at),
- Challenge has a short validity window (5 minutes),
- No password or private key is transmitted over the network.

### 10.3 Key Exchange Protocol

```
Alice (initiator)               Server               Bob (recipient)
     │                             │                      │
     │── GET /public-keys/search ▶ │                      │
     │◀── {Der: bobPublicKey} ──── │                      │
     │                             │                      │
     │  Integrity check:                                  │
     │  SHA-512(bobPublicKey.Der) == bobFingerprint        │
     │                             │                      │
     │  seed = randomBytes(32)     │                      │
     │  encSeed = RSA-OAEP(SHA-256, seed, bobPublicKey)   │
     │                             │                      │
     │── POST /key-exchanges ────▶ │                      │
     │   {ToPublicKey: bobFP,      │                      │
     │    EncryptedPrivateKey:     │                      │
     │    encSeed}                 │                      │
     │                             │                      │
     │                             │◀── GET /key-exchanges ─│
     │                             │─── {encSeed} ─────────▶│
     │                             │                      │
     │                             │  seed = RSA-OAEP decrypt(encSeed, bobPrivateKey)
     │                             │  Store seed in conversation_state
```

### 10.4 Message Encryption — Chain Key Scheme

```
Seed (32B)
    │
    ├── K_0 = SHA-256(Seed)     ← key for message #1
    │
    ├── K_1 = SHA-256(K_0)      ← key for message #2
    │
    └── K_n = SHA-256(K_{n-1})  ← key for message #n+1

For each message:
    plaintext
        │
        ▼
    IV = randomBytes(12)
    ciphertext, tag = AES-GCM(key=K_n, iv=IV, plaintext)
    payload = Base64(IV || tag || ciphertext)
    hash = SHA-512(rawPayloadBytes)
```

**Forward secrecy:** even if an attacker learns K_n, they cannot recover K_{n-1} (SHA-256 is a one-way function), and therefore cannot decrypt earlier messages.

### 10.5 Summary of Cryptographic Primitives

| Purpose | Algorithm | Parameters |
|---|---|---|
| Identity generation | RSA | 2048-bit (1024 in dev) |
| User identification | SHA-512 | Input: public key DER |
| Private key protection (KDF) | PBKDF2-SHA256 | 150,000 iterations, 16B salt, 32B key |
| Private key protection (encryption) | AES-256-GCM | 12B IV, 16B tag |
| Authentication (signature) | RSA + SHA-512 + PKCS#1 v1.5 | — |
| Key material exchange | RSA-OAEP + SHA-256 | — |
| Message encryption | AES-256-GCM | 12B IV, 16B tag, random per message |
| Chain key derivation | SHA-256 | K_{n+1} = H(K_n) |
| Message hash | SHA-512 | Input: encrypted payload |

---

## 11. Database Schema

### 11.1 Backend (PostgreSQL)

The schema is created automatically by EF Core `EnsureCreated`.

#### Table `public_keys`

```sql
CREATE TABLE public_keys (
    fingerprint_sha512  VARCHAR(128)  PRIMARY KEY,
    der                 BYTEA         NOT NULL,
    user_name           VARCHAR(32)   NOT NULL,
    user_tag            INTEGER       NOT NULL,
    created_at          TIMESTAMP     NOT NULL,
    updated_at          TIMESTAMP     NOT NULL
);
```

#### Table `messages`

```sql
CREATE TABLE messages (
    from_public_key     VARCHAR(128)  NOT NULL,
    to_public_key       VARCHAR(128)  NOT NULL,
    message_hash        VARCHAR(128)  NOT NULL,
    encrypted_content   BYTEA         NOT NULL,
    created_at          TIMESTAMP     NOT NULL,

    PRIMARY KEY (from_public_key, to_public_key, message_hash),
    FOREIGN KEY (from_public_key) REFERENCES public_keys(fingerprint_sha512) ON DELETE RESTRICT,
    FOREIGN KEY (to_public_key)   REFERENCES public_keys(fingerprint_sha512) ON DELETE RESTRICT
);

CREATE INDEX idx_messages_from    ON messages(from_public_key);
CREATE INDEX idx_messages_to      ON messages(to_public_key);
CREATE INDEX idx_messages_created ON messages(created_at);
```

#### Table `key_exchanges`

```sql
CREATE TABLE key_exchanges (
    from_public_key        VARCHAR(128)  NOT NULL,
    to_public_key          VARCHAR(128)  NOT NULL,
    encrypted_private_key  BYTEA         NOT NULL,
    created_at             TIMESTAMP     NOT NULL,

    PRIMARY KEY (from_public_key, to_public_key),
    FOREIGN KEY (from_public_key) REFERENCES public_keys(fingerprint_sha512) ON DELETE RESTRICT,
    FOREIGN KEY (to_public_key)   REFERENCES public_keys(fingerprint_sha512) ON DELETE RESTRICT
);

CREATE INDEX idx_kex_from    ON key_exchanges(from_public_key);
CREATE INDEX idx_kex_to      ON key_exchanges(to_public_key);
CREATE INDEX idx_kex_created ON key_exchanges(created_at);
```

#### Table `login_challenges`

```sql
CREATE TABLE login_challenges (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint_sha512  VARCHAR(128)  NOT NULL,
    challenge           BYTEA         NOT NULL,
    created_at          TIMESTAMP     NOT NULL,
    expires_at          TIMESTAMP     NOT NULL,
    consumed_at         TIMESTAMP,

    FOREIGN KEY (fingerprint_sha512) REFERENCES public_keys(fingerprint_sha512) ON DELETE RESTRICT
);

CREATE INDEX idx_challenges_fp      ON login_challenges(fingerprint_sha512);
CREATE INDEX idx_challenges_expires ON login_challenges(expires_at);
```

### 11.2 Entity Relationship Diagram (ERD)

```
public_keys (PK: fingerprint_sha512)
    ║
    ╠══════════════════════╗
    ║                      ║
    ▼                      ▼
messages                key_exchanges
(PK: from+to+hash)      (PK: from+to)
from_public_key ──▶ FK  from_public_key ──▶ FK
to_public_key   ──▶ FK  to_public_key   ──▶ FK
    ║
    ▼
login_challenges
(PK: id)
fingerprint_sha512 ──▶ FK
```

### 11.3 Mobile Client (SQLite)

Database `messager_profiles.db`.

#### Table `profiles`

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | Local profile UUID |
| `display_name` | TEXT | Display name |
| `has_registration` | INTEGER (bool) | Whether the profile is registered on the server |
| `registration_json` | TEXT | JSON blob: `StoredRegistration` (including `PrivateKeyEnvelope`) |
| `created_at` / `updated_at` | TEXT | ISO 8601 |

#### Table `app_state`

| Column | Type | Description |
|---|---|---|
| `key` | TEXT PK | State key (`active_profile_id`) |
| `value` | TEXT | Value |

#### Table `known_profiles`

| Column | Type | Description |
|---|---|---|
| `owner_fingerprint` | TEXT | Owner's fingerprint |
| `peer_fingerprint` | TEXT PK | Peer's fingerprint |
| `peer_der_base64` | TEXT | Peer's RSA public key as Base64 DER |
| `peer_user_name` | TEXT | Peer's username |
| `peer_user_tag` | INTEGER | Peer's tag |

#### Table `conversation_state`

| Column | Type | Description |
|---|---|---|
| `owner_fingerprint` | TEXT | — |
| `peer_fingerprint` | TEXT | — |
| `outgoing_chain_key` | TEXT | Current outgoing chain key (Base64) |
| `incoming_chain_key` | TEXT | Current incoming chain key (Base64) |
| `outgoing_message_count` | INTEGER | Count of sent messages |
| `incoming_message_count` | INTEGER | Count of received messages |

#### Table `messages_local`

| Column | Type | Description |
|---|---|---|
| `message_hash` | TEXT PK | SHA-512 of the encrypted payload |
| `owner_fingerprint` | TEXT | Conversation owner |
| `from_fingerprint` | TEXT | Sender |
| `to_fingerprint` | TEXT | Recipient |
| `encrypted_content_base64` | TEXT | Encrypted content |
| `plaintext` | TEXT (NULL) | Decrypted content (optional) |
| `created_at` | TEXT | ISO 8601 |

#### Table `key_exchanges_local`

Key exchange record cache (analogous structure to the server).

#### Table `sync_state`

| Column | Type | Description |
|---|---|---|
| `owner_fingerprint` | TEXT PK | Owner's fingerprint |
| `peer_fingerprint` | TEXT PK | Peer's fingerprint |
| `last_synced_at_utc` | TEXT | Timestamp of the last synchronization |

---

## 12. Synchronization and Real-Time Communication

### 12.1 Incremental HTTP Synchronization

`GET /api/sync/delta?since=<ISO8601>` returns a `SyncDeltaResponse` containing all messages and key exchanges to/from the current user that are newer than `since`. The mobile client:

1. Reads `last_synced_at_utc` from `sync_state`,
2. Fetches the delta,
3. Updates local tables,
4. Saves the new `last_synced_at_utc`.

### 12.2 WebSocket — Push Notifications

The client connects via WebSocket to `/ws/sync?access_token=<JWT>` (token in query param due to WebSocket API limitations regarding custom headers).

```
WebSocket Client ◀──── SyncNotificationHub ◀──── SendMessageHandler
                                                ◀──── SendKeyExchangeHandler
```

`SyncNotificationHub` maintains a map of fingerprint → `Channel<string>`. After saving data, a handler publishes a notification; the WebSocket consumes it and forwards it to the client. The client then performs a full or incremental HTTP sync in response.

### 12.3 Conversation WebSocket

`/ws/conversations/{peerFingerprint}` streams the messages of a specific conversation without requiring a full inbox sync. Used in the `ConversationPage` screen.

---

## 13. Environment Configuration and Deployment

### 13.1 The `.env` File — Central Docker Compose Configuration

All environment variables for the Docker stack are stored in a `.env` file in the repository root. Docker Compose reads it automatically on every `docker compose` invocation.

The `.env` file is excluded from the repository via `.gitignore`. The `.env.example` file serves as a template to copy from:

```dotenv
# PostgreSQL
POSTGRES_DB=messager
POSTGRES_USER=messager
POSTGRES_PASSWORD=change-me

# JWT — generate with: openssl rand -base64 64
JWT_SIGNING_KEY=replace-with-strong-random-base64-value

# Message retention
MESSAGE_TTL_DAYS=30

# Nginx reverse proxy
APP_PORT=443
APP_DOMAIN=localhost
NGINX_USE_SSL=true

# Android builder — URL the APK will call at runtime
# Emulator:         http://10.0.2.2:5000
# Physical (ADB):   https://127.0.0.1:443
# LAN:              https://<LAN-IP>:443
MESSAGER_API_BASE_URL=https://127.0.0.1:443
SSL_CA_CERT_FILE=ca.pem
```

First-time setup:

```bash
cp .env.example .env
# Edit .env — change POSTGRES_PASSWORD and JWT_SIGNING_KEY
```

### 13.2 Environment Variables — Description

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `POSTGRES_USER` | Yes | PostgreSQL user |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL user password |
| `JWT_SIGNING_KEY` | Yes | HMAC-SHA256 secret (min. 32 bytes, recommended: Base64 64B) |
| `MESSAGE_TTL_DAYS` | No | Message retention period in days (default: `30`) |
| `APP_PORT` | No | nginx listen port (default: `443` with SSL, `80` without SSL) |
| `APP_DOMAIN` | No | Public domain / IP (default: `localhost`) |
| `NGINX_USE_SSL` | No | Enable TLS via nginx (default: `true`) |
| `SSL_CA_CERT_FILE` | No | CA certificate embedded in the APK by `android-builder` |
| `MESSAGER_API_BASE_URL` | No | API URL embedded in the APK by `android-builder` |

### 13.3 docker-compose — Full Stack

The `docker-compose.yml` file defines four services. All sensitive values are sourced from the `.env` file via `${VARIABLE}` interpolation:

```
db  ──▶  api  ──▶  nginx  ──▶  android-builder
(postgres:17-alpine)   (depends on db:healthy)   (SSL proxy)   (profile: release)
```

#### Service `db`

```yaml
image: postgres:17-alpine
environment:
  POSTGRES_DB: ${POSTGRES_DB}
  POSTGRES_USER: ${POSTGRES_USER}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
healthcheck:
  test: pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}
  interval: 5s / timeout: 5s / retries: 10
```

Data persistence: Docker volume `db-data`.

#### Service `api`

```yaml
environment:
  POSTGRES_CONNECTION_STRING: "Host=db;Port=5432;Database=${POSTGRES_DB};
                               Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}"
  JWT_SIGNING_KEY: ${JWT_SIGNING_KEY}
  MESSAGE_TTL_DAYS: ${MESSAGE_TTL_DAYS}
depends_on:
  db: { condition: service_healthy }
```

The API listens internally on port `5000` — it is not exposed directly to the host.

#### Service `nginx`

```yaml
ports: "${APP_PORT}:${APP_PORT}"
environment:
  NGINX_USE_SSL: ${NGINX_USE_SSL}
  APP_PORT: ${APP_PORT}
  APP_DOMAIN: ${APP_DOMAIN}
depends_on: [api]
volumes:
  - ./ssl:/etc/nginx/ssl:ro
```

Nginx acts as a reverse proxy — it terminates TLS (when `NGINX_USE_SSL=true`) and forwards traffic to `api:5000`. SSL certificates are placed in the `./ssl/` directory.

#### Service `android-builder`

```yaml
profiles: [release]
environment:
  MESSAGER_API_BASE_URL: ${MESSAGER_API_BASE_URL}
volumes:
  - ./App:/app
  - /app/node_modules
  - android-gradle:/root/.gradle
  - ./releases/android:/releases
```

This service is activated only when `--profile release` is passed. After the build completes, the APK appears in the `./releases/android/` directory.

#### Starting the Stack

```bash
# Server + database (development mode)
docker compose up -d

# Full deployment with APK build
docker compose --profile release up --build
```

### 13.4 Dockerfile.android — APK Build

`App/Dockerfile.android` is a CI/CD image for compiling APKs without a Windows environment:

| Layer | Value |
|---|---|
| Base image | `eclipse-temurin:17-jdk-jammy` (JDK 17 required by Android) |
| Node.js | 22.x (as per `engines` in `package.json`) |
| Android SDK | `cmdline-tools-11076708`, `platforms;android-35`, `build-tools;35.0.0` |
| `ANDROID_HOME` | `/opt/android-sdk` |

### 13.5 Local Setup (Without Docker)

**Backend:**

```bash
dotnet build ./Messager.slnx -c Debug
POSTGRES_CONNECTION_STRING="..." JWT_SIGNING_KEY="..." dotnet run --project ./API/API.csproj
```

**Mobile client (Android):**

```bash
cd App && npm install
cp .env.example .env
npm run android
```

### 13.6 Mobile Network Configuration

| Environment | `API_BASE_URL` |
|---|---|
| Android Emulator | `http://10.0.2.2:5000` |
| Physical device (USB) | `http://localhost:5000` (after `adb reverse`) |
| Physical device (Wi-Fi) | `http://<LAN-IP>:5000` |
| Production | `https://<domain>` |

---

## 14. Security Analysis

### 14.1 Threats and Protection Mechanisms

| Threat | Protection Mechanism |
|---|---|
| Interception of messages in transit | E2EE encryption — the server stores only encrypted data |
| Login brute-force | Rate limiting (10 req/min), single-use challenge, 12h JWT |
| Identity forgery | Fingerprint = SHA-512(DER) — irreversible binding of key to identifier |
| Public key substitution (MITM) | SHA-512(DER) == fingerprint verified before encrypting the seed |
| Compromise of private key on device | AES-GCM + PBKDF2 (150k iterations) — high cost for dictionary attacks |
| Challenge replay attack | `consumed_at` field + short 5-minute validity window |
| Leaking past messages after current key compromise | Forward secrecy: SHA-256(K_n) → K_{n+1} (one-way derivation) |
| Unauthorized sync (WebSocket) | JWT in `access_token` query param; validation identical to Bearer |
| DoS on search endpoint | Separate `search` rate limiter (30 req/min) |

### 14.2 Identified Weaknesses and Limitations

1. No transport-layer Perfect Forward Secrecy — HTTPS is not enforced.
2. No RSA key rotation.
3. No multi-device verification support.
4. Static `JWT_SIGNING_KEY` — rotation requires a restart.
5. `EnsureCreated` instead of EF Core migrations.
6. 1024-bit RSA in DEV mode.
7. No delivery acknowledgement (ack).

### 14.3 Positive Security Aspects

- The server holds no private keys or plaintexts — zero knowledge of message content,
- Cryptographically strong PRNG,
- Public key integrity verification before encryption (anti-MITM),
- Sensitive variables in `.env` excluded from the repository,
- `DeleteBehavior.Restrict` policies.

---

## 15. Limitations and Future Development

### 15.1 Current Technical Limitations

1. EF Core 10 preview.
2. Reflection used for aggregate hydration.
3. No automated tests.
4. Sequential chain-key synchronization.

### 15.2 Proposed Development Directions

| Priority | Area | Proposal |
|---|---|---|
| High | Persistence | EF Core migrations |
| High | Testing | Testcontainers |
| High | Security | HTTPS |
| Medium | Cryptography | Double Ratchet |
| Medium | UX | Delivery confirmations |
| Medium | Security | JWKS endpoint |
| Low | Architecture | Aggregate factory |
| Low | Monitoring | Security telemetry |

---

## 16. Conclusions

The Messager project is a coherent implementation of an E2EE messenger with Clean Architecture, RSA+AES-GCM+chain-key cryptography, incremental synchronization, and WebSocket support. The server holds no decryption keys. The project is ready for further operational hardening.

---

## 17. Glossary

| Term | Definition |
|---|---|
| **AES-GCM** | Advanced Encryption Standard in Galois/Counter Mode |
| **Aggregate** | DDD pattern — a cluster of entities treated as a unit of consistency |
| **Chain Key** | Symmetric key derived as: K_{n+1} = H(K_n) |
| **Challenge-Response** | Authentication protocol that avoids transmitting a password |
| **Clean Architecture** | Architectural pattern with unidirectional dependency flow |
| **DER** | Distinguished Encoding Rules — binary ASN.1 format |
| **E2EE** | End-to-End Encryption |
| **EF Core** | Entity Framework Core — Microsoft ORM |
| **Fingerprint** | SHA-512 of a public key used as an identifier |
| **Forward Secrecy** | Compromise of the current key does not reveal past messages |
| **IV** | Initialization Vector — randomly generated per-message nonce |
| **JWT** | JSON Web Token |
| **Key Exchange** | Transmission of encrypted key material |
| **Minimal API** | ASP.NET Core without controllers |
| **PBKDF2** | Password-Based Key Derivation Function 2 |
| **PEM** | Privacy Enhanced Mail — text-based key format |
| **RSA** | Rivest–Shamir–Adleman |
| **RSA-OAEP** | RSA with Optimal Asymmetric Encryption Padding |
| **SHA-512** | Secure Hash Algorithm 512-bit |
| **SQLite** | Embedded client-side database |
| **WebSocket** | Protocol for full-duplex real-time communication |

---

*Document generated from source code analysis of repository `c:\Users\Blazej\sources\Messager`. Date: 2026-06-09.*
