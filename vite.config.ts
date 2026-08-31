import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves project sites under /<repo-name>/
  base: command === 'build' ? '/caloriesApp/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Calorie Camera',
        short_name: 'Calorie Camera',
        description: "Camera-first calorie tracker that remembers what you've eaten before.",
        start_url: '/caloriesApp/',
        scope: '/caloriesApp/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0b0d',
        theme_color: '#0a0b0d',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // precache the built app shell so it launches offline; camera/API
        // calls still need the device itself, not the network
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        runtimeCaching: [
          {
            // MobileNet's weights (fetched from TF Hub / Kaggle Models / GCS on
            // first classification) are immutable once versioned — cache them
            // so on-device recognition keeps working offline after first use.
            urlPattern: ({ url }) =>
              /(^|\.)tfhub\.dev$|(^|\.)kaggle\.com$|(^|\.)googleapis\.com$/.test(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ml-model-weights',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
}))
