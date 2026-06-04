# Application

Use-case orchestration layer for Messager. This project defines what the system *can do* — it contains handlers for every user-facing operation and the interfaces that Infrastructure must implement.

## Responsibilities

- Implement use-case handlers (one handler per operation)
- Define service interfaces consumed by handlers
- Coordinate Domain entities through Infrastructure services
- Remain independent of HTTP, database drivers, and cryptographic libraries

## Project Structure

```
Application/
├── Handlers/
│   ├── RegisterHandler.cs
│   ├── GetLoginChallengeHandler.cs
│   ├── LoginHandler.cs
│   ├── SendMessageHandler.cs
│   ├── GetMessagesHandler.cs
│   ├── SendKeyExchangeHandler.cs
│   └── GetKeyExchangesHandler.cs
├── Interfaces/
│   ├── ICurrentPublicKey.cs
│   ├── ILoginChallengeService.cs
│   ├── ILoginService.cs
│   ├── IPublicKeyRepository.cs
│   └── IPublicKeySecurityService.cs
└── Application.csproj
```

## Handlers

Each handler receives a request record, performs business logic via injected services, and returns a result record. No handler knows about HTTP or the database driver.

| Handler | Description |
|---------|-------------|
| `RegisterHandler` | Validates and persists a new RSA public key; returns the computed SHA-512 fingerprint |
| `GetLoginChallengeHandler` | Generates a 64-byte random challenge tied to a fingerprint; stores it with a 5-minute TTL |
| `LoginHandler` | Verifies the RSA signature against the stored challenge; issues a JWT on success |
| `SendMessageHandler` | Validates sender/recipient, persists encrypted message, notifies via WebSocket |
| `GetMessagesHandler` | Returns encrypted messages between the caller and a specified peer |
| `SendKeyExchangeHandler` | Persists or replaces a key exchange from caller to peer |
| `GetKeyExchangesHandler` | Returns key exchanges addressed to the caller |

## Service Interfaces

Interfaces define the contract that Infrastructure must fulfil. Handlers depend only on these abstractions.

| Interface | Responsibility |
|-----------|----------------|
| `IPublicKeyRepository` | CRUD for `PublicKey` entities; search by name/tag |
| `ILoginChallengeService` | Create, retrieve, and consume login challenges |
| `ILoginService` | Full login flow: verify challenge signature, return JWT |
| `IPublicKeySecurityService` | RSA signature verification using a stored public key |
| `ICurrentPublicKey` | Ambient accessor for the authenticated caller's fingerprint (populated from JWT claim) |

## Dependency Rule

```
Application  →  Domain
Application  ↚  Infrastructure   (depends on interfaces, not implementations)
Application  ↚  API
```

Infrastructure registers its implementations against Application interfaces in the DI container. Handlers never import an Infrastructure type directly.

## Adding a New Use Case

1. Create a handler class in `Handlers/` that takes a request record and returns a result record.
2. Inject only `Application.Interfaces.*` — never Infrastructure or API types.
3. Register the handler in `Infrastructure/DependencyInjection.cs` or `API/Program.cs`.
4. Add the corresponding endpoint in `API/Endpoints/`.
