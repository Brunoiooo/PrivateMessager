# API

ASP.NET Core (.NET 10) HTTP and WebSocket gateway for Messager. This project is the entry point for all client communication — it maps HTTP routes and WebSocket connections to Application-layer handlers and returns DTO responses.

## Responsibilities

- Minimal API endpoint registration (`/api/*`)
- JWT Bearer authentication setup and validation
- WebSocket sync hub (`/ws/sync`)
- DTO mapping between HTTP contracts and Application handlers
- Rate limiting (auth: 10 req/min, search: 30 req/min)

## Project Structure

```
API/
├── Contracts/                # Request/response DTOs
│   ├── AuthContracts.cs
│   ├── KeyExchangeContracts.cs
│   ├── MessageContracts.cs
│   ├── PublicKeyContracts.cs
│   └── SyncContracts.cs
├── Endpoints/                # Minimal API route handlers
│   ├── AuthEndpoints.cs
│   ├── KeyExchangeEndpoints.cs
│   ├── MessageEndpoints.cs
│   ├── PublicKeyEndpoints.cs
│   ├── SyncEndpoints.cs
│   └── EndpointHelpers.cs
├── Realtime/
│   └── SyncNotificationHub.cs  # WebSocket connection manager
├── Security/
│   └── JwtTokenIssuer.cs       # Token generation & signing
├── Program.cs                  # DI wiring, middleware pipeline
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
| GET | `/api/messages/?toPublicKey=` | JWT | Fetch messages exchanged with a peer |

### Key Exchange

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/key-exchanges/` | JWT | Publish or update a key exchange |
| GET | `/api/key-exchanges/?toPublicKey=` | JWT | Fetch key exchange from a peer |

### Discovery & Sync

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/public-keys/search` | JWT | Search users by `userName` and optional `userTag` |
| GET | `/api/sync/delta?since=` | JWT | HTTP incremental sync |
| GET | `/ws/sync?access_token=` | JWT (query) | WebSocket incremental sync |

## Authentication Flow

```
POST /api/auth/challenge  →  {challengeId, challenge (Base64)}
        ↓
Client signs challenge with RSA private key (SHA-512)
        ↓
POST /api/auth/login  →  {token: "Bearer eyJ..."}
        ↓
Authorization: Bearer <token>  on all subsequent requests
```

JWT claims:
- `NameIdentifier` — SHA-512 fingerprint of the user's public key
- Expiry — 12 hours

## Configuration

Environment variables (or `appsettings.json`):

| Variable | Description | Default |
|----------|-------------|---------|
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string | — |
| `Jwt__SigningKey` | HMAC-SHA256 signing secret (min 32 chars) | — |
| `Jwt__Issuer` | JWT issuer claim | `Messager` |
| `API_BIND_IP` | Bind address | `0.0.0.0` |
| `API_BIND_PORT` | Listen port | `5000` |

## Running Locally

```bash
# From repo root
dotnet run --project API/API.csproj
```

Or with Docker Compose (starts PostgreSQL + API together):

```bash
docker-compose up -d
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Microsoft.AspNetCore.Authentication.JwtBearer | 9.0.8 | JWT middleware |
| Microsoft.EntityFrameworkCore | 9.0.8 | ORM (via Infrastructure) |
| Npgsql.EntityFrameworkCore.PostgreSQL | 9.0.4 | PostgreSQL driver |

## Layer Dependencies

```
API  →  Application (handlers)
API  →  Infrastructure (DI registration only, via Program.cs)
```

The API project does not reference Domain or Infrastructure types directly — it communicates through Application interfaces registered in the DI container.
