import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `command` is 'serve' for the dev server and 'build' for a production build.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  build: {
    // The SPA shell is one of two build outputs; scripts/merge-build.ts moves it
    // to dist/_app-shell/index.html, which vercel.json rewrites app routes to.
    outDir: 'dist-app',
  },
  // Astro copies public/ into its own output and merge-build assembles the two,
  // so a production build must not copy it twice.
  //
  // The dev server has neither of those: with publicDir off, every file under
  // public/ — the vault audio included — resolves to the SPA shell instead, so
  // `fetch` succeeds, `decodeAudioData` throws on HTML, and the cue silently
  // falls back to synthesis. The sounds have been dead locally since the Astro
  // split while working fine in production, which is exactly the shape that
  // sends you hunting through application code.
  publicDir: command === 'serve' ? 'public' : false,
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
