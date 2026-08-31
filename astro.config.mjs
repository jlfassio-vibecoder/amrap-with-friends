// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import path from 'node:path';

/**
 * The content layer. Astro owns the marketing and editorial pages; the React SPA
 * in `src/` keeps every app route it already had, because rally links are shared
 * into group chats and must never move.
 *
 * Both builds emit into their own directory and `scripts/merge-build.ts` assembles
 * `dist/`. Tailwind runs through the repo's existing postcss.config.js, so the
 * design tokens in src/index.css are shared rather than duplicated.
 */
export default defineConfig({
  site: 'https://amrapwithfriends.com',
  srcDir: './site',
  publicDir: './public',
  outDir: './dist-site',
  integrations: [react()],
  // One URL per page, with no trailing slash, so the canonical in routes.ts and
  // the URL Vercel actually serves are the same string. `cleanUrls` in
  // vercel.json serves /about from about.html and redirects the .html away.
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  },
});
