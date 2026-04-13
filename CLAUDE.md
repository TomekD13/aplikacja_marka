# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Aplikacja Marka** is a Polish-language PWA (Progressive Web App) for Seventh-day Adventist (ADS) evangelists. Core use case: an evangelist is talking with someone, opens the app, searches a theological topic, and pulls up the relevant Bible verse in ~3 seconds. All content is in Polish; Bible translation is Biblia Warszawska.

Full product spec: [Specyfikacja.md](Specyfikacja.md)

## Running Locally

No build step required — this is a zero-dependency Vanilla JS app.

```bash
# Serve via any HTTP server (required for Service Worker / PWA features):
python -m http.server 8000
# Then open: http://localhost:8000/App.html
```

Or open `App.html` directly in a browser (Chrome 84+, Firefox, Safari) for non-PWA testing.

## Architecture

**Single-file prototype:** All HTML, CSS, and JS live in `App.html`. The spec describes splitting this into `index.html`, `styles.css`, `app.js`, `data.js`, `sw.js`, and `manifest.json` — but that refactor has not happened yet.

**Data layer:** `zasady_wiary.json` holds 28 Adventist doctrinal principles (zasady wiary). The planned `data.js` wraps this as a `const DATA = [...]` array with stable IDs for principles (`1–28`), questions (`"1-1"`, `"1-2"`, …), and Bible verses.

```javascript
// Planned data.js schema (from spec):
{
  id: 1,                   // 1–28, stable
  title: "Pismo Święte",
  kategoria: "Bóg",        // One of 6 categories
  keywords: [...],
  pytania: [{
    id: "1-1",
    q: "Question text",
    wersety: [{ r: "2 Tm 3,16-17", s: "Summary", t: "Full verse text", n: "Commentary" }]
  }]
}
```

**State / storage:** `localStorage` only — no backend. Keys: `tb_postep` (progress), `tb_ulubione` (favorites), `tb_api_key` (base64-encoded Anthropic API key), `tb_ustawienia` (settings).

**Screen navigation:** CSS-based screen-stack SPA. No page reloads. Screens: Home → Topics → Question List → Verse View. Special screens: Guest Mode (full-screen for the person being shown the verse), Pastor AI Chat.

**AI integration:** Spec requires Claude API (streaming) for the "Pasteur AI" chat feature. The current prototype in `App.html` uses Gemini — this must be migrated to `@anthropic-ai/sdk` or the Anthropic REST API.

## Design System

- Primary: Navy `#1B4F8A`
- Accent/CTA: Gold `#B8860B`
- Background: `#F2F5F9`
- Typography: system fonts only (size budget <5 MB total)
- Style reference: Booking.com-style cards, bottom nav, minimalism

## What Is and Isn't Implemented

**Done:** Product spec, `zasady_wiary.json` database, basic HTML/CSS/JS prototype with topic selection, split-view study screen, and Gemini-based AI chat.

**Not yet done:** Full 28-principle dataset in `data.js`, search with diacritic normalization, Service Worker (offline), Guest Mode, Favorites, Settings screen with API key management, PWA `manifest.json`, Capacitor.js APK wrapper.

## Key Technical Constraints

- Zero external JS/CSS dependencies at runtime (bundle target <5 MB for APK)
- Must work offline after first load (Service Worker + cache-first for all assets)
- Screen Wake Lock API needed in Guest Mode (keeps screen on while showing verse)
- Android 8.0+ (API 26+) primary target via Capacitor.js; iOS via PWA
- API key stored base64-encoded in localStorage (MVP only; future: Cloudflare Worker proxy)
