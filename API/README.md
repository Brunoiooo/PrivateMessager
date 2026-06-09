# API

ASP.NET Core (.NET 10) HTTP and WebSocket gateway for Messager. This project is the entry point for all client communication — it maps HTTP routes and WebSocket connections to Application-layer handlers and returns DTO responses.

## Responsibilities

- Minimal API endpoint registration (`/api/*`)
- JWT Bearer authentication setup and validation
- WebSocket sync hub (`/ws/sync`, `/ws/conversations/{peer}`)
- DTO mapping between HTTP contracts and Application handlers
- Rate limiting (auth: 10 req/min, search: 30 req/min)
- Signal Protocol pre-key management endpoints

## Project Structure

```
API/
├── BackgroundServices/
│   └── MessageCleanupService.cs    # TTL-based message deletion (MESSAGE_TTL_DAYS)
├── Contracts/                      # Request/response DTOs
│   ├── AuthContracts.cs
│   ├── KeyExchangeContracts.cs
│   ├── MessageContracts.cs
│   ├── PreKeyContracts.cs
│   ├── PublicKeyContracts.cs
│   └── SyncContracts.cs
├── Endpoints/                      # Minimal API route handlers
│   ├── AuthEndpoints.cs
│   ├── KeyExchangeEndpoints.cs
│   ├── MessageEndpoints.cs
│   ├── PreKeyEndpoints.cs
│   ├── PublicKeyEndpoints.cs
│   ├── SyncEndpoints.cs
│   └── EndpointHelpers.cs
├── Realtime/
│   └── SyncNotificationHub.cs      # WebSocket connection manager
├── Security/
│   └── JwtTokenIssuer.cs           # Token generation & signing
├── Program.cs                      # DI wiring, middleware pipeline
├── API.csproj
└── Dockerfile
```

## Endpoints

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register RSA public key (DER, Base64) |
| POST | `/api/auth/challenge` | — | Request 64-byte sign challenge |
| POST | `/api/auth/login` | — | Submit RSA signature, receive JWT |

### Messaging

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/messages/` | JWT | Send AES-GCM encrypted message |
| GET | `/api/messages/` | JWT | Fetch messages exchanged with a peer |

### Key Exchange

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/key-exchanges/` | JWT | Publish or update a key exchange |
| GET | `/api/key-exchanges/` | JWT | Fetch key exchange from a peer |

### Signal Protocol Pre-Keys

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/pre-keys/signed` | JWT | Upload signed pre-key |
| POST | `/api/pre-keys/one-time` | JWT | Upload batch of one-time pre-keys |
| GET | `/api/pre-keys/bundle` | JWT | Fetch pre-key bundle for a peer |

### Discovery & Sync

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/public-keys/search` | JWT | Search users by `userName` and optional `userTag` |
| GET | `/api/sync/delta?since=` | JWT | HTTP incremental sync |
| WS | `/ws/sync?access_token=` | JWT (query) | WebSocket full inbox sync |
| WS | `/ws/conversations/{peerFingerprint}?access_token=` | JWT (query) | WebSocket conversation stream |

## Authentication Flow

```
POST /api/auth/challenge  →  {challengeBase64}
        ↓
Client signs challenge with RSA private key (SHA-512, PKCS1)
        ↓
POST /api/auth/login  →  {accessToken: "eyJ..."}
        ↓
Authorization: Bearer <token>  on all subsequent requests
```

JWT claims:
- `NameIdentifier` — SHA-512 fingerprint of the user's public key
- Expiry — 12 hours
- Issuer / Audience — `messager-api` / `messager-client`

## Background Services

`MessageCleanupService` runs periodically and deletes messages older than `MESSAGE_TTL_DAYS` days (default: 30). Configured via the `MESSAGE_TTL_DAYS` environment variable.

## Configuration

Environment variables read by the API container:

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_CONNECTION_STRING` | PostgreSQL connection string | — (required) |
| `JWT_SIGNING_KEY` | HMAC-SHA256 signing secret (min 32 chars) | — (required) |
| `MESSAGE_TTL_DAYS` | Message retention period in days | `30` |

Kestrel binding is configured by the nginx reverse proxy — the API listens on `0.0.0.0:5000` internally. Public access is through nginx (see `nginx/` and `.env.example`).

## Running Locally

```bash
# From repo root
POSTGRES_CONNECTION_STRING="Host=localhost;Port=5432;Database=messager;Username=messager;Password=messager" \
JWT_SIGNING_KEY="<your-key>" \
dotnet run --project API/API.csproj
```

Or with Docker Compose (starts PostgreSQL + API + nginx):

```bash
cp .env.example .env
docker compose up -d
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Microsoft.AspNetCore.Authentication.JwtBearer | 10.x | JWT middleware |
| Microsoft.EntityFrameworkCore | 10.x | ORM (via Infrastructure) |
| Npgsql.EntityFrameworkCore.PostgreSQL | 10.x | PostgreSQL driver |

## Layer Dependencies

```
API  →  Application (handlers)
API  →  Infrastructure (DI registration only, via Program.cs)
```

The API project does not reference Domain or Infrastructure types directly — it communicates through Application interfaces registered in the DI container.
