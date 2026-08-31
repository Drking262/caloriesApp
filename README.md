# Calorie Camera

Camera-first calorie tracker: shoot your plate, it logs instantly, and remembers what you've eaten before.

All data stays on your device (`localStorage`) — no backend, no accounts, no API keys. Food "recognition" is a client-side perceptual image hash (see `src/lib/perceptualHash.ts`), not a network call.

## Use it on your phone

Open **https://drking262.github.io/caloriesApp/** on your phone's browser, then:

- **iOS (Safari):** Share button → *Add to Home Screen*
- **Android (Chrome):** menu (⋮) → *Install app* (or *Add to Home Screen*)

That installs it as a standalone app icon — no browser chrome, works offline after the first load, and your logged food stays local to that phone.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # serve the production build locally
```

Pushing to `main` auto-deploys `dist/` to GitHub Pages via `.github/workflows/deploy.yml`.
