import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/aulado/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['planos/**/*', 'icons/**/*'],
      manifest: {
        name: 'Aulado — Navegación de campus',
        short_name: 'Aulado',
        description: 'Encontrá aulas, oficinas y espacios en el campus rápido y sin conexión.',
        theme_color: '#1a6fd8',
        background_color: '#f5f7fa',
        display: 'standalone',
        start_url: '/aulado/',
        lang: 'es',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precachea el shell + assets estáticos.
        // Los planos y datos se cachean con NetworkFirst para que
        // la primera visita funcione y posteriores visitas offline también.
        runtimeCaching: [
          {
            urlPattern: /\/planos\/.+\.(svg|png)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'aulado-planos',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/src\/data\/campus\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'aulado-datos',
            },
          },
        ],
      },
    }),
  ],
  // Alias para que los imports sean limpios (opcional en este proyecto pequeño).
  resolve: {
    alias: {},
  },
});
