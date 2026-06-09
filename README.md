# Messager

End-to-end encrypted messaging application built with **.NET 10** and **React Native**. Messages are encrypted on-device — the server never sees plaintext.

## Architecture

```
Messager/
├── Domain/          # Business rules and entities
├── Application/     # Use-case handlers and service interfaces
├── Infrastructure/  # EF Core, PostgreSQL, cryptographic services
├── API/             # ASP.NET Core Minimal API + WebSocket gateway
└── App/             # React Native mobile client (Android / iOS)
```

Clean Architecture is enforced: outer layers depend on inner layers, never the reverse.

```
API  ──────────────────────────────────────────────────────┐
     ↓ depends on                                           │
Application ────────────────────────────────────────────── │
     ↓ depends on                                           │
Domain                                           Infrastructure
                                                  ↓ implements ↑ Application interfaces
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server runtime | .NET 10 / ASP.NET Core Minimal APIs |
| Database | PostgreSQL 17 + Entity Framework Core 9 |
| Authentication | RSA challenge-response → JWT Bearer |
| Real-time | WebSocket (`/ws/sync`) |
| Mobile | React Native 0.85 + TypeScript |
| Mobile DB | SQLite (local cache & key store) |
| Cryptography | AES-256-GCM, RSA-OAEP, PBKDF2-SHA256 |
| Containers | Docker Compose |

## Security Model

1. **Identity** — User ID is the SHA-512 fingerprint of their RSA-2048 public key.
2. **Authentication** — Server issues a 64-byte challenge; client signs it with their private key; server verifies and issues a 12-hour JWT.
3. **Key exchange** — First message seeds a symmetric chain key (RSA-OAEP encrypted); subsequent keys are derived via SHA-256.
4. **Message encryption** — AES-256-GCM per message; chain key advances after every send.
5. **Private key protection** — Private key is AES-256-GCM encrypted with a PBKDF2 key derived from the user's PIN (150 000 iterations).

## Quick Start

### Full stack with Docker

```bash
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD and JWT_SIGNING_KEY
docker compose up -d
```

Starts PostgreSQL, the API, and an nginx reverse proxy. Default access: `https://localhost` (SSL enabled) or `http://localhost:80` (when `NGINX_USE_SSL=false`).

### Backend only (development)

```bash
dotnet run --project API/API.csproj
```

Requires a running PostgreSQL instance. Set `POSTGRES_CONNECTION_STRING` and `JWT_SIGNING_KEY` environment variables.

### Mobile app

```bash
cd App
npm install
npm start           # Metro bundler
npm run android     # or: npm run ios
```

See [`App/README.md`](App/README.md) for full setup instructions.

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Upload RSA public key |
| POST | `/api/auth/challenge` | Request sign challenge |
| POST | `/api/auth/login` | Submit signed challenge, receive JWT |
| GET | `/api/public-keys/search` | Find users by name and tag |
| POST | `/api/messages/` | Send encrypted message |
| GET | `/api/messages/` | Fetch messages from a peer |
| POST | `/api/key-exchanges/` | Publish key exchange |
| GET | `/api/key-exchanges/` | Fetch key exchanges |
| POST | `/api/pre-keys/signed` | Upload signed pre-key |
| POST | `/api/pre-keys/one-time` | Upload one-time pre-keys |
| GET | `/api/pre-keys/bundle` | Fetch pre-key bundle for a peer |
| GET | `/api/sync/delta` | Incremental sync (HTTP polling) |
| GET | `/ws/sync` | Incremental sync (WebSocket) |
| GET | `/ws/conversations/{peerFingerprint}` | Conversation stream (WebSocket) |

## User Flow

```
Register (generate RSA key pair)
  ↓
Upload public key  →  Server stores fingerprint
  ↓
PIN unlock (PBKDF2 → AES decrypt private key)
  ↓
Challenge-response  →  JWT issued
  ↓
Search contacts  →  Key exchange  →  Send encrypted messages
  ↓
Periodic delta sync (HTTP or WebSocket)
```

## Sub-project Documentation

| Project | Description |
|---------|-------------|
| [`Domain`](Domain/README.md) | Entities, value objects, domain rules |
| [`Application`](Application/README.md) | Use-case handlers and service contracts |
| [`Infrastructure`](Infrastructure/README.md) | Database, persistence, crypto services |
| [`API`](API/README.md) | HTTP endpoints, JWT, WebSocket |
| [`App`](App/README.md) | React Native mobile client |

## Environment Variables

See `.env.example` for all variables. Key ones:

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `JWT_SIGNING_KEY` | HMAC-SHA256 secret (min 32 chars) |
| `MESSAGE_TTL_DAYS` | Days before undelivered messages are deleted (default: 30) |
| `APP_PORT` | nginx listen port (default: 443) |
| `APP_DOMAIN` | Public domain/IP (default: localhost) |
| `NGINX_USE_SSL` | Enable TLS via nginx (default: true) |
| `SSL_CA_CERT_FILE` | CA certificate for Android builder |
| `MESSAGER_API_BASE_URL` | API URL baked into the APK |

## Requirements

- .NET 10 SDK
- PostgreSQL 14+
- Node.js 20+ / npm 10+
- React Native development environment (Android Studio or Xcode)
