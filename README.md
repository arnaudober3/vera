# Vera, your personal stylist

Vera is a smart wardrobe assistant that helps you decide what to wear, every day.
Snap your closet, let Vera organize your clothes, and get fresh outfit ideas — only from what you actually own and have cleaned.

## Features
- **Closet Import** — add your wardrobe with a simple photo
- **Daily Outfit Suggestions** — tailored looks from your own clothes
- **Laundry Tracking** — only wear what's clean, reset when laundry is done
- **Smart Rotation** — avoid outfit fatigue with fresh combos
- **AI Styling** — fashion classification via HuggingFace, background removal via remove.bg

## Tech Stack
- **React 19** + **TypeScript** — frontend SPA with React Router
- **Vite** — build tooling
- **Tailwind CSS 4** — styling
- **Firebase** — authentication, Firestore database, storage
- **TanStack React Query** — data fetching and cache
- **PWA** — installable on mobile via `vite-plugin-pwa`

## Getting Started

### Prerequisites
- Node.js
- [Doppler](https://www.doppler.com/) configured for environment variables

### Environment Variables
The following `VITE_*` variables must be set (managed via Doppler):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_HF_API_KEY` — HuggingFace (fashion classification)
- `VITE_REMOVE_BG_API_KEY` — remove.bg (background removal)

### Install & Run
```bash
npm install
npm run dev      # starts dev server via Doppler
npm run build    # type-check + production build
npm run lint     # ESLint
```

## License
Distributed under the MIT License.
