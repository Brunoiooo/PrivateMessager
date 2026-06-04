# Infrastructure

Technical implementation layer for Messager. This project implements all Application interfaces — database access, RSA cryptography, JWT issuance, and session context — so that the Application and Domain layers remain free of framework dependencies.

## Responsibilities

- Entity Framework Core DbContext and entity mapping
- Application interface implementations (repositories, services)
- DI registration of all infrastructure services
- PostgreSQL persistence

## Project Structure

```
Infrastructure/
├── DependencyInjection.cs          # Extension method to wire all services into IServiceCollection
├── Persistence/
│   ├── MessagerDbContext.cs         # EF Core DbContext; schema via EnsureCreated
│   └── Models/                     # EF persistence records (separate from Domain entities)
│       ├── PublicKeyRecord.cs
│       ├── MessageRecord.cs
│       ├── KeyExchangeRecord.cs
│       └── LoginChallengeRecord.cs
└── Services/
    ├── PublicKeyRepository.cs       # IPublicKeyRepository → EF Core
    ├── LoginService.cs              # ILoginService → challenge verify + JWT issue
    ├── LoginChallengeService.cs     # ILoginChallengeService → challenge CRUD
    ├── PublicKeySecurityService.cs  # IPublicKeySecurityService → RSA verify
    └── CurrentPublicKeyAccessor.cs  # ICurrentPublicKey → reads JWT claim from HttpContext
```

## Database

**Backend database: PostgreSQL 17**

The schema is created automatically on API startup via `EnsureCreated()`. There are no EF Core migrations in this version.

### Tables

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `public_keys` | `fingerprint_sha512` | Registered user identities (RSA public key + display name) |
| `messages` | `(from_public_key, to_public_key, message_hash)` | Encrypted messages; deduplication via SHA-512 hash of ciphertext |
| `key_exchanges` | `(from_public_key, to_public_key)` | Chain key seeds; one per directed conversation pair |
| `login_challenges` | `id` (GUID) | Short-lived sign challenges (5-minute TTL, single-use) |

Indexes are defined on foreign keys and `created_at` columns to support efficient delta sync queries.

### EF Core Mapping

Persistence records in `Models/` are separate from Domain entities. The DbContext maps records to tables and returns Domain objects via explicit projection — Infrastructure never leaks ORM types into higher layers.

## Services

### `PublicKeyRepository`

Implements `IPublicKeyRepository`. Wraps EF Core queries for:
- Inserting a new public key
- Looking up a key by fingerprint
- Searching by `UserName` / `UserTag`
- Listing messages and key exchanges for a given identity

### `LoginChallengeService`

Implements `ILoginChallengeService`. Creates challenge records with a computed `expires_at`, marks them as consumed after use to prevent replay.

### `LoginService`

Implements `ILoginService`. Orchestrates the full login:
1. Loads the stored challenge
2. Delegates signature verification to `IPublicKeySecurityService`
3. Consumes the challenge (marks `consumed_at`)
4. Issues a JWT via `JwtTokenIssuer` (lives in API but injected here)

### `PublicKeySecurityService`

Implements `IPublicKeySecurityService`. Decodes a DER-encoded RSA public key and verifies an RSA-SHA512 signature over a byte array using `System.Security.Cryptography`.

### `CurrentPublicKeyAccessor`

Implements `ICurrentPublicKey`. Reads the `NameIdentifier` claim from the current `HttpContext` user, providing the authenticated caller's fingerprint to handlers as ambient context.

## Dependency Injection

Call `services.AddInfrastructure(configuration)` from `API/Program.cs` to register all services:

```csharp
// API/Program.cs
builder.Services.AddInfrastructure(builder.Configuration);
```

`DependencyInjection.cs` registers:
- `MessagerDbContext` with PostgreSQL connection string
- All repository and service implementations against their interfaces
- `IHttpContextAccessor` (required by `CurrentPublicKeyAccessor`)

## Layer Dependencies

```
Infrastructure  →  Application (implements interfaces)
Infrastructure  →  Domain      (maps to/from domain entities)
Infrastructure  ↚  API         (no upward dependency)
```
