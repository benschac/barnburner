// Seeded Canvas2D "cuttings". Every sheet renders identically on each visit.
import * as THREE from 'three';

const S = 1024;
const ok = (l, c, h) => `oklch(${l} ${c} ${h})`;

export const PALETTES = {
  light: {
    tile: ok(0.925, 0.006, 90), page: ok(0.968, 0.008, 90), text: ok(0.235, 0.018, 265), soft: ok(0.47, 0.02, 265),
    ink: ok(0.2, 0.015, 265), wall: ok(0.2, 0.015, 265), paper: ok(0.955, 0.018, 88),
    blue: ok(0.56, 0.095, 245), crease: ok(0.82, 0.06, 228), teal: ok(0.72, 0.085, 172), butter: ok(0.84, 0.115, 88),
    tan: ok(0.74, 0.075, 62), plum: ok(0.6, 0.085, 335), lamp: ok(0.665, 0.17, 33),
  },
  dark: {
    tile: ok(0.235, 0.014, 255), page: ok(0.19, 0.012, 255), text: ok(0.93, 0.02, 88), soft: ok(0.72, 0.02, 255),
    ink: ok(0.2, 0.015, 265), wall: ok(0.93, 0.03, 70), paper: ok(0.955, 0.018, 88),
    blue: ok(0.68, 0.095, 245), crease: ok(0.86, 0.06, 228), teal: ok(0.8, 0.085, 172), butter: ok(0.88, 0.115, 88),
    tan: ok(0.8, 0.075, 62), plum: ok(0.72, 0.085, 335), lamp: ok(0.7, 0.165, 33),
  },
};

function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
export function rng(seed) { let a = typeof seed === 'string' ? hash(seed) : seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

const WORDS = ['27', 'OT', '3–2', 'PP', 'SO', '19', 'GOAL', 'ICING', 'SAVE', '5 ON 4', 'PIM', '88', 'W', 'L', 'FINAL', '2ND'];

const DRAW = {
  plain() {},
  type(g, r, bg, fg) {
    const n = 1 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const size = 300 + r() * 300;
      g.save(); g.translate(r() * S, r() * S); g.rotate(pick(r, [0, 0, -Math.PI / 2, Math.PI / 2, 0.12, -0.2]));
      g.font = `${pick(r, ['400', '700'])} ${size}px ${pick(r, ['Graduate', 'Graduate', 'RobotoC'])}`; g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(pick(r, WORDS), 0, 0); g.restore();
    }
  },
  stripes(g, r, bg, fg) {
    const w = 46 + r() * 70; g.save(); g.translate(S / 2, S / 2); g.rotate(pick(r, [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, 0.5])); g.fillStyle = fg;
    for (let x = -S; x < S; x += w * 2) g.fillRect(x, -S, w, S * 2); g.restore();
  },
  grid(g, r, bg, fg) {
    const c = 128; g.strokeStyle = fg; g.fillStyle = fg; g.lineWidth = 6;
    for (let i = 0; i <= S; i += c) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
    g.font = '700 84px RobotoC'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let y = 0; y < S; y += c) for (let x = 0; x < S; x += c) { const v = r(); if (v < 0.14) g.fillRect(x, y, c, c); else if (v < 0.5) g.fillText(String(Math.floor(r() * 10)), x + c / 2, y + c / 2 + 4); }
    g.fillRect(0, pick(r, [0, 256, 512]), S, 36);
  },
  halftone(g, r, bg, fg) {
    const blobs = [0, 1, 2].map(() => [r() * S, r() * S, 180 + r() * 260]); const step = 30; g.fillStyle = fg;
    for (let y = 0; y < S; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < S; x += step) {
      let v = 0; for (const [bx, by, br] of blobs) { const d = Math.hypot(x - bx, y - by); v += Math.exp(-(d * d) / (2 * br * br)); }
      const rad = Math.min(1, v) * step * 0.62; if (rad > 1.5) { g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
    }
  },
  rink(g, r, bg, fg) {
    g.strokeStyle = fg; g.fillStyle = fg; g.lineWidth = 34; const cx = 300 + r() * 420, cy = 300 + r() * 420;
    g.beginPath(); g.arc(cx, cy, 300, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, 44, 0, 7); g.fill();
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { g.fillRect(cx + sx * 90 - 14, cy + sy * 300 - (sy > 0 ? 0 : 110), 28, 110); }
    g.fillRect(0, (cy + 520) % S, S, 54); g.fillRect((cx + 560) % S, 0, 90, S);
  },
  scribble(g, r, bg, fg) {
    g.strokeStyle = fg; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 9; i++) {
      const x = r() * S, y = r() * S, s = 60 + r() * 60; g.lineWidth = 16 + r() * 8;
      if (r() < 0.5) { g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x + s, y + s + r() * 12); g.moveTo(x + s, y - s); g.lineTo(x - s, y + s); g.stroke(); }
      else { g.beginPath(); g.ellipse(x, y, s, s * (0.8 + r() * 0.3), r(), 0.3, 6.6); g.stroke(); }
    }
    for (let i = 0; i < 3; i++) {
      const x0 = r() * S, y0 = r() * S, x1 = r() * S, y1 = r() * S; g.lineWidth = 18;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(r() * S, r() * S, x1, y1); g.stroke();
      const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1 - 70 * Math.cos(a - 0.5), y1 - 70 * Math.sin(a - 0.5)); g.lineTo(x1, y1); g.lineTo(x1 - 70 * Math.cos(a + 0.5), y1 - 70 * Math.sin(a + 0.5)); g.stroke();
    }
    g.lineWidth = 14; g.beginPath(); let x = 80, y = 900; g.moveTo(x, y); for (let i = 0; i < 14; i++) { x += 60; g.quadraticCurveTo(x - 30, y + (i % 2 ? 60 : -60), x, y); } g.stroke();
  },
  columns(g, r, bg, fg) {
    g.fillStyle = fg; g.font = '400 210px Graduate'; g.textBaseline = 'top'; g.fillText(pick(r, ['FINAL', 'OVERTIME', 'SHUTOUT', 'ICE NEWS']), 30, 20);
    g.fillRect(30, 250, S - 60, 14); g.fillRect(30, 276, S - 60, 4);
    const cols = 3, cw = (S - 60 - (cols - 1) * 40) / cols;
    for (let c = 0; c < cols; c++) { const x = 30 + c * (cw + 40); let y = 320;
      if (c === 1) { g.fillRect(x, y, cw, 300); y += 330; }
      while (y < S - 20) { const para = 4 + Math.floor(r() * 7); for (let i = 0; i < para && y < S - 20; i++) { g.fillRect(x, y, i === para - 1 ? cw * (0.3 + r() * 0.5) : cw, 13); y += 30; } y += 22; } }
  },
  engrave(g, r, bg, fg) {
    const blobs = [0, 1, 2, 3].map(() => [r() * S, r() * S, 120 + r() * 240]); const ph = r() * 6; g.fillStyle = fg;
    for (let row = -4; row < S / 20 + 4; row++) for (let x = 0; x < S; x += 4) {
      const y = row * 20 + Math.sin(x / 90 + ph + row * 0.15) * 26 + Math.sin(x / 31 + row) * 4;
      let v = 0; for (const [bx, by, br] of blobs) { const d = Math.hypot(x - bx, y - by); v += Math.exp(-(d * d) / (2 * br * br)); }
      const t = 1.5 + Math.min(1, v) * 14; g.fillRect(x, y - t / 2, 4.5, t);
    }
  },
  speckle(g, r, bg, fg) {
    g.fillStyle = fg; for (let i = 0; i < 26000; i++) { const s = r() < 0.9 ? 2.5 : 6; g.globalAlpha = 0.35 + r() * 0.5; g.fillRect(r() * S, r() * S, s, s); } g.globalAlpha = 1;
  },
  mesh(g, r, bg, fg) {
    g.strokeStyle = fg; g.lineWidth = 12; const d = 110;
    for (let i = -S; i < S * 2; i += d) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.moveTo(i, 0); g.lineTo(i - S, S); g.stroke(); }
  },
};

const cache = new Map();
export function sheet(kind, bg, fg, pal, variant = 0) {
  const key = `${kind}|${bg}|${fg}|${variant}|${pal.wall}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = pal[bg]; g.fillRect(0, 0, S, S);
  DRAW[kind](g, rng(`${kind}|${bg}|${fg}|${variant}`), pal[bg], pal[fg || 'ink']);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.userData.canvas = c; cache.set(key, t); return t;
}
export const KINDS = Object.keys(DRAW);
