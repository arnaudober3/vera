# Vera, your personal stylist

Vera is a smart, local-first wardrobe assistant that helps you decide what to wear, every day.
Snap your closet, let Vera classify and organize your clothes, and get fresh outfit ideas — built only from what you actually own and have cleaned, tuned to today's weather and the occasion.

Everything lives on your device: your wardrobe, photos, and outfit history are stored locally and never leave the browser (only photo analysis is sent to third-party AI services). Vera is an installable PWA that works offline for everything you already own.

## Features

- **Closet Import** — add a garment from a single photo. Vera removes the background, classifies the item with an AI vision model, and extracts its dominant color automatically.
- **AI Fashion Classification** — a Qwen3-VL-8B vision model (via HuggingFace) sorts each photo into one of 21 subcategories — t-shirt, shirt, sweater, hoodie, jacket, coat, jeans, sneakers, boots, and more (`src/services/fashion-classifier.ts`).
- **Background Removal** — clean cut-outs of each garment via remove.bg (`src/services/remove-bg.ts`).
- **Daily Outfit Deck** — a swipeable deck of outfit suggestions built only from your clean clothes. Combinations are ranked by color harmony (CIEDE2000 perceptual color distance via `culori`) and filtered/weighted by season, occasion, and weather (`src/hooks/outfit.ts`, `src/components/today-deck.tsx`).
- **Item Pinning** — lock a piece you want to wear; the deck regenerates outfits around it.
- **Weather-Aware Suggestions** — pulls your local forecast from Open-Meteo (with geolocation), nudges toward outerwear when it's cold or wet, and supports a manual temperature override (`src/services/weather.ts`, `src/hooks/weather.ts`).
- **Occasions** — filter the deck by casual, smart, formal, or sport; off-occasion pieces are excluded entirely (`src/models/occasion.ts`).
- **Seasonality** — items are scored by season, with automatic Northern/Southern hemisphere detection (`src/models/season.ts`).
- **Laundry Tracking** — mark pieces as dirty; they drop out of suggestions until you clean them, so Vera only ever proposes what's wearable.
- **Lookbook** — save favorite outfits and track wear count and last-worn date; filter by ready, recent, or worn (`src/hooks/lookbook.ts`).
- **Smart Rotation** — a recency penalty (14-day window) steers the deck away from outfits you've worn recently to avoid fatigue (`src/hooks/outfit-history.ts`).
- **Google Calendar** — connect your calendar during onboarding (real OAuth 2.0) and Vera biases the daily deck toward the day's most relevant occasion — a meeting, the gym, dinner out. Events are mapped to occasions by keyword heuristics (`src/models/calendar.ts`); the OAuth token exchange runs server-side in Cloudflare Pages Functions (`functions/api/google/`) so the client secret never reaches the browser.
- **Internationalization** — English and French, auto-detected from the browser language (`src/i18n/`).
- **Installable PWA** — add Vera to your home screen; works offline for your existing wardrobe.

## Tech Stack

- **React 19** + **TypeScript 5.8** — frontend SPA, routed with **React Router 7**
- **Vite 7** — build tooling and dev server
- **Tailwind CSS 4** — styling (via `@tailwindcss/postcss`)
- **culori** — perceptual color science for outfit matching
- **i18next** + **react-i18next** — internationalization (EN / FR)
- **react-icons** — iconography
- **Local-first storage** — `localStorage` for structured data + **IndexedDB** (`vera-images`) for garment photos; no backend except the thin Google OAuth proxy
- **Cloudflare Pages Functions** — serverless `functions/api/google/*` handlers for the Google Calendar OAuth token exchange / refresh (keeps the client secret off the client)
- **State management** — lightweight custom hooks using a singleton + listener/subscribe pattern (TanStack React Query is a dependency but is barely used)
- **PWA** — installable via `vite-plugin-pwa` (auto-updating service worker)
- **Cloudflare Pages** — static hosting & deployment via **Wrangler 4**
- **ESLint 9** (flat config) + **typescript-eslint**, **Prettier**

## Architecture

The app is organized under `src/`:

| Folder | Responsibility |
| --- | --- |
| `pages/` | Route-level screens — Today, Closet, Lookbook, Welcome (onboarding) |
| `components/` | Reusable UI — nav bar, outfit deck, basket strip, toasts |
| `modals/` | Dialog flows (e.g. adding an item) |
| `hooks/` | App state & business logic — closet, outfit generation, lookbook, weather, history, images |
| `services/` | External integrations & algorithms — classification, background removal, image processing, weather, season |
| `models/` | TypeScript types & rules — clothing items, occasions, seasons |
| `storage/` | Persistence — `localStorage` keys, IndexedDB image store, per-session id |
| `utils/` | Helpers — color tints, date formatting |
| `i18n/` | i18next setup + `en` / `fr` locale files |

**Local-first data model.** All data is namespaced per browser session id and persisted locally. The core types are `ClothingItem`, `Outfit` (an ephemeral daily suggestion), `LookbookOutfit` (a saved favorite), `OutfitHistoryEntry`, and `Weather`. Garment photos are stored as data URLs in IndexedDB; everything else is JSON in `localStorage`.

**Outfit generation.** Candidate outfits are built from clean, in-occasion items, then ranked by a combined score: color harmony (CIEDE2000) × season fit, with a recency penalty for recently-worn combinations and weather-driven nudges toward outerwear.

## External APIs

| Service | Purpose | Endpoint | Key |
| --- | --- | --- | --- |
| HuggingFace | Fashion classification (Qwen3-VL-8B) | `router.huggingface.co` — proxied via `/api/huggingface` in dev | `VITE_HF_API_KEY` |
| remove.bg | Background removal | `api.remove.bg/v1.0/removebg` | `VITE_REMOVE_BG_API_KEY` |
| Open-Meteo | Weather (temperature, precipitation) | `api.open-meteo.com/v1/forecast` | none (public) |
| Google Calendar | Daily events → occasions | `oauth2.googleapis.com` + `googleapis.com/calendar/v3` via `functions/api/google/*` | `VITE_GOOGLE_CLIENT_ID` (client) + `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (server) |

### Google Calendar setup

The calendar connection uses the OAuth 2.0 authorization-code flow with PKCE. The
browser opens the Google consent screen in a popup; the popup lands on
`/google/callback` and posts the auth code back; a Cloudflare Pages Function
(`functions/api/google/token.ts`) exchanges it for tokens — using the
server-only client secret — and returns a window of upcoming events. The refresh
token is stored client-side so the app can silently re-fetch each day
(`functions/api/google/events.ts`).

In the **Google Cloud Console**:

1. Enable the **Google Calendar API**.
2. Configure the OAuth consent screen (scope
   `https://www.googleapis.com/auth/calendar.events.readonly`); while the app is
   unverified, add testers under **Audience**.
3. Create an **OAuth 2.0 Client ID** (type: *Web application*) with authorized
   redirect URIs `http://localhost:8788/google/callback` (local) and
   `https://<your-domain>/google/callback` (production).
4. Put the **client ID** in `VITE_GOOGLE_CLIENT_ID` (+ `GOOGLE_CLIENT_ID`) and
   the **client secret** in `GOOGLE_CLIENT_SECRET` (server-only — see below).

## Getting Started

### Prerequisites

- **Node.js 22**
- **[Doppler](https://www.doppler.com/)** — used to inject environment variables for local dev (`npm run dev` wraps Vite in `doppler run`)
- _Optional:_ **Docker** — for a containerized dev environment

### Environment Variables

**Client-side** vars use Vite's `VITE_*` convention (shipped to the browser) and
are injected via Doppler locally / Cloudflare Pages env vars in production. See
`.env.example`:

- `VITE_HF_API_KEY` — HuggingFace (fashion classification)
- `VITE_REMOVE_BG_API_KEY` — remove.bg (background removal)
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID (public)
- `VITE_ENABLE_DEBUG` _(optional)_ — set to `"true"` to clear sample data and enable debug behavior

**Server-side** vars are consumed by the Cloudflare Pages Functions and must
**never** be `VITE_`-prefixed. Locally they go in `.dev.vars` (gitignored — copy
from `.dev.vars.example`); in production set them as Pages secrets in the
Cloudflare dashboard:

- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret

### Install & Run

```bash
npm install
npm run dev      # Doppler-injected Vite dev server (http://127.0.0.1:5173)
```

To exercise the Google Calendar flow locally you also need the backend Functions
running, since the OAuth token exchange lives there. Build once, then run
`wrangler pages dev` alongside Vite (the Vite dev server proxies `/api/google/*`
to it):

```bash
npm run build        # functions need a built ./dist to serve from
npm run pages:dev    # Cloudflare Pages Functions on http://localhost:8788
npm run dev          # Vite, proxying /api/google → :8788
```

### Run with Docker

The provided Dockerfile (Node 22 + Doppler CLI) and `docker-compose.yml` start the dev server on port 5173. Provide your Doppler token via the `DOPPLER_TOKEN` environment variable:

```bash
DOPPLER_TOKEN=<your-token> docker compose up
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | `doppler run -- vite` — dev server with injected secrets |
| `npm run build` | `tsc -b && vite build` — type-check + production build to `dist/` |
| `npm run lint` | ESLint over the project |
| `npm run pages:dev` | `wrangler pages dev` — run the Pages Functions locally on :8788 (serves built `dist/`) |
| `npm run preview` | Build, then serve `dist/` + Functions locally with `wrangler pages dev` |
| `npm run deploy` | Build, then `wrangler pages deploy` to Cloudflare Pages |

## Deployment

Vera deploys to **Cloudflare Pages** via Wrangler. Run `npm run deploy` to build and publish (`wrangler pages deploy`, configured by `wrangler.toml`). The `functions/` directory is deployed automatically as Pages Functions. Client env vars (`VITE_HF_API_KEY`, `VITE_REMOVE_BG_API_KEY`, `VITE_GOOGLE_CLIENT_ID`) and the server secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) are configured in the Cloudflare dashboard. The build ships an SPA fallback (`/* → /index.html`) and PWA-aware caching headers (immutable hashed assets, no-cache for the service worker and manifest).

## License

Distributed under the MIT License.
