# Messager

A **full-stack, end-to-end encrypted messenger** combining a modern .NET 10 API backend with a React Native mobile application. Built with security at its core, featuring Signal Protocol E2E encryption, challenge-response authentication, and multi-platform support.

🔒 **Production-ready security** | 📱 **React Native mobile** | 🔐 **Signal Protocol E2E** | 🐳 **Docker support**

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Security Model](#security-model)
- [API Endpoints](#api-endpoints)
- [Development](#development)
- [Docker](#docker)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 22.11.0
- **.NET 8.0+** (tested on .NET 10)
- **Docker & Docker Compose** (optional)
- **PostgreSQL** (if running without Docker)
- **Android SDK** or **Xcode** (for mobile builds)

### Local Setup (with Docker)

```bash
# Clone repository
git clone https://github.com/your-org/messager.git
cd messager

# Copy environment template
cp .env.example .env

# Update .env with your values
nano .env

# Start Docker stack
docker-compose up -d

# Apply migrations (inside docker)
docker exec messager-api dotnet ef database update

# Access the app
# - API: https://localhost:443/swagger
# - Mobile: http://localhost:3000 (dev server)
```

### Local Setup (manual)

#### Backend

```bash
cd API
dotnet restore
dotnet build
dotnet run
```

Runs on `http://localhost:5000` (HTTPS redirect enabled).

#### Frontend

```bash
cd App
npm install
npm start                 # Start Metro bundler
npm run android          # Android emulator/device
npm run ios             # iOS simulator/device
```

---

## 🛠️ Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Backend API** | .NET 10, ASP.NET Core Minimal APIs | Clean Architecture (Domain → Application → Infrastructure) |
| **Database** | PostgreSQL 17 + Entity Framework Core | Type-safe, migrations-ready |
| **Authentication** | JWT + RSA-OAEP challenge-response | 12-hour token TTL, 30s clock skew tolerance |
| **E2E Encryption** | Signal Protocol (libsignal-protocol-typescript) | Ratcheting, forward secrecy |
| **Message Encryption** | AES-256-GCM + RSA-OAEP | Authenticated, random IVs |
| **Mobile** | React Native 0.85 + TypeScript | Cross-platform iOS/Android |
| **Local Storage** | SQLite + AsyncStorage | Persistent offline message cache |
| **Biometrics** | react-native-keychain | Fingerprint/Face + secure key storage |
| **Infrastructure** | Docker, Nginx, Docker Compose | TLS 1.2+, WebSocket proxy, HTTP→HTTPS redirect |

---

## ✨ Features

- ✅ **End-to-End Encrypted Messaging** — Signal Protocol with forward secrecy
- ✅ **Zero-Knowledge Architecture** — Server never sees plaintext messages
- ✅ **Challenge-Response Login** — RSA-SHA512 signatures, no password transmission
- ✅ **Real-time Sync** — WebSocket gateway for instant notifications
- ✅ **Multi-Profile Support** — Manage multiple identities on one device
- ✅ **Offline-First** — SQLite local cache, automatic sync on reconnection
- ✅ **Biometric Authentication** — PIN + fingerprint/face unlock
- ✅ **Message TTL** — Automatic expiration (configurable, default 30 days)
- ✅ **Auto-Lock** — Session timeout with background inactivity
- ✅ **Cross-Platform** — iOS and Android support via React Native

---

## 🏗️ Architecture

### Clean Architecture Pattern

```
Domain Layer
    ↓
Application Layer (CQRS-style handlers)
    ↓
Infrastructure Layer (EF Core, services)
    ↓
API Layer (HTTP endpoints, WebSocket hubs)
```

### Authentication Flow

```
1. User registers: RSA key pair generated, encrypted with PIN (PBKDF2)
2. Login: Server sends cryptographic challenge
3. Client signs challenge with private key
4. Server verifies signature, issues JWT
5. JWT used for all subsequent requests (WebSocket + HTTP)
```

### Message Encryption Flow

```
Sender                                  Receiver
  ↓                                        ↓
AES-256-GCM                        Signal Protocol
  ↓                                        ↓
RSA-OAEP (recipient's key)    Decrypt with ratcheted key
  ↓                                        ↓
[Encrypted message] --------→ Store in local cache
```

---

## 📁 Project Structure

```
Messager/
├── API/                          # ASP.NET Core Minimal APIs
│   ├── Endpoints/                # Route handlers
│   │   ├── AuthEndpoints.cs
│   │   ├── MessageEndpoints.cs
│   │   ├── KeyExchangeEndpoints.cs
│   │   ├── PublicKeyEndpoints.cs
│   │   ├── SyncEndpoints.cs
│   │   └── PreKeyEndpoints.cs
│   ├── Contracts/                # Request/Response DTOs
│   ├── Security/
│   │   └── JwtTokenIssuer.cs     # JWT generation (12h TTL)
│   ├── Realtime/
│   │   └── SyncNotificationHub.cs  # WebSocket gateway
│   ├── BackgroundServices/
│   │   └── MessageCleanupService.cs # TTL-based expiration
│   ├── Program.cs                # DI, middleware setup
│   └── Dockerfile
│
├── Application/                  # Business logic (CQRS handlers)
│   ├── Handlers/
│   │   ├── RegisterHandler.cs
│   │   ├── LoginHandler.cs
│   │   ├── GetLoginChallengeHandler.cs
│   │   ├── SendMessageHandler.cs
│   │   ├── GetMessagesHandler.cs
│   │   ├── SendKeyExchangeHandler.cs
│   │   └── GetKeyExchangesHandler.cs
│   └── Interfaces/               # Service contracts
│
├── Infrastructure/               # Data access & services
│   ├── Persistence/
│   │   └── MessagerDbContext.cs  # EF Core DbContext
│   ├── Repositories/
│   │   └── PublicKeyRepository.cs
│   ├── Services/
│   │   ├── LoginService.cs
│   │   ├── LoginChallengeService.cs
│   │   ├── CurrentPublicKeyAccessor.cs
│   │   └── PublicKeySecurityService.cs
│   └── Migrations/               # EF Core migrations
│
├── Domain/                       # Core entities & value objects
│   ├── BaseEntity.cs
│   ├── PublicKey.cs
│   ├── Message.cs
│   ├── KeyExchange.cs
│   ├── LoginChallenge.cs
│   ├── SignedPreKey.cs
│   └── OneTimePreKey.cs
│
├── App/                          # React Native frontend
│   ├── src/
│   │   ├── pages/                # Screens (Auth, Messaging, Security, etc.)
│   │   ├── components/           # Reusable UI components
│   │   ├── services/             # API clients, crypto, storage
│   │   ├── context/              # React Context (PrivateKeySessionContext)
│   │   ├── types/                # TypeScript definitions
│   │   └── App.tsx               # Root component
│   ├── android/                  # Android native code
│   ├── ios/                      # iOS native code
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile.android
│   └── metro.config.js
│
├── docker-compose.yml            # PostgreSQL + API + Nginx + Android builder
├── nginx/                        # Nginx configuration & SSL setup
├── .env.example                  # Environment variables template
├── CLAUDE.md                     # Development guidelines
├── DOKUMENTACJA.md               # Polish documentation
├── doc/                          # Multilingual docs (en, pl, de, fr, es, pt, ua)
└── Messager.slnx                 # Modern .NET solution format
```

---

## 🔐 Security Model

### Encryption Stack

1. **Key Exchange** — RSA-OAEP (2048-bit)
   - Asymmetric encryption of symmetric keys
   - Server stores recipient's public key only

2. **Message Encryption** — AES-256-GCM
   - Authenticated encryption with random IVs
   - Forward secrecy via Signal Protocol ratcheting

3. **Authentication** — RSA-SHA512 + Challenge-Response
   - No passwords transmitted over network
   - Challenge prevents replay attacks
   - Signatures prove key ownership

### Data at Rest

- Private keys: Encrypted with PBKDF2 (PIN-derived key)
- Stored in SQLite on-device (iOS Keychain, Android Keystore)
- Messages: AES-256-GCM in database (server never sees plaintext)

### Transport Security

- HTTPS mandatory (TLS 1.2+)
- Nginx redirect: HTTP → HTTPS
- WebSocket over WSS (secure)
- JWT validation on all endpoints

### Known Security Practices

- JWT includes `issuer` and `audience` claims (validated)
- Rate limiting on auth (10 req/min/IP) and search (30 req/min/IP)
- SQL injection protection: EF Core parameterized queries
- LIKE wildcards escaped in user search
- Fingerprint validation: 128-char hex format

### ⚠️ Development-Mode Relaxations

- **DEV**: 1024-bit RSA (switch to 2048-bit in production)
- **DEV**: Self-signed SSL certificates in `ssl/` (use real certs in production)
- Ensure `JWT_SIGNING_KEY` and `POSTGRES_CONNECTION_STRING` are set (no fallbacks)

---

## 🔌 API Endpoints

### Authentication

```http
POST   /api/auth/register                  # Create account
POST   /api/auth/login/challenge           # Get RSA challenge
POST   /api/auth/login                     # Verify signature, get JWT
```

### Messaging

```http
POST   /api/messages                       # Send encrypted message
GET    /api/messages/{peerFingerprint}     # Get message history
```

### Key Exchange (Signal Protocol)

```http
POST   /api/key-exchanges                  # Send key exchange
GET    /api/key-exchanges/{peerFingerprint}# Get pending exchanges
```

### Pre-keys (Signal Protocol)

```http
POST   /api/prekeys/signed                 # Upload signed pre-key
POST   /api/prekeys/one-time               # Upload one-time pre-keys
GET    /api/prekeys/one-time/{fingerprint} # Fetch one-time key
```

### Public Keys

```http
GET    /api/public-keys/{fingerprint}      # Retrieve peer's public key
GET    /api/public-keys/search             # Search users by fingerprint (paginated)
GET    /api/public-keys/verify/{fingerprint} # Verify key exists
```

### WebSocket Sync

```
WebSocket /ws/conversations/{peerFingerprint}?access_token=JWT
  • Query: real-time notifications
  • Payload: sync events (new messages, key exchanges)
  • Keep-alive: 30s
  • Timeout: 3600s (1h)
```

---

## 🛠️ Development

### Building Backend

```bash
cd API
dotnet restore
dotnet build

# Run tests
dotnet test

# Run with live reload
dotnet watch run

# Publish for production
dotnet publish -c Release -o ./publish
```

### Building Frontend

```bash
cd App

# Install dependencies
npm install

# Lint code
npm run lint

# Run tests
npm test

# Build AAB (Android App Bundle)
cd android && ./gradlew bundleRelease

# Build IPA (iOS)
cd ios && xcodebuild archive
```

### Code Structure (Frontend)

- **Pages** (`src/pages/`)
  - `AuthGatewayPage` — Login/register entry
  - `RegistrationPage` — RSA key generation
  - `LocalLoginPage` — PIN-based unlock
  - `MessagingPage` — Contact list & search
  - `ConversationPage` — Chat UI
  - `SecuritySettingsPage` — Key management

- **Services** (`src/services/`)
  - `authApi.ts` — REST client for `/api/auth/*`
  - `messagingApi.ts` — REST + WebSocket for messages
  - `signalStore.ts` — Signal Protocol E2E state
  - `chatCrypto.ts` — AES-256-GCM, RSA-OAEP
  - `registrationCrypto.ts` — Key generation, PBKDF2
  - `biometricAuth.ts` — Fingerprint/Face unlock
  - `chatStore.ts` — SQLite message cache
  - `profileStore.ts` — Multi-profile management

- **Context** (`src/context/`)
  - `PrivateKeySessionContext` — In-memory unlocked key, auto-lock on inactivity
  - `LoadingOverlayContext` — Global loading spinner

### Environment Variables

```bash
# API
JWT_SIGNING_KEY=<base64-encoded-key>
JWT_AUDIENCE=messager-client
JWT_ISSUER=messager-api
POSTGRES_CONNECTION_STRING=Server=db;Database=messager;Username=postgres;Password=...
MESSAGE_TTL_DAYS=30

# Mobile & Nginx
APP_PORT=443
APP_DOMAIN=localhost
MESSAGER_API_BASE_URL=https://localhost:443
NGINX_USE_SSL=true
SSL_CA_CERT_FILE=ca.pem
```

---

## 🐳 Docker

### Services

| Service | Image | Port | Notes |
|---------|-------|------|-------|
| **db** | postgres:17-alpine | 5432 | Volume: `db-data`, health checks |
| **api** | custom (API/Dockerfile) | 5000 | ASP.NET Core, auto-migrated |
| **nginx** | nginx:alpine | 80, 443 | Reverse proxy, SSL, WebSocket |
| **android-builder** | custom (App/Dockerfile.android) | — | Release builds only |

### Start Services

```bash
# Up and running
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop
docker-compose down

# Rebuild images
docker-compose build --no-cache
```

### Database Initialization

```bash
# Automatic on first run (EnsureCreated)
# To manually apply migrations:
docker exec messager-api dotnet ef database update

# Drop and recreate (dev only)
docker exec messager-api dotnet ef database drop --force
docker exec messager-api dotnet ef database update
```

### SSL Certificates

Place certificates in `ssl/`:

```
ssl/
├── server.pem         # Server certificate
├── server-key.pem     # Private key
└── ca.pem            # CA certificate
```

Set `NGINX_USE_SSL=true` in `.env`.

---

## 🐛 Troubleshooting

### API Won't Start

```bash
# Check JWT_SIGNING_KEY is set
echo $JWT_SIGNING_KEY

# Check database connection
dotnet user-secrets list

# View detailed logs
dotnet run --verbosity Debug
```

### Mobile App Crashes on Login

- Ensure `MESSAGER_API_BASE_URL` points to correct server
- Check SSL certificate trust (development: add CA cert to app)
- Verify private key is unlocked in `PrivateKeySessionContext`
- Check biometric permissions (iOS: Info.plist, Android: AndroidManifest.xml)

### WebSocket Connection Fails

- Verify JWT token is valid (12h expiry)
- Check Nginx WebSocket timeout: `proxy_read_timeout 3600s;`
- Ensure `Access-Control-Allow-Origin` header is set
- Validate `peerFingerprint` is 128-char hex

### Database Issues

```bash
# View database logs
docker logs messager-db

# Connect to database
psql -h localhost -U postgres -d messager

# Check connection string
cat .env | grep POSTGRES
```

### Migration Failures

```bash
# Add EF Core tooling (if missing)
dotnet tool install --global dotnet-ef

# List pending migrations
dotnet ef migrations list

# View migration status
dotnet ef database info
```

---

## 📝 Contributing

1. **Fork** the repository
2. **Create feature branch**: `git checkout -b feature/your-feature`
3. **Make changes** following [CLAUDE.md](./CLAUDE.md) guidelines
4. **Test locally** (`npm test`, `dotnet test`)
5. **Commit** with clear messages (see git history for style)
6. **Push** and open a pull request
7. **Address review feedback**

### Code Standards

- **Backend**: Clean Architecture, async/await, EF Core best practices
- **Frontend**: TypeScript strict mode, functional components, React hooks
- **Security**: No hardcoded secrets, use environment variables
- **Tests**: Unit tests for critical logic, integration tests for APIs

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE) file for details.

---

## 📚 Additional Resources

- [CLAUDE.md](./CLAUDE.md) — Development guidelines
- [DOKUMENTACJA.md](./DOKUMENTACJA.md) — Polish documentation
- [doc/](./doc/) — Multilingual guides (English, Polish, German, French, Spanish, Portuguese, Ukrainian)
- [Signal Protocol](https://signal.org/docs/) — E2E encryption specification
- [ASP.NET Core Docs](https://learn.microsoft.com/en-us/aspnet/core/) — Backend framework
- [React Native Docs](https://reactnative.dev/) — Mobile framework

---

## ❓ FAQ

**Q: Can I use this in production?**  
A: The architecture is production-ready, but this is currently a demo/personal project. Conduct security audits before production deployment.

**Q: What's the message size limit?**  
A: Limited by `MaxRequestBodySize` in Nginx (~1MB by default).

**Q: How long are messages stored?**  
A: `MESSAGE_TTL_DAYS` environment variable (default: 30 days).

**Q: Can I run this without Docker?**  
A: Yes, but you'll need PostgreSQL, Node.js, and .NET installed locally.

**Q: Is the database encrypted?**  
A: Messages are encrypted client-side; database stores only ciphertext. Add full-disk encryption for additional protection.

---

**Built with ❤️ using .NET 10, React Native, and Signal Protocol.**

For issues, questions, or contributions, please open an issue or pull request on GitHub.
