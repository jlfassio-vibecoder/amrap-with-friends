// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import path from 'node:path';
import { loadEnv } from 'vite';

const root = path.resolve(import.meta.dirname);
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const env = loadEnv(mode, root, '');

/** Astro's srcDir is site/, so Vite's default envDir misses the repo-root .env. */
const viteEnvDefine = Object.fromEntries(
  Object.entries(env)
    .filter(([key]) => key.startsWith('VITE_'))
    .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
);

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
    envDir: root,
    define: viteEnvDefine,
    resolve: {
      alias: {
        '@': path.resolve(root, './src'),
      },
    },
  },
});
