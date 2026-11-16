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
  interacting: false,
};

const scratchCanvases = {};
function scratchCanvas(key, w, h) {
  let c = scratchCanvases[key];
  if (!c) c = scratchCanvases[key] = document.createElement('canvas');
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  return c;
}

const sampleCache = { source: null, w: 0, h: 0, data: null };
const hmapCache = { key: '', map: null };

let interactTimer = null;
function markInteract() {
  state.interacting = true;
  clearTimeout(interactTimer);
  interactTimer = setTimeout(() => {
    state.interacting = false;
    scheduleRender();
  }, 240);
}

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
  let data;
  if (sampleCache.source === source && sampleCache.w === width && sampleCache.h === height) {
    data = sampleCache.data;
  } else {
    const sample = scratchCanvas('sample', width, height);
    const sctx = sample.getContext('2d', { willReadFrequently: true });
    sctx.clearRect(0, 0, width, height);
    sctx.drawImage(source, 0, 0, width, height);
    data = sctx.getImageData(0, 0, width, height).data;
    sampleCache.source = source;
    sampleCache.w = width;
    sampleCache.h = height;
    sampleCache.data = data;
  }

  const screen = SCREENS[opts.mode];
  const out = scratchCanvas('out', width, height);
  const octx = out.getContext('2d');

  const spacing = opts.spacing;
  const maxR = spacing * 0.7;
  const reach = Math.ceil(Math.hypot(width, height) / 2 / spacing);
  const jitterAmp = opts.jitter * spacing * 0.5;
  const varAmt = opts.inkvar;
  const sub = spacing / 3;
  const samples = opts.fast ? 1 : 9;
  const norm = 255 * samples;
  const isChain = opts.shape === 'circle' && typeof octx.roundRect === 'function';
  const stride = 2 * reach + 1;
  const tones = isChain ? new Float32Array(stride * stride) : null;
  const halfCell = (spacing + 0.5) / 2;

  const paper = opts.mode === 'rgb' ? [0, 0, 0] : ageColor(hexToRgb(screen.bg()), opts.sunfade);
  const paperStyle = `rgb(${paper[0]},${paper[1]},${paper[2]})`;

  const needsPaper = !opts.fast && (opts.grain > 0 || opts.inkfade > 0 || opts.crumple > 0);
  let hmap = null;
  if (needsPaper) {
    const hkey = `${state.seed}|${width}|${height}|${Math.round(spacing * 120)}`;
    if (hmapCache.key === hkey) {
      hmap = hmapCache.map;
    } else {
      hmap = paperHeightmap(state.seed, width, height, spacing * 1.2);
      hmapCache.key = hkey;
      hmapCache.map = hmap;
    }
  }

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
    const jx = (i, j) => (jitterAmp > 0 ? (hash3(state.seed, ci, i, j * 2 + 1) - 0.5) * 2 * jitterAmp : 0);
    const jy = (i, j) => (jitterAmp > 0 ? (hash3(state.seed, ci, i, j * 2 + 2) - 0.5) * 2 * jitterAmp : 0);
    const layer = scratchCanvas('layer', width, height);
    const lctx = layer.getContext('2d');
    lctx.clearRect(0, 0, width, height);
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
        let r = 0;
        let g = 0;
        let b = 0;
        for (let s = 0; s < samples; s++) {
          const ox = samples === 1 ? px : px + ((s % 3) - 1) * sub;
          const oy = samples === 1 ? py : py + (((s / 3) | 0) - 1) * sub;
          const fx = width / 2 + ox * cos - oy * sin;
          const fy = height / 2 + ox * sin + oy * cos;
          let x0 = Math.floor(fx);
          let y0 = Math.floor(fy);
          const tx = fx - x0;
          const ty = fy - y0;
          x0 = x0 < 0 ? 0 : x0 >= width ? width - 1 : x0;
          y0 = y0 < 0 ? 0 : y0 >= height ? height - 1 : y0;
          const x1 = x0 + 1 >= width ? width - 1 : x0 + 1;
          const y1 = y0 + 1 >= height ? height - 1 : y0 + 1;
          const w00 = (1 - tx) * (1 - ty);
          const w10 = tx * (1 - ty);
          const w01 = (1 - tx) * ty;
          const w11 = tx * ty;
          const p00 = (y0 * width + x0) * 4;
          const p10 = (y0 * width + x1) * 4;
          const p01 = (y1 * width + x0) * 4;
          const p11 = (y1 * width + x1) * 4;
          r += data[p00] * w00 + data[p10] * w10 + data[p01] * w01 + data[p11] * w11;
          g += data[p00 + 1] * w00 + data[p10 + 1] * w10 + data[p01 + 1] * w01 + data[p11 + 1] * w11;
          b += data[p00 + 2] * w00 + data[p10 + 2] * w10 + data[p01 + 2] * w01 + data[p11 + 2] * w11;
        }
        r /= norm;
        g /= norm;
        b /= norm;
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
        if (tones) tones[(i + reach) * stride + (j + reach)] = v;
        if (isChain) {
          if (v < 0.5) {
            const denom = 1 - ((4 - Math.PI) * (1 - 2 * v) * (1 - 2 * v)) / 4;
            const a = spacing * Math.sqrt(v / denom);
            if (a >= 0.05) {
              lctx.save();
              lctx.translate(px, py);
              lctx.rotate(Math.PI / 4);
              lctx.beginPath();
              lctx.roundRect(-a / 2, -a / 2, a, a, (a / 2) * (1 - 2 * v));
              lctx.fill();
              lctx.restore();
            }
          } else {
            lctx.beginPath();
            lctx.roundRect(px - halfCell, py - halfCell, spacing + 0.5, spacing + 0.5, spacing * 0.12);
            lctx.fill();
          }
        } else {
          drawDot(lctx, opts.shape, px, py, maxR, spacing, v);
        }
      }
    }

    if (isChain) {
      lctx.globalCompositeOperation = 'destination-out';
      lctx.fillStyle = '#000';
      for (let i = -reach; i < reach; i++) {
        for (let j = -reach; j < reach; j++) {
          let sum = 0;
          let cnt = 0;
          let sx = 0;
          let sy = 0;
          for (let di = 0; di <= 1; di++) {
            for (let dj = 0; dj <= 1; dj++) {
              const ii = i + di;
              const jj = j + dj;
              if (ii < -reach || ii > reach || jj < -reach || jj > reach) continue;
              sum += tones[(ii + reach) * stride + (jj + reach)];
              sx += ii * spacing + jx(ii, jj);
              sy += jj * spacing + jy(ii, jj);
              cnt++;
            }
          }
          const tAvg = sum / cnt;
          if (tAvg <= 0.5) continue;
          const rh = spacing * Math.sqrt((1 - tAvg) / Math.PI);
          if (rh < 0.05) continue;
          lctx.beginPath();
          lctx.arc(sx / cnt, sy / cnt, rh, 0, Math.PI * 2);
          lctx.fill();
        }
      }
    }
    lctx.restore();

    octx.globalCompositeOperation = screen.composite;
    octx.drawImage(layer, 0, 0);
  }
  octx.globalCompositeOperation = 'source-over';

  if (opts.soften > 0 && !opts.fast && typeof octx.filter === 'string') {
    const tmp = scratchCanvas('tmpA', width, height);
    tmp.getContext('2d').clearRect(0, 0, width, height);
    tmp.getContext('2d').drawImage(out, 0, 0);
    octx.save();
    octx.filter = `blur(${(opts.soften * spacing * 0.18).toFixed(2)}px)`;
    octx.clearRect(0, 0, width, height);
    octx.drawImage(tmp, 0, 0);
    octx.restore();
  }

  if (opts.inkfade > 0 && !opts.fast) {
    const tmp = scratchCanvas('tmpA', width, height);
    const tctx = tmp.getContext('2d');
    tctx.clearRect(0, 0, width, height);
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

  if (opts.crumple > 0 && !opts.fast) {
    const tmp = scratchCanvas('tmpA', width, height);
    const tctx = tmp.getContext('2d');
    tctx.clearRect(0, 0, width, height);
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

const GL_VERT = `#version 300 es
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

const GL_FRAG_TONE = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSize;
uniform float uSpacing;
uniform int uMode;
uniform float uBrightness;
uniform float uSaturation;
uniform float uContrast;
uniform float uGain;
uniform float uRich;
uniform vec4 uStrength;
uniform vec4 uFadeMul;
out vec4 outColor;
void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 uv = p / uSize;
  vec2 px = (uSpacing / 3.0) / uSize;
  vec3 acc = vec3(0.0);
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      acc += texture(uSrc, uv + vec2(float(i), float(j)) * px).rgb;
    }
  }
  vec3 rgb = acc / 9.0 * uBrightness;
  float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = clamp(l + (rgb - l) * uSaturation, 0.0, 1.0);
  vec4 t;
  if (uMode == 0) {
    float c = 1.0 - rgb.r;
    float m = 1.0 - rgb.g;
    float y = 1.0 - rgb.b;
    float k = min(c, min(m, y));
    float d = 1.0 - k;
    float e = uRich * k;
    float ck = d > 0.001 ? (c - k) / d : 0.0;
    float mk = d > 0.001 ? (m - k) / d : 0.0;
    float yk = d > 0.001 ? (y - k) / d : 0.0;
    t = vec4(min(1.0, ck + e), min(1.0, mk + e), min(1.0, yk + e), k);
  } else if (uMode == 1) {
    t = vec4(rgb, 1.0);
  } else {
    t = vec4(1.0 - dot(rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 0.0, 0.0);
  }
  outColor = vec4(
    min(1.0, pow(clamp((t.r - 0.5) * uContrast + 0.5, 0.0, 1.0), 1.0 / uGain) * uStrength.r * uFadeMul.r),
    min(1.0, pow(clamp((t.g - 0.5) * uContrast + 0.5, 0.0, 1.0), 1.0 / uGain) * uStrength.g * uFadeMul.g),
    min(1.0, pow(clamp((t.b - 0.5) * uContrast + 0.5, 0.0, 1.0), 1.0 / uGain) * uStrength.b * uFadeMul.b),
    min(1.0, pow(clamp((t.a - 0.5) * uContrast + 0.5, 0.0, 1.0), 1.0 / uGain) * uStrength.a * uFadeMul.a));
}`;

const GL_FRAG_SCREEN = `#version 300 es
precision highp float;
uniform sampler2D uTone;
uniform vec2 uSize;
uniform vec2 uCenter;
uniform float uSpacing;
uniform float uAngle;
uniform float uMisreg;
uniform float uJitter;
uniform float uInkvar;
uniform float uSpecks;
uniform float uSoften;
uniform float uGrain;
uniform float uInkfade;
uniform float uCrumple;
uniform float uSeed;
uniform int uCount;
uniform int uShape;
uniform float uAdditive;
uniform vec3 uPaper;
uniform vec3 uColors[4];
uniform float uAngles[4];
out vec4 outColor;
const float PI = 3.14159265;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec2 p, float tag) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(vec3(i, tag));
  float b = hash(vec3(i + vec2(1.0, 0.0), tag));
  float c = hash(vec3(i + vec2(0.0, 1.0), tag));
  float d = hash(vec3(i + vec2(1.0, 1.0), tag));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float paperNoise(vec2 p) {
  float cell = uSpacing * 1.2;
  return 0.65 * vnoise(p / cell, uSeed + 31.0) + 0.35 * vnoise(p / (cell * 0.3), uSeed + 37.0);
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float roundedDiamond(vec2 q, float tone, float spacing) {
  float wt = clamp(tone, 0.0, 0.5);
  float denom = 1.0 - ((4.0 - PI) * (1.0 - 2.0 * wt) * (1.0 - 2.0 * wt)) / 4.0;
  float a = spacing * sqrt(max(wt, 0.0) / denom);
  float cr = (a / 2.0) * (1.0 - 2.0 * wt);
  mat2 R = mat2(0.70710678, -0.70710678, 0.70710678, 0.70710678);
  return sdRoundBox(R * q, vec2(a / 2.0), cr);
}
float chan(vec4 t, int i) {
  return i == 0 ? t.r : i == 1 ? t.g : i == 2 ? t.b : t.a;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  float n = (uGrain > 0.0 || uInkfade > 0.0 || uCrumple > 0.0) ? paperNoise(p) : 0.0;
  float grainF = uGrain > 0.0 ? 1.0 - uGrain * 0.22 * (n - 0.5) * 2.0 : 1.0;
  vec3 col = uPaper * grainF;
  float band = uSoften * uSpacing * 0.18;
  float w = 0.75 + band;
  for (int ch = 0; ch < 4; ch++) {
    if (ch >= uCount) break;
    float ca = radians(uAngles[ch] + uAngle);
    float cs = cos(ca);
    float sn = sin(ca);
    vec2 d = p - uCenter;
    vec2 g = vec2(d.x * cs + d.y * sn, -d.x * sn + d.y * cs);
    float md = hash(vec3(float(ch), 11.0, uSeed)) * 6.2831853;
    g -= vec2(cos(md), sin(md)) * (uMisreg * uSpacing * 0.45);
    vec2 cellId = floor(g / uSpacing);
    vec2 jit = (vec2(hash(vec3(cellId, uSeed + float(ch) * 17.0 + 1.0)), hash(vec3(cellId, uSeed + float(ch) * 17.0 + 2.0))) - 0.5) * 2.0 * (uJitter * uSpacing * 0.5);
    vec2 cj = (cellId + 0.5) * uSpacing + jit;
    vec2 img = uCenter + vec2(cj.x * cs - cj.y * sn, cj.x * sn + cj.y * cs);
    float tone = chan(texture(uTone, img / uSize), ch);
    vec2 q = g - cj;
    float cov = 0.0;
    if (uShape == 0) {
      if (tone >= 0.5) {
        cov = 1.0 - smoothstep(-w, w, sdRoundBox(q, vec2(uSpacing / 2.0 + 0.25), 0.12 * uSpacing));
      } else {
        cov = 1.0 - smoothstep(-w, w, roundedDiamond(q, tone, uSpacing));
      }
      for (int ci = 0; ci < 4; ci++) {
        vec2 cornerId = cellId + vec2(float(ci & 1), float((ci >> 1) & 1));
        vec2 corner = cornerId * uSpacing;
        if (length(corner - g) >= uSpacing * 0.6) continue;
        float tAvg = 0.0;
        for (int k = 0; k < 4; k++) {
          vec2 nid = cornerId - vec2(float(k & 1), float((k >> 1) & 1));
          vec2 ng = (nid + 0.5) * uSpacing;
          vec2 nimg = uCenter + vec2(ng.x * cs - ng.y * sn, ng.x * sn + ng.y * cs);
          tAvg += chan(texture(uTone, nimg / uSize), ch);
        }
        tAvg /= 4.0;
        if (tAvg > 0.5) {
          float sdh = length(q - (corner - cj)) - uSpacing * sqrt((1.0 - tAvg) / PI);
          cov *= 1.0 - (1.0 - smoothstep(-0.75, 0.75, sdh));
        }
      }
    } else if (uShape == 1) {
      cov = 1.0 - smoothstep(-w, w, sdRoundBox(q, vec2(uSpacing * sqrt(tone) / 2.0), 0.0));
    } else if (uShape == 2) {
      float sd = (abs(q.x) + abs(q.y) - 0.7 * uSpacing * sqrt(tone)) * 0.70710678;
      cov = 1.0 - smoothstep(-w, w, sd);
    } else {
      cov = 1.0 - smoothstep(-w, w, sdRoundBox(q, vec2(uSpacing / 2.0, uSpacing * tone / 2.0), 0.0));
    }
    vec3 ink = uColors[ch];
    if (uInkvar > 0.0) {
      float f = 1.0 + (hash(vec3(cellId, uSeed + 91.0 + float(ch))) - 0.5) * 0.6 * uInkvar;
      ink = clamp(ink * f, 0.0, 1.0);
    }
    if (uAdditive < 0.5) col *= 1.0 - cov * (1.0 - ink);
    else col += cov * ink;
  }
  if (uInkfade > 0.0) col = mix(col, uPaper, uInkfade * clamp((0.55 - n) * 2.0, 0.0, 1.0));
  if (uSpecks > 0.0) {
    float scell = uSpacing * 6.325;
    vec2 sid = floor(p / scell);
    float h1 = hash(vec3(sid, uSeed + 7.0));
    float thr = uSpecks / 100.0;
    if (h1 < thr) {
      vec2 off = vec2(hash(vec3(sid, uSeed + 71.0)), hash(vec3(sid, uSeed + 72.0)));
      vec2 center = (sid + off) * scell;
      float r = uSpacing * (0.04 + 0.1 * hash(vec3(sid, uSeed + 73.0)));
      float cov = 1.0 - smoothstep(r - 0.75, r + 0.75, length(p - center));
      if (cov > 0.0) {
        col = h1 < thr * 0.35 ? mix(col, vec3(0.078), 0.85 * cov) : mix(col, uPaper, cov);
      }
    }
  }
  if (uCrumple > 0.0) {
    float s5 = paperNoise(p - vec2(1.0, 0.0)) - paperNoise(p + vec2(1.0, 0.0))
      + paperNoise(p - vec2(0.0, 1.0)) - paperNoise(p + vec2(0.0, 1.0));
    float m = min(1.0, abs(s5) * 6.0);
    vec3 shade = s5 > 0.0 ? vec3(1.0, 1.0, 0.98) : vec3(0.078, 0.063, 0.039);
    col = mix(col, shade, uCrumple * m * 0.5);
  }
  outColor = vec4(col, 1.0);
}`;

function initGL() {
  const gl = els.canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false });
  if (!gl) return null;
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const link = (fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, GL_VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  try {
    const progTone = link(GL_FRAG_TONE);
    const progScreen = link(GL_FRAG_SCREEN);
    const srcTex = gl.createTexture();
    const toneTex = gl.createTexture();
    for (const tex of [srcTex, toneTex]) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    const toneFbo = gl.createFramebuffer();
    const loc = (prog, names) => {
      const m = {};
      for (const n of names) m[n] = gl.getUniformLocation(prog, n);
      return m;
    };
    return {
      gl,
      progTone,
      progScreen,
      srcTex,
      toneTex,
      toneFbo,
      uTone: loc(progTone, ['uSrc', 'uSize', 'uSpacing', 'uMode', 'uBrightness', 'uSaturation', 'uContrast', 'uGain', 'uRich', 'uStrength', 'uFadeMul']),
      uScreen: loc(progScreen, ['uTone', 'uSize', 'uCenter', 'uSpacing', 'uAngle', 'uMisreg', 'uJitter', 'uInkvar', 'uSpecks', 'uSoften', 'uGrain', 'uInkfade', 'uCrumple', 'uSeed', 'uCount', 'uShape', 'uAdditive', 'uPaper', 'uColors[0]', 'uAngles[0]']),
      tw: 0,
      th: 0,
    };
  } catch (err) {
    return null;
  }
}

function renderGL(r, source, width, height, opts) {
  const { gl } = r;
  if (els.canvas.width !== width) {
    els.canvas.width = width;
    els.canvas.height = height;
  }
  gl.viewport(0, 0, width, height);
  const screen = SCREENS[opts.mode];
  const count = screen.channels.length;
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  let src = source;
  if (source.width > maxTex || source.height > maxTex) {
    const scale = maxTex / Math.max(source.width, source.height);
    const small = scratchCanvas('glscale', Math.round(source.width * scale), Math.round(source.height * scale));
    small.getContext('2d').drawImage(source, 0, 0, small.width, small.height);
    src = small;
  }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, r.srcTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  if (r.tw !== width || r.th !== height) {
    gl.bindTexture(gl.TEXTURE_2D, r.toneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    r.tw = width;
    r.th = height;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.toneFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.toneTex, 0);
  gl.useProgram(r.progTone);
  gl.uniform1i(r.uTone.uSrc, 0);
  gl.uniform2f(r.uTone.uSize, width, height);
  gl.uniform1f(r.uTone.uSpacing, opts.spacing);
  gl.uniform1i(r.uTone.uMode, { cmyk: 0, rgb: 1, mono: 2 }[opts.mode]);
  gl.uniform1f(r.uTone.uBrightness, opts.brightness);
  gl.uniform1f(r.uTone.uSaturation, opts.saturation);
  gl.uniform1f(r.uTone.uContrast, opts.contrast);
  gl.uniform1f(r.uTone.uGain, opts.gain);
  gl.uniform1f(r.uTone.uRich, opts.rich);
  const strength = [0, 0, 0, 0];
  const fadeMul = [0, 0, 0, 0];
  screen.channels.forEach((ch, i) => {
    strength[i] = ch.strength;
    fadeMul[i] = 1 - opts.sunfade * ch.fadeBias;
  });
  gl.uniform4fv(r.uTone.uStrength, strength);
  gl.uniform4fv(r.uTone.uFadeMul, fadeMul);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.useProgram(r.progScreen);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, r.toneTex);
  const paper = opts.mode === 'rgb' ? [0, 0, 0] : ageColor(hexToRgb(screen.bg()), opts.sunfade);
  gl.uniform1i(r.uScreen.uTone, 0);
  gl.uniform2f(r.uScreen.uSize, width, height);
  gl.uniform2f(r.uScreen.uCenter, width / 2, height / 2);
  gl.uniform1f(r.uScreen.uSpacing, opts.spacing);
  gl.uniform1f(r.uScreen.uAngle, opts.angle);
  gl.uniform1f(r.uScreen.uMisreg, opts.misreg);
  gl.uniform1f(r.uScreen.uJitter, opts.jitter);
  gl.uniform1f(r.uScreen.uInkvar, opts.inkvar);
  gl.uniform1f(r.uScreen.uSpecks, opts.specks);
  gl.uniform1f(r.uScreen.uSoften, opts.soften);
  gl.uniform1f(r.uScreen.uGrain, opts.grain);
  gl.uniform1f(r.uScreen.uInkfade, opts.inkfade);
  gl.uniform1f(r.uScreen.uCrumple, opts.crumple);
  gl.uniform1f(r.uScreen.uSeed, state.seed % 16777216);
  gl.uniform1i(r.uScreen.uCount, count);
  gl.uniform1i(r.uScreen.uShape, { circle: 0, square: 1, diamond: 2, line: 3 }[opts.shape]);
  gl.uniform1f(r.uScreen.uAdditive, screen.composite === 'multiply' ? 0 : 1);
  gl.uniform3f(r.uScreen.uPaper, paper[0] / 255, paper[1] / 255, paper[2] / 255);
  const colors = [];
  const angles = [];
  for (const ch of screen.channels) {
    colors.push(ch.color[0] / 255, ch.color[1] / 255, ch.color[2] / 255);
    angles.push(ch.angle);
  }
  gl.uniform3fv(r.uScreen['uColors[0]'], colors);
  gl.uniform1fv(r.uScreen['uAngles[0]'], angles);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

const glRenderer = initGL();

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
  opts.fast = glRenderer ? false : state.interacting;
  opts.spacing = Math.max(1.5, opts.spacing * (w / out.w));
  if (glRenderer) {
    renderGL(glRenderer, src, w, h, opts);
  } else {
    const halftone = renderHalftone(src, w, h, opts);
    if (els.canvas.width !== w) {
      els.canvas.width = w;
      els.canvas.height = h;
    }
    state.ctx2d.drawImage(halftone, 0, 0);
  }
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
  sampleCache.source = null;
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
    let halftone;
    if (glRenderer) {
      renderGL(glRenderer, state.source, w, h, readOpts());
      halftone = document.createElement('canvas');
      halftone.width = w;
      halftone.height = h;
      halftone.getContext('2d').drawImage(els.canvas, 0, 0);
      renderPreview();
    } else {
      halftone = renderHalftone(state.source, w, h, readOpts());
    }
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
    markInteract();
    scheduleRender();
  })
);

state.ctx2d = glRenderer ? null : els.canvas.getContext('2d');

buildInkControls();
updateLabels();
