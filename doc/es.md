# Messager — Documentación Académica del Sistema

**Título del proyecto:** Messager — mensajero multicapa con cifrado end-to-end
**Tipo de proyecto:** Aplicación web-móvil (monorepo)
**Fecha de documentación:** 2026-06-09

## 1. Resumen

Este documento constituye la documentación académica del sistema Messager, un mensajero que implementa cifrado de mensajes E2EE mediante criptografía asimétrica RSA y claves de cadena simétricas (chain keys). El sistema se compone de un backend escrito en ASP.NET Core (.NET 10) con base de datos PostgreSQL, y un cliente móvil basado en React Native con almacenamiento local SQLite. La arquitectura del backend sigue el patrón Clean Architecture, separando las capas de dominio (Domain), aplicación (Application), infraestructura (Infrastructure) e interfaz HTTP (API). El cliente móvil implementa el flujo criptográfico completo: generación del par de claves RSA, protección de la clave privada mediante PBKDF2+AES-GCM, autenticación challenge-response con firma RSA/SHA-512, intercambio de material de claves RSA-OAEP y cifrado de mensajes AES-GCM con derivación de claves de cadena sucesivas mediante SHA-256.

## 2. Introducción

### 2.1 Objetivo del proyecto

- Identificación de participantes mediante clave pública RSA
- Autenticación por firma criptográfica (challenge-response)
- Intercambio de material de claves entre interlocutores mediante cifrado asimétrico
- Transmisión segura de mensajes cifrados con clave simétrica y mecanismo de forward secrecy
- Sincronización incremental de datos entre el dispositivo móvil y el servidor
- Almacenamiento del historial en base de datos SQLite local, inaccesible para el servidor

El sistema está diseñado para ser resistente a la compromisión del servidor: el servidor almacena únicamente datos cifrados y no dispone de las claves necesarias para descifrarlos.

### 2.2 Alcance de la documentación

| Directorio | Rol |
|---|---|
| Domain/ | Entidades de dominio y reglas de negocio |
| Application/ | Manejadores de casos de uso e interfaces de servicios |
| Infrastructure/ | EF Core, PostgreSQL, implementaciones de servicios criptográficos |
| API/ | Minimal API ASP.NET Core, JWT, WebSockets, DTOs |
| App/ | Cliente móvil React Native (Android/iOS) |

### 2.3 Tecnologías

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime del backend | .NET | 10.0 |
| Framework HTTP | ASP.NET Core Minimal APIs | 10.0 |
| ORM | Entity Framework Core + Npgsql | 10.x (preview) |
| Base de datos del servidor | PostgreSQL | 17 |
| Runtime móvil | React Native | 0.85.3 |
| Lenguaje móvil | TypeScript / React | 19.2.3 |
| Base de datos del cliente | SQLite | react-native-sqlite-storage |
| Criptografía del cliente | node-forge, react-native-rsa-native | — |

## 3. Contexto tecnológico y criptográfico

### 3.1 RSA

RSA (Rivest–Shamir–Adleman) — algoritmo basado en la dificultad de factorizar números grandes. En Messager: identificación del usuario (fingerprint SHA-512 a partir del DER) y cifrado del seed mediante RSA-OAEP.

### 3.2 AES-GCM

Clave de 256 bits, IV de 12 bytes aleatorios, Tag de 16 bytes. Formato del criptograma: IV(12B)||Tag(16B)||Ciphertext(nB).

### 3.3 PBKDF2

150 000 iteraciones HMAC-SHA256, clave de salida de 32 bytes.

### 3.4 Chain Keys y Forward Secrecy

K_{n+1} = SHA-256(K_n). La compromisión de K_n no revela K_{n-1} (SHA-256 es unidireccional).

### 3.5 Challenge-Response

El servidor genera un desafío aleatorio de 64 bytes; el cliente firma con RSA/SHA-512/PKCS1; el servidor verifica la firma.

## 4. Arquitectura del sistema

### 4.1 Arquitectura general

Cliente-servidor con criptografía exclusivamente en el lado del cliente.

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

- Domain: reglas de negocio, sin dependencias externas
- Application: casos de uso, interfaces de servicios
- Infrastructure: EF Core, PostgreSQL, implementaciones
- API: mapeo HTTP a manejadores, sin lógica de negocio

### 4.3 Cliente móvil

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Pages (UI) | src/pages/ | Pantallas, navegación |
| Services (API) | authApi.ts, messagingApi.ts | HTTP/WebSocket |
| Services (Crypto) | registrationCrypto.ts, chatCrypto.ts | Criptografía |
| Services (Store) | profileStore.ts, chatStore.ts | SQLite |
| Context | src/context/ | Estado de sesión |
| Components | src/components/ | Componentes reutilizables |
| Types | src/types/ | TypeScript |

## 5. Modelo de dominio

### 5.1 BaseEntity

```csharp
public abstract class BaseEntity
{
    public DateTime CreatedAt { get; protected set; }
    public DateTime UpdatedAt { get; protected set; }
}
```

### 5.2 PublicKey — identidad del usuario

Agregado: FingerprintSha512 (128 hex), Der (byte[]), UserName (3-32), UserTag (1-99999). Regla: SendMessage requiere que exista un intercambio de claves previo.

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

Clave compuesta: (FromPublicKey, ToPublicKey, MessageHash) — idempotencia.

### 5.4 KeyExchange

Clave compuesta: (FromPublicKey, ToPublicKey) — un registro por par y por dirección.

## 6. Capa Application

### 6.1 Interfaces de servicios

| Interfaz | Propósito |
|---|---|
| ICurrentPublicKey | Fingerprint de la solicitud actual |
| ILoginChallengeService | Generación y validación de desafíos |
| ILoginService | Verificación de firma RSA |
| IPublicKeyRepository | CRUD de agregados |
| IPublicKeySecurityService | Importación RSA, cálculo del fingerprint |

### 6.2 Manejadores

- RegisterHandler: validación DER, importación RSA, fingerprint SHA-512, unicidad de userTag, persistencia
- GetLoginChallengeHandler: verificación de fingerprint, limpieza, randomBytes(64), TTL 5 min
- LoginHandler: lectura del desafío, verificación de firma, ConsumedAt, emisión de JWT
- SendMessageHandler: agregado del emisor, SendMessage(), persistencia, notificación WebSocket
- SendKeyExchangeHandler: validación del destinatario, AddKeyExchange(), persistencia
- GetMessagesHandler / GetKeyExchangesHandler: filtro opcional por since

## 7. Capa Infrastructure

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

### 7.2 PublicKeyRepository — reflexión

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

### 7.5–7.7 Servicios adicionales

LoginChallengeService: RandomNumberGenerator.GetBytes(64), TTL 5 min.
CurrentPublicKeyAccessor: AsyncLocal<string?>.
DependencyInjection: AddInfrastructure() registra todos los servicios.

## 8. Capa API

### 8.1 Program.cs

1. Kestrel — escucha internamente en 0.0.0.0:5000; el acceso externo se gestiona mediante nginx
2. JWT Bearer — HS256, tolerancia de reloj 30 s
3. Rate Limiting — auth: 10/min, search: 30/min (ventana deslizante)
4. WebSockets — keep-alive 30 s
5. EnsureCreated

### 8.2 DTOs

AuthContracts: RegisterRequest/Response, ChallengeRequest/Response, LoginRequest/Response, ErrorResponse.
MessageContracts: SendMessageRequest, MessageResponse.
KeyExchangeContracts: SendKeyExchangeRequest, KeyExchangeResponse.
SyncContracts: SyncDeltaResponse.

### 8.3 Endpoints

Autenticación (/api/auth): POST register, challenge, login (anónimo, rate: auth).
Mensajes (/api/messages/): POST send, GET fetch (Bearer JWT).
Intercambios de claves (/api/key-exchanges/): POST send, GET fetch (Bearer JWT).
Perfil (/api/public-keys/search): GET (Bearer JWT, rate: search).
Sincronización: GET /api/sync/delta (Bearer JWT). WS /ws/sync, /ws/conversations/{peer} (access_token query).

### 8.4 JwtTokenIssuer

HS256, issuer/audience=messager, validez 12 h, claim sub=fingerprint SHA-512.

### 8.5 SyncNotificationHub

Pub/sub en memoria, System.Threading.Channels. fingerprint → Channel<string>.

## 9. Cliente móvil

### 9.1 Perfil (App.tsx, profileStore.ts)

Múltiples perfiles por dispositivo. Persistencia SQLite (profiles, app_state).

### 9.2 Registro

```
Datos del usuario → RSA.generateKeys(KEY_BITS) → DER → SHA-512(DER) = fingerprint
→ PBKDF2(pin, salt, 150000) → AES-GCM encrypt(privateKeyPem) = envelope
→ POST /api/auth/register → almacenamiento SQLite
```

KEY_BITS: 1024 (__DEV__), 2048 (producción).

### 9.3 Inicio de sesión

```
PIN → AES-GCM decrypt(envelope) → privateKeyPem
→ GET /challenge → sign(RSA/SHA-512/PKCS1) → POST /login → JWT → PrivateKeySessionContext
```

### 9.4 Criptografía de mensajes (chatCrypto.ts)

Key Exchange: randomBytes(32) → RSA-OAEP encrypt(recipientPublicKey) → POST /key-exchanges.
Envío: AES-GCM(currentChainKey, randomIV) → payload → POST /messages → nextKey=SHA-256(currentKey).
Recepción: AES-GCM decrypt(incomingChainKey) → nextKey=SHA-256(incomingKey).

### 9.5 SQLite (chatStore.ts)

known_profiles, conversation_state (chain keys), messages_local, key_exchanges_local, sync_state.

### 9.6 PrivateKeySessionContext

Bloqueo automático tras 5 min de inactividad, reset por interacción, regreso a la pantalla de inicio de sesión.

## 10. Modelo criptográfico

RSA 2048-bit → publicKey(DER/X.509) → SHA-512 → FingerprintSha512.
privateKey(PEM) → PBKDF2-SHA256(pin,salt,150000,32B) → K_wrap → AES-GCM → PrivateKeyEnvelope.
Chain keys: K_0=SHA-256(Seed), K_n=SHA-256(K_{n-1}).
Forward secrecy: SHA-256 es unidireccional.

### 10.5 Resumen de primitivos

| Propósito | Algoritmo | Parámetros |
|---|---|---|
| Identidad | RSA | 2048-bit |
| Identificador | SHA-512 | entrada: DER |
| KDF | PBKDF2-SHA256 | 150k iter, 16B salt, 32B key |
| Protección de clave privada | AES-256-GCM | 12B IV, 16B tag |
| Firma | RSA+SHA-512+PKCS1 | — |
| Key Exchange | RSA-OAEP+SHA-256 | — |
| Cifrado de mensajes | AES-256-GCM | 12B IV, 16B tag |
| Derivación de cadena | SHA-256 | K_{n+1}=H(K_n) |
| Hash de mensaje | SHA-512 | entrada: payload cifrado |

## 11. Esquema de base de datos

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
CREATE INDEX idx_messages_from ON messages(from_public_key);
CREATE INDEX idx_messages_to   ON messages(to_public_key);
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

ERD: public_keys → messages, key_exchanges, login_challenges (FK).
SQLite: profiles, app_state, known_profiles, conversation_state, messages_local, key_exchanges_local, sync_state.

## 12. Sincronización y tiempo real

HTTP: GET /api/sync/delta?since=ISO8601 → SyncDeltaResponse.
WebSocket: /ws/sync?access_token=JWT — fingerprint→Channel (SyncNotificationHub).
/ws/conversations/{peerFingerprint} — stream por conversación.

## 13. Configuración y despliegue

### 13.1 Archivo .env

Archivo central de configuración de Docker Compose, excluido del repositorio mediante .gitignore.

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

### 13.2 Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| POSTGRES_DB | Sí | Nombre de la base de datos |
| POSTGRES_USER | Sí | Usuario |
| POSTGRES_PASSWORD | Sí | Contraseña |
| JWT_SIGNING_KEY | Sí | Secreto HMAC-SHA256 |
| MESSAGE_TTL_DAYS | No | Retención de mensajes en días (defecto: 30) |
| APP_PORT | No | Puerto nginx (defecto: 443 con SSL, 80 sin SSL) |
| APP_DOMAIN | No | Dominio / IP pública (defecto: localhost) |
| NGINX_USE_SSL | No | Activar TLS mediante nginx (defecto: true) |
| SSL_CA_CERT_FILE | No | Certificado CA para android-builder |
| MESSAGER_API_BASE_URL | No | URL de la API integrada en el APK |

### 13.3 docker-compose

Cuatro servicios: db (postgres:17-alpine), api, nginx (proxy SSL), android-builder (perfil: release). Interpolación ${VAR}. La API escucha internamente en el puerto 5000; nginx expone ${APP_PORT} al exterior.

```bash
cp .env.example .env
docker compose up -d
docker compose --profile release up --build
```

### 13.4 Dockerfile.android

eclipse-temurin:17-jdk-jammy, Node.js 22, Android SDK 35, APK → /releases.

### 13.5 Ejecución local

```bash
dotnet run --project ./API/API.csproj
cd App && npm install && cp .env.example .env && npm run android
```

### 13.6 Red móvil

| Entorno | URL |
|---|---|
| Emulador Android | http://10.0.2.2:5000 |
| USB (adb reverse) | http://localhost:5000 |
| WiFi | http://<LAN-IP>:5000 |
| Producción | https://<dominio> |

## 14. Seguridad

| Amenaza | Protección |
|---|---|
| Interceptación en tránsito | E2EE |
| Fuerza bruta | Rate limiting 10/min, desafío de un solo uso, JWT 12 h |
| Suplantación de identidad | Fingerprint = SHA-512(DER) |
| MITM de clave | Verificación SHA-512 antes del cifrado |
| Compromisión de clave | PBKDF2+AES-GCM |
| Replay | consumed_at + TTL 5 min |
| Filtración del historial | Forward secrecy |
| WebSocket no autorizado | Validación JWT |
| DoS en búsqueda | Límite 30/min |

Debilidades: ausencia de HTTPS, sin rotación RSA, sin soporte multi-dispositivo, clave JWT estática, EnsureCreated, RSA 1024 en desarrollo, sin acuse de recibo.
Fortalezas: servidor zero-knowledge, CSPRNG, verificación de integridad de clave, .env excluido del repositorio, DeleteBehavior.Restrict.

## 15. Limitaciones y líneas de desarrollo futuro

Limitaciones: EF Core 10 en preview, hidratación por reflexión, ausencia de pruebas, sincronización secuencial.
Líneas de desarrollo: migraciones EF, Testcontainers, HTTPS, Double Ratchet, JWKS, fábrica de agregados, telemetría de seguridad.

## 16. Conclusiones

Messager es una implementación E2EE coherente con Clean Architecture. El servidor es zero-knowledge. Listo para su endurecimiento en producción.

## 17. Glosario

| Término | Definición |
|---|---|
| AES-GCM | Cifrado simétrico AEAD (Advanced Encryption Standard — Galois/Counter Mode) |
| Chain Key | K_{n+1}=H(K_n) — forward secrecy |
| Challenge-Response | Autenticación sin transmisión de contraseña |
| Clean Architecture | Patrón con flujo unidireccional de dependencias |
| DER | Formato binario ASN.1 |
| E2EE | End-to-End Encryption |
| EF Core | Entity Framework Core — ORM de Microsoft |
| Fingerprint | SHA-512(publicKey.Der) — identificador del usuario |
| Forward Secrecy | La compromisión de la clave actual no revela el historial |
| IV | Initialization Vector |
| JWT | JSON Web Token |
| Key Exchange | Intercambio del seed cifrado |
| Minimal API | ASP.NET Core sin controladores |
| PBKDF2 | Password-Based Key Derivation Function 2 |
| PEM | Privacy Enhanced Mail — formato de texto para claves |
| RSA | Rivest–Shamir–Adleman |
| RSA-OAEP | RSA con Optimal Asymmetric Encryption Padding |
| SHA-512 | Secure Hash Algorithm 512-bit |
| SQLite | Base de datos embebida en el cliente |
| WebSocket | Protocolo de comunicación bidireccional en tiempo real |

*Fecha: 2026-06-09.*
