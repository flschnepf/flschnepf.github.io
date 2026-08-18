import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative Base, damit der Build auch in einem Unterverzeichnis statisch ausgeliefert
// werden kann (GitHub Pages o. Ä.). Routing laeuft ueber den Hash, also ohne Rewrites.
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      // Kein stilles Update: Phase 5 haengt hier den Neuladen-Hinweis dran.
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'Kostentracker',
        short_name: 'Kosten',
        description: 'Lokaler Kosten-Tracker fuer Haushaltsausgaben',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#111315',
        theme_color: '#111315',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Alles wird vorab gecacht: nach dem ersten Laden laeuft die App ohne Netz.
        // Startbilder bleiben bewusst draussen — die zieht iOS beim Installieren
        // selbst, im laufenden Betrieb braucht sie niemand.
        globPatterns: [
          '**/*.{js,css,html,svg,woff2}',
          'icons/icon-*.png',
          'icons/apple-touch-icon.png',
        ],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
