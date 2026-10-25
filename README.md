# The Great Lock In (TGLI)

A private, installable fitness-transformation PWA. Dark-luxury "mission control" design, local-first data, optional bring-your-own-key AI coach.

## Run

```bash
npm install
npm run dev        # http://localhost:5174 (use --host to test on a phone on the same Wi-Fi)
npm test           # deterministic analytics tests (vitest)
npm run build      # type-check + production build with service worker
npm run preview    # serve the production build
npm run icons      # regenerate icons + iOS splash screens from public/logo.svg
```

**Deploying:** any static HTTPS host works (Netlify, Vercel, Cloudflare Pages, GitHub Pages at a root domain). Service workers and iPhone installation require HTTPS. Configure the host to serve `index.html` for unknown paths (SPA fallback).

**Installing on iPhone:** open the deployed URL in Safari → Share → *Add to Home Screen* → Add. The in-app guide is at Profile → Install on iPhone.

## Stack

| Concern | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript, Vite 8 | Mature, fast, strongly typed |
| Motion | `motion` (Framer Motion) | Springs, layout animations, gestures, reduced-motion support |
| 3D | three.js + @react-three/fiber | Procedural muscle figure with a custom holographic shader — no external model download; lazy-loaded |
| Data | IndexedDB via Dexie (+ `dexie-react-hooks`) | Reliable local persistence, live queries, Blob-free photo storage |
| State | zustand | Tiny stores for navigation and UI |
| Charts | Custom SVG | Gaps for missing data, matching the design language |
| PWA | vite-plugin-pwa (Workbox) | Precache + offline, update prompt, manifest |
| Fonts | Unbounded, Manrope, JetBrains Mono (self-hosted) | Distinctive display face, readable body, data mono — offline-safe |

## Architecture

```
src/
  data/        types, Dexie schema, repository (all writes), settings, hooks, demo seed
    training/  muscles, exercise library, WorkoutSource interface (future NW Log seam)
  domain/      pure, deterministic logic: dates, timeline, analytics, weekly review, goals, milestones
  design/      design-system primitives, sheet, charts, overlays, ruler picker
  components/  app shell: tab bar, page scaffold, ambient background, emblem, particles
  nav/         stack-per-tab navigator with history sync and transitions
  features/    onboarding, home, checkin, calendar, progress (+muscle 3D, studio), motivation,
               archive (+ replay & video export), profile/settings, coach
  ai/          optional coach: provider metadata, lazy adapters (Anthropic SDK, OpenAI, Gemini),
               key storage, data context, prompts, reply parsing, safe markdown
  services/    images (on-device resize, EXIF date), reminders, platform/install, backup
```

* **AI independence:** nothing outside `features/coach` and `ai/` imports AI code. Adapters load only after a provider is configured. Weekly reviews, analytics, milestones and the muscle map are pure functions in `domain/`.
* **Honest data:** missing values are `null` and render as gaps / "not recorded", never zero. Sessions = logged workouts + check-ins marked "workout" without a log (no double counting). Muscle volume uses weighted sets (primary 1, secondary ½) and is shown relative to the period's most-trained group.
* **Demo mode** uses a separate database (`tgli-demo`) with a persistent banner, so sample data can never mix with real records.
* **Future sync:** every record has a UUID and `updatedAt`; the repository layer is the single write path, which is where a sync engine would hook in.
* **NW Log:** not integrated. `data/training/source.ts` defines `WorkoutSource` / `TrainingRecord`; a future adapter maps NW Log workouts into that shape and every analytics module picks it up unchanged.

## Privacy & security

* No accounts, no backend, no analytics, no social features. All data lives in this browser's IndexedDB on the device.
* Browser storage is **not** a backup: clearing site data or deleting the Home Screen app erases it. Profile → Data exports a JSON backup (optionally with photos) and restores it. TGLI requests persistent storage to reduce eviction.
* On iPhone, the Home Screen app and Safari keep **separate** storage.
* AI coach (optional): the user's own API key is stored on-device (or session-only), sent only directly to the chosen provider, excluded from backups and never logged. Users choose which data categories are shared; photos are never shared.

## Known platform limits (by design, stated in-app)

* **Reminders:** web apps can't schedule local notifications while fully closed; reliable closed-app delivery needs a Web Push server, which TGLI does not run. TGLI notifies while open/recently used (iPhone: only when installed, iOS 16.4+) and always shows an in-app reminder after the chosen time.
* **Replay video export** depends on `MediaRecorder` + `canvas.captureStream` (MP4 on Safari, WebM on Chromium) and records in real time.
* **3D muscle map** needs WebGL; a 2D map is used automatically otherwise (and is available as a toggle).
