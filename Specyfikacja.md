# Tematy Biblijne – Specyfikacja Produktu

**Wersja:** 2.0  
**Data:** Kwiecień 2026  
**Platforma docelowa:** Android (APK) + PWA  

---

## 1. Kontekst i cel

### 1.1 Główny scenariusz użycia

Ewangelista siedzi z rozmówcą. Rozmówca zadaje pytanie: *„Co się dzieje po śmierci?"*. Ewangelista otwiera aplikację, wpisuje słowo lub wybiera temat, w 3 sekundy trafia do wersetu, przekazuje telefon rozmówcy. Rozmówca widzi czysty, duży tekst biblijny z komentarzem.

Z tego scenariusza wynikają wszystkie priorytety: **szybkość dostępu**, **czytelność tekstu**, **tryb dla rozmówcy**, **działanie offline**.

### 1.2 Użytkownicy docelowi

| Typ | Charakterystyka |
|-----|-----------------|
| Ewangelista ADS | Prowadzi rozmowy 1:1, studia biblijne, odwiedziny. Zna doktrynę, potrzebuje szybkiego dostępu do wersetów. |
| Kaznodzieja / pastor | Przygotowanie odpowiedzi na pytania doktrynalne. Używa Pastora AI jako pomocy. |
| Rozmówca (gość) | Osoba ciekawa Słowa Bożego. Widzi tylko tryb prezentacji – nigdy UI aplikacji, nie może nawigować. |

---

## 2. Platforma i technologia

| Aspekt | Decyzja |
|--------|---------|
| Platforma główna | Android 8.0+ (API 26+) – APK, dystrybucja przez Play Store lub bezpośrednie pobieranie |
| Platforma wtórna | iOS – PWA instalowalna z Safari |
| Technologia | PWA (HTML + CSS + Vanilla JS) opakowana w APK przez **Capacitor.js** |
| Framework JS | Brak – czysty Vanilla JS. Zero zewnętrznych frameworków UI. |
| Backend | Brak – cała logika po stronie klienta |
| Offline | Service Worker (Workbox) – obowiązkowy dla PWA i APK |
| Rozmiar docelowy | < 5 MB (fonty systemowe, zero bundlowania) |
| WebView minimalne | Chrome 84+ / WebView 84+ (wymagane przez Screen Wake Lock API) |

---

## 3. Architektura

### 3.1 Struktura plików

```
index.html        – struktura SPA, jeden plik HTML
styles.css        – design system, CSS variables
app.js            – logika: nawigacja, wyszukiwanie, stan, localStorage
data.js           – baza danych (28 zasad, 49 pytań, 101 wersetów)
sw.js             – Service Worker (Workbox)
manifest.json     – PWA manifest
/icons/           – ikony aplikacji (PNG, różne rozmiary)
```

### 3.2 Struktura danych (`data.js`)

Oparta na pliku `zasady_wiary.json`. Każde pytanie ma stabilne `id` złożone z numeru zasady i indeksu pytania.

```js
const DATA = [
  {
    id: 1,                          // stały, oparty na numeracji ADS
    title: "Pismo Święte",
    kategoria: "Bóg",               // źródło prawdy dla filtrów
    keywords: ["Biblia", "natchnienie", "Słowo Boże", "prawda"],
    pytania: [
      {
        id: "1-1",                  // stabilny: "{zasada_id}-{pytanie_nr}"
        q: "Skąd wiadomo, że Biblia jest prawdziwym Słowem Bożym?",
        wersety: [
          {
            r: "2 Tm 3,16-17",      // referencja
            s: "Całe Pismo natchnione przez Boga",  // skrót (1 zdanie)
            t: "Całe Pismo jest natchnione przez Boga i pożyteczne...",  // plain text, gotowy do wyświetlenia
            n: "Paweł potwierdza boski autorytet Pisma..."               // plain text, bez Markdown/HTML
          }
        ]
      }
    ]
  }
];
```

**Zasady dotyczące danych:**
- `id` zasady (1–28) jest stały i niezmienny między wersjami
- `id` pytania (`"zasada_id-pytanie_nr"`) jest stabilny – chroni localStorage przed rozjechaniem
- Werset należy zawsze do konkretnego pytania (brak „wspólnych" wersetów na poziomie zasady)
- Duplikaty wersetów między pytaniami są dopuszczalne jako kopie (bez globalnego katalogu)
- Pola `t` i `n` to plain text – aplikacja nie formatuje, nie interpretuje Markdown
- Kategoria wynika z pola `kategoria` w danych (nie z zakresu `id`)

### 3.3 LocalStorage

| Klucz | Typ | Zawartość |
|-------|-----|-----------|
| `tb_postep` | Object | `{ "1-1": true, "1-2": true, ... }` – klucz to `pytanie.id` |
| `tb_ulubione` | Array | `[{ zasada_id, pytanie_id, werset_idx, data: "ISO string" }]` |
| `tb_api_key` | String | Klucz API Anthropic zakodowany base64 |
| `tb_ustawienia` | Object | `{ pokaz_komentarz_rozmowcy: true, przekład: "warszawska" }` |

**Uwagi:**
- `tb_postep` indeksowany przez `pytanie.id` (nie `idx`) – odporny na zmiany kolejności
- `data` w ulubionych jako ISO 8601 string (`2026-04-13T10:00:00Z`)
- Klucz API w base64 to wystarczające zabezpieczenie dla MVP (użytkownicy to świadomi współpracownicy kościelni)
- Przycisk „Wyczyść klucz API" w Ustawieniach – obowiązkowy
- Brak persystencji historii czatu AI po zamknięciu aplikacji

### 3.4 Nawigacja

System stosu ekranów (`screenStack`) bez przeładowania strony, animacja slide-in/slide-out.

**Zasady nawigacji:**
- Tap na dolną nawigację → czyści stos do root danej sekcji (nie wraca jak back)
- Systemowy przycisk Back (Android) → `goBack()` na stosie ekranów
- W trybie rozmówcy: Back → najpierw zamknięcie trybu rozmówcy, następne Back → poprzedni ekran
- MVP: aplikacja zawsze startuje na ekranie głównym (bez odtwarzania ostatniego miejsca)

---

## 4. Design System

### 4.1 Inspiracja

**Booking.com** – jako wzorzec UX/UI:
- Dolna nawigacja z ikonami (mobile)
- Białe karty na jasnym tle
- Ogólna czystość i minimalizm układu

Kolorystyka własna: granat ADS jako kolor dominujący (odpowiednik niebieskiego Booking), złoto jako CTA.

### 4.2 Kolorystyka

| Token CSS | Wartość | Użycie |
|-----------|---------|--------|
| `--navy` | `#1B4F8A` | Kolor główny, nagłówki, aktywne elementy |
| `--navy-dark` | `#0D3060` | Top bar, hover |
| `--navy-light` | `#E8F0FB` | Tła chipów, aktywne wiersze, bąbelki czatu użytkownika |
| `--gold` | `#B8860B` | CTA (przycisk „Pokaż rozmówcy") |
| `--gold-light` | `#FFF8DC` | Tło notatek, wyróżnienia |
| `--bg` | `#F2F5F9` | Tło aplikacji |
| `--card` | `#FFFFFF` | Tło kart |
| `--text` | `#1A1A2E` | Tekst główny |
| `--muted` | `#6B7280` | Tekst drugorzędny |
| `--border` | `#E5E7EB` | Obramowania |

### 4.3 Typografia

Wyłącznie fonty systemowe – zero bundlowania, limit 5 MB zachowany.

| Rola | Font | Rozmiar | Styl |
|------|------|---------|------|
| Nagłówki UI | `-apple-system, system-ui, sans-serif` | 17–20px | weight 700 |
| Tekst interfejsu | `-apple-system, system-ui, sans-serif` | 14–15px | weight 400/500 |
| Tekst biblijny (normalny) | `Georgia, serif` | 17px | italic, line-height 1.8 |
| Tekst biblijny (tryb rozmówcy) | `Georgia, serif` | 22px | italic, line-height 1.9 |
| Referencja biblijna | `-apple-system, system-ui, sans-serif` | 13px | weight 700, kolor `--navy` |

### 4.4 Komponenty CSS

**Karta tematu:**
```css
background: white;
border-radius: 12px;
border: 0.5px solid #E5E7EB;
border-left: 3px solid <kolor kategorii>;
padding: 14px;
box-shadow: 0 1px 4px rgba(0,0,0,0.06);
```

**Chip kategorii:**
```css
border-radius: 20px;
padding: 6px 14px;
font-size: 13px;
font-weight: 500;
```

**Kolory kategorii:**

| Kategoria | Zasady | Tło chipa | Tekst chipa | Lewa krawędź karty |
|-----------|--------|-----------|-------------|-------------------|
| Bóg | 1–6 | `#EBF5FF` | `#1B4F8A` | `#1B4F8A` |
| Człowiek | 7–8 | `#FFF3E0` | `#E65100` | `#E65100` |
| Zbawienie | 9–11 | `#E8F5E9` | `#2E7D32` | `#2E7D32` |
| Kościół | 12–18 | `#F3E5F5` | `#7B1FA2` | `#7B1FA2` |
| Życie chrześcijańskie | 19–25 | `#E0F7FA` | `#00838F` | `#00838F` |
| Rzeczy ostateczne | 26–28 | `#FCE4EC` | `#C62828` | `#C62828` |

**Przycisk główny:**
```css
background: #1B4F8A;
color: white;
border-radius: 8px;
height: 48px;
font-size: 15px;
font-weight: 600;
border: none;
```

**Przycisk „Pokaż rozmówcy":**
```css
background: #B8860B;
color: white;
border-radius: 8px;
height: 52px;
width: 100%;
font-size: 16px;
font-weight: 700;
border: none;
```

---

## 5. Ekrany

### 5.1 Przegląd

| Ekran | Priorytet | Opis |
|-------|-----------|------|
| Ekran główny | MVP | Wyszukiwarka + kategorie + karty tematów |
| Lista pytań tematu | MVP | Pytania życiowe wybranej zasady |
| Widok wersetu | MVP | Lista wersetów (góra) + szczegóły (dół) |
| Tryb rozmówcy | MVP | Pełnoekranowy tekst dla drugiej osoby |
| Pastor AI | MVP | Czat z kontekstem tematu |
| Ulubione | v1.1 | Zapisane wersety |
| Ustawienia | v1.1 | Klucz API, czcionka, przekład |

---

### 5.2 Ekran główny

**Top bar (granat):**
- Tytuł: „Tematy Biblijne"
- Podtytuł: „Czego szuka twój rozmówca?"
- Pole wyszukiwania (białe, zaokrąglone, ikona lupy)

**Pasek kategorii** – poziomy scroll, chipy:  
`Wszystkie` | `Bóg` | `Człowiek` | `Zbawienie` | `Kościół` | `Życie chrześcijańskie` | `Rzeczy ostateczne`

Tap na chip filtruje karty poniżej. Aktywny chip wyróżniony kolorem kategorii.

**Siatka kart tematów** – 2 kolumny:
```
[ emoji kategorii ]
Zasada 1
Pismo Święte
3 pytania  •  ████░ postęp
```
Tap na kartę → ekran pytań tematu.

**Dolna nawigacja (stała, zawsze widoczna poza trybem rozmówcy):**
```
[szukaj]  [tematy]  [ulubione]  [AI]
  Dom      Lista      Serce     Gwiazdka
```

---

### 5.3 Lista pytań tematu

**Nagłówek:**
- Strzałka wstecz + nazwa zasady
- Chip kategorii

**Lista pytań** – karty:
```
[ ? ]  Skąd wiadomo, że Biblia jest prawdziwym...
       3 wersety  >
```

Przejrzane pytanie (w `tb_postep`) oznaczone checkmarkiem lub przyciszonym kolorem.

**Dół ekranu:**
- Przycisk „Zapytaj Pastora AI o tę zasadę" → czat z preładowanym kontekstem zasady

---

### 5.4 Widok wersetu (prowadzący)

**Układ split-view:**

```
┌─────────────────────────────┐
│  LISTA WERSETÓW (40%)        │
│  ▶ 2 Tm 3,16-17             │  ← aktywny: lewa kreska --navy
│    Całe Pismo natchnione...  │
│  ○ 2 P 1,20-21              │
│    Prorocy pisali pod...     │
│  ○ J 17,17                  │
│    Słowo Boże jest prawdą    │
├─────────────────────────────┤
│  SZCZEGÓŁY WERSETU (60%)    │
│                              │
│  2 Tm 3,16-17               │  ← referencja: 13px, --navy, bold
│                              │
│  „Całe Pismo jest natchnione │  ← tekst: 17px, Georgia italic
│  przez Boga i pożyteczne..." │    line-height 1.8
│                              │
│  Komentarz:                  │  ← label: 11px uppercase --muted
│  Paweł potwierdza boski...   │  ← 14px, system-ui, --muted
│                              │
│  [←]        [×]        [→]  │  ← prev / zamknij / next
├─────────────────────────────┤
│  [ POKAŻ ROZMÓWCY  ▶ ]      │  ← złoty przycisk, pełna szerokość
└─────────────────────────────┘
```

**Zachowanie:**
- Tap na wiersz listy → zmienia aktywny werset, aktualizuje szczegóły
- `[←]` / `[→]` – poprzedni / następny werset; zablokowane na skrajach
- `[×]` – zamknięcie panelu szczegółów (lista pozostaje)
- Lista auto-scrolluje do aktywnego wersetu
- Otwarcie pytania zapisuje `pytanie.id` w `tb_postep`
- Przycisk „Pokaż rozmówcy" → tryb rozmówcy z bieżącym wersetem

---

### 5.5 Tryb rozmówcy

> **Najważniejszy ekran aplikacji.**

**Zasady:**
- Pełnoekranowy – zero elementów nawigacji aplikacji, dolna belka ukryta
- Brak dodatkowej blokady wyjścia (double-tap itp.) – wystarczy mały, niewyróżniający się przycisk „Wróć"
- Animacja fade-in przy otwarciu
- Screen Wake Lock API (webowa implementacja); fallback przez Capacitor plugin dla APK
- Działa w orientacji pionowej i poziomej
- Rozmówca nie ma żadnej kontroli – nie może nawigować do innych wersetów

**Układ:**
```
┌─────────────────────────────┐
│                              │
│  2 Tm 3,16-17               │  ← 16px, --navy, weight 700
│                              │
│  „Całe Pismo jest natchnione │
│  przez Boga i pożyteczne do  │  ← 22px, Georgia italic
│  nauki, do wykrywania        │    line-height 1.9
│  błędów..."                  │
│                              │
│  ──────────────────────────  │
│                              │
│  Paweł potwierdza boski      │  ← 15px, --muted (widoczny gdy
│  autorytet Pisma...          │    pokaz_komentarz_rozmowcy: true)
│                              │
│                              │
│                    [ Wróć ]  │  ← 13px, mały, prawy dół
└─────────────────────────────┘
```

**Ustawienie `pokaz_komentarz_rozmowcy`** dotyczy wyłącznie tego ekranu. W widoku prowadzącego komentarz jest zawsze widoczny.

---

### 5.6 Pastor AI

**Interfejs czatu:**
- Wiadomość powitalna z kontekstem (jeśli otwarty z tematu):  
  *„Mam otwarty temat: Pismo Święte (Zasada 1). O co chcesz zapytać?"*
- Wiadomości użytkownika – prawa strona, tło `--navy-light`
- Wiadomości AI – lewa strona, tło `--card`
- Odpowiedź AI strumieniowana token po tokenie (streaming)
- Auto-scroll do najnowszej wiadomości

**Chipy szybkich pytań** (pod polem tekstowym, wysyłają predefiniowany prompt):
- „Więcej wersetów na ten temat"
- „Co mówi Ellen White?"
- „Jak odpowiedzieć na zarzut..."
- „Wyjaśnij prościej"

> „Co mówi Ellen White?" – AI odpowiada z wiedzy ogólnej, bez lokalnej bazy cytatów (MVP).

**Konfiguracja API:**

| Parametr | Wartość |
|----------|---------|
| Endpoint | `https://api.anthropic.com/v1/messages` |
| Model | `claude-sonnet-4-20250514` (konkretny snapshot, nie alias) |
| `anthropic-version` | `2023-06-01` |
| `anthropic-dangerous-direct-browser-access` | `true` |
| `max_tokens` | `1024` |
| Streaming | `true` |

**Kontekst przekazywany do AI:**
```
Tytuł zasady + lista pytań (samo pole q) + wersety aktywnego pytania (r + s + t).
Pole n (komentarze) wykluczone z kontekstu – ograniczenie rozmiaru.
```

**Prompt systemowy:**
```
Jesteś pastorem Kościoła Adwentystów Dnia Siódmego. Odpowiadasz na pytania 
dotyczące Biblii i doktryny zgodnie z 28 Zasadami Wiary ADS. Twoje odpowiedzi 
są życzliwe, merytoryczne, poparte cytatami biblijnymi. Odpowiadasz po polsku.
```

**Stany błędów UI:**

| Stan | Komunikat użytkownikowi |
|------|------------------------|
| Brak internetu | „Brak połączenia. Pastor AI wymaga internetu." |
| Brak klucza API | „Wprowadź klucz API w Ustawieniach →" (tap otwiera Ustawienia) |
| Rate limit (429) | „Przekroczono limit zapytań. Spróbuj za chwilę." |
| Błąd 401 / 403 | „Nieprawidłowy klucz API. Sprawdź Ustawienia →" |
| Inny błąd / CORS | „Błąd połączenia z asystentem. Spróbuj ponownie." |

---

## 6. Wyszukiwanie

### 6.1 Zakres indeksowania

Wyszukiwanie obejmuje (w kolejności priorytetu):

| Priorytet | Pole | Przykład |
|-----------|------|---------|
| 1 | `keywords[]` zasady | „śmierć", „zbawienie" |
| 2 | `title` zasady | „Pismo Święte" |
| 3 | `q` pytania | „Co się dzieje po śmierci?" |
| 4 | `s` wersetu | „Umarli nic nie wiedzą" |

Pola `t` (tekst biblijny) i `n` (komentarz) są **wyłączone** z wyszukiwania w MVP.

Wynik wyszukiwania prowadzi do **ekranu pytań** danej zasady (nie bezpośrednio do wersetu).

### 6.2 Algorytm (Vanilla JS)

```js
function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // usuń diakrytyki
    .replace(/[^a-z0-9\s]/g, "");
}

function search(query) {
  const q = normalize(query);
  const results = [];

  DATA.forEach(zasada => {
    let score = 0;

    // keywords – najwyższy priorytet
    if (zasada.keywords.some(k => normalize(k).includes(q))) score += 3;

    // tytuł zasady
    if (normalize(zasada.title).includes(q)) score += 2;

    // pytania
    zasada.pytania.forEach(p => {
      if (normalize(p.q).includes(q)) score += 1;
      p.wersety.forEach(w => {
        if (normalize(w.s).includes(q)) score += 1;
      });
    });

    if (score > 0) results.push({ zasada, score });
  });

  return results.sort((a, b) => b.score - a.score);
}
```

**Zasady:**
- Minimum 2 znaki do uruchomienia wyszukiwania
- Wyniki natychmiastowe (live search, bez debounce powyżej 2 znaków)
- Normalizacja polskich znaków obowiązkowa (`ś→s`, `ó→o` itd.)
- Fuzzy search poza MVP – w MVP proste `includes()` po normalizacji
- Brak tolerancji na literówki w MVP

---

## 7. Offline i PWA

### 7.1 Service Worker (Workbox)

Service Worker obowiązkowy dla PWA i APK. W APK zasoby są wbudowane w pakiet Capacitor, ale SW zapewnia spójne zachowanie i ułatwia przyszłe aktualizacje danych.

| Zasób | Strategia Workbox | Uwagi |
|-------|-------------------|-------|
| `index.html` | `NetworkFirst` | Fallback na cache; unika problemu „starego shella" |
| CSS / JS / `data.js` / ikony | `StaleWhileRevalidate` | Szybka odpowiedź z cache + odświeżenie w tle |
| Fonty systemowe | nie cachowane | Fonty systemowe nie wymagają cache |
| Żądania do `api.anthropic.com` | `NetworkOnly` | Wymaga internetu; błąd obsługiwany gracefully |

### 7.2 Aktualizacje

**PWA:** Toast „Dostępna nowa wersja – odśwież" po wykryciu nowego SW. Nie silent.  
**APK:** Nowa wersja przez Play Store lub bezpośrednie pobranie nowego APK. Bez in-app update w MVP.

### 7.3 manifest.json

```json
{
  "name": "Tematy Biblijne",
  "short_name": "Tematy Biblijne",
  "description": "Narzędzie ewangelizacyjne dla adwentystów",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F2F5F9",
  "theme_color": "#1B4F8A",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 7.4 Instalacja poza Play Store

Przy dystrybucji bezpośrednim APK – ekran onboardingu przy pierwszym uruchomieniu z instrukcją włączenia „Nieznanych źródeł" (Android 8+: Ustawienia → Aplikacje → Specjalny dostęp).

---

## 8. Bezpieczeństwo

- Klucz API przechowywany w `localStorage` zakodowany base64 – wystarczające dla MVP (użytkownicy to świadomi współpracownicy kościelni, nie aplikacja publiczna)
- Żądania AI wysyłane bezpośrednio do `api.anthropic.com` z nagłówkiem `anthropic-dangerous-direct-browser-access: true` (podejście BYO key)
- Przycisk „Wyczyść klucz API" w Ustawieniach – obowiązkowy
- Brak zbierania jakichkolwiek danych użytkownika
- Brak analityki, trackerów, reklam
- Historia czatu nie jest persystowana po zamknięciu aplikacji

> **Zalecenie na v2.0:** przy szerokiej dystrybucji wdrożyć Cloudflare Worker jako proxy ukrywający klucz API. Koszt: $0/mies. w darmowym planie Cloudflare (100k req/dzień).

---

## 9. Harmonogram (MVP)

| Faza | Czas | Zakres |
|------|------|--------|
| 0 – Przygotowanie | Tydzień 1 | Weryfikacja teologiczna bazy danych, wybór emoji dla kategorii, decyzja o przekładzie biblijnym |
| 1 – Core | Tygodnie 2–4 | Ekran główny, wyszukiwanie, lista pytań, widok wersetu, tryb rozmówcy, offline |
| 2 – AI | Tydzień 5 | Integracja Pastora AI, klucz w ustawieniach, chipy pytań, obsługa błędów |
| 3 – APK | Tygodnie 6–7 | Capacitor.js, manifest, Wake Lock, testy na urządzeniach Android 8+ |
| 4 – v1.1 | Tydzień 8+ | Ulubione, ustawienia, onboarding APK, rozszerzenie bazy do 80+ pytań |

### Definicja MVP (gotowe do użycia terenowego)

- [ ] Wyszukiwanie po słowach kluczowych i tematach (normalizacja PL)
- [ ] Pełne 28 zasad z pytaniami i wersetami
- [ ] Tryb rozmówcy (pełnoekranowy tekst, Wake Lock, brak nawigacji dla gościa)
- [ ] Działa w pełni offline (bez internetu, poza Pastorem AI)
- [ ] Instalacja na Android (APK lub PWA)
- [ ] Pastor AI z obsługą wszystkich stanów błędów

---

## 10. Otwarte pytania

| Kwestia | Opcje | Rekomendacja |
|---------|-------|--------------|
| Przekład biblijny | Biblia Warszawska (użyta w bazie) vs. Tysiąclecia vs. wybór przez użytkownika | Warszawska w MVP; wybór przez użytkownika w v1.1 |
| Dystrybucja APK | Play Store ($25 jednorazowo) vs. bezpośrednie pobieranie APK | Bezpośrednie APK w MVP; Play Store przy szerszej dystrybucji |
| Klucz API | BYO key (każdy użytkownik swój) vs. jeden klucz kościelny przez proxy | BYO key w MVP; proxy w v2.0 |
| Ellen White | Osobny moduł vs. sekcja w widoku wersetu | Sekcja w widoku wersetu w v1.1 |
| Języki | Tylko polski vs. angielski/ukraiński | Tylko polski w MVP |
| Ikony kategorii | Emoji (szybko) vs. dedykowane SVG | Emoji w MVP; SVG w v1.1 |

---

## Appendix A: Kategorie zasad wiary

| Kategoria | Zasady | Emoji |
|-----------|--------|-------|
| Bóg | 1–6 | ✦ |
| Człowiek | 7–8 | ◈ |
| Zbawienie | 9–11 | ♦ |
| Kościół | 12–18 | ⬡ |
| Życie chrześcijańskie | 19–25 | ◉ |
| Rzeczy ostateczne | 26–28 | ◎ |

> Emoji do zatwierdzenia. Alternatywnie: proste SVG shapes w kolorach kategorii.

---

## Appendix B: Pliki do przekazania deweloperowi

```
zasady_wiary.json          – baza danych (wymaga weryfikacji teologicznej)
specyfikacja.md            – ten dokument
```

**Model AI:** `claude-sonnet-4-20250514`  
**Wersja API:** `anthropic-version: 2023-06-01`  
**Dokumentacja API:** https://docs.anthropic.com  
**Dokumentacja Capacitor:** https://capacitorjs.com/docs  
**Dokumentacja Workbox:** https://developer.chrome.com/docs/workbox  

---

## Appendix C: Weryfikacja teologiczna – priorytety

Przed wdrożeniem MVP wymagana jest weryfikacja następujących zasad w `zasady_wiary.json`:

| Zasada | Temat | Powód priorytetu |
|--------|-------|-----------------|
| 7 | Natura człowieka / stan umarłych | Doktryna ADS odbiega od mainstreamu chrześcijańskiego |
| 18 | Dar proroctwa / Ellen White | Delikatny temat w komunikacji zewnętrznej |
| 20 | Szabat | Centralna i charakterystyczna doktryna ADS |
| 26 | Śmierć i zmartwychwstanie (annihilacjonizm) | Doktryna ADS odbiega od mainstreamu |