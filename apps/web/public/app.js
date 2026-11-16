'use strict';

const $ = (id) => document.getElementById(id);

const els = {
  file: $('file'),
  demo: $('demo'),
  stage: $('stage'),
  dropzone: $('dropzone'),
  placeholder: $('placeholder'),
  canvasWrap: $('canvasWrap'),
  canvas: $('preview'),
  mode: $('mode'),
  shape: $('shape'),
  spacing: $('spacing'),
  angle: $('angle'),
  gain: $('gain'),
  contrast: $('contrast'),
  jitter: $('jitter'),
  misreg: $('misreg'),
  specks: $('specks'),
  reroll: $('reroll'),
  bg: $('bg'),
  outSize: $('outSize'),
  download: $('download'),
  spacingVal: $('spacingVal'),
  angleVal: $('angleVal'),
  gainVal: $('gainVal'),
  contrastVal: $('contrastVal'),
  jitterVal: $('jitterVal'),
  misregVal: $('misregVal'),
  specksVal: $('specksVal'),
  outSizeVal: $('outSizeVal'),
};

const state = {
  source: null,
  name: 'image',
  seed: (Math.random() * 0x100000000) >>> 0,
};

function hash3(seed, a, b, c) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ a, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ b, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h ^ c, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const MAX_PREVIEW = 1100;

const SCREENS = {
  cmyk: {
    composite: 'multiply',
    bg: () => els.bg.value,
    channels: [
      { color: [0, 158, 224], angle: 15 },
      { color: [230, 0, 118], angle: 75 },
      { color: [255, 222, 0], angle: 0 },
      { color: [24, 24, 24], angle: 45 },
    ],
  },
  rgb: {
    composite: 'lighter',
    bg: () => '#000000',
    channels: [
      { color: [255, 32, 32], angle: 15 },
      { color: [0, 220, 80], angle: 75 },
      { color: [40, 80, 255], angle: 135 },
    ],
  },
  mono: {
    composite: 'multiply',
    bg: () => els.bg.value,
    channels: [
      { color: [18, 18, 18], angle: 45 },
    ],
  },
};

function channelValues(mode, r, g, b) {
  if (mode === 'cmyk') {
    const c = 1 - r;
    const m = 1 - g;
    const y = 1 - b;
    const k = Math.min(c, m, y);
    if (k >= 0.999) return [0, 0, 0, 1];
    const d = 1 - k;
    return [(c - k) / d, (m - k) / d, (y - k) / d, k];
  }
  if (mode === 'rgb') return [r, g, b];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [1 - lum];
}

function drawDot(ctx, shape, x, y, maxR, spacing, tone) {
  switch (shape) {
    case 'square': {
      const s = spacing * Math.sqrt(tone);
      if (s < 0.05) return;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      return;
    }
    case 'diamond': {
      const r = maxR * Math.sqrt(tone);
      if (r < 0.05) return;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case 'line': {
      const t = spacing * tone;
      if (t < 0.05) return;
      ctx.fillRect(x - spacing / 2, y - t / 2, spacing, t);
      return;
    }
    default: {
      const r = maxR * Math.sqrt(tone);
      if (r < 0.05) return;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderHalftone(source, width, height, opts) {
  const sample = document.createElement('canvas');
  sample.width = width;
  sample.height = height;
  const sctx = sample.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(source, 0, 0, width, height);
  const data = sctx.getImageData(0, 0, width, height).data;

  const screen = SCREENS[opts.mode];
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const octx = out.getContext('2d');
  octx.fillStyle = screen.bg();
  octx.fillRect(0, 0, width, height);

  const spacing = opts.spacing;
  const maxR = spacing * 0.7;
  const reach = Math.ceil(Math.hypot(width, height) / 2 / spacing);
  const jitterAmp = opts.jitter * spacing * 0.5;

  for (let ci = 0; ci < screen.channels.length; ci++) {
    const ch = screen.channels[ci];
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const lctx = layer.getContext('2d');
    lctx.fillStyle = `rgb(${ch.color[0]},${ch.color[1]},${ch.color[2]})`;

    const a = ((ch.angle + opts.angle) * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    lctx.save();
    lctx.translate(width / 2, height / 2);
    lctx.rotate(a);
    if (opts.misreg > 0) {
      const dir = hash3(state.seed, 11, ci, 3) * Math.PI * 2;
      const mag = opts.misreg * spacing * 0.45;
      lctx.translate(Math.cos(dir) * mag, Math.sin(dir) * mag);
    }

    for (let i = -reach; i <= reach; i++) {
      for (let j = -reach; j <= reach; j++) {
        let px = i * spacing;
        let py = j * spacing;
        if (jitterAmp > 0) {
          px += (hash3(state.seed, ci, i, j * 2 + 1) - 0.5) * 2 * jitterAmp;
          py += (hash3(state.seed, ci, i, j * 2 + 2) - 0.5) * 2 * jitterAmp;
        }
        const ix = Math.round(width / 2 + px * cos - py * sin);
        const iy = Math.round(height / 2 + px * sin + py * cos);
        if (ix < 0 || iy < 0 || ix >= width || iy >= height) continue;
        const p = (iy * width + ix) * 4;
        let v = channelValues(opts.mode, data[p] / 255, data[p + 1] / 255, data[p + 2] / 255)[ci];
        v = (v - 0.5) * opts.contrast + 0.5;
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        if (v <= 0.004) continue;
        drawDot(lctx, opts.shape, px, py, maxR, spacing, Math.pow(v, 1 / opts.gain));
      }
    }
    lctx.restore();

    octx.globalCompositeOperation = screen.composite;
    octx.drawImage(layer, 0, 0);
  }
  octx.globalCompositeOperation = 'source-over';

  if (opts.specks > 0) {
    const count = Math.round((opts.specks / 100) * 0.025 * (width * height) / (spacing * spacing));
    for (let k = 0; k < count; k++) {
      const dark = hash3(state.seed, 7, k, 1) < 0.35;
      const x = hash3(state.seed, 7, k, 2) * width;
      const y = hash3(state.seed, 7, k, 3) * height;
      const r = spacing * (0.04 + hash3(state.seed, 7, k, 4) * 0.1);
      octx.fillStyle = dark ? 'rgba(20,20,20,0.85)' : screen.bg();
      octx.beginPath();
      octx.arc(x, y, r, 0, Math.PI * 2);
      octx.fill();
    }
  }
  return out;
}

function readOpts() {
  return {
    mode: els.mode.value,
    shape: els.shape.value,
    spacing: parseFloat(els.spacing.value),
    angle: parseFloat(els.angle.value),
    gain: parseFloat(els.gain.value),
    contrast: parseFloat(els.contrast.value),
    jitter: parseFloat(els.jitter.value),
    misreg: parseFloat(els.misreg.value),
    specks: parseFloat(els.specks.value),
  };
}

function outputSize() {
  const src = state.source;
  const target = parseInt(els.outSize.value, 10);
  const scale = Math.min(1, target / Math.max(src.width, src.height));
  return {
    w: Math.max(1, Math.round(src.width * scale)),
    h: Math.max(1, Math.round(src.height * scale)),
  };
}

function renderPreview() {
  const src = state.source;
  if (!src) return;
  const out = outputSize();
  const scale = Math.min(1, MAX_PREVIEW / Math.max(out.w, out.h));
  const w = Math.max(1, Math.round(out.w * scale));
  const h = Math.max(1, Math.round(out.h * scale));
  const opts = readOpts();
  opts.spacing = Math.max(1.5, opts.spacing * (w / out.w));
  const halftone = renderHalftone(src, w, h, opts);
  els.canvas.width = w;
  els.canvas.height = h;
  els.canvas.getContext('2d').drawImage(halftone, 0, 0);
  els.placeholder.hidden = true;
  els.canvasWrap.hidden = false;
  els.download.disabled = false;
}

let renderTimer = null;
function scheduleRender() {
  if (!state.source) return;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderPreview, 40);
}

function loadSource(source, name) {
  state.source = source;
  state.name = (name || 'image').replace(/\.[^.]+$/, '') || 'image';
  renderPreview();
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    loadSource(img, file.name);
  };
  img.src = url;
}

function makeDemoImage() {
  const c = document.createElement('canvas');
  c.width = 960;
  c.height = 640;
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 960, 640);
  sky.addColorStop(0, '#ff8a3d');
  sky.addColorStop(0.5, '#e83e8c');
  sky.addColorStop(1, '#3b6ff0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 640);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(680, 170, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f7a4d';
  ctx.beginPath();
  ctx.ellipse(220, 660, 400, 240, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#14532d';
  ctx.beginPath();
  ctx.ellipse(720, 700, 440, 280, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function updateLabels() {
  els.spacingVal.textContent = `${els.spacing.value} px`;
  els.angleVal.textContent = `${els.angle.value}°`;
  els.gainVal.textContent = Number(els.gain.value).toFixed(2);
  els.contrastVal.textContent = Number(els.contrast.value).toFixed(2);
  els.jitterVal.textContent = `${Math.round(els.jitter.value * 100)}%`;
  els.misregVal.textContent = `${Math.round(els.misreg.value * 100)}%`;
  els.specksVal.textContent = els.specks.value;
  els.outSizeVal.textContent = `${els.outSize.value} px`;
}

els.file.addEventListener('change', () => {
  loadFile(els.file.files[0]);
  els.file.value = '';
});

['pointerdown', 'dragover', 'dragenter'].forEach((evt) =>
  els.stage.addEventListener(evt, (e) => {
    if (evt === 'pointerdown') return;
    e.preventDefault();
    els.dropzone.classList.add('drag');
  })
);

['dragleave', 'dragend', 'drop'].forEach((evt) =>
  els.stage.addEventListener(evt, () => els.dropzone.classList.remove('drag'))
);

els.stage.addEventListener('drop', (e) => {
  e.preventDefault();
  loadFile(e.dataTransfer.files && e.dataTransfer.files[0]);
});

document.addEventListener('paste', (e) => {
  const files = e.clipboardData && e.clipboardData.files;
  if (files && files.length) loadFile(files[0]);
});

els.demo.addEventListener('click', () => loadSource(makeDemoImage(), 'demo'));

els.reroll.addEventListener('click', () => {
  state.seed = (Math.random() * 0x100000000) >>> 0;
  scheduleRender();
});

els.download.addEventListener('click', () => {
  if (!state.source) return;
  els.download.disabled = true;
  els.download.textContent = 'Rendering…';
  setTimeout(() => {
    const { w, h } = outputSize();
    const halftone = renderHalftone(state.source, w, h, readOpts());
    halftone.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.name}-halftone.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      els.download.disabled = false;
      els.download.textContent = 'Download PNG';
    }, 'image/png');
  }, 30);
});

[els.mode, els.shape, els.spacing, els.angle, els.gain, els.contrast, els.jitter, els.misreg, els.specks, els.bg, els.outSize].forEach(
  (el) => el.addEventListener('input', () => {
    updateLabels();
    scheduleRender();
  })
);

updateLabels();
