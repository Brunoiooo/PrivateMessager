# Messager — Documentation Académique du Système

**Titre du projet :** Messager — messagerie multicouche avec chiffrement end-to-end
**Type de projet :** Application web-mobile (monorepo)
**Date de la documentation :** 2026-06-09

## 1. Résumé

Le présent document constitue la documentation académique du système Messager — une messagerie mettant en œuvre le chiffrement de bout en bout (E2EE) au moyen de la cryptographie asymétrique RSA et de clés symétriques en chaîne (chain keys). Le système se compose d'un backend développé avec ASP.NET Core (.NET 10) et une base de données PostgreSQL, ainsi que d'un client mobile basé sur React Native avec un stockage local SQLite. L'architecture du backend applique le patron Clean Architecture, séparant la couche domaine (Domain), la couche application (Application), la couche infrastructure (Infrastructure) et la couche interface HTTP (API). Le client mobile implémente le flux cryptographique complet : génération de la paire de clés RSA, protection de la clé privée par PBKDF2+AES-GCM, authentification challenge-response avec signature RSA/SHA-512, échange de matériel de clé via RSA-OAEP, et chiffrement des messages AES-GCM avec dérivation successive des clés en chaîne par la fonction SHA-256.

## 2. Introduction

### 2.1 Objectif du projet

- Identification des participants via la clé publique RSA
- Authentification par signature cryptographique (challenge-response)
- Échange de matériel de clé entre interlocuteurs au moyen du chiffrement asymétrique
- Transmission sécurisée des messages chiffrés par clé symétrique avec mécanisme de forward secrecy
- Synchronisation incrémentale des données entre l'appareil mobile et le serveur
- Stockage de l'historique dans une base SQLite locale, illisible par le serveur

### 2.2 Périmètre de la documentation

| Répertoire | Rôle |
|---|---|
| Domain/ | Entités du domaine et règles métier |
| Application/ | Handlers des cas d'usage et interfaces des services |
| Infrastructure/ | EF Core, PostgreSQL, implémentations des services cryptographiques |
| API/ | Minimal API ASP.NET Core, JWT, WebSockets, DTOs |
| App/ | Client mobile React Native (Android/iOS) |

### 2.3 Technologies

| Couche | Technologie | Version |
|---|---|---|
| Runtime backend | .NET | 10.0 |
| Framework HTTP | ASP.NET Core Minimal APIs | 10.0 |
| ORM | Entity Framework Core + Npgsql | 10.x (preview) |
| Base de données serveur | PostgreSQL | 17 |
| Runtime mobile | React Native | 0.85.3 |
| Langage mobile | TypeScript / React | 19.2.3 |
| Base de données client | SQLite | react-native-sqlite-storage |
| Cryptographie client | node-forge, react-native-rsa-native | — |

## 3. Contexte technologique et cryptographique

### 3.1 RSA

RSA (Rivest–Shamir–Adleman) — algorithme de cryptographie asymétrique. Dans Messager : identification de l'utilisateur (fingerprint SHA-512 du DER) et chiffrement du seed via RSA-OAEP.

### 3.2 AES-GCM

Clé de 256 bits, IV de 12 octets aléatoires, Tag de 16 octets. Format du chiffré : IV||Tag||Ciphertext.

### 3.3 PBKDF2

150 000 itérations HMAC-SHA256, clé de 32 octets.

### 3.4 Chain Keys et Forward Secrecy

K_{n+1} = SHA-256(K_n). Le caractère unidirectionnel de SHA-256 garantit la forward secrecy.

### 3.5 Challenge-Response

Le serveur génère un challenge de 64 octets ; le client signe avec RSA/SHA-512/PKCS1 ; le serveur vérifie.

## 4. Architecture du système

### 4.1 Vue d'ensemble

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

### 4.3 Client mobile

| Couche | Fichiers | Responsabilité |
|---|---|---|
| Pages (UI) | src/pages/ | Écrans, navigation |
| Services (API) | authApi.ts, messagingApi.ts | HTTP/WebSocket |
| Services (Crypto) | registrationCrypto.ts, chatCrypto.ts | Cryptographie |
| Services (Store) | profileStore.ts, chatStore.ts | SQLite |
| Context | src/context/ | État de la session |
| Components | src/components/ | Composants réutilisables |
| Types | src/types/ | TypeScript |

## 5. Modèle de domaine

### 5.1 BaseEntity

```csharp
public abstract class BaseEntity
{
    public DateTime CreatedAt { get; protected set; }
    public DateTime UpdatedAt { get; protected set; }
}
```

### 5.2 PublicKey — identité de l'utilisateur

Agrégat : FingerprintSha512 (128 hex), Der (byte[]), UserName (3-32), UserTag (1-99999).

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

Clé composite : (FromPublicKey, ToPublicKey, MessageHash) — idempotence.

### 5.4 KeyExchange

Clé composite : (FromPublicKey, ToPublicKey) — une seule par paire et par direction.

## 6. Couche Application

### 6.1 Interfaces des services

| Interface | Objectif |
|---|---|
| ICurrentPublicKey | Fingerprint de la requête courante |
| ILoginChallengeService | Challenge |
| ILoginService | Vérification RSA |
| IPublicKeyRepository | CRUD |
| IPublicKeySecurityService | Import, fingerprint |

### 6.2 Handlers

RegisterHandler, GetLoginChallengeHandler, LoginHandler, SendMessageHandler, SendKeyExchangeHandler, GetMessagesHandler, GetKeyExchangesHandler.

## 7. Couche Infrastructure

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

### 7.2 PublicKeyRepository — réflexion

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

## 8. Couche API

Kestrel (IP/port configurables par variables d'environnement), JWT Bearer HS256 (tolérance d'horloge 30 s), Rate Limiting (auth 10/min, recherche 30/min), WebSockets keep-alive 30 s, EnsureCreated.

Points d'entrée : POST /api/auth/register, /challenge, /login. POST/GET /api/messages/, /api/key-exchanges/. GET /api/public-keys/search. GET /api/sync/delta. WS /ws/sync, /ws/conversations/{peer}.

JwtTokenIssuer : HS256, issuer/audience=messager, durée 12 h, sub=fingerprint.

SyncNotificationHub : pub/sub en mémoire via Channels.

## 9. Client mobile

Plusieurs profils par appareil (SQLite). Inscription : génération de clé RSA, protection de la clé par PBKDF2+AES-GCM, POST /register. Connexion : déchiffrement par PIN, challenge-response, JWT. Chain keys : AES-GCM avec dérivation SHA-256. Verrouillage automatique après 5 min d'inactivité.

## 10. Modèle cryptographique

RSA 2048 bits → DER → SHA-512 → fingerprint. PrivateKey → PBKDF2 → enveloppe AES-GCM. Chaîne : K_0=SHA-256(Seed), K_n=SHA-256(K_{n-1}). Forward secrecy.

### 10.5 Récapitulatif des primitives cryptographiques

| Objectif | Algorithme | Paramètres |
|---|---|---|
| Identité | RSA | 2048 bits |
| Identifiant | SHA-512 | entrée : DER |
| KDF | PBKDF2-SHA256 | 150k itér., sel 16 o., clé 32 o. |
| Protection de la clé | AES-256-GCM | IV 12 o., tag 16 o. |
| Signature | RSA+SHA-512+PKCS1 | — |
| Key Exchange | RSA-OAEP+SHA-256 | — |
| Chiffrement des messages | AES-256-GCM | IV 12 o., tag 16 o. |
| Dérivation en chaîne | SHA-256 | K_{n+1}=H(K_n) |
| Hachage des messages | SHA-512 | entrée : charge utile chiffrée |

## 11. Schéma de base de données

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

SQLite : profiles, app_state, known_profiles, conversation_state, messages_local, key_exchanges_local, sync_state.

## 12. Synchronisation en temps réel

Delta HTTP : GET /api/sync/delta?since=ISO8601. WebSocket : /ws/sync (fingerprint → Channel). /ws/conversations/{peer} par conversation.

## 13. Configuration et déploiement

### 13.1 Fichier .env

Fichier de configuration central pour Docker Compose, exclu par .gitignore.

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

### 13.2 Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| POSTGRES_DB | Oui | Nom de la base de données |
| POSTGRES_USER | Oui | Utilisateur |
| POSTGRES_PASSWORD | Oui | Mot de passe |
| JWT_SIGNING_KEY | Oui | Secret HMAC-SHA256 |
| MESSAGE_TTL_DAYS | Non | Rétention des messages en jours (défaut : 30) |
| APP_PORT | Non | Port nginx (défaut : 443 avec SSL, 80 sans SSL) |
| APP_DOMAIN | Non | Domaine / IP publique (défaut : localhost) |
| NGINX_USE_SSL | Non | Activer TLS via nginx (défaut : true) |
| SSL_CA_CERT_FILE | Non | Certificat CA pour android-builder |
| MESSAGER_API_BASE_URL | Non | URL de l'APK |

### 13.3 docker-compose

Quatre services : db (postgres:17-alpine), api, nginx (proxy SSL), android-builder (profil : release). Interpolation ${VAR}. L'API écoute en interne sur le port 5000 ; nginx expose ${APP_PORT} à l'extérieur.

```bash
cp .env.example .env
docker compose up -d
docker compose --profile release up --build
```

### 13.4 Dockerfile.android

eclipse-temurin:17-jdk-jammy, Node.js 22, Android SDK 35.

### 13.5 Lancement local

```bash
dotnet run --project ./API/API.csproj
cd App && npm install && cp .env.example .env && npm run android
```

### 13.6 Réseau mobile

| Environnement | URL |
|---|---|
| Émulateur Android | http://10.0.2.2:5000 |
| USB | http://localhost:5000 |
| WiFi | http://<LAN-IP>:5000 |
| Production | https://<domaine> |

## 14. Analyse de sécurité

E2EE, rate limiting, fingerprint=SHA-512(DER), protection anti-MITM, PBKDF2+AES-GCM, consumed_at, forward secrecy, authentification JWT via WebSocket.

Faiblesses identifiées : absence de HTTPS forcé, pas de rotation des clés RSA, pas de support multi-appareil, JWT_SIGNING_KEY statique, utilisation d'EnsureCreated, RSA 1024 bits en mode DEV, absence d'accusé de réception.

## 15. Limites et développements futurs

Limites actuelles : EF Core 10 en preview, recours à la réflexion pour l'hydratation des agrégats, absence de tests automatisés, synchronisation séquentielle.

Améliorations envisagées : migrations EF, Testcontainers, HTTPS, protocole Double Ratchet, JWKS, télémétrie.

## 16. Conclusion

Messager est une implémentation E2EE cohérente reposant sur Clean Architecture. Le serveur est à connaissance nulle (zero-knowledge). Le projet est prêt pour un durcissement en vue d'une mise en production.

## 17. Glossaire

| Terme | Définition |
|---|---|
| AES-GCM | Chiffrement symétrique AEAD |
| Chain Key | K_{n+1}=H(K_n) — forward secrecy |
| Challenge-Response | Authentification sans transmission de secret |
| Clean Architecture | Flux de dépendances unidirectionnel |
| DER | Format binaire ASN.1 |
| E2EE | End-to-End Encryption |
| EF Core | Entity Framework Core — ORM Microsoft |
| Fingerprint | SHA-512(publicKey.Der) |
| Forward Secrecy | Une compromission actuelle ne révèle pas l'historique passé |
| IV | Vecteur d'initialisation |
| JWT | JSON Web Token |
| Key Exchange | Échange de matériel de clé chiffré |
| Minimal API | ASP.NET Core sans contrôleurs |
| PBKDF2 | Dérivation de clé basée sur un mot de passe |
| PEM | Format texte des clés cryptographiques |
| RSA | Rivest–Shamir–Adleman |
| RSA-OAEP | RSA avec rembourrage OAEP |
| SHA-512 | Fonction de hachage 512 bits |
| SQLite | Base de données embarquée |
| WebSocket | Protocole de communication bidirectionnelle en temps réel |

*Date : 2026-06-09.*
