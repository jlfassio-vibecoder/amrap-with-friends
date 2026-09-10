# Brand assets

## Source

Master logo:

```
public/brand/source/amrap-with-friends-logo.png
```

Prefer a square (or near-square) PNG, at least **1024×1024**.

## Generated

| File | Use |
|------|-----|
| `public/favicon.ico` | Browser tab favicon (16/32/48) from `logo-female.png` |
| `public/favicon-16.png` | PNG favicon |
| `public/favicon-32.png` | PNG favicon |
| `public/apple-touch-icon.png` | iOS home screen (180×180) from `logo-female.png` |
| `public/brand/logo.png` | In-app header emblem (512×512) |
| `public/brand/logo-male.png` | Landing hero dissolve (male face) |
| `public/brand/logo-female.png` | Landing hero dissolve (female face) |
| `public/og-image-f.png` | Default / female Open Graph card (1200×630) |
| `public/og-image-m.png` | Male Open Graph card (1200×630) |
| `public/og-image.png` | Alias of female card (legacy share URLs) |

Wired in `index.html` (icons + female `og:image` / `twitter:image`), `AppHeader` (`/brand/logo.png`), and `HeroLogoDissolve` (male/female crossfade). Invite links bake `?card=f|m`; social crawlers get the matching card via Edge Middleware.

Regenerate OG cards: `npm run generate:og-images`  
Regenerate favicons from female logo: `npm run generate:favicons`
