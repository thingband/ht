# ht — Halftone Studio

A web app that converts images into color halftone prints, served as a Mistral App.

## Features

- **CMYK (print)** — classic process-color screening: cyan, magenta, yellow, and black dot screens at traditional angles (15°/75°/0°/45°), composited with multiply blending on paper.
- **RGB (screen)** — additive red/green/blue dot screens on black, for a glowing LED-screen look.
- **Mono (B&W)** — single black screen from image luminance.
- **Dot shapes** — circle, square, diamond, line.
- **Controls** — dot size, angle offset, dot gain (midtone response), contrast, brightness, saturation, soften, and paper color.
- **Inks** — recolor any ink and scale its strength; "rich black" adds CMY under the key for deeper darks.
- **Press realism** — dot jitter, per-screen misregistration, ink color variation, ink/dark specks, and sun fade, all driven by a re-rollable seed so the preview and the exported PNG show the same print.
- **Paper** — procedural paper grain with structure-based ink fade and crumple shading.
- **Print character** — one-click Clean, Newsprint, Comic, and Worn presets that bundle the realism controls.
- **Export** — renders the full-resolution result and downloads it as PNG.
- Drag & drop, file picker, and clipboard paste are all supported. A built-in demo image lets you try it instantly.

Everything runs client-side on a canvas; the API module only provides the platform's health routes.

## Structure

Mistral App scaffold (`apps.json`):

- `apps/web` — TanStack Start frontend. The halftone app is the static page in `apps/web/public/app.html` (+ `app.css`, `app.js`); the `/` route redirects to it.
- `apps/api` — FastAPI backend at `/api`.

## Develop

```bash
bun install
bash tools/install.sh   # full workspace install (web + api)
bun run dev:web         # web module only
mistral apps dev        # full dev stack via the Mistral CLI
```

## Test and build

```bash
cd apps/web && bun run test    # vitest-style bun tests
cd apps/web && bun run build   # nitro build
```

## Deploy

```bash
mistral deploy
```

## How the halftone works

The image is sampled from an offscreen canvas. Each ink channel gets its own rotated dot grid; at every grid point the channel's ink amount is sampled, converted to a dot whose area is proportional to tone (`r ∝ √tone`), and drawn on a channel layer. Layers are composited with `multiply` (CMYK/mono) or `lighter` (RGB) to emulate overprinted halftone inks. The preview renders at screen resolution and export re-renders at the chosen output size, so dot spacing stays consistent.
