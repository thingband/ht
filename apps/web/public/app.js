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
  preset: $('preset'),
  mode: $('mode'),
  shape: $('shape'),
  spacing: $('spacing'),
  angle: $('angle'),
  gain: $('gain'),
  contrast: $('contrast'),
  brightness: $('brightness'),
  saturation: $('saturation'),
  soften: $('soften'),
  jitter: $('jitter'),
  misreg: $('misreg'),
  inkvar: $('inkvar'),
  specks: $('specks'),
  sunfade: $('sunfade'),
  reroll: $('reroll'),
  inks: $('inks'),
  rich: $('rich'),
  bg: $('bg'),
  grain: $('grain'),
  inkfade: $('inkfade'),
  crumple: $('crumple'),
  outSize: $('outSize'),
  download: $('download'),
  spacingVal: $('spacingVal'),
  angleVal: $('angleVal'),
  gainVal: $('gainVal'),
  contrastVal: $('contrastVal'),
  brightnessVal: $('brightnessVal'),
  saturationVal: $('saturationVal'),
  softenVal: $('softenVal'),
  jitterVal: $('jitterVal'),
  misregVal: $('misregVal'),
  inkvarVal: $('inkvarVal'),
  specksVal: $('specksVal'),
  sunfadeVal: $('sunfadeVal'),
  richVal: $('richVal'),
  grainVal: $('grainVal'),
  inkfadeVal: $('inkfadeVal'),
  crumpleVal: $('crumpleVal'),
  outSizeVal: $('outSizeVal'),
};

const state = {
  source: null,
  name: 'image',
  seed: (Math.random() * 0x100000000) >>> 0,
};

const MAX_PREVIEW = 1100;

const SCREENS = {
  cmyk: {
    composite: 'multiply',
    bg: () => els.bg.value,
    names: ['Cyan', 'Magenta', 'Yellow', 'Key'],
    channels: [
      { color: [0, 158, 224], angle: 15, fadeBias: 0.25, strength: 1 },
      { color: [230, 0, 118], angle: 75, fadeBias: 0.5, strength: 1 },
      { color: [255, 222, 0], angle: 0, fadeBias: 0.35, strength: 1 },
      { color: [24, 24, 24], angle: 45, fadeBias: 0.15, strength: 1 },
    ],
  },
  rgb: {
    composite: 'lighter',
    bg: () => '#000000',
    names: ['Red', 'Green', 'Blue'],
    channels: [
      { color: [255, 32, 32], angle: 15, fadeBias: 0.45, strength: 1 },
      { color: [0, 220, 80], angle: 75, fadeBias: 0.3, strength: 1 },
      { color: [40, 80, 255], angle: 135, fadeBias: 0.2, strength: 1 },
    ],
  },
  mono: {
    composite: 'multiply',
    bg: () => els.bg.value,
    names: ['Ink'],
    channels: [
      { color: [18, 18, 18], angle: 45, fadeBias: 0.3, strength: 1 },
    ],
  },
};

const PRESETS = {
  clean: { jitter: 0, misreg: 0, inkvar: 0, specks: 0, sunfade: 0, soften: 0, grain: 0, inkfade: 0, crumple: 0, rich: 0 },
  newsprint: { jitter: 0.2, misreg: 0.15, inkvar: 0.15, specks: 25, sunfade: 0.1, soften: 0.15, grain: 0.35, inkfade: 0.3, crumple: 0, rich: 0.2 },
  comic: { jitter: 0.35, misreg: 0.2, inkvar: 0.2, specks: 15, sunfade: 0, soften: 0, grain: 0.15, inkfade: 0.1, crumple: 0, rich: 0.35 },
  worn: { jitter: 0.3, misreg: 0.3, inkvar: 0.35, specks: 60, sunfade: 0.55, soften: 0.2, grain: 0.5, inkfade: 0.5, crumple: 0.4, rich: 0.3 },
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

function channelValues(mode, r, g, b, rich) {
  if (mode === 'cmyk') {
    const c = 1 - r;
    const m = 1 - g;
    const y = 1 - b;
    const k = Math.min(c, m, y);
    const d = 1 - k;
    const e = rich * k;
    const ck = d > 0.001 ? (c - k) / d : 0;
    const mk = d > 0.001 ? (m - k) / d : 0;
    const yk = d > 0.001 ? (y - k) / d : 0;
    return [Math.min(1, ck + e), Math.min(1, mk + e), Math.min(1, yk + e), k];
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

function valueNoise(seed, tag, w, h, cell) {
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const lat = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) lat[y * gw + x] = hash3(seed, tag, x, y);
  }
  const map = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / cell;
    const iy = fy | 0;
    const ty = fy - iy;
    const sy = ty * ty * (3 - 2 * ty);
    const row = iy * gw;
    for (let x = 0; x < w; x++) {
      const fx = x / cell;
      const ix = fx | 0;
      const tx = fx - ix;
      const sx = tx * tx * (3 - 2 * tx);
      const a = lat[row + ix];
      const b = lat[row + ix + 1];
      const c = lat[row + gw + ix];
      const d = lat[row + gw + ix + 1];
      map[y * w + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
  }
  return map;
}

function paperHeightmap(seed, w, h, cell) {
  const coarse = valueNoise(seed, 31, w, h, cell);
  const fine = valueNoise(seed, 37, w, h, Math.max(1, cell * 0.3));
  const map = new Float32Array(w * h);
  for (let i = 0; i < map.length; i++) {
    map[i] = coarse[i] * 0.65 + fine[i] * 0.35;
  }
  return map;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb) {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function ageColor(rgb, fade) {
  const aged = [226, 214, 176];
  return rgb.map((v, i) => Math.round(v + (aged[i] - v) * fade * 0.5));
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

  const spacing = opts.spacing;
  const maxR = spacing * 0.7;
  const reach = Math.ceil(Math.hypot(width, height) / 2 / spacing);
  const jitterAmp = opts.jitter * spacing * 0.5;
  const varAmt = opts.inkvar;

  const paper = opts.mode === 'rgb' ? [0, 0, 0] : ageColor(hexToRgb(screen.bg()), opts.sunfade);
  const paperStyle = `rgb(${paper[0]},${paper[1]},${paper[2]})`;

  const needsPaper = opts.grain > 0 || opts.inkfade > 0 || opts.crumple > 0;
  const hmap = needsPaper ? paperHeightmap(state.seed, width, height, spacing * 1.2) : null;

  if (opts.grain > 0) {
    const img = octx.createImageData(width, height);
    const px = img.data;
    for (let i = 0, o = 0; i < width * height; i++, o += 4) {
      const f = 1 - opts.grain * 0.22 * (hmap[i] - 0.5) * 2;
      px[o] = paper[0] * f;
      px[o + 1] = paper[1] * f;
      px[o + 2] = paper[2] * f;
      px[o + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
  } else {
    octx.fillStyle = paperStyle;
    octx.fillRect(0, 0, width, height);
  }

  for (let ci = 0; ci < screen.channels.length; ci++) {
    const ch = screen.channels[ci];
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const lctx = layer.getContext('2d');
    const cr = ch.color[0];
    const cg = ch.color[1];
    const cb = ch.color[2];
    lctx.fillStyle = `rgb(${cr},${cg},${cb})`;

    const a = ((ch.angle + opts.angle) * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const fadeMul = 1 - opts.sunfade * ch.fadeBias;
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
        let r = data[p] / 255;
        let g = data[p + 1] / 255;
        let b = data[p + 2] / 255;
        if (opts.brightness !== 1) {
          r *= opts.brightness;
          g *= opts.brightness;
          b *= opts.brightness;
        }
        if (opts.saturation !== 1) {
          const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          r = l + (r - l) * opts.saturation;
          g = l + (g - l) * opts.saturation;
          b = l + (b - l) * opts.saturation;
        }
        r = r < 0 ? 0 : r > 1 ? 1 : r;
        g = g < 0 ? 0 : g > 1 ? 1 : g;
        b = b < 0 ? 0 : b > 1 ? 1 : b;
        let v = channelValues(opts.mode, r, g, b, opts.rich)[ci];
        v = (v - 0.5) * opts.contrast + 0.5;
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        if (v <= 0.004) continue;
        v = Math.min(1, Math.pow(v, 1 / opts.gain) * ch.strength * fadeMul);
        if (v <= 0.004) continue;
        if (varAmt > 0) {
          const f = 1 + (hash3(state.seed, 23, ci, i * 8192 + j) - 0.5) * 0.6 * varAmt;
          lctx.fillStyle = `rgb(${Math.min(255, cr * f) | 0},${Math.min(255, cg * f) | 0},${Math.min(255, cb * f) | 0})`;
        }
        drawDot(lctx, opts.shape, px, py, maxR, spacing, v);
      }
    }
    lctx.restore();

    octx.globalCompositeOperation = screen.composite;
    octx.drawImage(layer, 0, 0);
  }
  octx.globalCompositeOperation = 'source-over';

  if (opts.soften > 0 && typeof octx.filter === 'string') {
    const tmp = document.createElement('canvas');
    tmp.width = width;
    tmp.height = height;
    tmp.getContext('2d').drawImage(out, 0, 0);
    octx.save();
    octx.filter = `blur(${(opts.soften * spacing * 0.18).toFixed(2)}px)`;
    octx.clearRect(0, 0, width, height);
    octx.drawImage(tmp, 0, 0);
    octx.restore();
  }

  if (opts.inkfade > 0) {
    const tmp = document.createElement('canvas');
    tmp.width = width;
    tmp.height = height;
    const tctx = tmp.getContext('2d');
    const img = tctx.createImageData(width, height);
    const px = img.data;
    for (let i = 0, o = 0; i < width * height; i++, o += 4) {
      px[o] = paper[0];
      px[o + 1] = paper[1];
      px[o + 2] = paper[2];
      px[o + 3] = 255 * opts.inkfade * Math.min(1, Math.max(0, (0.55 - hmap[i]) * 2));
    }
    tctx.putImageData(img, 0, 0);
    octx.drawImage(tmp, 0, 0);
  }

  if (opts.specks > 0) {
    const count = Math.round((opts.specks / 100) * 0.025 * (width * height) / (spacing * spacing));
    for (let k = 0; k < count; k++) {
      const dark = hash3(state.seed, 7, k, 1) < 0.35;
      const x = hash3(state.seed, 7, k, 2) * width;
      const y = hash3(state.seed, 7, k, 3) * height;
      const r = spacing * (0.04 + hash3(state.seed, 7, k, 4) * 0.1);
      octx.fillStyle = dark ? 'rgba(20,20,20,0.85)' : paperStyle;
      octx.beginPath();
      octx.arc(x, y, r, 0, Math.PI * 2);
      octx.fill();
    }
  }

  if (opts.crumple > 0) {
    const tmp = document.createElement('canvas');
    tmp.width = width;
    tmp.height = height;
    const tctx = tmp.getContext('2d');
    const img = tctx.createImageData(width, height);
    const px = img.data;
    for (let y = 0; y < height; y++) {
      const up = (y > 0 ? y - 1 : 0) * width;
      const down = (y < height - 1 ? y + 1 : height - 1) * width;
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const s = hmap[row + (x > 0 ? x - 1 : 0)] - hmap[row + (x < width - 1 ? x + 1 : width - 1)]
          + hmap[up + x] - hmap[down + x];
        const m = Math.min(1, Math.abs(s) * 6);
        const o = (row + x) * 4;
        if (s > 0) {
          px[o] = 255;
          px[o + 1] = 255;
          px[o + 2] = 250;
        } else {
          px[o] = 20;
          px[o + 1] = 16;
          px[o + 2] = 10;
        }
        px[o + 3] = 128 * opts.crumple * m;
      }
    }
    tctx.putImageData(img, 0, 0);
    octx.drawImage(tmp, 0, 0);
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
    brightness: parseFloat(els.brightness.value),
    saturation: parseFloat(els.saturation.value),
    soften: parseFloat(els.soften.value),
    jitter: parseFloat(els.jitter.value),
    misreg: parseFloat(els.misreg.value),
    inkvar: parseFloat(els.inkvar.value),
    specks: parseFloat(els.specks.value),
    sunfade: parseFloat(els.sunfade.value),
    rich: parseFloat(els.rich.value),
    grain: parseFloat(els.grain.value),
    inkfade: parseFloat(els.inkfade.value),
    crumple: parseFloat(els.crumple.value),
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

function buildInkControls() {
  const screen = SCREENS[els.mode.value];
  els.inks.textContent = '';
  screen.channels.forEach((ch, ci) => {
    const label = document.createElement('label');
    label.className = 'ink';
    const pick = document.createElement('input');
    pick.type = 'color';
    pick.value = rgbToHex(ch.color);
    pick.addEventListener('input', () => {
      ch.color = hexToRgb(pick.value);
      scheduleRender();
    });
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '1.5';
    range.step = '0.05';
    range.value = String(ch.strength);
    range.setAttribute('aria-label', `${screen.names[ci]} strength`);
    range.addEventListener('input', () => {
      ch.strength = parseFloat(range.value);
      scheduleRender();
    });
    label.append(document.createTextNode(screen.names[ci]), pick, range);
    els.inks.append(label);
  });
  els.rich.disabled = els.mode.value !== 'cmyk';
}

function updateLabels() {
  els.spacingVal.textContent = `${els.spacing.value} px`;
  els.angleVal.textContent = `${els.angle.value}°`;
  els.gainVal.textContent = Number(els.gain.value).toFixed(2);
  els.contrastVal.textContent = Number(els.contrast.value).toFixed(2);
  els.brightnessVal.textContent = `${Number(els.brightness.value).toFixed(2)}×`;
  els.saturationVal.textContent = `${Number(els.saturation.value).toFixed(2)}×`;
  els.softenVal.textContent = `${Math.round(els.soften.value * 100)}%`;
  els.jitterVal.textContent = `${Math.round(els.jitter.value * 100)}%`;
  els.misregVal.textContent = `${Math.round(els.misreg.value * 100)}%`;
  els.inkvarVal.textContent = `${Math.round(els.inkvar.value * 100)}%`;
  els.specksVal.textContent = els.specks.value;
  els.sunfadeVal.textContent = `${Math.round(els.sunfade.value * 100)}%`;
  els.richVal.textContent = `${Math.round(els.rich.value * 100)}%`;
  els.grainVal.textContent = `${Math.round(els.grain.value * 100)}%`;
  els.inkfadeVal.textContent = `${Math.round(els.inkfade.value * 100)}%`;
  els.crumpleVal.textContent = `${Math.round(els.crumple.value * 100)}%`;
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

els.preset.addEventListener('change', () => {
  const preset = PRESETS[els.preset.value];
  if (!preset) return;
  for (const [key, value] of Object.entries(preset)) {
    els[key].value = String(value);
  }
  updateLabels();
  scheduleRender();
});

els.mode.addEventListener('change', buildInkControls);

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

[
  els.mode, els.shape, els.spacing, els.angle, els.gain, els.contrast,
  els.brightness, els.saturation, els.soften,
  els.jitter, els.misreg, els.inkvar, els.specks, els.sunfade,
  els.rich, els.grain, els.inkfade, els.crumple, els.bg, els.outSize,
].forEach(
  (el) => el.addEventListener('input', () => {
    updateLabels();
    scheduleRender();
  })
);

buildInkControls();
updateLabels();
