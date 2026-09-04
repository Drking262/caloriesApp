# Calorie Camera

Camera-first calorie tracker: shoot your plate, it logs instantly, and remembers what you've eaten before.

Your logged food and preferences stay on your device (`localStorage`) — no backend, no accounts required. Food recognition runs on-device (see `src/lib/foodClassifier.ts`); nutrition data for a recognized or searched food is looked up live against USDA's free FoodData Central API (see `src/lib/nutritionApi.ts`), with a local fallback for dishes it doesn't cover (e.g. Czech traditional dishes) — recognized labels and typed search queries do leave your device as part of that lookup.

## Configuration

The hosted app (below) always uses USDA's shared demo key (30 requests/hour, 50/day per device) — the GitHub Pages deploy (`.github/workflows/deploy.yml`) builds with no `.env`, so a personal key only takes effect if you build and host your own copy. To do that, get a free personal key (no cost, no credit card, ~1 minute) at https://api.data.gov/signup/ for a much higher limit (1,000/hour), then create a `.env` file (see `.env.example`) before running `npm run build`:

```
VITE_FDC_API_KEY=your-key-here
```

This key ends up compiled into the public JS bundle, like any Vite `VITE_*` variable — fine here, since it only affects your own request's rate limit and carries no billing or account access.

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
