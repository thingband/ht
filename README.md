# Halftone Studio

A dependency-free web app that converts images into color halftone prints, entirely in the browser.

## Features

- **CMYK (print)** — classic process-color screening: cyan, magenta, yellow, and black dot screens at traditional angles (15°/75°/0°/45°), composited with multiply blending on paper.
- **RGB (screen)** — additive red/green/blue dot screens on black, for a glowing LED-screen look.
- **Mono (B&W)** — single black screen from image luminance.
- **Dot shapes** — circle, square, diamond, line.
- **Controls** — dot size, angle offset, dot gain (midtone response), contrast, and paper color.
- **Export** — renders the full-resolution result and downloads it as PNG.
- Drag & drop, file picker, and clipboard paste are all supported. A built-in demo image lets you try it instantly.

## Run

No build step and no dependencies:

```bash
cd halftone-studio
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` directly also works.)

## How it works

The image is sampled from an offscreen canvas. Each ink channel gets its own rotated dot grid; at every grid point the channel's ink amount is sampled, converted to a dot whose area is proportional to tone (`r ∝ √tone`), and drawn on a channel layer. Layers are composited with `multiply` (CMYK/mono) or `lighter` (RGB) to emulate overprinted halftone inks. The preview renders at screen resolution and export re-renders at the chosen output size, so dot spacing stays consistent.
