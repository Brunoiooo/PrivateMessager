# Messager — Академічна документація системи

**Назва проєкту:** Messager — багаторівневий месенджер із наскрізним шифруванням
**Тип проєкту:** Веб-мобільний застосунок (монорепозиторій)
**Дата документації:** 2026-06-09

## Зміст
1. Анотація
2. Вступ
3. Технологічне та криптографічне підґрунтя
4. Архітектура системи
5. Модель предметної області
6. Шар Application — варіанти використання
7. Шар Infrastructure — технічна реалізація
8. Шар API — HTTP-інтерфейс і WebSocket
9. Мобільний клієнт
10. Криптографічна модель — детальний аналіз
11. Схема бази даних
12. Синхронізація та комунікація в реальному часі
13. Конфігурація середовища та розгортання
14. Аналіз безпеки
15. Обмеження та напрями розвитку
16. Висновки
17. Словник термінів

## 1. Анотація
Цей документ є академічною документацією системи Messager — месенджера, що реалізує наскрізне шифрування повідомлень (E2EE) із застосуванням асиметричної криптографії RSA та симетричних ланцюгових ключів (chain keys). Система складається з серверної частини, написаної на ASP.NET Core (.NET 10) з базою даних PostgreSQL, та мобільного клієнта на основі React Native з локальним сховищем SQLite. Серверна архітектура використовує патерн Clean Architecture, розділяючи шари: предметної області (Domain), застосунку (Application), інфраструктури (Infrastructure) та HTTP-інтерфейсу (API). Мобільний клієнт реалізує повний криптографічний потік: генерацію пари ключів RSA, захист приватного ключа механізмом PBKDF2+AES-GCM, автентифікацію challenge-response з підписом RSA/SHA-512, обмін ключовим матеріалом RSA-OAEP та шифрування повідомлень AES-GCM з деривацією наступних ланцюгових ключів через SHA-256.

## 2. Вступ
### 2.1 Мета проєкту
- Ідентифікація учасників за публічним ключем RSA
- Автентифікація за допомогою криптографічного підпису (challenge-response)
- Обмін ключовим матеріалом між співрозмовниками з використанням асиметричного шифрування
- Безпечна передача повідомлень, зашифрованих симетричним ключем, із механізмом forward secrecy
- Інкрементальна синхронізація даних між мобільним пристроєм і сервером
- Зберігання історії в локальній базі SQLite без можливості читання сервером

### 2.2 Обсяг документації
| Каталог | Роль |
|---|---|
| Domain/ | Сутності предметної області та бізнес-правила |
| Application/ | Обробники варіантів використання та інтерфейси сервісів |
| Infrastructure/ | EF Core, PostgreSQL, реалізації криптографічних сервісів |
| API/ | Minimal API ASP.NET Core, JWT, WebSockets, DTOs |
| App/ | Мобільний клієнт React Native (Android/iOS) |

### 2.3 Технології
| Шар | Технологія | Версія |
|---|---|---|
| Runtime серверної частини | .NET | 10.0 |
| HTTP-фреймворк | ASP.NET Core Minimal APIs | 10.0 |
| ORM | Entity Framework Core + Npgsql | 10.x (preview) |
| База даних сервера | PostgreSQL | 17 |
| Runtime мобільного клієнта | React Native | 0.85.3 |
| Мова мобільного клієнта | TypeScript / React | 19.2.3 |
| База даних клієнта | SQLite | react-native-sqlite-storage |
| Криптографія клієнта | node-forge, react-native-rsa-native | — |

## 3. Технологічне та криптографічне підґрунтя
### 3.1 RSA
RSA (Rivest–Shamir–Adleman) — алгоритм, що базується на складності факторизації. У Messager використовується для: ідентифікації (fingerprint SHA-512 з DER) та шифрування seed-матеріалу RSA-OAEP.

### 3.2 AES-GCM
Ключ 256 біт, IV 12 байт випадковий, Tag 16 байт. Структура: IV||Tag||Ciphertext.

### 3.3 PBKDF2
150 000 ітерацій HMAC-SHA256, ключ 32 байти.

### 3.4 Chain Keys та Forward Secrecy
K_{n+1} = SHA-256(K_n). Компрометація K_n не розкриває K_{n-1}.

### 3.5 Challenge-Response
Сервер: 64 байти випадкових даних. Клієнт: підпис RSA/SHA-512/PKCS1. Сервер: верифікація підпису.

## 4. Архітектура системи
### 4.1 Загальна схема
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

### 4.3 Мобільний клієнт
| Шар | Файли | Відповідальність |
|---|---|---|
| Pages (UI) | src/pages/ | Екрани, навігація |
| Services (API) | authApi.ts, messagingApi.ts | HTTP/WebSocket |
| Services (Crypto) | registrationCrypto.ts, chatCrypto.ts | Криптографія |
| Services (Store) | profileStore.ts, chatStore.ts | SQLite |
| Context | src/context/ | Стан сесії |
| Components | src/components/ | Багаторазові компоненти |
| Types | src/types/ | TypeScript |

## 5. Модель предметної області
### 5.1 BaseEntity
```csharp
public abstract class BaseEntity
{
    public DateTime CreatedAt { get; protected set; }
    public DateTime UpdatedAt { get; protected set; }
}
```

### 5.2 PublicKey
Агрегат: FingerprintSha512, Der, UserName (3-32), UserTag (1-99999).
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
Ключ: (FromPublicKey, ToPublicKey, MessageHash) — ідемпотентність.

### 5.4 KeyExchange
Ключ: (FromPublicKey, ToPublicKey) — один на пару в кожному напрямку.

## 6. Шар Application
### 6.1 Інтерфейси
| Інтерфейс | Призначення |
|---|---|
| ICurrentPublicKey | Fingerprint поточного запиту |
| ILoginChallengeService | Challenge |
| ILoginService | Верифікація RSA |
| IPublicKeyRepository | CRUD |
| IPublicKeySecurityService | Імпорт, fingerprint |

### 6.2 Обробники
RegisterHandler, GetLoginChallengeHandler, LoginHandler, SendMessageHandler, SendKeyExchangeHandler, GetMessagesHandler, GetKeyExchangesHandler.

## 7. Шар Infrastructure
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

### 7.2 PublicKeyRepository — рефлексія
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

## 8. Шар API
Kestrel (IP/порт із env), JWT Bearer HS256 (зсув годинника 30 с), Rate Limiting (auth 10/хв, search 30/хв), WebSockets (keep-alive 30 с), EnsureCreated.

Ендпоінти:
- POST /api/auth/register, /challenge, /login (анонімні, rate: auth)
- POST/GET /api/messages/ (Bearer JWT)
- POST/GET /api/key-exchanges/ (Bearer JWT)
- GET /api/public-keys/search (Bearer JWT, rate: search)
- GET /api/sync/delta (Bearer JWT)
- WS /ws/sync, /ws/conversations/{peerFingerprint} (access_token у query)

JwtTokenIssuer: HS256, issuer=messager, audience=messager, термін дії 12 год, sub=fingerprint.
SyncNotificationHub: in-memory pub/sub, System.Threading.Channels.

## 9. Мобільний клієнт
Кілька профілів на пристрій (SQLite). Реєстрація: генерація RSA, захист приватного ключа PBKDF2+AES-GCM, POST /register. Вхід: розшифровка PIN, challenge-response, JWT. Криптографія: chain keys AES-GCM. Автоблокування через 5 хв.

## 10. Криптографічна модель
RSA 2048 біт → DER → SHA-512 → fingerprint. PrivateKey → PBKDF2 → AES-GCM envelope. Chain: K_0=SHA-256(seed), K_n=SHA-256(K_{n-1}). Forward secrecy через односпрямований SHA-256.

## 11. Схема бази даних
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
```
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
```
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
```
SQLite (клієнт): profiles, app_state, known_profiles, conversation_state, messages_local, key_exchanges_local, sync_state.

## 12. Синхронізація в реальному часі
HTTP delta GET /api/sync/delta?since=ISO8601. WebSocket /ws/sync (fingerprint→Channel). /ws/conversations/{peer} — окремо для кожної розмови.

## 13. Конфігурація
.env (виключений з репозиторію):
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
docker-compose: db (postgres:17), api, nginx (SSL-проксі), android-builder (профіль: release). Інтерполяція ${VAR} з .env. API слухає внутрішньо на порту 5000; nginx експонує ${APP_PORT} назовні.
```bash
cp .env.example .env
docker compose up -d
docker compose --profile release up --build
```
Dockerfile серверної частини: 4 етапи (base/build/publish/final). Dockerfile.android: JDK 17, Node 22, Android SDK 35.

## 14. Безпека
E2EE, rate limiting, fingerprint=SHA-512(DER), захист від MITM, PBKDF2+AES-GCM, consumed_at, forward secrecy, JWT для WebSocket. Вразливості: відсутність HTTPS, відсутність ротації RSA, відсутність підтримки кількох пристроїв, статичний JWT-ключ, EnsureCreated, RSA 1024 у dev-режимі, відсутність підтверджень доставки (ack).

## 15. Обмеження та напрями розвитку
EF Core 10 preview, рефлексія, відсутність тестів, послідовна синхронізація. Напрями: міграції EF, Testcontainers, HTTPS, Double Ratchet, JWKS, телеметрія безпеки.

## 16. Висновки
Messager — цілісна реалізація E2EE. Сервер є zero-knowledge. Clean Architecture. Готовий до production після посилення безпеки.

## 17. Словник термінів
AES-GCM, Chain Key, Challenge-Response, Clean Architecture, DER, E2EE, EF Core, Fingerprint, Forward Secrecy, IV, JWT, Key Exchange, Minimal API, PBKDF2, PEM, RSA, RSA-OAEP, SHA-512, SQLite, WebSocket.

*Дата: 2026-06-09.*
