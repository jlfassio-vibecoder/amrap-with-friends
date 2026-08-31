import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The SPA shell is one of two build outputs; scripts/merge-build.ts moves it
    // to dist/_app-shell/index.html, which vercel.json rewrites app routes to.
    outDir: 'dist-app',
  },
  // Astro copies public/ into its own output; doing it twice would just be a
  // slower way to get the same files.
  publicDir: false,
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
