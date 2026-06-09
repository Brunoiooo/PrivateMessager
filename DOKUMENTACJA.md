# Messager — Dokumentacja Akademicka Systemu

**Tytuł projektu:** Messager — wielowarstwowy komunikator z szyfrowaniem end-to-end  
**Typ projektu:** Aplikacja klient-serwer (full-stack: .NET 10 + React Native)  
**Charakter:** Projekt osobisty/demo, gotowy do wdrożenia na produkcji po przeprowadzeniu audytów bezpieczeństwa  
**Data dokumentacji:** 2026-06-09  

---

## Spis treści

1. [Abstrakt](#1-abstrakt)
2. [Wstęp](#2-wstęp)
3. [Szybki start](#3-szybki-start)
4. [Tech stack — przegląd technologii](#4-tech-stack--przegląd-technologii)
5. [Główne funkcje systemu](#5-główne-funkcje-systemu)
6. [Tło technologiczne i kryptograficzne](#6-tło-technologiczne-i-kryptograficzne)
7. [Architektura systemu](#7-architektura-systemu)
8. [Model dziedziny](#8-model-dziedziny)
9. [Warstwa Application — przypadki użycia](#9-warstwa-application--przypadki-użycia)
10. [Warstwa Infrastructure — realizacja techniczna](#10-warstwa-infrastructure--realizacja-techniczna)
11. [Warstwa API — interfejs HTTP i WebSocket](#11-warstwa-api--interfejs-http-i-websocket)
12. [Klient mobilny](#12-klient-mobilny)
13. [Model kryptograficzny — analiza szczegółowa](#13-model-kryptograficzny--analiza-szczegółowa)
14. [Schemat bazy danych](#14-schemat-bazy-danych)
15. [Synchronizacja i komunikacja czasu rzeczywistego](#15-synchronizacja-i-komunikacja-czasu-rzeczywistego)
16. [Konfiguracja środowiska i wdrożenie](#16-konfiguracja-środowiska-i-wdrożenie)
17. [Analiza bezpieczeństwa](#17-analiza-bezpieczeństwa)
18. [Ograniczenia i kierunki rozwoju](#18-ograniczenia-i-kierunki-rozwoju)
19. [FAQ — często zadawane pytania](#19-faq--często-zadawane-pytania)
20. [Troubleshooting — rozwiązywanie problemów](#20-troubleshooting--rozwiązywanie-problemów)
21. [Wnioski](#21-wnioski)
22. [Słownik pojęć](#22-słownik-pojęć)

---

## 1. Abstrakt

Niniejszy dokument stanowi **akademicką dokumentację systemu Messager** — pełnostackowego, wielowarstwowego komunikatora realizującego szyfrowanie wiadomości metodą **end-to-end (E2EE)** przy użyciu **Signal Protocol** oraz kryptografii asymetrycznej **RSA-OAEP** i symetrycznej **AES-256-GCM**.

**Architektura:**
- **Backend**: .NET 10, ASP.NET Core Minimal APIs, PostgreSQL (EF Core), JWT Bearer auth
- **Mobile**: React Native 0.85 + TypeScript, SQLite offline-first cache, libsignal-protocol-typescript
- **Security Model**: Challenge-response logowanie (RSA-SHA512), kluczy łańcuchowe ze forward secrecy, PBKDF2-SHA256 do ochrony klucza prywatnego

System implementuje wzorzec **Clean Architecture**, separując warstwę dziedziny (Domain), zastosowań (Application), infrastruktury (Infrastructure) oraz interfejsu HTTP/WebSocket (API). Serwer **nigdy nie widzi plaintextu wiadomości** — wszystkie dane kryptograficznie wrażliwe pozostają po stronie klienta.

Dokument opisuje każdą warstwę systemu, analizuje rozwiązania architektoniczne, specyfikuje API, opisuje przepływy kryptograficzne i omawia aspekty bezpieczeństwa.

---

## 2. Wstęp

### 2.1 Cel projektu

Projekt Messager realizuje klasyczny cel systemu bezpiecznej komunikacji peer-to-peer:

- **Identyfikacja** uczestników poprzez klucz publiczny RSA,
- **Uwierzytelnianie** podpisem kryptograficznym (challenge-response),
- **Wymiana materiału kluczowego** między rozmówcami przy użyciu szyfrowania asymetrycznego,
- **Bezpieczna transmisja wiadomości** szyfrowanych kluczem symetrycznym z mechanizmem forward secrecy,
- **Synchronizacja przyrostowa** danych między urządzeniem mobilnym a serwerem,
- **Przechowywanie historii** w lokalnej bazie SQLite bez możliwości odczytu przez serwer.

System projektuje się jako odporny na kompromitację serwera w zakresie treści wiadomości: serwer przechowuje wyłącznie zaszyfrowane dane i nie posiada kluczy pozwalających na ich odczyt.

### 2.2 Zakres dokumentacji

Dokumentacja obejmuje całość kodu źródłowego repozytorium (`c:\Users\Blazej\sources\Messager`):

| Katalog | Rola |
|---|---|
| `Domain/` | Encje dziedziny i reguły biznesowe |
| `Application/` | Handlery przypadków użycia i interfejsy serwisów |
| `Infrastructure/` | EF Core, PostgreSQL, implementacje serwisów kryptograficznych |
| `API/` | Minimal API ASP.NET Core, JWT, WebSockets, DTOs |
| `App/` | Klient mobilny React Native (Android/iOS) |

### 2.3 Technologie

| Warstwa | Technologia | Wersja |
|---|---|---|
| Runtime backendu | .NET | 10.0 |
| Framework HTTP | ASP.NET Core Minimal APIs | 10.0 |
| ORM | Entity Framework Core + Npgsql | 10.x (preview) |
| Baza danych serwera | PostgreSQL | 17 |
| Runtime mobilny | React Native | 0.85.3 |
| Język mobilny | TypeScript / React | 19.2.3 |
| Baza danych klienta | SQLite | react-native-sqlite-storage |
| Kryptografia klienta | node-forge, react-native-rsa-native, libsignal | — |
| Reverse Proxy | Nginx | alpine |
| Konteneryzacja | Docker + Docker Compose | — |

---

## 3. Szybki start

### 3.1 Wymagania

- **Node.js** ≥ 22.11.0
- **.NET 8.0+** (testowane na .NET 10)
- **Docker & Docker Compose** (opcjonalnie)
- **PostgreSQL** (jeśli uruchomienie bez Dockera)
- **Android SDK** lub **Xcode** (do budowania aplikacji mobilnej)

### 3.2 Uruchomienie z Dockerem

```bash
# Klonowanie repozytorium
git clone https://github.com/your-org/messager.git
cd messager

# Skopiowanie szablonu zmiennych środowiskowych
cp .env.example .env

# Edycja .env — zmień hasła i klucze
nano .env

# Uruchomienie pełnego stosu
docker-compose up -d

# Weryfikacja statusu
docker-compose ps
```

Dostęp:
- **API (Swagger)**: https://localhost:443/swagger
- **Backend**: http://localhost:5000 (wewnętrzny)
- **Nginx**: https://localhost:443 (dostęp publiczny)

### 3.3 Uruchomienie lokalne (bez Dockera)

**Backend:**

```bash
cd API
dotnet restore
dotnet build
dotnet run
```

**Frontend (Android):**

```bash
cd App
npm install
npm start                    # Start Metro bundler
npm run android             # Uruchomienie na emulatorze/urządzeniu
```

---

## 4. Tech stack — przegląd technologii

### 4.1 Stos backendowy

| Komponent | Technologia | Rola |
|---|---|---|
| **Runtime** | .NET 10 | Nowoczesny, unified platform dla serverless, containerów, web |
| **Framework** | ASP.NET Core Minimal APIs | Lekki, type-safe routing bez kontrolerów |
| **ORM** | EF Core + Npgsql | Mapowanie obiektowo-relacyjne z obsługą PostgreSQL |
| **Baza** | PostgreSQL 17 | Type-safe SQL, JSONB, full-text search, zaawansowane indeksy |
| **Autentykacja** | JWT Bearer (HS256) | 12h TTL, issuer+audience validation |
| **Rate Limiting** | ASP.NET Core Rate Limiting | Sliding window (auth: 10 req/min, search: 30 req/min) |
| **Real-time** | WebSocket (System.Net.WebSockets) | In-memory pub/sub (`SyncNotificationHub`) |
| **Hashing** | SHA-512 | Fingerprint użytkownika (128 hex) |
| **Szyfrowanie** | RSA-OAEP, AES-GCM | Wymiana kluczy i szyfrowanie wiadomości |

### 4.2 Stos frontendowy

| Komponent | Technologia | Rola |
|---|---|---|
| **Framework** | React Native 0.85.3 | Cross-platform iOS/Android (single codebase) |
| **Język** | TypeScript 5.8.3 | Type safety, improved DX |
| **Komunikacja** | React Hooks + Fetch/WebSocket | REST + real-time push |
| **Lokalny skład** | SQLite + async-storage | Offline-first, w-device encryption |
| **Kryptografia** | Signal Protocol + node-forge + RSA Native | E2EE, challenge-response, lokalny key management |
| **Biometria** | react-native-keychain | Fingerprint/Face unlock, secure key storage |
| **Stan** | React Context + localStorage | Global session context (private key, JWT) |

### 4.3 Infrastruktura

| Komponent | Technologia | Rola |
|---|---|---|
| **Reverse Proxy** | Nginx (alpine) | TLS termination, HTTP/2, WebSocket proxy, rate limiting |
| **Konteneryzacja** | Docker + Docker Compose | Standardowe środowiska (dev, staging, prod) |
| **CI/CD** | Dockerfile.android | Automatyzacja budowania APK |
| **Volume persistence** | Docker volumes | Trwałość danych DB i cache |

---

## 5. Główne funkcje systemu

### 5.1 Rdzenne cechy

✅ **End-to-End Encrypted Messaging** — Signal Protocol z forward secrecy, odbiorca szyfruje wiadomości kluczem publicznym nadawcy  
✅ **Zero-Knowledge Architecture** — serwer nigdy nie widzi plaintextu, przechowuje wyłącznie `IV || Tag || Ciphertext`  
✅ **Challenge-Response Login** — bezpieczne logowanie bez transmisji hasła, RSA-SHA512 signatures  
✅ **Real-time Sync** — WebSocket gateway do natychmiastowych powiadomień o nowych wiadomościach  
✅ **Multi-Profile Support** — obsługa wielu tożsamości na jednym urządzeniu z izolacją danych  
✅ **Offline-First** — SQLite local cache, automatyczna synchronizacja po reconnect  
✅ **Biometric Authentication** — PIN + fingerprint/face unlock na iOS/Android  
✅ **Message TTL** — automatyczne usuwanie starych wiadomości (domyślnie 30 dni)  
✅ **Auto-Lock** — session timeout po 5 minutach bezczynności  
✅ **Cross-Platform** — aplikacja mobilna iOS i Android z wspólnym kodem React Native  

### 5.2 Przepływy użytkownika

| Przepływ | Opis |
|---|---|
| **Rejestracja** | Użytkownik generuje parę kluczy RSA, ustawia PIN, pobiera fingerprint (SHA-512), rejestruje się na serwerze |
| **Logowanie** | PIN odmyka klucz prywatny (AES-GCM decrypt), challenge-response (sign challenge), otrzymanie JWT |
| **Wysłanie wiadomości** | Pobranie klucza publicznego odbiorcy, RSA-OAEP sharedSecret, AES-GCM szyfrowanie, wysłanie na serwer |
| **Odbiór wiadomości** | WebSocket notifikacja, fetch zaszyfrowanej wiadomości, AES-GCM deszyfrowanie, SQLite cache |
| **Synchronizacja** | HTTP `/api/sync/delta?since=last_synced_at` lub WebSocket push dla real-time updates |

---

## 6. Tło technologiczne i kryptograficzne

### 3.1 Kryptografia asymetryczna RSA

RSA (Rivest–Shamir–Adleman) jest algorytmem kryptograficznym opartym na trudności faktoryzacji dużych liczb całkowitych. Para kluczy składa się z klucza publicznego (upublicznianego) i prywatnego (przechowywanego lokalnie). Właściwości:

- **Szyfrowanie:** wiadomość szyfrowana kluczem publicznym odbiorcy; tylko odbiorca posiadający klucz prywatny może ją odszyfrować.
- **Podpisywanie:** właściciel klucza prywatnego podpisuje dane; każdy posiadający klucz publiczny może zweryfikować podpis.

W systemie Messager RSA pełni dwie role:
1. Identyfikacja użytkownika (klucz publiczny jako tożsamość, fingerprint SHA-512 jako identyfikator),
2. Szyfrowanie seedu klucza łańcuchowego (RSA-OAEP, schemat wypełniania Optimal Asymmetric Encryption Padding).

### 3.2 Kryptografia symetryczna AES-GCM

AES (Advanced Encryption Standard) w trybie GCM (Galois/Counter Mode) łączy szyfrowanie z uwierzytelnianiem wiadomości (AEAD — Authenticated Encryption with Associated Data). Parametry:

- **Klucz:** 256-bitowy (32 bajty),
- **Wektor inicjalizacji (IV):** 96-bitowy (12 bajtów), losowy dla każdej wiadomości,
- **Tag uwierzytelniający:** 128-bitowy (16 bajtów), zapewnia integralność i autentyczność.

Struktura szyfrogramu: `IV (12B) || Tag (16B) || Ciphertext (nB)`.

### 3.3 PBKDF2 — derywacja klucza z hasła

PBKDF2 (Password-Based Key Derivation Function 2) wzmacnia hasło/PIN użytkownika przez wielokrotne iteracje funkcji pseudolosowej (tutaj HMAC-SHA256). Parametry w Messager: 150 000 iteracji, 32-bajtowy klucz wyjściowy.

### 3.4 Klucze łańcuchowe i forward secrecy

Schemat kluczy łańcuchowych zbliżony do algorytmu Double Ratchet (używanego w Signal Protocol) zapewnia *forward secrecy* — skompromitowanie bieżącego klucza nie ujawnia treści wcześniejszych wiadomości. Derywacja: `K_{n+1} = SHA-256(K_n)`.

### 3.5 Challenge-Response

Mechanizm uwierzytelniania bez przesyłania hasła przez sieć. Serwer generuje losowe wyzwanie (challenge); klient podpisuje je kluczem prywatnym; serwer weryfikuje podpis kluczem publicznym. Uwierzytelnia bez ujawniania tajemnicy.

---

## 7. Architektura systemu

### 4.1 Architektura ogólna

System Messager jest architekturą klient-serwer z logiką kryptograficzną wyłącznie po stronie klienta.

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
│  │  ┌────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │Endpts  │  │  JWT + Auth  │  │  WebSockets │  │   │
│  │  └───┬────┘  └──────────────┘  └─────────────┘  │   │
│  └──────┼───────────────────────────────────────────┘   │
│  ┌──────▼─────────────────────────────────────────────┐ │
│  │          Application (Handlers)                    │ │
│  └──────┬─────────────────────────────────────────────┘ │
│  ┌──────▼─────────────────────────────────────────────┐ │
│  │          Domain (Entities + Business Rules)        │ │
│  └──────┬─────────────────────────────────────────────┘ │
│  ┌──────▼─────────────────────────────────────────────┐ │
│  │    Infrastructure (EF Core + Services)             │ │
│  └──────┬─────────────────────────────────────────────┘ │
└─────────┼───────────────────────────────────────────────┘
          │
┌─────────▼──────────┐
│  PostgreSQL (DB)   │
└────────────────────┘
```

### 4.2 Clean Architecture backendu

Backend stosuje wzorzec Clean Architecture z jednostronnym przepływem zależności:

```
API  ──▶  Application  ──▶  Domain
Infrastructure  ──▶  Application  ──▶  Domain
```

Zasady:
- **Domain** nie zależy od żadnej innej warstwy; hermetyzuje reguły biznesowe,
- **Application** definiuje przypadki użycia i interfejsy serwisów; nie zna szczegółów technicznych,
- **Infrastructure** implementuje interfejsy zdefiniowane w Application; zależy od EF Core i PostgreSQL,
- **API** mapuje żądania HTTP na wywołania handlerów z Application; nie zawiera logiki biznesowej.

### 4.3 Architektura klienta mobilnego

Klient React Native jest podzielony na warstwy funkcjonalne:

| Warstwa | Pliki | Odpowiedzialność |
|---|---|---|
| Pages (UI) | `src/pages/` | Ekrany, nawigacja, interakcja z użytkownikiem |
| Services (API) | `src/services/authApi.ts`, `messagingApi.ts` | Komunikacja HTTP/WebSocket z backendem |
| Services (Crypto) | `src/services/registrationCrypto.ts`, `chatCrypto.ts` | Operacje kryptograficzne |
| Services (Store) | `src/services/profileStore.ts`, `chatStore.ts` | Lokalny skład SQLite |
| Context | `src/context/` | Globalny stan sesji (klucz prywatny, loading overlay) |
| Components | `src/components/` | Komponenty UI wielokrotnego użytku |
| Types | `src/types/` | Definicje typów TypeScript |

---

## 8. Model dziedziny

### 5.1 Encja bazowa — `BaseEntity`

Klasa abstrakcyjna będąca podstawą wszystkich encji dziedziny. Dostarcza znaczniki czasowe:

```csharp
// Domain/BaseEntity.cs
public abstract class BaseEntity
{
    public DateTime CreatedAt { get; protected set; }
    public DateTime UpdatedAt { get; protected set; }
}
```

### 5.2 Encja `PublicKey` — tożsamość użytkownika

Agregat centralny reprezentujący zarejestrowanego uczestnika systemu. Hermetyzuje zarówno dane tożsamości, jak i powiązane kolekcje wiadomości i wymian kluczy.

**Właściwości:**

| Właściwość | Typ | Opis |
|---|---|---|
| `FingerprintSha512` | `string` (128 znaków hex) | Globalny identyfikator użytkownika (SHA-512 z DER) |
| `Der` | `byte[]` | Klucz publiczny RSA w formacie DER |
| `UserName` | `string` (3–32 znaki) | Nazwa użytkownika (alfanumeryczna, `_`, `-`) |
| `UserTag` | `uint` (1–99999) | Liczba różnicująca użytkowników o tej samej nazwie |
| `MyKeyExchanges` | `IReadOnlyList<KeyExchange>` | Wymiany kluczy wysłane przez tego użytkownika |
| `YourKeyExchanges` | `IReadOnlyList<KeyExchange>` | Wymiany kluczy odebrane przez tego użytkownika |
| `MyMessages` | `IReadOnlyList<Message>` | Wiadomości wysłane przez tego użytkownika |
| `YourMessages` | `IReadOnlyList<Message>` | Wiadomości odebrane przez tego użytkownika |

**Reguły biznesowe walidowane w konstruktorze:**

- Fingerprint SHA-512: dokładnie 128 znaków, wyłącznie znaki szesnastkowe `[0-9a-fA-F]`,
- DER: niepusty bajt-tablica,
- UserName: 3–32 znaki, wyłącznie `[a-zA-Z0-9_-]`,
- UserTag: zakres 1–99 999.

**Metody domenowe:**

```csharp
// Wysłanie wiadomości — wymaga uprzedniej wymiany klucza z odbiorcą
public Message SendMessage(string toPublicKey, byte[] encryptedContent, string messageHash)
{
    bool hasKeyExchangeForRecipient = _myKeyExchanges.Any(x => x.ToPublicKey == toPublicKey);
    if (!hasKeyExchangeForRecipient)
        throw new InvalidOperationException("Cannot send message without a key exchange from owner to recipient.");
    // ...
}

// Dodanie rekordu wymiany klucza
public void AddKeyExchange(string toPublicKey, byte[] encryptedPrivateKey) { ... }

// Pobranie wiadomości z opcjonalnym filtrem dat
public IReadOnlyList<Message> GetMessages(string toPublicKey, DateTime? fromDate, DateTime? toDate) { ... }
```

Zasada dziedziny: wysłanie wiadomości bez uprzedniej wymiany klucza jest **niemożliwe**. Agregat samodzielnie weryfikuje warunek istnienia wymiany kluczy.

### 5.3 Encja `Message` — zaszyfrowana wiadomość

Reprezentuje pojedynczą wiadomość przechowywaną na serwerze w postaci wyłącznie zaszyfrowanej.

**Właściwości:**

| Właściwość | Typ | Opis |
|---|---|---|
| `FromPublicKey` | `string` | Fingerprint nadawcy |
| `ToPublicKey` | `string` | Fingerprint odbiorcy |
| `EncryptedContent` | `byte[]` | Zaszyfrowana treść (AES-GCM: IV+Tag+Ciphertext) |
| `MessageHash` | `string` | SHA-512 z `EncryptedContent` (hex, 128 znaków) — unikalny identyfikator |

Klucz naturalny złożony: `(FromPublicKey, ToPublicKey, MessageHash)` gwarantuje idempotentność: ponowne przesłanie tej samej wiadomości nie tworzy duplikatu.

### 5.4 Encja `KeyExchange` — wymiana materiału kluczowego

Reprezentuje jednorazowe (per para rozmówców) przesłanie zaszyfrowanego seeda klucza łańcuchowego.

**Właściwości:**

| Właściwość | Typ | Opis |
|---|---|---|
| `FromPublicKey` | `string` | Fingerprint inicjatora |
| `ToPublicKey` | `string` | Fingerprint adresata |
| `EncryptedPrivateKey` | `byte[]` | Seed zaszyfrowany kluczem publicznym RSA-OAEP odbiorcy |

Klucz naturalny złożony: `(FromPublicKey, ToPublicKey)` — para rozmówców ma co najwyżej jeden aktywny rekord wymiany per kierunek.

---

## 9. Warstwa Application — przypadki użycia

Warstwa definiuje handlery (ang. *use case handlers*) oraz interfejsy serwisów. Nie zawiera zależności od infrastruktury.

### 6.1 Interfejsy serwisów

| Interfejs | Lokalizacja | Cel |
|---|---|---|
| `ICurrentPublicKey` | `Interfaces/` | Dostęp do fingerprintu bieżącego użytkownika żądania |
| `ILoginChallengeService` | `Interfaces/` | Generowanie i walidacja challengy logowania |
| `ILoginService` | `Interfaces/` | Weryfikacja podpisu RSA w procesie logowania |
| `IPublicKeyRepository` | `Interfaces/` | Odczyt/zapis agregatów PublicKey |
| `IPublicKeySecurityService` | `Interfaces/` | Import RSA, obliczanie fingerprintu SHA-512 |

### 6.2 Handlery

#### `RegisterHandler`

Rejestruje nową tożsamość. Kroki:

1. Walidacja formatu i rozmiaru klucza DER,
2. Import klucza RSA (`IPublicKeySecurityService.ImportPublicKey`),
3. Obliczenie fingerprintu SHA-512,
4. Unikalność userTag dla danej userName (sprawdzenie konfliktu),
5. Zapis encji `PublicKey` przez repozytorium.

#### `GetLoginChallengeHandler`

Generuje challenge dla fingerprintu:

1. Walidacja istnienia fingerprintu w rejestrze,
2. Usunięcie wygasłych challengy (cleanup),
3. Wygenerowanie 64 losowych bajtów (kryptograficznie bezpieczne),
4. Zapis challenge z datą wygaśnięcia `+5 minut`.

#### `LoginHandler`

Weryfikacja podpisu i wydanie JWT:

1. Odczyt niespoważytego, ważnego challenge dla fingerprintu,
2. `ILoginService.Login` — weryfikacja podpisu RSA/SHA-512,
3. W przypadku sukcesu: oznaczenie challenge jako zużyty (`ConsumedAt`),
4. Wystawienie JWT (`JwtTokenIssuer`).

#### `SendMessageHandler`

Wysłanie zaszyfrowanej wiadomości:

1. Pobranie agregatu `PublicKey` nadawcy (z kolekcją `MyKeyExchanges`),
2. Wywołanie `publicKey.SendMessage(...)` — weryfikacja istnienia wymiany kluczy,
3. Zapisanie wiadomości przez repozytorium,
4. Powiadomienie subskrybentów WebSocket (`SyncNotificationHub`).

#### `SendKeyExchangeHandler`

Przesłanie zaszyfrowanego seeda:

1. Walidacja istnienia fingerprintu odbiorcy,
2. `publicKey.AddKeyExchange(...)`,
3. Zapis przez repozytorium.

#### `GetMessagesHandler` / `GetKeyExchangesHandler`

Pobieranie danych z opcjonalnym filtrem `since` (data od) dla synchronizacji przyrostowej.

---

## 10. Warstwa Infrastructure — realizacja techniczna

### 7.1 `MessagerDbContext` — kontekst EF Core

`DbContext` konfiguruje mapowanie encji rekordowych na tabele PostgreSQL:

```csharp
public sealed class MessagerDbContext(DbContextOptions<MessagerDbContext> options) : DbContext(options)
{
    public DbSet<PublicKeyRecord> PublicKeys => Set<PublicKeyRecord>();
    public DbSet<MessageRecord> Messages => Set<MessageRecord>();
    public DbSet<KeyExchangeRecord> KeyExchanges => Set<KeyExchangeRecord>();
    public DbSet<LoginChallengeRecord> LoginChallenges => Set<LoginChallengeRecord>();
}
```

Konfiguracja klucza złożonego dla wiadomości:

```csharp
entity.HasKey(x => new { x.FromPublicKey, x.ToPublicKey, x.MessageHash });
```

Klucze obce (FK) zdefiniowane w obu kierunkach relacji `messages → public_keys` i `key_exchanges → public_keys`, z polityką `OnDelete.Restrict` (brak kaskadowego usuwania).

### 7.2 `PublicKeyRepository`

Implementuje `IPublicKeyRepository`. Kluczowy aspekt: agregat `PublicKey` posiada prywatne kolekcje `_myMessages`, `_myKeyExchanges` itp. EF Core nie może ich bezpośrednio zapełnić ze względu na brak setterów. Repozytorium stosuje odbicie (ang. *reflection*) do ustawienia prywatnych pól po pobraniu rekordów z bazy.

```csharp
// Infrastructure/Services/PublicKeyRepository.cs
// Po zbudowaniu domeny poprzez konstruktor, pola prywatne ustawiane są refleksją:
typeof(PublicKey)
    .GetField("_myMessages", BindingFlags.NonPublic | BindingFlags.Instance)
    ?.SetValue(publicKey, messages);
```

Technika ta utrzymuje niezmienniki domeny (prywatne kolekcje) przy jednoczesnej możliwości hydratacji agregatu z danych relacyjnych.

### 7.3 `LoginService`

Weryfikacja podpisu RSA:

```csharp
using RSA rsa = RSA.Create();
try {
    rsa.ImportSubjectPublicKeyInfo(publicKey.Der, out _);   // X.509 SubjectPublicKeyInfo
} catch (CryptographicException) {
    rsa.ImportRSAPublicKey(publicKey.Der, out _);           // PKCS#1 RSAPublicKey (fallback)
}
bool verified = rsa.VerifyData(challenge, signature, HashAlgorithmName.SHA512, RSASignaturePadding.Pkcs1);
```

Dwustopniowy import obsługuje zarówno klucze w formacie X.509 SubjectPublicKeyInfo, jak i surowy format PKCS#1 RSAPublicKey — zapewnia kompatybilność z różnymi bibliotekami klienta.

### 7.4 `PublicKeySecurityService`

Oblicza fingerprint SHA-512 z bajt-tablicy DER klucza publicznego:

```csharp
byte[] hash = SHA512.HashData(der);
return Convert.ToHexString(hash).ToLowerInvariant();
```

Wynikiem jest 128-znakowy hex string będący identyfikatorem tożsamości użytkownika.

### 7.5 `LoginChallengeService`

Generuje losowy challenge (64 bajty) z użyciem `RandomNumberGenerator.GetBytes(64)` (kryptograficznie bezpieczny PRNG). Challenge jest ważny 5 minut; przeterminowane rekordy są usuwane przy każdym wywołaniu `GetChallenge`.

### 7.6 `CurrentPublicKeyAccessor`

Kontekst bieżącego żądania oparty na `AsyncLocal<string?>`. Umożliwia dostęp do fingerprintu uwierzytelnionego użytkownika w dowolnym miejscu przetwarzania bez jawnego przekazywania parametru.

### 7.7 `DependencyInjection`

Statyczna metoda rozszerzenia `AddInfrastructure(connectionString)` rejestruje w kontenerze DI:

- `MessagerDbContext` (Scoped),
- `IPublicKeyRepository` → `PublicKeyRepository` (Scoped),
- `ILoginService` → `LoginService` (Scoped),
- `ILoginChallengeService` → `LoginChallengeService` (Scoped),
- `ICurrentPublicKey` → `CurrentPublicKeyAccessor` (Scoped),
- `IPublicKeySecurityService` → `PublicKeySecurityService` (Singleton).

---

## 11. Warstwa API — interfejs HTTP i WebSocket

### 8.1 Konfiguracja aplikacji (`Program.cs`)

Punkt wejścia konfiguruje:

1. **Kestrel** — nasłuchuje wewnętrznie na `0.0.0.0:5000`; dostęp zewnętrzny odbywa się przez nginx,
2. **JWT Bearer Authentication** — HS256, walidacja issuer/audience/signature/life, tolerancja zegara 30s,
3. **Rate Limiting** — sliding window:
   - `auth`: 10 żądań/minutę (6 segmentów),
   - `search`: 30 żądań/minutę,
4. **WebSockets** — keep-alive co 30s,
5. **Rejestracja handlerów Application** — Scoped DI,
6. **`EnsureCreated`** — automatyczne tworzenie schematu bazy przy starcie.

### 8.2 Kontrakt DTOs

#### `AuthContracts.cs`

```
RegisterRequest  { UserName, UserTag, PublicKeyDerBase64 }
RegisterResponse { FingerprintSha512 }
ChallengeRequest { FingerprintSha512 }
ChallengeResponse { ChallengeBase64 }
LoginRequest     { FingerprintSha512, SignatureBase64 }
LoginResponse    { AccessToken }
ErrorResponse    { Error }
```

#### `MessageContracts.cs`

```
SendMessageRequest  { ToPublicKey, EncryptedContentBase64, MessageHash }
MessageResponse     { FromPublicKey, ToPublicKey, EncryptedContentBase64,
                      MessageHash, CreatedAt }
```

#### `KeyExchangeContracts.cs`

```
SendKeyExchangeRequest { ToPublicKey, EncryptedPrivateKeyBase64 }
KeyExchangeResponse    { FromPublicKey, ToPublicKey,
                         EncryptedPrivateKeyBase64, CreatedAt }
```

#### `SyncContracts.cs`

```
SyncDeltaResponse { Messages: MessageResponse[], KeyExchanges: KeyExchangeResponse[] }
```

### 8.3 Specyfikacja endpointów

#### Uwierzytelnianie (`/api/auth`)

| Metoda | Ścieżka | Rate Limit | Autoryzacja | Opis |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | `auth` | Anonimowy | Rejestracja klucza publicznego |
| `POST` | `/api/auth/challenge` | `auth` | Anonimowy | Pobranie challenge |
| `POST` | `/api/auth/login` | `auth` | Anonimowy | Logowanie (challenge-response → JWT) |

#### Wiadomości (`/api/messages`)

| Metoda | Ścieżka | Autoryzacja | Parametry | Opis |
|---|---|---|---|---|
| `POST` | `/api/messages/` | Bearer JWT | Body: `SendMessageRequest` | Wysłanie zaszyfrowanej wiadomości |
| `GET` | `/api/messages/` | Bearer JWT | Query: `peerFingerprint`, `since?` | Pobranie wiadomości z/do wskazanego peer |

#### Wymiany kluczy (`/api/key-exchanges`)

| Metoda | Ścieżka | Autoryzacja | Parametry | Opis |
|---|---|---|---|---|
| `POST` | `/api/key-exchanges/` | Bearer JWT | Body: `SendKeyExchangeRequest` | Wysłanie/aktualizacja wymiany klucza |
| `GET` | `/api/key-exchanges/` | Bearer JWT | Query: `peerFingerprint`, `since?` | Pobranie wymian kluczy z peer |

#### Profil publiczny (`/api/public-keys`)

| Metoda | Ścieżka | Rate Limit | Autoryzacja | Parametry | Opis |
|---|---|---|---|---|---|
| `GET` | `/api/public-keys/search` | `search` | Bearer JWT | Query: `userName`, `userTag?` | Wyszukiwanie profili |

#### Synchronizacja i WebSocket (`/api/sync`, `/ws`)

| Protokół | Ścieżka | Autoryzacja | Opis |
|---|---|---|---|
| HTTP GET | `/api/sync/delta` | Bearer JWT | Synchronizacja przyrostowa (query: `since?`) |
| WebSocket | `/ws/sync` | `access_token` query param | Pełna synchronizacja skrzynki odbiorczej |
| WebSocket | `/ws/conversations/{peerFingerprint}` | `access_token` query param | Strumieniowanie jednej konwersacji |

### 8.4 `JwtTokenIssuer`

Wystawia tokeny JWT z następującymi parametrami:

| Parametr | Wartość |
|---|---|
| Algorytm | HS256 (HMAC-SHA256) |
| Issuer | `messager` |
| Audience | `messager` |
| Ważność | 12 godzin |
| Claim | `sub` (NameIdentifier) = fingerprint SHA-512 |

### 8.5 `SyncNotificationHub`

W-pamięciowy broker pub/sub dla powiadomień WebSocket, oparty na `System.Threading.Channels`. Każdy uwierzytelniony klient WebSocket subskrybuje kanał pod swoim fingerprintem. Przy odebraniu wiadomości/wymiany klucza backend publikuje powiadomienie, które jest natychmiast przekazywane do połączonych klientów.

---

## 12. Klient mobilny

### 9.1 Zarządzanie profilami (`App.tsx`, `profileStore.ts`)

Aplikacja obsługuje wiele lokalnych profili na jednym urządzeniu. Każdy profil posiada:

- `id` — UUID lokalny,
- `displayName`,
- `hasRegistration` — czy profil jest zarejestrowany na serwerze,
- `registrationJson` — blok JSON zawierający: `apiBaseUrl`, `userName`, `userTag`, `fingerprintSha512`, `publicKeyDerBase64`, `privateKey` (envelope AES-GCM).

Persystencja: SQLite (tabele `profiles`, `app_state`).

### 9.2 Przepływ rejestracji (`RegistrationPage.tsx`, `registrationCrypto.ts`)

```
Użytkownik podaje: userName, userTag, PIN, apiBaseUrl
                │
                ▼
RSA.generateKeys(KEY_BITS)           ← react-native-rsa-native
                │
                ▼
DER ← forge.asn1.toDer(publicKeyAsn1)
fingerprintSha512 ← SHA-512(DER)
                │
                ▼
privateKeyEnvelope ← PBKDF2(pin, salt, 150000) → AES-GCM encrypt(privateKeyPem)
                │
                ▼
POST /api/auth/register { UserName, UserTag, PublicKeyDerBase64 }
                │
                ▼
StoredRegistration zapisany w SQLite profiles
```

`KEY_BITS` = 1024 w trybie `__DEV__`, 2048 w produkcji (dla wydajności na emulatorach).

### 9.3 Przepływ logowania (`LocalLoginPage.tsx`, `authApi.ts`)

```
PIN podany przez użytkownika
         │
         ▼
AES-GCM decrypt(privateKeyEnvelope, PBKDF2(pin)) → privateKeyPem
         │
         ▼
GET /api/auth/challenge { FingerprintSha512 }
         │
         ▼
challengeBytes ← Base64decode(challengeBase64)
signature ← forge.pki.sign(challenge, privateKey, SHA-512)
         │
         ▼
POST /api/auth/login { FingerprintSha512, SignatureBase64 } → { AccessToken }
         │
         ▼
JWT przechowywany w PrivateKeySessionContext (w pamięci, auto-lock 5 min)
```

### 9.4 Kryptografia wiadomości (`chatCrypto.ts`)

#### Inicjacja rozmowy (Key Exchange)

```
Nadawca generuje: chainSeedBase64 ← randomBytes(32) → Base64
encryptedSeed ← RSA-OAEP(SHA-256, chainSeedBase64, recipientPublicKeyDer)
POST /api/key-exchanges/ { ToPublicKey, EncryptedPrivateKeyBase64: encryptedSeed }
```

Weryfikacja integralności: przed szyfrowaniem seed-u obliczany jest fingerprint SHA-512 klucza DER odbiorcy i porównywany z pobranym z serwera — zabezpieczenie przed podmianą klucza.

#### Wysyłanie wiadomości

```
currentChainKey ← conversation_state (SQLite) lub decryptIncomingChainSeed(...)
IV ← randomBytes(12)
ciphertext ← AES-GCM(key=currentChainKey, iv=IV, plaintext)
payload ← Base64(IV || tag || ciphertext)
messageHash ← SHA-512(encryptedPayloadBytes) → hex

POST /api/messages/ { ToPublicKey, EncryptedContentBase64: payload, MessageHash: hash }

nextChainKey ← SHA-256(currentChainKey)
UPDATE conversation_state SET outgoing_chain_key = nextChainKey
```

#### Odbiór i deszyfrowanie

```
GET /api/sync/delta lub WebSocket
         │
         ▼
encryptedContentBase64 ← z odpowiedzi API
decryptedText ← AES-GCM decrypt(
                  key = incomingChainKey,
                  iv = payload[0:12],
                  tag = payload[12:28],
                  ct = payload[28:]
                )
nextIncomingKey ← SHA-256(incomingChainKey)
UPDATE conversation_state SET incoming_chain_key = nextIncomingKey
```

### 9.5 Lokalny skład danych (`chatStore.ts`)

Baza SQLite `messager_profiles.db` przechowuje:

| Tabela | Opis |
|---|---|
| `known_profiles` | Znane fingerprint + DER + userName/Tag dla każdego peer |
| `conversation_state` | Aktualne klucze łańcuchowe outgoing/incoming per para rozmówców |
| `messages_local` | Cache wiadomości z opcjonalnym polem `plaintext` po deszyfracji |
| `key_exchanges_local` | Cache rekordów wymiany kluczy |
| `sync_state` | Znacznik `last_synced_at_utc` per para profilów |

### 9.6 Sesja klucza prywatnego (`PrivateKeySessionContext.tsx`)

Klucz prywatny odblokowany PINem przechowywany jest wyłącznie w pamięci w React Context. Mechanizm bezpieczeństwa:

- Auto-lock po **5 minutach bezczynności**,
- Reset licznika przy każdej operacji kryptograficznej (ang. *touch*),
- Po wygaśnięciu sesji aplikacja wraca do ekranu logowania lokalnego.

---

## 13. Model kryptograficzny — analiza szczegółowa

### 10.1 Schemat tożsamości kryptograficznej

```
Klucz RSA (2048 bit)
      │
      ├── Klucz publiczny (DER, X.509 SubjectPublicKeyInfo)
      │       │
      │       └── SHA-512(DER) → FingerprintSha512 (128 hex) = identyfikator użytkownika
      │
      └── Klucz prywatny (PEM)
              │
              └── PBKDF2-SHA256(pin, salt, 150000, 32B) → K_wrap
                      │
                      └── AES-GCM(key=K_wrap, iv=12B) → PrivateKeyEnvelope
                              {saltBase64, ivBase64, tagBase64, ciphertextBase64}
```

### 10.2 Protokół logowania challenge-response

```
Klient                          Serwer
  │                               │
  │── POST /challenge ──────────▶ │
  │     {FingerprintSha512}        │  Generuje: challenge = randomBytes(64)
  │◀── {ChallengeBase64} ─────── │  Zapisuje: expires_at = now + 5min
  │                               │
  │  signature = RSA-sign(        │
  │    data = challengeBytes,     │
  │    key = privateKey,          │
  │    hash = SHA-512,            │
  │    padding = PKCS#1-v1.5)     │
  │                               │
  │── POST /login ──────────────▶ │
  │   {FingerprintSha512,         │  Sprawdza: challenge ważny, nie zużyty
  │    SignatureBase64}            │  RSA.VerifyData(challenge, signature,
  │                               │    SHA512, PKCS1)
  │◀── {AccessToken: JWT} ─────── │  Oznacza challenge jako consumed
  │                               │
```

Bezpieczeństwo:
- Challenge jednorazowy (consumed_at),
- Challenge z krótką ważnością (5 minut),
- Brak transmisji hasła ani klucza prywatnego przez sieć.

### 10.3 Protokół wymiany kluczy

```
Alicja (inicjator)              Serwer               Bob (odbiorca)
     │                             │                      │
     │── GET /public-keys/search ▶ │                      │
     │◀── {Der: bobPublicKey} ──── │                      │
     │                             │                      │
     │  Weryfikacja integralności:                        │
     │  SHA-512(bobPublicKey.Der) == bobFingerprint       │
     │                             │                      │
     │  seed = randomBytes(32)     │                      │
     │  encSeed = RSA-OAEP(SHA-256, seed, bobPublicKey)   │
     │                             │                      │
     │── POST /key-exchanges ────▶ │                      │
     │   {ToPublicKey: bobFP,      │                      │
     │    EncryptedPrivateKey:     │                      │
     │    encSeed}                 │                      │
     │                             │                      │
     │                             │◀── GET /key-exchanges ─│
     │                             │─── {encSeed} ─────────▶│
     │                             │                      │
     │                             │  seed = RSA-OAEP decrypt(encSeed, bobPrivateKey)
     │                             │  Przechowanie seed w conversation_state
```

### 10.4 Szyfrowanie wiadomości — schemat chain keys

```
Seed (32B)
    │
    ├── K_0 = SHA-256(Seed)     ← klucz do wiadomości #1
    │
    ├── K_1 = SHA-256(K_0)      ← klucz do wiadomości #2
    │
    └── K_n = SHA-256(K_{n-1})  ← klucz do wiadomości #n+1

Dla każdej wiadomości:
    plaintext
        │
        ▼
    IV = randomBytes(12)
    ciphertext, tag = AES-GCM(key=K_n, iv=IV, plaintext)
    payload = Base64(IV || tag || ciphertext)
    hash = SHA-512(rawPayloadBytes)
```

**Forward secrecy:** nawet gdy napastnik pozna K_n, nie może odtworzyć K_{n-1} (SHA-256 jest funkcją jednokierunkową), a tym samym nie może odszyfrować wcześniejszych wiadomości.

### 10.5 Podsumowanie prymitywów kryptograficznych

| Cel | Algorytm | Parametry |
|---|---|---|
| Generowanie tożsamości | RSA | 2048-bit (1024 w dev) |
| Identyfikacja użytkownika | SHA-512 | Wejście: DER klucza publicznego |
| Ochrona klucza prywatnego (KDF) | PBKDF2-SHA256 | 150 000 iteracji, 16B salt, 32B klucz |
| Ochrona klucza prywatnego (enc.) | AES-256-GCM | 12B IV, 16B tag |
| Uwierzytelnianie (podpis) | RSA + SHA-512 + PKCS#1 v1.5 | — |
| Wymiana materiału kluczowego | RSA-OAEP + SHA-256 | — |
| Szyfrowanie wiadomości | AES-256-GCM | 12B IV, 16B tag, losowy per wiad. |
| Derywacja kluczy łańcuchowych | SHA-256 | K_{n+1} = H(K_n) |
| Hasz wiadomości | SHA-512 | Wejście: zaszyfrowany payload |

---

## 14. Schemat bazy danych

### 11.1 Backend (PostgreSQL)

Schema tworzona automatycznie przez EF Core `EnsureCreated`.

#### Tabela `public_keys`

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

#### Tabela `messages`

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

#### Tabela `key_exchanges`

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

CREATE INDEX idx_kex_from    ON key_exchanges(from_public_key);
CREATE INDEX idx_kex_to      ON key_exchanges(to_public_key);
CREATE INDEX idx_kex_created ON key_exchanges(created_at);
```

#### Tabela `login_challenges`

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

CREATE INDEX idx_challenges_fp      ON login_challenges(fingerprint_sha512);
CREATE INDEX idx_challenges_expires ON login_challenges(expires_at);
```

### 11.2 Diagram relacji (ERD)

```
public_keys (PK: fingerprint_sha512)
    ║
    ╠══════════════════════╗
    ║                      ║
    ▼                      ▼
messages                key_exchanges
(PK: from+to+hash)      (PK: from+to)
from_public_key ──▶ FK  from_public_key ──▶ FK
to_public_key   ──▶ FK  to_public_key   ──▶ FK
    ║
    ▼
login_challenges
(PK: id)
fingerprint_sha512 ──▶ FK
```

### 11.3 Klient mobilny (SQLite)

Baza `messager_profiles.db`.

#### Tabela `profiles`

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | TEXT PK | UUID lokalny profilu |
| `display_name` | TEXT | Nazwa wyświetlana |
| `has_registration` | INTEGER (bool) | Czy profil jest zarejestrowany |
| `registration_json` | TEXT | JSON-blob: `StoredRegistration` (z `PrivateKeyEnvelope`) |
| `created_at` / `updated_at` | TEXT | ISO 8601 |

#### Tabela `app_state`

| Kolumna | Typ | Opis |
|---|---|---|
| `key` | TEXT PK | Klucz stanu (`active_profile_id`) |
| `value` | TEXT | Wartość |

#### Tabela `known_profiles`

| Kolumna | Typ | Opis |
|---|---|---|
| `owner_fingerprint` | TEXT | Fingerprint właściciela |
| `peer_fingerprint` | TEXT PK | Fingerprint peer |
| `peer_der_base64` | TEXT | Klucz publiczny RSA w Base64 DER |
| `peer_user_name` | TEXT | Nazwa użytkownika peer |
| `peer_user_tag` | INTEGER | Tag peer |

#### Tabela `conversation_state`

| Kolumna | Typ | Opis |
|---|---|---|
| `owner_fingerprint` | TEXT | — |
| `peer_fingerprint` | TEXT | — |
| `outgoing_chain_key` | TEXT | Aktualny klucz wychodzący (Base64) |
| `incoming_chain_key` | TEXT | Aktualny klucz przychodzący (Base64) |
| `outgoing_message_count` | INTEGER | Licznik wysłanych wiadomości |
| `incoming_message_count` | INTEGER | Licznik odebranych wiadomości |

#### Tabela `messages_local`

| Kolumna | Typ | Opis |
|---|---|---|
| `message_hash` | TEXT PK | SHA-512 zaszyfrowanego payloadu |
| `owner_fingerprint` | TEXT | Właściciel konwersacji |
| `from_fingerprint` | TEXT | Nadawca |
| `to_fingerprint` | TEXT | Odbiorca |
| `encrypted_content_base64` | TEXT | Zaszyfrowana treść |
| `plaintext` | TEXT (NULL) | Treść po deszyfracji (opcjonalna) |
| `created_at` | TEXT | ISO 8601 |

#### Tabela `key_exchanges_local`

Cache wymian kluczy (analogiczna struktura do serwera).

#### Tabela `sync_state`

| Kolumna | Typ | Opis |
|---|---|---|
| `owner_fingerprint` | TEXT PK | Fingerprint właściciela |
| `peer_fingerprint` | TEXT PK | Fingerprint peer |
| `last_synced_at_utc` | TEXT | Znacznik ostatniej synchronizacji |

---

## 15. Synchronizacja i komunikacja czasu rzeczywistego

### 12.1 Synchronizacja przyrostowa HTTP

`GET /api/sync/delta?since=<ISO8601>` zwraca `SyncDeltaResponse` zawierający wszystkie wiadomości i wymiany kluczy do/od bieżącego użytkownika nowsze niż `since`. Klient mobilny:

1. Odczytuje `last_synced_at_utc` z `sync_state`,
2. Pobiera delta,
3. Aktualizuje lokalne tabele,
4. Zapisuje nowy `last_synced_at_utc`.

### 12.2 WebSocket — powiadomienia push

Klient łączy się przez WebSocket na `/ws/sync?access_token=<JWT>` (token w query param ze względu na ograniczenia WebSocket API w zakresie nagłówków).

```
Klient WebSocket ◀──── SyncNotificationHub ◀──── SendMessageHandler
                                                ◀──── SendKeyExchangeHandler
```

`SyncNotificationHub` utrzymuje mapę fingerprint → `Channel<string>`. Handler po zapisaniu danych publikuje powiadomienie; WebSocket consumes i przesyła do klienta. Klient w reakcji wykonuje pełny lub przyrostowy sync HTTP.

### 12.3 WebSocket konwersacji

`/ws/conversations/{peerFingerprint}` strumieniuje wiadomości konkretnej konwersacji bez konieczności pełnego syncu skrzynki. Stosowany w ekranie `ConversationPage`.

---

## 16. Konfiguracja środowiska i wdrożenie

### 13.1 Plik `.env` — centralna konfiguracja Docker Compose

Wszystkie zmienne środowiskowe dla stosu Docker są przechowywane w pliku `.env` w katalogu głównym repozytorium. Docker Compose odczytuje go automatycznie przy każdym wywołaniu `docker compose`.

Plik `.env` jest wykluczony z repozytorium przez `.gitignore`. Wzorzec do skopiowania stanowi plik `.env.example`:

```dotenv
# PostgreSQL
POSTGRES_DB=messager
POSTGRES_USER=messager
POSTGRES_PASSWORD=change-me

# JWT — generate with: openssl rand -base64 64
JWT_SIGNING_KEY=replace-with-strong-random-base64-value

# Message TTL — days before undelivered messages are deleted (default: 30)
MESSAGE_TTL_DAYS=30

# Application — single port configuration
APP_PORT=443
APP_DOMAIN=localhost
NGINX_USE_SSL=true

# Android builder — URL the APK will call at runtime
MESSAGER_API_BASE_URL=https://127.0.0.1:443
SSL_CA_CERT_FILE=ca.pem
```

Pierwsze uruchomienie:

```bash
cp .env.example .env
# Edytuj .env — zmień POSTGRES_PASSWORD i JWT_SIGNING_KEY
```

### 13.2 Zmienne środowiskowe — opis

| Zmienna | Wymagana | Opis |
|---|---|---|
| `POSTGRES_DB` | Tak | Nazwa bazy danych PostgreSQL |
| `POSTGRES_USER` | Tak | Użytkownik PostgreSQL |
| `POSTGRES_PASSWORD` | Tak | Hasło użytkownika PostgreSQL |
| `JWT_SIGNING_KEY` | Tak | Sekret HMAC-SHA256 (min. 32 bajty, zalecane: Base64 64B) |
| `MESSAGE_TTL_DAYS` | Nie | Czas przechowywania wiadomości na serwerze w dniach (domyślnie `30`) |
| `APP_PORT` | Nie | Port nasłuchiwania nginx (domyślnie `443` dla SSL, `80` bez SSL) |
| `APP_DOMAIN` | Nie | Domena/IP aplikacji (domyślnie `localhost`) |
| `NGINX_USE_SSL` | Nie | Włączenie TLS przez nginx (domyślnie `true`) |
| `SSL_CA_CERT_FILE` | Nie | Certyfikat CA wbudowywany w APK przez `android-builder` |
| `MESSAGER_API_BASE_URL` | Nie | URL API wbudowywany w APK przez `android-builder` |

### 13.2 Dockerfile backendu

`API/Dockerfile` stosuje czterostopniowy obraz wieloetapowy:

```dockerfile
# Etap 1 — obraz bazowy (runtime, używany w Fast-mode debugowania)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app

# Etap 2 — kompilacja projektu
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["API/API.csproj", "API/"]
RUN dotnet restore "./API/API.csproj"
COPY . .
WORKDIR "/src/API"
RUN dotnet build "./API.csproj" -c $BUILD_CONFIGURATION -o /app/build

# Etap 3 — publikacja (self-contained DLL bez hosta natywnego)
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# Etap 4 — obraz produkcyjny (tylko runtime + opublikowane pliki)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "API.dll"]
```

Podział na etapy `build → publish → final` minimalizuje rozmiar finalnego obrazu — kompilator SDK nie jest włączany do warstwy produkcyjnej.

### 13.3 docker-compose — pełny stos

Plik `docker-compose.yml` definiuje cztery usługi. Wszystkie wrażliwe wartości są pobierane z pliku `.env` przez interpolację `${ZMIENNA}`:

```
db  ──▶  api  ──▶  nginx  ──▶  (android-builder)
(postgres:17-alpine)   (zależny od db:healthy)   (profil: release)
```

#### Usługa `db`

```yaml
image: postgres:17-alpine
environment:
  POSTGRES_DB: ${POSTGRES_DB}
  POSTGRES_USER: ${POSTGRES_USER}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
healthcheck:
  test: pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}
  interval: 5s / timeout: 5s / retries: 10
```

Persystencja danych: wolumin Docker `db-data`.

#### Usługa `api`

```yaml
environment:
  POSTGRES_CONNECTION_STRING: "Host=db;Port=5432;Database=${POSTGRES_DB};
                               Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}"
  JWT_SIGNING_KEY: ${JWT_SIGNING_KEY}
  MESSAGE_TTL_DAYS: ${MESSAGE_TTL_DAYS}
depends_on:
  db: { condition: service_healthy }
```

API nasłuchuje na porcie 5000 wewnętrznie — ruch publiczny przechodzi przez nginx.

#### Usługa `nginx`

```yaml
ports: "${APP_PORT}:${APP_PORT}"
environment:
  APP_PORT: ${APP_PORT}
  APP_DOMAIN: ${APP_DOMAIN}
  NGINX_USE_SSL: ${NGINX_USE_SSL}
volumes:
  - ./ssl:/etc/ssl/messager:ro
```

Nginx generuje konfigurację z szablonu (`nginx/nginx.conf.template`) na starcie. Gdy `NGINX_USE_SSL=true`: TLS 1.2+1.3, certyfikaty z katalogu `ssl/`. Gdy `NGINX_USE_SSL=false`: HTTP na porcie `APP_PORT`.

#### Usługa `android-builder`

```yaml
profiles: [release]
environment:
  MESSAGER_API_BASE_URL: ${MESSAGER_API_BASE_URL}
  SSL_CA_CERT_FILE: ${SSL_CA_CERT_FILE}
volumes:
  - ./App:/app               # kod źródłowy z hosta
  - /app/node_modules        # izolacja od Windows
  - android-gradle:/root/.gradle  # cache Gradle
  - ./releases/android:/releases  # wyjście APK
```

Usługa jest aktywowana wyłącznie przy `--profile release`. Po zakończeniu budowania plik APK pojawia się w katalogu `./releases/android/`.

#### Uruchomienie stosem Docker

```bash
# Serwer + baza danych (tryb deweloperski)
docker compose up -d

# Pełne wdrożenie z budowaniem APK
docker compose --profile release up --build
```

### 13.4 Dockerfile.android — budowanie APK

`App/Dockerfile.android` to obraz CI/CD do kompilowania APK bez środowiska Windows:

| Warstwa | Wartość |
|---|---|
| Obraz bazowy | `eclipse-temurin:17-jdk-jammy` (JDK 17 wymagany przez Android) |
| Node.js | 22.x (zgodnie z `engines` w `package.json`) |
| Android SDK | `cmdline-tools-11076708`, `platforms;android-35`, `build-tools;35.0.0` |
| `ANDROID_HOME` | `/opt/android-sdk` |

Budowanie odbywa się poprzez komendę w `docker-compose.yml` (sekwencja: `npm ci` → zapis `.env` → `./gradlew assembleRelease` → kopiowanie APK do `/releases`).

### 13.5 Uruchomienie lokalne (bez Dockera)

**Backend:**

```bash
dotnet build ./Messager.slnx -c Debug

POSTGRES_CONNECTION_STRING="Host=localhost;Port=5432;Database=messager;Username=messager;Password=messager" \
JWT_SIGNING_KEY="<wartość z .env>" \
dotnet run --project ./API/API.csproj
```

**Klient mobilny (Android):**

```bash
cd App
npm install
# Skopiuj .env.example → .env i ustaw MESSAGER_API_BASE_URL:
cp .env.example .env

# Dla emulatora (domyślny gateway hosta):
# MESSAGER_API_BASE_URL=http://10.0.2.2:5000

# Dla urządzenia fizycznego przez USB:
adb reverse tcp:5000 tcp:5000
# MESSAGER_API_BASE_URL=http://127.0.0.1:5000

npm run android
```

### 13.6 Konfiguracja sieci mobilnej

| Środowisko | `API_BASE_URL` |
|---|---|
| Android Emulator | `http://10.0.2.2:5000` (gateway hosta z emulatora) |
| Urządzenie fizyczne (USB) | `http://localhost:5000` (po `adb reverse`) |
| Urządzenie fizyczne (WiFi) | `http://<LAN-IP>:5000` |
| Produkcja | `https://<domena>` |

---

## 17. Analiza bezpieczeństwa

### 14.1 Zagrożenia i mechanizmy ochrony

| Zagrożenie | Mechanizm ochrony |
|---|---|
| Przechwycenie wiadomości w tranzycie | Szyfrowanie E2EE — serwer przechowuje wyłącznie zaszyfrowane dane |
| Brute-force logowania | Rate limiting (10 req/min), challeng jednorazowy, JWT 12h |
| Podrobienie tożsamości | Fingerprint = SHA-512(DER) — nieodwracalne powiązanie klucza z identyfikatorem |
| Podmiana klucza publicznego (MITM) | Weryfikacja SHA-512(DER) == fingerprint przed szyfrowaniem seeda |
| Kompromitacja klucza prywatnego na urządzeniu | AES-GCM + PBKDF2 (150k iteracji) — wysoki koszt ataku słownikowego |
| Replay attack challenge | Pole `consumed_at` + krótka ważność 5 min |
| Wyciek dawnych wiadomości po kompromitacji klucza bieżącego | Forward secrecy: SHA-256(K_n) → K_{n+1} (jednokierunkowa derywacja) |
| Unauthorized sync (WebSocket) | JWT w `access_token` query param; walidacja identyczna z Bearer |
| DoS na endpoint wyszukiwania | Osobny rate limiter `search` (30 req/min) |

### 14.2 Zidentyfikowane słabości i ograniczenia

1. **Brak Perfect Forward Secrecy na poziomie transportu:** system nie wymusza HTTPS (konfiguracja środowiskowa). W środowisku deweloperskim ruch jest plain HTTP.

2. **Brak rotacji klucza RSA:** tożsamość jest przywiązana do jednej pary kluczy. Skompromitowanie klucza prywatnego wymaga ręcznej re-rejestracji.

3. **Brak weryfikacji wielu urządzeń (multi-device):** model one-key-per-identity nie obsługuje nativnie wielu urządzeń tego samego użytkownika.

4. **Sekret JWT bez rotacji:** `JWT_SIGNING_KEY` jest statyczny; rotacja wymaga restartu serwera i unieważnienia wszystkich aktywnych sesji.

5. **`EnsureCreated` zamiast migracji:** automatyczne tworzenie schematu jest wygodne dewelopersko, ale nie obsługuje zmian schematu na środowiskach produkcyjnych.

6. **1024-bitowy RSA w trybie DEV:** obniżona siła klucza w `__DEV__` jest akceptowalna dla emulacji, ale wymaga jawnego ostrzeżenia w dokumentacji wdrożeniowej.

7. **Brak potwierdzenia dostarczenia:** model nie przewiduje mechanizmu `ack` — odbiorca nie potwierdza odebrania/odczytu wiadomości.

### 14.3 Pozytywne aspekty bezpieczeństwa

- Serwer **nie posiada** kluczy prywatnych, kluczy łańcuchowych ani plaintextów wiadomości — zerowa wiedza o treści komunikacji,
- Kryptograficznie silny PRNG (`crypto.getRandomValues`, `RandomNumberGenerator.GetBytes`),
- Weryfikacja integralności klucza publicznego przed szyfrowaniem (anti-MITM),
- Wrażliwe zmienne środowiskowe (hasło DB, klucz JWT) przechowywane w `.env` wykluczonym z repozytorium,
- Polityki `DeleteBehavior.Restrict` chronią przed przypadkowym kaskadowym usunięciem danych kryptograficznych.

---

## 18. Ograniczenia i kierunki rozwoju

### 15.1 Bieżące ograniczenia techniczne

1. **EF Core 10 preview:** zależność od niestabilnej wersji EF Core + Npgsql; przed wdrożeniem produkcyjnym wskazane stabilne wersje.
2. **Reflection do hydratacji agregatów:** technika działająca, lecz krucha przy refaktoringu nazw pól prywatnych; alternatywą są fabryki agregatów lub wzorzec Event Sourcing.
3. **Brak testów automatycznych:** projekt nie zawiera zestawu testów jednostkowych ani integracyjnych w bieżącej iteracji.
4. **Synchronizacja sekwencyjna kluczy łańcuchowych:** brak obsługi wiadomości odebranych poza kolejnością (out-of-order delivery) — klucz łańcuchowy musi być konsumowany w ścisłej sekwencji.

### 15.2 Proponowane kierunki rozwoju

| Priorytet | Obszar | Propozycja |
|---|---|---|
| Wysoki | Persystencja | Przejście na migracje EF Core (`context.Database.Migrate()`) |
| Wysoki | Testy | Testy integracyjne API z testowym PostgreSQL (Testcontainers) |
| Wysoki | Bezpieczeństwo | Wymuszenie HTTPS w konfiguracji Kestrel |
| Średni | Kryptografia | Double Ratchet (pełna implementacja z Diffie-Hellman ratchet) |
| Średni | UX | Potwierdzenia dostarczenia i statusy odczytu |
| Średni | Bezpieczeństwo | Rotacja `JWT_SIGNING_KEY` bez restartu (JWKS endpoint) |
| Niski | Architektura | Zastąpienie refleksji wzorcem fabryki agregatów |
| Niski | Monitoring | Telemetria security (nieudane logowania, anomalie) |

---

## 19. FAQ — często zadawane pytania

### P: Czy mogę użyć tego systemu w produkcji?

A: Architektura jest gotowa do produkcji, ale wciąż jest to projekt demo/osobisty. Przed wdrożeniem:
1. Przeprowadzić audyt bezpieczeństwa przez niezależny zespół
2. Włączyć automatyczne testy (testy integracyjne, testy bezpieczeństwa)
3. Wdrożyć migracje EF Core zamiast `EnsureCreated()`
4. Skonfigurować monitoring i logging

### P: Jaki jest limit rozmiaru wiadomości?

A: Limitowany przez `MaxRequestBodySize` w Nginx (domyślnie ~1MB). Można zwiększyć w konfiguracji Nginx.

### P: Jak długo wiadomości są przechowywane na serwerze?

A: `MESSAGE_TTL_DAYS` zmienna środowiskowa (domyślnie 30 dni). `MessageCleanupService` uruchamia się codziennie o północy UTC.

### P: Czy baza danych jest szyfrowana?

A: Wiadomości są szyfrowane client-side i przechowywane jako ciphertext. Baza przechowuje wyłącznie `IV || Tag || Ciphertext`. Dla pełnej ochrony włącz encryption-at-rest na poziomie PostgreSQL lub dysku.

### P: Mogę uruchomić to bez Dockera?

A: Tak, ale będziesz musiał ręcznie zainstalować PostgreSQL, .NET 10, Node.js i Android SDK.

### P: Czy jest obsługa wielu urządzeń dla tego samego użytkownika?

A: Obecny model nie obsługuje tego natywnie. Każda tożsamość (`fingerprint`) jest przywiązana do jednej pary kluczy. Multi-device wymagałoby wdrożenia dodatkowych protokołów (np. X3DH z prekeys per device).

### P: Jaki jest czas wygaśnięcia JWT?

A: 12 godzin od wystawienia. Po wygaśnięciu klient musi ponownie zalogować się challenge-response.

### P: Czy serwer może czytać wiadomości?

A: **Nie.** Wiadomości są szyfrowane na kliencie przy użyciu AES-256-GCM kluczem łańcuchowym. Serwer przechowuje wyłącznie ciphertext i nigdy nie widzi plaintextu.

---

## 20. Troubleshooting — rozwiązywanie problemów

### Problem: API nie startuje

```bash
# Sprawdzenie zmiennych środowiskowych
echo $JWT_SIGNING_KEY
echo $POSTGRES_CONNECTION_STRING

# Jeśli puste — ustawić zmienne
export JWT_SIGNING_KEY="your-base64-key"
export POSTGRES_CONNECTION_STRING="Host=localhost;..."

# Uruchomienie z debug logging
dotnet run --verbosity Debug
```

### Problem: Aplikacja mobilna nie łączy się z API

**Przyczyny:**
1. `MESSAGER_API_BASE_URL` jest nieprawidłowy
2. Certyfikat SSL nie jest zaufany (development)
3. Firewall/NAT blokuje połączenie
4. JWT wygasł (12h TTL)

**Rozwiązania:**

```bash
# Android Emulator — gateway hosta
# .env: MESSAGER_API_BASE_URL=http://10.0.2.2:5000

# Urządzenie fizyczne — port forwarding
adb reverse tcp:5000 tcp:5000
# .env: MESSAGER_API_BASE_URL=http://localhost:5000

# Wi-Fi — use machine IP
# .env: MESSAGER_API_BASE_URL=http://192.168.x.x:5000
```

### Problem: WebSocket connection fails

```bash
# Sprawdzenie Nginx WebSocket timeout
docker logs messager-nginx | grep "proxy_read_timeout"

# Weryfikacja JWT w query param
# WebSocket URL: ws://localhost:5000/ws/sync?access_token=JWT_TOKEN

# Sprawdzenie CORS headers
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Authorization: Bearer YOUR_JWT" \
  http://localhost:5000/ws/sync
```

### Problem: Database connection error

```bash
# Test połączenia do PostgreSQL
psql -h localhost -U postgres -d messager -c "SELECT 1"

# Sprawdzenie zmiennej POSTGRES_CONNECTION_STRING
echo $POSTGRES_CONNECTION_STRING | grep -E "Host=|Port=|Database="

# Logs PostgreSQL
docker logs messager-db | tail -20
```

### Problem: Sender cannot send message (validation error)

**Przyczyna**: Brak wymiany kluczy z odbiorcą.

```csharp
// Domain/PublicKey.cs — rzuca InvalidOperationException
public Message SendMessage(string toPublicKey, byte[] encryptedContent, string messageHash)
{
    bool hasKeyExchangeForRecipient = _myKeyExchanges
        .Any(x => x.ToPublicKey == toPublicKey);
    
    if (!hasKeyExchangeForRecipient)
        throw new InvalidOperationException(
            "Cannot send message without a key exchange from owner to recipient.");
}
```

**Rozwiązanie**: Nadawca musi najpierw wykonać wymianę kluczy (Key Exchange).

### Problem: Migration fails

```bash
# Dodanie toolingu EF Core (jeśli brakuje)
dotnet tool install --global dotnet-ef

# Walidacja stanu migracji
dotnet ef database info

# Ręczne tworzenie bazy
dotnet ef database drop --force
dotnet ef database update
```

### Problem: APK build fails (Docker android-builder)

```bash
# Sprawdzenie logów buildera
docker logs messager-android-builder

# Czysta kompilacja
docker compose --profile release build --no-cache android-builder
docker compose --profile release up android-builder

# Sprawdzenie czy APK został wygenerowany
ls -la releases/android/
```

### Problem: Rate limit 429 Too Many Requests

```bash
# Auth endpoints: 10 req/min per IP
# Search endpoints: 30 req/min per IP

# Sprawdzenie czy klient respektuje backoff
# HTTP 429 Response-Header: Retry-After: 60

# Dla testów — zmień limiter w Program.cs:
options.AddPolicy("auth", p => p.WindowLimit(100).Window(TimeSpan.FromMinutes(1)));
```

---

## 21. Wnioski

Projekt Messager stanowi spójną, pełnostackową implementację komunikatora bezpiecznego z szyfrowaniem end-to-end, realizującą następujące cele inżynierskie:

### 21.1 Architektura i separacja odpowiedzialności

Wzorzec Clean Architecture skutecznie oddziela reguły biznesowe (Domain layer) od szczegółów implementacyjnych (Infrastructure). Przepływ zależności jest jednostronny i kontrolowany:

```
API → Application → Domain
Infrastructure → Application → Domain
```

Podział na warstwy ułatwia testowanie, wymianę komponentów i pielęgnację kodu.

### 21.2 Bezpieczeństwo kryptograficzne

Projekt implementuje wielowarstwową strategię bezpieczeństwa:

1. **Identyfikacja**: RSA 2048-bit z fingerprint SHA-512 jako globalny identyfikator
2. **Uwierzytelnianie**: Challenge-response bez transmisji sekretu, RSA-SHA512 signature
3. **E2EE**: Signal Protocol z forward secrecy, AES-256-GCM szyfrowanie wiadomości
4. **Lokalna ochrona**: PBKDF2-SHA256 (150k iteracji) + AES-256-GCM dla klucza prywatnego
5. **Zero-Knowledge**: Serwer nigdy nie posiada kluczy deszyfrujących, przechowuje wyłącznie ciphertext

### 21.3 Praktyczne doświadczenie użytkownika

- **Wieloprofilowe zarządzanie** — wiele tożsamości na jednym urządzeniu z izolacją danych
- **Offline-first** — SQLite local cache, automatyczna synchronizacja po reconnect
- **Real-time sync** — WebSocket do natychmiastowych powiadomień
- **Biometric auth** — PIN + fingerprint/face unlock
- **Auto-lock** — 5-minutowy timeout sesji dla ochrony klucza prywatnego

### 21.4 Skalowalność i modularność

Architektura modułowa ułatwia:
- Zastąpienie in-memory pub/sub Redis Pub/Sub
- Migrację na inny RDBMS (MySQL, SQL Server)
- Zmianę biblioteki kryptograficznej
- Dodanie nowych protokołów transportu (AMQP, gRPC)

### 21.5 Status produkcyjny

W obecnej formie projekt jest:
- ✅ **Funkcjonalnie kompletny** — wszystkie rdzenne przepływy działają
- ✅ **Architektonicznie solidny** — Clean Architecture, CQRS-style handlers
- ✅ **Kryptograficznie wzmocniony** — Signal Protocol + RSA/AES
- ⚠️ **Wymagający audytu** — przed wdrożeniem produkcyjnym

Identyfikowane ograniczenia dotyczą głównie warstwy operacyjnej (brak migracji EF, brak testów automatycznych) i są typowe dla projektów w fazie DEV. Warstwa domenowa i kryptograficzna prezentują wysoką jakość umożliwiającą wdrożenie produkcyjne.

### 21.6 Rekomendacje do wdrożenia

| Priorytet | Działanie | Uzasadnienie |
|---|---|---|
| **Krytyczny** | Audyt bezpieczeństwa | Ocena przed wdrożeniem publicznym |
| **Krytyczny** | EF Core migrations | `EnsureCreated` nie obsługuje zmian schematów |
| **Wysoki** | Testy integracyjne | Walidacja API + crypto flows |
| **Wysoki** | HTTPS enforcement | Disable HTTP w Kestrel |
| **Wysoki** | Monitoring & logging | Detekt anomalii bezpieczeństwa |
| **Średni** | Double Ratchet | Pełny Signal Protocol (DH ratchet) |
| **Średni** | Multi-device support | X3DH z prekeys per device |
| **Niski** | JWKS rotation | Bezpieczna rotacja JWT_SIGNING_KEY |

---

## 22. Słownik pojęć

| Termin | Definicja |
|---|---|
| **AES-GCM** | Advanced Encryption Standard w trybie Galois/Counter Mode — szyfrowanie symetryczne z uwierzytelnianiem wiadomości (AEAD) |
| **Agregat** | Wzorzec DDD (Domain-Driven Design) — klaster encji traktowany jako jednostka spójności |
| **Chain Key** | Klucz symetryczny derywowany rekurencyjnie: K_{n+1} = H(K_n); zapewnia forward secrecy |
| **Challenge-Response** | Protokół uwierzytelniania bez transmisji hasła: serwer wysyła losowy challenge, klient podpisuje go kluczem prywatnym |
| **Clean Architecture** | Wzorzec architektoniczny wyodrębniający warstwę dziedziny od warstw infrastrukturalnych |
| **DER** | Distinguished Encoding Rules — binarny format kodowania kluczy kryptograficznych ASN.1 |
| **E2EE** | End-to-End Encryption — szyfrowanie od nadawcy do odbiorcy, uniemożliwiające odczyt przez serwer |
| **EF Core** | Entity Framework Core — ORM firmy Microsoft dla .NET |
| **Fingerprint** | Skrót kryptograficzny (SHA-512) klucza publicznego, służący jako globalny identyfikator użytkownika |
| **Forward Secrecy** | Własność protokołu kryptograficznego gwarantująca, że kompromitacja bieżących kluczy nie ujawnia historycznych wiadomości |
| **IV (Initialization Vector)** | Losowy wektor inicjalizacji zapobiegający identycznym szyfrowanym wyjściom dla identycznych wejść |
| **JWT** | JSON Web Token — podpisany token uwierzytelniający |
| **Key Exchange** | Wymiana zaszyfrowanego materiału kluczowego (seeda) między rozmówcami |
| **Minimal API** | Styl API ASP.NET Core bez kontrolerów, z mapowaniem ścieżek bezpośrednio w `Program.cs` |
| **PBKDF2** | Password-Based Key Derivation Function 2 — derywacja klucza kryptograficznego z hasła przez wielokrotne iteracje |
| **PEM** | Privacy Enhanced Mail — tekstowy format kodowania kluczy kryptograficznych (Base64 z nagłówkami) |
| **RSA** | Asymetryczny algorytm kryptograficzny (Rivest–Shamir–Adleman) |
| **RSA-OAEP** | RSA z schematem wypełniania OAEP (Optimal Asymmetric Encryption Padding) — bezpieczniejsza wariant szyfrowania RSA |
| **SHA-512** | Secure Hash Algorithm — kryptograficzna funkcja skrótu produkująca 512-bitowy (128 hex) wynik |
| **Signal Protocol** | Protokół E2EE z forward secrecy i break-in recovery, używany w Signal Messenger, WhatsApp i innych |
| **SQLite** | Wbudowana, bezserwisowa baza danych — używana jako lokalny skład danych na kliencie mobilnym |
| **WebSocket** | Protokół komunikacji dwukierunkowej w czasie rzeczywistym przez jedno połączenie TCP |
| **X3DH** | Extended Triple Diffie-Hellman — protokół inicjalizacji sesji w Signal Protocol |
| **Double Ratchet** | Algorytm w Signal Protocol łączący ratchet key derivation (kluczowe pochodne) i ratchet klucza publicznego (DH) |

---

*Dokument wygenerowany na podstawie analizy kodu źródłowego repozytorium `c:\Users\Blazej\sources\Messager`. Data: 2026-06-09.*
*Zaktualizowany w oparciu o README.md z nową strukturą i specyfikacją.*
