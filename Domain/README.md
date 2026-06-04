# Domain

Core business rules and entities for Messager. This project has **no external dependencies** — it contains only pure C# and encapsulates the invariants of the messaging domain.

## Responsibilities

- Define the core entities (`PublicKey`, `Message`, `KeyExchange`)
- Enforce business rules and validation through constructors and methods
- Provide a stable, dependency-free foundation for the Application and Infrastructure layers

## Project Structure

```
Domain/
├── BaseEntity.cs       # Base class: timestamps (CreatedAt, UpdatedAt)
├── PublicKey.cs        # User identity entity
├── Message.cs          # Encrypted message entity
├── KeyExchange.cs      # Key exchange entity
└── Domain.csproj
```

## Entities

### `PublicKey`

Represents a registered user identity. The primary identifier is a SHA-512 fingerprint of the user's RSA public key.

| Property | Type | Description |
|----------|------|-------------|
| `FingerprintSha512` | `string` | 128-char hex, unique user ID |
| `Der` | `byte[]` | Raw DER-encoded public key |
| `UserName` | `string` | Human-readable display name |
| `UserTag` | `string` | Discriminator tag (for search) |

Business rules:
- Fingerprint must be exactly 128 hex characters
- DER payload must be non-empty
- UserName and UserTag must be non-empty

### `Message`

Represents a single encrypted message between two users. The server stores only ciphertext — plaintext is never present.

| Property | Type | Description |
|----------|------|-------------|
| `FromPublicKey` | `string` | Sender fingerprint |
| `ToPublicKey` | `string` | Recipient fingerprint |
| `MessageHash` | `string` | SHA-512 hash of ciphertext (dedup key) |
| `EncryptedContent` | `byte[]` | AES-256-GCM ciphertext |

Business rules:
- Sender and recipient must be different identities
- Encrypted content must be non-empty
- The composite key `(FromPublicKey, ToPublicKey, MessageHash)` is unique

### `KeyExchange`

Represents the asymmetric key exchange that seeds a chain key for a conversation.

| Property | Type | Description |
|----------|------|-------------|
| `FromPublicKey` | `string` | Initiating party fingerprint |
| `ToPublicKey` | `string` | Receiving party fingerprint |
| `EncryptedPrivateKey` | `byte[]` | RSA-OAEP encrypted chain key seed |

Business rules:
- Sender and recipient must be different identities
- One active exchange per directed pair `(From, To)`

### `BaseEntity`

All entities extend `BaseEntity`:

```csharp
public abstract class BaseEntity
{
    public DateTimeOffset CreatedAt { get; protected set; }
    public DateTimeOffset UpdatedAt { get; protected set; }
}
```

## Design Principles

- **No framework dependencies** — Domain does not reference EF Core, ASP.NET, or any infrastructure concern.
- **Invariants in constructors** — Invalid state cannot be constructed; entities throw on invalid arguments.
- **Value semantics for IDs** — Fingerprints are plain strings (SHA-512 hex) rather than GUIDs, reflecting the domain's cryptographic identity model.

## Layer Dependencies

```
Domain  →  (none)
```

Domain is the innermost layer. Nothing it references can change due to infrastructure or framework decisions.
