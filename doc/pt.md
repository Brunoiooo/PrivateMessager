# Messager — Documentação Acadêmica do Sistema

**Título do projeto:** Messager — mensageiro multicamada com criptografia end-to-end
**Tipo do projeto:** Aplicação web e mobile (monorepo)
**Data da documentação:** 2026-06-09

## 1. Resumo

Este documento constitui a documentação acadêmica do sistema Messager — um mensageiro que implementa criptografia de mensagens ponta-a-ponta (E2EE) utilizando criptografia assimétrica RSA e chaves simétricas encadeadas (chain keys). O sistema é composto por um backend desenvolvido com ASP.NET Core (.NET 10) e banco de dados PostgreSQL, além de um cliente mobile baseado em React Native com armazenamento local em SQLite. A arquitetura do backend adota o padrão Clean Architecture, separando as camadas de domínio (Domain), aplicação (Application), infraestrutura (Infrastructure) e interface HTTP (API). O cliente mobile implementa o fluxo criptográfico completo: geração de par de chaves RSA, proteção da chave privada via PBKDF2+AES-GCM, autenticação challenge-response com assinatura RSA/SHA-512, troca de material de chave RSA-OAEP e cifragem de mensagens AES-GCM com derivação de chaves encadeadas via SHA-256.

## 2. Introdução

### 2.1 Objetivo do projeto

- Identificação dos participantes por meio de chave pública RSA
- Autenticação por assinatura criptográfica (challenge-response)
- Troca de material de chave entre os interlocutores utilizando criptografia assimétrica
- Transmissão segura de mensagens cifradas com chave simétrica e mecanismo de forward secrecy
- Sincronização incremental de dados entre o dispositivo mobile e o servidor
- Armazenamento do histórico no banco local SQLite sem possibilidade de leitura pelo servidor

### 2.2 Escopo da documentação

| Diretório | Papel |
|---|---|
| Domain/ | Entidades de domínio e regras de negócio |
| Application/ | Handlers de casos de uso e interfaces de serviços |
| Infrastructure/ | EF Core, PostgreSQL, implementações de serviços criptográficos |
| API/ | Minimal API ASP.NET Core, JWT, WebSockets, DTOs |
| App/ | Cliente mobile React Native (Android/iOS) |

### 2.3 Tecnologias

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime do backend | .NET | 10.0 |
| Framework HTTP | ASP.NET Core Minimal APIs | 10.0 |
| ORM | Entity Framework Core + Npgsql | 10.x (preview) |
| Banco de dados do servidor | PostgreSQL | 17 |
| Runtime mobile | React Native | 0.85.3 |
| Linguagem mobile | TypeScript / React | 19.2.3 |
| Banco de dados do cliente | SQLite | react-native-sqlite-storage |
| Criptografia do cliente | node-forge, react-native-rsa-native | — |

## 3. Fundamentos tecnológicos e criptográficos

RSA: identificação (fingerprint SHA-512 a partir do DER) e cifragem do seed RSA-OAEP.
AES-GCM: chave de 256-bit, IV de 12B, Tag de 16B. Criptograma: IV||Tag||Ciphertext.
PBKDF2: 150.000 iterações, chave de 32B.
Chain Keys: K_{n+1}=SHA-256(K_n). Forward secrecy.
Challenge-Response: 64B aleatório, assinatura RSA/SHA-512/PKCS1.

## 4. Arquitetura do sistema

### 4.1 Geral

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
│         ASP.NET Core Minimal API                        │
│  Application (Handlers) → Domain → Infrastructure       │
└─────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────┐
│  PostgreSQL (DB)   │
└────────────────────┘
```

### 4.2 Clean Architecture

```
API  ──▶  Application  ──▶  Domain
Infrastructure  ──▶  Application  ──▶  Domain
```

### 4.3 Cliente mobile

| Camada | Arquivos | Responsabilidade |
|---|---|---|
| Pages (UI) | src/pages/ | Telas, navegação |
| Services (API) | authApi.ts, messagingApi.ts | HTTP/WebSocket |
| Services (Crypto) | registrationCrypto.ts, chatCrypto.ts | Criptografia |
| Services (Store) | profileStore.ts, chatStore.ts | SQLite |
| Context | src/context/ | Estado da sessão |
| Components | src/components/ | Componentes reutilizáveis |
| Types | src/types/ | TypeScript |

## 5. Modelo de domínio

### 5.1 BaseEntity

```csharp
public abstract class BaseEntity
{
    public DateTime CreatedAt { get; protected set; }
    public DateTime UpdatedAt { get; protected set; }
}
```

### 5.2 PublicKey

Agregado: FingerprintSha512 (128 hex), Der (byte[]), UserName (3-32), UserTag (1-99999).

```csharp
public Message SendMessage(string toPublicKey, byte[] encryptedContent, string messageHash)
{
    bool hasKeyExchangeForRecipient = _myKeyExchanges.Any(x => x.ToPublicKey == toPublicKey);
    if (!hasKeyExchangeForRecipient)
        throw new InvalidOperationException("Cannot send message without a key exchange from owner to recipient.");
    // ...
}
public void AddKeyExchange(string toPublicKey, byte[] encryptedPrivateKey) { ... }
public IReadOnlyList<Message> GetMessages(string toPublicKey, DateTime? fromDate, DateTime? toDate) { ... }
```

### 5.3 Message

Chave composta: (FromPublicKey, ToPublicKey, MessageHash) — idempotência.

### 5.4 KeyExchange

Chave composta: (FromPublicKey, ToPublicKey) — um registro por par por direção.

## 6. Camada Application

Interfaces: ICurrentPublicKey, ILoginChallengeService, ILoginService, IPublicKeyRepository, IPublicKeySecurityService.
Handlers: RegisterHandler, GetLoginChallengeHandler, LoginHandler, SendMessageHandler, SendKeyExchangeHandler, GetMessagesHandler, GetKeyExchangesHandler.

## 7. Camada Infrastructure

### 7.1 MessagerDbContext

```csharp
public sealed class MessagerDbContext(DbContextOptions<MessagerDbContext> options) : DbContext(options)
{
    public DbSet<PublicKeyRecord> PublicKeys => Set<PublicKeyRecord>();
    public DbSet<MessageRecord> Messages => Set<MessageRecord>();
    public DbSet<KeyExchangeRecord> KeyExchanges => Set<KeyExchangeRecord>();
    public DbSet<LoginChallengeRecord> LoginChallenges => Set<LoginChallengeRecord>();
}
```

```csharp
entity.HasKey(x => new { x.FromPublicKey, x.ToPublicKey, x.MessageHash });
```

### 7.2 PublicKeyRepository — reflexão

```csharp
typeof(PublicKey)
    .GetField("_myMessages", BindingFlags.NonPublic | BindingFlags.Instance)
    ?.SetValue(publicKey, messages);
```

### 7.3 LoginService

```csharp
using RSA rsa = RSA.Create();
try {
    rsa.ImportSubjectPublicKeyInfo(publicKey.Der, out _);
} catch (CryptographicException) {
    rsa.ImportRSAPublicKey(publicKey.Der, out _);
}
bool verified = rsa.VerifyData(challenge, signature, HashAlgorithmName.SHA512, RSASignaturePadding.Pkcs1);
```

### 7.4 PublicKeySecurityService

```csharp
byte[] hash = SHA512.HashData(der);
return Convert.ToHexString(hash).ToLowerInvariant();
```

## 8. Camada API

Kestrel (IP/port via env), JWT Bearer HS256 (clock skew 30s), Rate Limiting (auth 10/min, search 30/min), WebSockets keep-alive 30s, EnsureCreated.
Endpoints: POST /api/auth/register, /challenge, /login. POST/GET /api/messages/, /api/key-exchanges/. GET /api/public-keys/search. GET /api/sync/delta. WS /ws/sync, /ws/conversations/{peer}.
JwtTokenIssuer: HS256, 12h, sub=fingerprint.
SyncNotificationHub: in-memory pub/sub, System.Threading.Channels.

## 9. Cliente mobile

Múltiplos perfis por dispositivo (SQLite). Registro: geração RSA, PBKDF2+AES-GCM proteção da chave, POST /register. Login: decriptação PIN, challenge-response, JWT. Chain keys: AES-GCM com derivação SHA-256. Auto-lock 5 min.

## 10. Modelo criptográfico

RSA 2048-bit → DER → SHA-512 → fingerprint. PrivateKey → PBKDF2 → AES-GCM envelope. Chain: K_0=SHA-256(Seed), K_n=SHA-256(K_{n-1}). Forward secrecy.

| Objetivo | Algoritmo | Parâmetros |
|---|---|---|
| Identidade | RSA | 2048-bit |
| Identificador | SHA-512 | input: DER |
| KDF | PBKDF2-SHA256 | 150k iter, 16B salt, 32B key |
| Proteção chave priv. | AES-256-GCM | 12B IV, 16B tag |
| Assinatura | RSA+SHA-512+PKCS1 | — |
| Key Exchange | RSA-OAEP+SHA-256 | — |
| Cifração mensagens | AES-256-GCM | 12B IV, 16B tag |
| Derivação chain | SHA-256 | K_{n+1}=H(K_n) |
| Hash mensagem | SHA-512 | input: payload cifrado |

## 11. Esquema do banco de dados

```sql
CREATE TABLE public_keys (
    fingerprint_sha512  VARCHAR(128)  PRIMARY KEY,
    der                 BYTEA         NOT NULL,
    user_name           VARCHAR(32)   NOT NULL,
    user_tag            INTEGER       NOT NULL,
    created_at          TIMESTAMP     NOT NULL,
    updated_at          TIMESTAMP     NOT NULL
);
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
CREATE TABLE key_exchanges (
    from_public_key        VARCHAR(128)  NOT NULL,
    to_public_key          VARCHAR(128)  NOT NULL,
    encrypted_private_key  BYTEA         NOT NULL,
    created_at             TIMESTAMP     NOT NULL,
    PRIMARY KEY (from_public_key, to_public_key),
    FOREIGN KEY (from_public_key) REFERENCES public_keys(fingerprint_sha512) ON DELETE RESTRICT,
    FOREIGN KEY (to_public_key)   REFERENCES public_keys(fingerprint_sha512) ON DELETE RESTRICT
);
CREATE TABLE login_challenges (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint_sha512  VARCHAR(128)  NOT NULL,
    challenge           BYTEA         NOT NULL,
    created_at          TIMESTAMP     NOT NULL,
    expires_at          TIMESTAMP     NOT NULL,
    consumed_at         TIMESTAMP,
    FOREIGN KEY (fingerprint_sha512) REFERENCES public_keys(fingerprint_sha512) ON DELETE RESTRICT
);
```

SQLite: profiles, app_state, known_profiles, conversation_state, messages_local, key_exchanges_local, sync_state.

## 12. Sincronização e tempo real

HTTP delta: GET /api/sync/delta?since=ISO8601. WebSocket: /ws/sync (fingerprint→Channel). /ws/conversations/{peer}.

## 13. Configuração e implantação

### 13.1 Arquivo .env

Configuração central do Docker Compose, excluído do repositório pelo .gitignore.

```dotenv
POSTGRES_DB=messager
POSTGRES_USER=messager
POSTGRES_PASSWORD=change-me
JWT_SIGNING_KEY=replace-with-strong-random-base64-value
MESSAGE_TTL_DAYS=30
APP_PORT=443
APP_DOMAIN=localhost
NGINX_USE_SSL=true
MESSAGER_API_BASE_URL=https://127.0.0.1:443
SSL_CA_CERT_FILE=ca.pem
```

### 13.2 Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| POSTGRES_DB | Sim | Nome do banco |
| POSTGRES_USER | Sim | Usuário |
| POSTGRES_PASSWORD | Sim | Senha |
| JWT_SIGNING_KEY | Sim | Segredo HMAC-SHA256 |
| MESSAGE_TTL_DAYS | Não | Retenção de mensagens em dias (padrão: 30) |
| APP_PORT | Não | Porta nginx (padrão: 443 com SSL, 80 sem SSL) |
| APP_DOMAIN | Não | Domínio / IP pública (padrão: localhost) |
| NGINX_USE_SSL | Não | Ativar TLS via nginx (padrão: true) |
| SSL_CA_CERT_FILE | Não | Certificado CA para android-builder |
| MESSAGER_API_BASE_URL | Não | URL do APK |

### 13.3 docker-compose

Quatro serviços: db (postgres:17-alpine), api, nginx (proxy SSL), android-builder (perfil: release). Interpolação ${VAR} do .env. A API escuta internamente na porta 5000; o nginx expõe ${APP_PORT} externamente.

```bash
cp .env.example .env
docker compose up -d
docker compose --profile release up --build
```

### 13.4 Dockerfile.android

eclipse-temurin:17-jdk-jammy, Node.js 22, Android SDK 35.

### 13.5 Execução local

```bash
dotnet run --project ./API/API.csproj
cd App && npm install && cp .env.example .env && npm run android
```

### 13.6 Rede mobile

| Ambiente | URL |
|---|---|
| Emulador Android | http://10.0.2.2:5000 |
| USB (adb reverse) | http://localhost:5000 |
| WiFi | http://<LAN-IP>:5000 |
| Produção | https://<domínio> |

## 14. Análise de segurança

E2EE, rate limiting, fingerprint=SHA-512(DER), anti-MITM, PBKDF2+AES-GCM, consumed_at, forward secrecy. Fraquezas: sem HTTPS forçado, sem rotação RSA, sem multi-device, JWT_SIGNING_KEY estático, EnsureCreated, RSA 1024 em DEV, sem confirmação de entrega. Pontos fortes: servidor zero-knowledge, CSPRNG, verificação de integridade, .env excluído do repositório, DeleteBehavior.Restrict.

## 15. Limitações e desenvolvimento futuro

Limitações: EF Core 10 preview, reflexão para hidratação, sem testes, sincronização sequencial. Melhorias: migrações EF, Testcontainers, HTTPS, Double Ratchet, JWKS, telemetria de segurança.

## 16. Conclusão

Messager — implementação E2EE coesa com Clean Architecture. Servidor zero-knowledge. Pronto para endurecimento de produção.

## 17. Glossário

| Termo | Definição |
|---|---|
| AES-GCM | Cifração simétrica AEAD |
| Chain Key | K_{n+1}=H(K_n) — forward secrecy |
| Challenge-Response | Autenticação sem transmissão de segredo |
| Clean Architecture | Fluxo de dependências unidirecional |
| DER | Formato binário ASN.1 |
| E2EE | Criptografia ponta-a-ponta |
| EF Core | Entity Framework Core — ORM Microsoft |
| Fingerprint | SHA-512(publicKey.Der) |
| Forward Secrecy | Comprometimento atual não revela histórico |
| IV | Vetor de inicialização |
| JWT | JSON Web Token |
| Key Exchange | Troca de material de chave cifrado |
| Minimal API | ASP.NET Core sem controllers |
| PBKDF2 | Derivação de chave baseada em senha |
| PEM | Formato texto de chaves criptográficas |
| RSA | Rivest–Shamir–Adleman |
| RSA-OAEP | RSA com padding OAEP |
| SHA-512 | Função de hash de 512 bits |
| SQLite | Banco de dados embarcado |
| WebSocket | Protocolo de comunicação bidirecional em tempo real |

*Data: 2026-06-09.*
