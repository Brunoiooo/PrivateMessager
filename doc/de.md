# Messager — Akademische Systemdokumentation

**Projekttitel:** Messager — mehrschichtiger Messenger mit End-to-End-Verschlüsselung
**Projekttyp:** Web- und Mobilanwendung (Monorepo)
**Dokumentationsdatum:** 2026-06-09

## Inhaltsverzeichnis
1. Abstrakt
2. Einleitung
3. Technologischer und kryptografischer Hintergrund
4. Systemarchitektur
5. Domänenmodell
6. Application-Schicht — Anwendungsfälle
7. Infrastructure-Schicht — technische Realisierung
8. API-Schicht — HTTP- und WebSocket-Schnittstelle
9. Mobiler Client
10. Kryptografisches Modell — detaillierte Analyse
11. Datenbankschema
12. Synchronisierung und Echtzeit-Kommunikation
13. Umgebungskonfiguration und Deployment
14. Sicherheitsanalyse
15. Einschränkungen und Entwicklungsrichtungen
16. Schlussfolgerungen
17. Glossar

## 1. Abstrakt
Dieses Dokument ist die akademische Dokumentation des Systems Messager — eines Messengers, der die End-to-End-Verschlüsselung (E2EE) von Nachrichten mittels asymmetrischer RSA-Kryptografie sowie symmetrischer Chain Keys realisiert. Das System besteht aus einem Backend, das mit ASP.NET Core (.NET 10) und einer PostgreSQL-Datenbank entwickelt wurde, sowie einem mobilen Client auf Basis von React Native mit lokalem SQLite-Datenspeicher. Die Backend-Architektur verwendet das Clean Architecture-Muster und trennt die Domänenschicht (Domain), die Anwendungsschicht (Application), die Infrastrukturschicht (Infrastructure) sowie die HTTP-Schnittstellenschicht (API). Der mobile Client implementiert den vollständigen kryptografischen Ablauf: Generierung eines RSA-Schlüsselpaares, Schutz des privaten Schlüssels durch PBKDF2+AES-GCM, Challenge-Response-Authentifizierung mit RSA/SHA-512-Signatur, Austausch von Schlüsselmaterial via RSA-OAEP sowie Nachrichtenverschlüsselung per AES-GCM mit Ableitung nachfolgender Chain Keys mittels SHA-256.

## 2. Einleitung
### 2.1 Projektziel
- Identifikation der Teilnehmer über den öffentlichen RSA-Schlüssel
- Authentifizierung durch kryptografische Signatur (Challenge-Response)
- Austausch von Schlüsselmaterial zwischen Gesprächspartnern mittels asymmetrischer Verschlüsselung
- Sichere Übertragung von Nachrichten, die mit einem symmetrischen Schlüssel verschlüsselt sind, mit Forward Secrecy-Mechanismus
- Inkrementelle Datensynchronisierung zwischen dem mobilen Gerät und dem Server
- Speicherung des Verlaufs in einer lokalen SQLite-Datenbank, die für den Server nicht lesbar ist

Das System ist darauf ausgelegt, gegen eine Kompromittierung des Servers hinsichtlich des Nachrichteninhalts widerstandsfähig zu sein: Der Server speichert ausschließlich verschlüsselte Daten und besitzt keine Schlüssel, die deren Entschlüsselung ermöglichen würden.

### 2.2 Dokumentationsumfang
| Verzeichnis | Rolle |
|---|---|
| Domain/ | Domänen-Entitäten und Geschäftsregeln |
| Application/ | Handler für Anwendungsfälle und Service-Schnittstellen |
| Infrastructure/ | EF Core, PostgreSQL, Implementierungen kryptografischer Dienste |
| API/ | Minimal API ASP.NET Core, JWT, WebSockets, DTOs |
| App/ | Mobiler React Native-Client (Android/iOS) |

### 2.3 Technologien
| Schicht | Technologie | Version |
|---|---|---|
| Backend-Runtime | .NET | 10.0 |
| HTTP-Framework | ASP.NET Core Minimal APIs | 10.0 |
| ORM | Entity Framework Core + Npgsql | 10.x (preview) |
| Server-Datenbank | PostgreSQL | 17 |
| Mobile Runtime | React Native | 0.85.3 |
| Mobile Sprache | TypeScript / React | 19.2.3 |
| Client-Datenbank | SQLite | react-native-sqlite-storage |
| Client-Kryptografie | node-forge, react-native-rsa-native | — |

## 3. Technologischer und kryptografischer Hintergrund
### 3.1 RSA
RSA (Rivest–Shamir–Adleman) — Algorithmus basierend auf der Schwierigkeit der Faktorisierung. In Messager: Benutzeridentifikation (SHA-512-Fingerprint aus DER) sowie Seed-Verschlüsselung via RSA-OAEP.

### 3.2 AES-GCM
256-bit-Schlüssel, 96-bit-IV (12 Byte zufällig), 128-bit-Tag. Struktur: IV(12B) || Tag(16B) || Ciphertext(nB).

### 3.3 PBKDF2
150.000 Iterationen HMAC-SHA256, 32-Byte-Ausgabeschlüssel.

### 3.4 Chain Keys und Forward Secrecy
K_{n+1} = SHA-256(K_n). Eine Kompromittierung von K_n legt K_{n-1} nicht offen.

### 3.5 Challenge-Response
Der Server generiert einen 64-Byte-Challenge; der Client signiert mit RSA/SHA-512; der Server verifiziert.

## 4. Systemarchitektur
### 4.1 Allgemeine Architektur
Client-Server mit Kryptografie ausschließlich auf der Client-Seite.

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
│  ┌──────────────────────────────────────────────────┐   │
│  │         ASP.NET Core Minimal API                 │   │
│  └──────────────────────────────────────────────────┘   │
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
- Domain: Geschäftsregeln, keine externen Abhängigkeiten
- Application: Anwendungsfälle, Service-Schnittstellen
- Infrastructure: EF Core, PostgreSQL, Implementierungen
- API: Abbildung von HTTP auf Handler

### 4.3 Architektur des mobilen Clients
| Schicht | Dateien | Verantwortlichkeit |
|---|---|---|
| Pages (UI) | src/pages/ | Bildschirme, Navigation |
| Services (API) | authApi.ts, messagingApi.ts | HTTP/WebSocket |
| Services (Crypto) | registrationCrypto.ts, chatCrypto.ts | Kryptografie |
| Services (Store) | profileStore.ts, chatStore.ts | SQLite |
| Context | src/context/ | Sitzungszustand |
| Components | src/components/ | Wiederverwendbare UI-Elemente |
| Types | src/types/ | TypeScript types |

## 5. Domänenmodell
### 5.1 BaseEntity
```csharp
public abstract class BaseEntity
{
    public DateTime CreatedAt { get; protected set; }
    public DateTime UpdatedAt { get; protected set; }
}
```

### 5.2 PublicKey — Benutzeridentität
Zentrales Aggregat. Eigenschaften: FingerprintSha512 (128 Hex), Der (byte[]), UserName (3-32), UserTag (1-99999), Nachrichten- und Schlüsselaustausch-Kollektionen.
Domänenmethoden:
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
Zusammengesetzter Schlüssel: (FromPublicKey, ToPublicKey, MessageHash) — Idempotenz.

### 5.4 KeyExchange
Zusammengesetzter Schlüssel: (FromPublicKey, ToPublicKey) — ein Datensatz pro Paar und Richtung.

## 6. Application-Schicht
### 6.1 Service-Schnittstellen
| Schnittstelle | Zweck |
|---|---|
| ICurrentPublicKey | Fingerprint des aktuellen Benutzers |
| ILoginChallengeService | Generierung und Validierung von Challenges |
| ILoginService | Überprüfung der RSA-Signatur |
| IPublicKeyRepository | CRUD für Aggregate |
| IPublicKeySecurityService | RSA-Import, SHA-512-Fingerprint |

### 6.2 Handler
- RegisterHandler: DER-Validierung, RSA-Import, Fingerprint, UserTag-Eindeutigkeit, Speicherung
- GetLoginChallengeHandler: Validierung, Bereinigung, 64 Byte zufällig, TTL 5 Minuten
- LoginHandler: Challenge lesen, Signatur verifizieren, ConsumedAt, JWT
- SendMessageHandler: Aggregat abrufen, SendMessage() aufrufen, speichern, WebSocket-Benachrichtigung
- SendKeyExchangeHandler: Empfänger validieren, AddKeyExchange() aufrufen, speichern
- GetMessagesHandler / GetKeyExchangesHandler: Filter seit Zeitstempel

## 7. Infrastructure-Schicht
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
Zusammengesetzter Schlüssel:
```csharp
entity.HasKey(x => new { x.FromPublicKey, x.ToPublicKey, x.MessageHash });
```

### 7.2 PublicKeyRepository
Reflection zur Hydratisierung privater Kollektionen:
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

### 7.5 LoginChallengeService
RandomNumberGenerator.GetBytes(64), TTL 5 Minuten, Bereinigung bei GetChallenge.

### 7.6 CurrentPublicKeyAccessor
AsyncLocal<string?> — Fingerprint ohne explizite Parameterübergabe.

### 7.7 DependencyInjection
AddInfrastructure(): Registrierung von DbContext (Scoped), Repositories (Scoped), Services (Scoped/Singleton).

## 8. API-Schicht
### 8.1 Program.cs
1. Kestrel — lauscht intern auf 0.0.0.0:5000; externer Zugriff erfolgt über nginx
2. JWT Bearer — HS256, Toleranz 30s
3. Rate Limiting — auth: 10/min, search: 30/min
4. WebSockets — Keep-Alive 30s
5. EnsureCreated

### 8.2 DTOs
AuthContracts: RegisterRequest, ChallengeRequest, LoginRequest/Response
MessageContracts: SendMessageRequest, MessageResponse
KeyExchangeContracts: SendKeyExchangeRequest, KeyExchangeResponse
SyncContracts: SyncDeltaResponse

### 8.3 Endpunkte
POST /api/auth/register, /api/auth/challenge, /api/auth/login (Rate: auth, anonym)
POST/GET /api/messages/ (Bearer JWT)
POST/GET /api/key-exchanges/ (Bearer JWT)
GET /api/public-keys/search (Rate: search, Bearer JWT)
GET /api/sync/delta (Bearer JWT)
WS /ws/sync, /ws/conversations/{peerFingerprint} (access_token query)

### 8.4 JwtTokenIssuer
HS256, Issuer/Audience: messager, Gültigkeit 12h, Claim sub = SHA-512-Fingerprint.

### 8.5 SyncNotificationHub
In-Memory Pub/Sub über System.Threading.Channels. fingerprint → Channel<string>.

## 9. Mobiler Client
### 9.1 Profil (App.tsx, profileStore.ts)
Mehrere Profile pro Gerät. Persistenz: SQLite (profiles, app_state).

### 9.2 Registrierung (RegistrationPage.tsx, registrationCrypto.ts)
```
User input → RSA.generateKeys(KEY_BITS) → DER → SHA-512 fingerprint
→ PBKDF2(pin) → AES-GCM encrypt(privateKeyPem)
→ POST /api/auth/register → SQLite
```
KEY_BITS: 1024 (__DEV__), 2048 (Produktion).

### 9.3 Anmeldung (LocalLoginPage.tsx, authApi.ts)
```
PIN → AES-GCM decrypt → privateKeyPem
→ GET /challenge → sign(RSA/SHA-512)
→ POST /login → JWT → PrivateKeySessionContext
```

### 9.4 Nachrichtenkryptografie (chatCrypto.ts)
Key Exchange: randomBytes(32) → RSA-OAEP encrypt → POST /key-exchanges
Senden: AES-GCM(currentChainKey) → payload → POST /messages → nextKey=SHA-256(currentKey)
Empfangen: AES-GCM decrypt(incomingChainKey) → nextKey=SHA-256(incomingKey)

### 9.5 SQLite (chatStore.ts)
Tabellen: known_profiles, conversation_state, messages_local, key_exchanges_local, sync_state.

### 9.6 PrivateKeySessionContext
Automatische Sperrung nach 5 Minuten, Zurücksetzen bei Berührung, Rückkehr zur LocalLoginPage.

## 10. Kryptografisches Modell
### 10.1 Identität
```
RSA 2048-bit → publicKey(DER) → SHA-512 → FingerprintSha512
            → privateKey(PEM) → PBKDF2(pin,salt,150000) → K_wrap → AES-GCM → PrivateKeyEnvelope
```

### 10.2 Challenge-Response
```
Client → POST /challenge {fp} → Server generates randomBytes(64), expires 5min
Client signs with RSA/SHA-512/PKCS1
Client → POST /login {fp, sig} → Server verifies → ConsumedAt → JWT
```

### 10.3 Key Exchange
Alice ruft Bobs DER ab, verifiziert SHA-512(DER)==fingerprint, generiert seed=randomBytes(32), verschlüsselt via RSA-OAEP und sendet es. Bob entschlüsselt mit seinem privaten Schlüssel.

### 10.4 Chain Keys
```
Seed → K_0=SHA-256(Seed) → K_1=SHA-256(K_0) → ... → K_n
Nachricht n: AES-GCM(K_n, randomIV, plaintext) → payload=Base64(IV||tag||ct)
```
Forward Secrecy: SHA-256 ist unidirektional.

### 10.5 Zusammenfassung der Primitiven
| Zweck | Algorithmus | Parameter |
|---|---|---|
| Identität | RSA | 2048-bit |
| Bezeichner | SHA-512 | DER-Eingabe |
| KDF | PBKDF2-SHA256 | 150k Iter., 16B Salt, 32B Schlüssel |
| Verschlüsselung des privaten Schlüssels | AES-256-GCM | 12B IV, 16B Tag |
| Signatur | RSA+SHA-512+PKCS1 | — |
| Key Exchange | RSA-OAEP+SHA-256 | — |
| Nachrichten | AES-256-GCM | 12B IV, 16B Tag |
| Chain-Ableitung | SHA-256 | K_{n+1}=H(K_n) |
| Nachrichten-Hash | SHA-512 | verschlüsselter Payload |

## 11. Datenbankschema
### 11.1 PostgreSQL
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
CREATE INDEX idx_messages_from    ON messages(from_public_key);
CREATE INDEX idx_messages_to      ON messages(to_public_key);
CREATE INDEX idx_messages_created ON messages(created_at);
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

### 11.2 ERD
```
public_keys (PK: fingerprint_sha512)
    ║
    ╠══════════════════════╗
    ▼                      ▼
messages                key_exchanges
(PK: from+to+hash)      (PK: from+to)
    ║
    ▼
login_challenges (PK: id)
```

### 11.3 SQLite (Client)
Tabellen: profiles, app_state, known_profiles, conversation_state, messages_local, key_exchanges_local, sync_state.

## 12. Synchronisierung und Echtzeit-Kommunikation
### 12.1 HTTP Delta Sync
GET /api/sync/delta?since=ISO8601 → SyncDeltaResponse. Client: liest last_synced_at → ruft Delta ab → aktualisiert lokale Tabellen → speichert neuen Zeitstempel.

### 12.2 WebSocket Push
/ws/sync?access_token=JWT. SyncNotificationHub: fingerprint → Channel<string>. Handler veröffentlicht nach dem Speichern → WebSocket → Client.

### 12.3 Konversations-WebSocket
/ws/conversations/{peerFingerprint} — Streaming einer bestimmten Konversation.

## 13. Konfiguration und Deployment
### 13.1 .env-Datei
Zentrale Konfigurationsdatei für Docker Compose, durch .gitignore vom Repository ausgeschlossen. Vorlage: .env.example.
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

### 13.2 Umgebungsvariablen
| Variable | Erforderlich | Beschreibung |
|---|---|---|
| POSTGRES_DB | Ja | Datenbankname |
| POSTGRES_USER | Ja | Benutzername |
| POSTGRES_PASSWORD | Ja | Passwort |
| JWT_SIGNING_KEY | Ja | HMAC-SHA256-Secret |
| MESSAGE_TTL_DAYS | Nein | Nachrichtenaufbewahrung in Tagen (Standard: 30) |
| APP_PORT | Nein | nginx-Port (Standard: 443 mit SSL, 80 ohne SSL) |
| APP_DOMAIN | Nein | Öffentliche Domain / IP (Standard: localhost) |
| NGINX_USE_SSL | Nein | TLS über nginx aktivieren (Standard: true) |
| SSL_CA_CERT_FILE | Nein | CA-Zertifikat für android-builder |
| MESSAGER_API_BASE_URL | Nein | URL für APK |

### 13.3 docker-compose
Vier Dienste: db (postgres:17-alpine), api, nginx (SSL-Proxy), android-builder (Profil: release). Interpolation ${VARIABLE} aus .env. API lauscht intern auf Port 5000; nginx exponiert ${APP_PORT} nach außen.
```bash
docker compose up -d
docker compose --profile release up --build
```

### 13.4 Dockerfile.android
eclipse-temurin:17-jdk-jammy, Node.js 22, Android SDK 35, APK-Build nach /releases.

### 13.5 Lokale Ausführung
```bash
dotnet run --project ./API/API.csproj
cd App && npm install && npm run android
```

### 13.6 Mobilnetzwerk
| Umgebung | URL |
|---|---|
| Android-Emulator | http://10.0.2.2:5000 |
| USB (adb reverse) | http://localhost:5000 |
| WLAN | http://<LAN-IP>:5000 |
| Produktion | https://<domain> |

## 14. Sicherheitsanalyse
### 14.1 Bedrohungen und Schutzmaßnahmen
| Bedrohung | Schutzmaßnahme |
|---|---|
| Abfangen während der Übertragung | E2EE |
| Brute-Force | Rate Limiting 10/min, einmalige Challenge |
| Identitätsfälschung | SHA-512(DER) = Fingerprint |
| MITM-Schlüssel | Überprüfung SHA-512(DER) vor der Verschlüsselung |
| Kompromittierung des privaten Schlüssels | PBKDF2+AES-GCM |
| Challenge-Replay | consumed_at + TTL 5 Minuten |
| Verlust des Nachrichtenverlaufs | Forward Secrecy Chain Keys |
| Unbefugter WS-Zugriff | JWT-Validierung |
| DoS-Suche | Limit 30 Req/min |

### 14.2 Schwachstellen
1. Kein erzwungenes HTTPS
2. Keine RSA-Rotation
3. Kein Multi-Device-Support
4. Statischer JWT_SIGNING_KEY
5. EnsureCreated statt Migrationen
6. RSA 1024-bit in DEV
7. Kein Acknowledgement

### 14.3 Stärken
- Zero Knowledge des Servers über den Inhalt
- CSPRNG
- Integritätsprüfung des Schlüssels
- .env vom Repository ausgeschlossen
- DeleteBehavior.Restrict

## 15. Einschränkungen und Entwicklungsrichtungen
### 15.1 Einschränkungen
1. EF Core 10 Preview
2. Reflection-Hydratisierung
3. Keine Tests
4. Sequenzielle Synchronisierung der Chain Keys

### 15.2 Entwicklungsrichtungen
| Priorität | Bereich | Vorschlag |
|---|---|---|
| Hoch | Persistenz | EF Core Migrationen |
| Hoch | Tests | Testcontainers |
| Hoch | Sicherheit | HTTPS |
| Mittel | Kryptografie | Double Ratchet |
| Mittel | UX | Delivery Receipts |
| Mittel | Sicherheit | JWKS |
| Niedrig | Architektur | Aggregatfabrik |
| Niedrig | Monitoring | Security Telemetry |

## 16. Schlussfolgerungen
Messager — eine kohärente E2EE-Messenger-Implementierung mit Clean Architecture. Zero-Knowledge-Server. Bereit für produktives Hardening.

## 17. Glossar
| Begriff | Definition |
|---|---|
| AES-GCM | Symmetrische AEAD-Verschlüsselung |
| Aggregat | DDD-Entitäts-Cluster |
| Chain Key | K_{n+1}=H(K_n) |
| Challenge-Response | Authentifizierung ohne Passwort |
| Clean Architecture | Unidirektionaler Abhängigkeitsfluss |
| DER | Binäres ASN.1-Format |
| E2EE | End-to-End Encryption |
| EF Core | Microsoft ORM |
| Fingerprint | SHA-512(publicKey.Der) |
| Forward Secrecy | Kompromittierung legt Verlauf nicht offen |
| IV | Initialization Vector |
| JWT | JSON Web Token |
| Key Exchange | Austausch des Schlüssel-Seeds |
| Minimal API | ASP.NET Core ohne Controller |
| PBKDF2 | Password-Based KDF |
| PEM | Textbasiertes Schlüsselformat |
| RSA | Rivest–Shamir–Adleman |
| RSA-OAEP | RSA mit OAEP-Padding |
| SHA-512 | 512-bit-Hash |
| SQLite | Eingebettete Datenbank |
| WebSocket | Bidirektionales Echtzeit-Protokoll |

*Dokument generiert auf Basis des Quellcodes. Datum: 2026-06-09.*
