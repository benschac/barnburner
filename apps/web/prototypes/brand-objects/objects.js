// Chunky unlit objects: boxes, split tubes, slabs and flat folds. Every face is a
// "window" onto a sheet: the fragment looks its texel up by SCREEN position, so the
// artwork stays upright while the silhouette turns and the part edge crops it.
import * as THREE from 'three';
import { sheet, rng } from './sheets.js';

const VERT = 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRAG = `uniform sampler2D map; uniform vec2 centre; uniform float unit; uniform vec2 off; uniform float rot;
void main(){ vec2 p = (gl_FragCoord.xy - centre) / unit; float c = cos(rot), s = sin(rot); p = mat2(c, -s, s, c) * p;
  gl_FragColor = vec4(texture2D(map, p + off).rgb, 1.0); }`;

const INK = ['plain:wall'];

class Builder {
  constructor(name) { this.name = name; this.parts = []; this.root = new THREE.Group(); this.spin = new THREE.Group(); this.root.add(this.spin); }
  mat(cuts) {
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
      uniforms: { map: { value: null }, centre: { value: new THREE.Vector2() }, unit: { value: 1 }, off: { value: new THREE.Vector2() }, rot: { value: 0 } } });
    this.parts.push({ m, cuts, id: this.parts.length }); return m;
  }
  add(mesh, pos, rot) { if (pos) mesh.position.set(...pos); if (rot) mesh.rotation.set(...rot); this.spin.add(mesh); return mesh; }
  slab(shape, depth, caps, walls = INK, pos, rot) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 40 }); g.translate(0, 0, -depth / 2);
    return this.add(new THREE.Mesh(g, [this.mat(caps), this.mat(walls)]), pos, rot);
  }
  box(w, h, d, faces, pos, rot) { // faces: +x -x +y -y +z -z
    return this.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faces.map((f) => this.mat(f))), pos, rot);
  }
  tube(r, len, a, b, caps, pos, rot) { // axis Y, split lengthwise into two halves
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 40, 1, true, 0, Math.PI), this.mat(a)));
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 40, 1, true, Math.PI, Math.PI), this.mat(b)));
    for (const s of [1, -1]) { const c = new THREE.Mesh(new THREE.CircleGeometry(r, 40), this.mat(caps)); c.rotation.x = -s * Math.PI / 2; c.position.y = s * len / 2; grp.add(c); }
    return this.add(grp, pos, rot);
  }
  fold(pts, cuts) { // flat polygon (fan) through 3D points
    const g = new THREE.BufferGeometry(); const v = []; for (let i = 1; i < pts.length - 1; i++) v.push(...pts[0], ...pts[i], ...pts[i + 1]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); return this.add(new THREE.Mesh(g, this.mat(cuts)));
  }
  gore(r, a0, a1, cuts, pos) { return this.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14, a0, a1 - a0, 0, Math.PI / 2), this.mat(cuts)), pos); }
}

const rect = (x0, y0, x1, y1) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath(); return s; };
const poly = (pts) => { const s = new THREE.Shape(); s.moveTo(...pts[0]); pts.slice(1).forEach((p) => s.lineTo(...p)); s.closePath(); return s; };
const disc = (r, hole) => { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false); if (hole) { const h = new THREE.Path(); h.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(h); } return s; };

export const OBJECTS = {
  puck: { label: 'Puck', use: 'Pick a team', rest: -0.5, tilt: 0.12, zoom: 1.12, build(b) {
    b.slab(disc(1.12, 0.8), 0.34, ['speckle:blue:ink', 'plain:blue', 'stripes:blue:paper', 'type:blue:paper']);
    b.slab(disc(0.8), 0.28, ['type:paper:ink', 'halftone:butter:ink', 'columns:paper:ink', 'rink:paper:blue', 'engrave:paper:ink']);
    b.slab(disc(0.2), 0.4, ['plain:lamp'], INK, [0.36, -0.34, 0]);
  } },
  stick: { label: 'Stick', use: 'Special teams', rest: 0.45, tilt: 0.06, zoom: 0.98, lift: 0.05, build(b) {
    const g = new THREE.Group(); b.spin.add(g); const keep = b.spin; b.spin = g; g.rotation.z = -0.3; g.position.set(-0.28, 0.08, 0);
    const d = 0.16;
    b.slab(rect(-0.13, 1.1, 0.13, 1.42), d, ['plain:lamp']);
    b.slab(rect(-0.13, 0.62, 0.13, 1.1), d, ['stripes:ink:paper', 'plain:ink', 'stripes:paper:ink']);
    b.slab(rect(-0.13, -1.0, 0.13, 0.62), d, ['type:tan:ink', 'engrave:tan:ink', 'plain:tan', 'columns:paper:ink']);
    const blade = new THREE.Shape(); blade.moveTo(-0.13, -1.0); blade.lineTo(0.13, -1.0); blade.lineTo(0.42, -1.12); blade.lineTo(1.38, -1.04); blade.quadraticCurveTo(1.6, -1.2, 1.44, -1.44); blade.lineTo(0.2, -1.5); blade.quadraticCurveTo(-0.2, -1.46, -0.13, -1.0);
    b.slab(blade, d, ['scribble:teal:ink', 'stripes:teal:ink', 'plain:teal', 'halftone:paper:ink']);
    b.spin = keep;
  } },
  lamp: { label: 'Goal lamp', use: 'New results', rest: 0.5, tilt: 0.2, zoom: 1.22, lift: 0.22, build(b) {
    b.box(1.5, 0.62, 1.1, [['stripes:plum:paper', 'plain:plum'], ['plain:plum', 'stripes:plum:paper'], INK, INK, ['columns:paper:ink', 'grid:paper:ink', 'plain:butter', 'type:paper:ink'], ['grid:paper:ink', 'type:paper:ink', 'plain:butter']], [0, -0.72, 0]);
    b.tube(0.66, 0.16, INK, INK, INK, [0, -0.33, 0]);
    const p = [0, -0.25, 0], q = Math.PI / 2;
    b.gore(0.6, 0, q, ['plain:lamp'], p);
    b.gore(0.6, q, 2 * q, ['halftone:butter:ink', 'plain:butter', 'engrave:paper:ink'], p);
    b.gore(0.6, 2 * q, 3 * q, ['plain:ink', 'stripes:ink:paper', 'plain:plum'], p);
    b.gore(0.6, 3 * q, 4 * q, ['speckle:butter:ink', 'type:paper:ink', 'plain:butter'], p);
  } },
  net: { label: 'Net', use: 'Standings', rest: -0.55, tilt: 0.16, zoom: 1.12, build(b) {
    const W = 1.15, T = 0.72, B = -0.72, F = 0.5, M = 0.1, K = -0.5, r = 0.085;
    b.fold([[-W, T, M], [W, T, M], [W, B, K], [-W, B, K]], ['mesh:paper:blue', 'type:paper:ink', 'grid:crease:ink', 'engrave:paper:ink']);
    b.fold([[-W, T, F], [-W, T, M], [-W, B, K], [-W, B, F]], ['halftone:crease:ink', 'plain:blue', 'stripes:blue:paper']);
    b.fold([[W, T, F], [W, T, M], [W, B, K], [W, B, F]], ['type:crease:ink', 'plain:crease', 'stripes:crease:ink']);
    b.fold([[-W, T, F], [W, T, F], [W, T, M], [-W, T, M]], ['plain:ink', 'stripes:ink:paper']);
    b.fold([[-W, B, F], [W, B, F], [W, B, K], [-W, B, K]], ['plain:ink']);
    b.tube(r, T - B + r, ['plain:lamp'], INK, INK, [-W, (T + B) / 2, F]);
    b.tube(r, T - B + r, ['plain:lamp'], INK, INK, [W, (T + B) / 2, F]);
    b.tube(r, 2 * W + 2 * r, ['plain:lamp'], INK, INK, [0, T, F], [0, 0, Math.PI / 2]);
  } },
  skate: { label: 'Skate', use: 'Player leaders', rest: -0.4, tilt: 0.08, zoom: 1.15, build(b) {
    const boot = new THREE.Shape(); boot.moveTo(-0.78, -0.3); boot.lineTo(0.9, -0.3); boot.quadraticCurveTo(1.12, -0.26, 1.04, 0.0); boot.quadraticCurveTo(0.9, 0.24, 0.5, 0.3); boot.lineTo(0.12, 0.52); boot.lineTo(0.06, 0.74); boot.lineTo(-0.7, 0.74); boot.closePath();
    b.slab(boot, 0.36, ['engrave:plum:ink', 'type:paper:ink', 'plain:plum', 'halftone:plum:paper', 'scribble:crease:ink']);
    b.slab(poly([[-0.72, 0.74], [0.08, 0.74], [0.02, 1.16], [-0.66, 1.2]]), 0.42, ['stripes:crease:ink', 'plain:crease', 'speckle:crease:ink']);
    b.slab(poly([[-0.9, 0.2], [-0.74, 0.2], [-0.7, 0.74], [-0.86, 0.74]]), 0.22, ['plain:lamp']);
    const hold = new THREE.Shape(); hold.moveTo(-0.66, -0.3); hold.lineTo(0.84, -0.3); hold.lineTo(0.72, -0.62); hold.lineTo(-0.58, -0.62); hold.closePath();
    const h1 = new THREE.Path(); h1.moveTo(-0.3, -0.38); h1.lineTo(0.0, -0.38); h1.lineTo(-0.04, -0.54); h1.lineTo(-0.26, -0.54); h1.closePath(); hold.holes.push(h1);
    const h2 = new THREE.Path(); h2.moveTo(0.2, -0.38); h2.lineTo(0.52, -0.38); h2.lineTo(0.46, -0.54); h2.lineTo(0.24, -0.54); h2.closePath(); hold.holes.push(h2);
    b.slab(hold, 0.18, ['grid:paper:ink', 'plain:paper', 'plain:crease']);
    const blade = new THREE.Shape(); blade.moveTo(-0.84, -0.62); blade.lineTo(0.96, -0.62); blade.quadraticCurveTo(1.12, -0.66, 1.0, -0.8); blade.lineTo(-0.8, -0.8); blade.quadraticCurveTo(-0.94, -0.72, -0.84, -0.62);
    b.slab(blade, 0.08, ['plain:wall']);
  } },
  resurfacer: { label: 'Resurfacer', use: 'Fresh data', rest: -0.65, tilt: 0.22, build(b) {
    const g = new THREE.Group(); b.spin.add(g); const keep = b.spin; b.spin = g; g.scale.setScalar(0.95); g.position.y = -0.05;
    const side = ['scribble:teal:ink', 'type:paper:ink', 'plain:teal', 'stripes:teal:paper'];
    b.box(2.5, 0.8, 1.3, [['plain:butter', 'stripes:butter:ink'], ['plain:ink'], ['speckle:butter:ink', 'plain:butter', 'grid:paper:ink'], INK, side, side], [0, -0.1, 0]);
    b.box(0.8, 0.66, 1.0, [['plain:paper', 'halftone:butter:ink'], ['plain:paper'], INK, INK, ['engrave:paper:ink', 'plain:paper', 'halftone:paper:ink'], ['plain:paper']], [-0.5, 0.63, 0]);
    b.box(0.95, 0.4, 1.3, [['stripes:butter:ink', 'plain:butter'], INK, ['plain:teal', 'speckle:teal:ink'], INK, ['columns:paper:ink', 'plain:butter', 'stripes:butter:ink'], ['plain:butter']], [0.72, 0.5, 0]);
    b.tube(0.11, 0.2, ['plain:lamp'], ['plain:lamp'], ['plain:lamp'], [-0.5, 1.06, 0]);
    for (const x of [-0.75, 0.75]) for (const z of [-0.68, 0.68]) b.tube(0.36, 0.22, INK, INK, ['stripes:paper:ink', 'plain:paper'], [x, -0.56, z], [Math.PI / 2, 0, 0]);
    b.spin = keep;
  } },
};

export function makeObject(key) {
  const def = OBJECTS[key]; const b = new Builder(key); def.build(b); b.root.rotation.x = def.tilt; b.root.scale.setScalar(def.zoom || 1); b.root.position.y = def.lift || 0; b.def = def; return b;
}

// frame k: a twelfth of a turn, and every part takes the next cutting at a fresh offset
export function setFrame(b, k, pal, px, scale = 0.78) {
  b.spin.rotation.y = b.def.rest + (k * Math.PI) / 6;
  for (const part of b.parts) {
    const i = k % part.cuts.length; const [kind, bg, fg] = part.cuts[i].split(':');
    const r = rng(`${b.name}|${part.id}|${k}`); const u = part.m.uniforms;
    u.map.value = sheet(kind, bg, fg, pal, (part.id + i) % 3); u.centre.value.set(px / 2, px / 2); u.unit.value = px * scale;
    u.off.value.set(r(), r()); u.rot.value = kind === 'plain' ? 0 : [0, 0, 0.14, -0.1, 0.3][Math.floor(r() * 5)];
  }
}
