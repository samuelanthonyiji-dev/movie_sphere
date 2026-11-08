import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const API = process.env.API_ORIGIN ?? 'http://localhost:4000'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: false, // hand-written: public/manifest.webmanifest
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Keep the install light: skip the lazily loaded HLS engine and non-Latin font subsets.
        globIgnores: ['**/og-image.png', '**/hls-*.js', '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*', '**/*.woff'],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/media': API,
      '/sitemap.xml': API,
      '/robots.txt': API,
    },
  },
  preview: { port: 4173, proxy: { '/api': API, '/media': API } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('hls.js')) return 'hls'
          if (/node_modules[\\/](react|react-dom|react-router|scheduler)/.test(id)) return 'react'
          if (id.includes('@tanstack')) return 'query'
        },
      },
    },
  },
})
