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

## Roadmap
- [x] Make available the MVP for private testing
- [x] Outfit history — track what was worn recently to avoid repetition
- [x] Favorite outfits — save and revisit liked combinations
- [x] Improve today page design — better layout, visual consistency with other pages, unified outfit card, FAB regenerate
- [x] Improve favourites page — add "ready to wear" filter, "wear it" quick action, unified card design
- [x] Outfit drag-and-drop — drag the whole outfit to the basket instead of individual items
- [x] Strikethrough dirty items — replace clean/dirty badges with a visual strikethrough on items in the laundry, also on the favourites page
- [x] Replace drag-and-drop on today page — replace with a simpler interaction (e.g. a confirm button) to improve discoverability
- [x] Move basket to closet page — the laundry basket fits better on the closet page; rethink the today page layout so it doesn't feel empty without it
- [x] More categories — shoes, accessories, jackets/coats
- [x] Add more accessory categories — watches, earrings, etc.
- [x] Improve category cleanliness rules — let some categories be excluded from clean/dirty tracking
- [x] Improve closet filter-bar — make horizontal scrolling more obvious so users understand they can browse categories sideways, or maybe use a dropdown instead of a bar
- [ ] Rearchitecture project (ditch Firestore, Firebase - replace with CloudFlares Pages, localStorage/indexedDb)
- [ ] Improved onboarding — guided tour for new users
- [ ] Horizontal scroll views — closet page with one row per category (tops, bottoms) scrolling horizontally; favourites page with a single horizontal row of outfits
- [ ] Pin item to outfit — select an item from the closet to lock it into today's outfit, then regenerate the rest around it; also remove the "clean" badge since this action replaces it as the primary CTA for clean items
- [ ] Multi-season — adapt suggestions to the current season
- [ ] Add notification for suggestion once a day, reminders for laundry to be done after a few days
- [ ] Improve suggestion algorithm with weather, occasions, etc.
- [ ] Social sharing — get friends' opinions on an outfit
- [ ] Release a first version to the public

## License
Distributed under the MIT License.
