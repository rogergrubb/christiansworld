// Legendary gear: eight hand-built showpieces, bought with mission money in the Toolbox.
// Unlike the blocky tools these are modelled in full detail: lathed and extruded metal, tapered tendrils,
// painted textures and glowing parts that move. Every design here is Christian's own. Nothing is copied from a film or comic.
// Each builder returns a group whose grip sits at the origin with the business end along +Y, and a tick(t, hot) that animates it.
import * as THREE from './three.js';
import { glowTexture } from './fx.js';

const TAU = Math.PI * 2;
const STAFF = { r: 0.75, carry: 0.5, use: 0.95 }, GUN = { r: Math.PI, carry: 0.05, use: 1.45 };

// price: mission money.  stats: power, speed, reach out of 5.  hold: how the arm carries and uses it (see Toolbox).
// swing/arc: a slash that lands `swing` metres ahead and catches everything within `arc`.  The rest reads like a blaster.
export const RELICS = [
  { id: 'goo', icon: '🗡️', name: 'Midnight Goo Blade', price: 150, verb: 'Slash', use: 'A living sword of black goo. To slash, [F]. Robots go flying.', tale: 'It drips. It wiggles. It is on your side.', swing: 1.7, arc: 3.2, cool: 0.42, dmg: 3, color: 0xb45cff, fx: 'knock', stats: [4, 4, 2], hold: { r: 1.4, carry: 0.6, sweep: [2.0, 0.1] } },
  { id: 'katana', icon: '⚔️', name: 'Crystal Katana', price: 300, verb: 'Slash', use: 'The fastest blade on the island. To slash, [hold F].', tale: 'Grown, not forged. It hums when robots are near.', swing: 1.5, arc: 2.5, cool: 0.2, dmg: 1.5, color: 0x7fe3ff, fx: 'hit', stats: [2, 5, 2], hold: { r: 1.4, carry: 0.6, sweep: [1.9, 0.2] } },
  { id: 'baton', icon: '⏳', name: 'Time Baton', price: 500, verb: 'Stop time', use: 'Stops the clock. Every robot around you stands still for seven seconds.', tale: 'Borrowed from a clockmaker who was never late.', radius: 16, cool: 6, dmg: 0, stun: 7, color: 0xffb23e, fx: 'stun', stats: [1, 2, 4], hold: { r: 0.9, carry: 0.5, use: 1.5 } },
  { id: 'bow', icon: '🏹', name: 'Galaxy Bow', price: 650, verb: 'Shoot', use: 'Star arrows that fly far and dead straight. To shoot, [hold F].', tale: 'Strung with a thread pulled out of the night sky.', rate: 2.6, speed: 75, grav: 1.5, spread: 0.004, dmg: 3, reach: 80, size: 0.14, long: 7, color: 0x9d7bff, fx: 'hit', stats: [3, 3, 5], hold: GUN },
  { id: 'trident', icon: '🔱', name: 'Storm Trident', price: 800, verb: 'Zap', use: 'Throws lightning. Every bolt stuns the robot it lands on.', tale: 'Fished out of a thundercloud.', rate: 5, speed: 80, grav: 0, spread: 0.01, dmg: 2, reach: 60, size: 0.15, long: 6, color: 0x58b8ff, fx: 'stun', stats: [3, 4, 4], hold: STAFF },
  { id: 'glove', icon: '🧤', name: 'Gravity Glove', price: 1000, verb: 'Lift', use: 'Raise your fist and every robot nearby floats off the ground.', tale: 'Rocks follow it around like puppies.', radius: 10, cool: 3.2, dmg: 1, color: 0xc77dff, fx: 'bubble', stats: [2, 2, 3], hold: { r: Math.PI, carry: 0, use: 2.7 } },
  { id: 'meteor', icon: '☄️', name: 'Meteor Staff', price: 1400, verb: 'Launch', use: 'Lobs a burning rock. Everything where it lands is blown away.', tale: 'The rock on top is still warm from space.', rate: 1.1, speed: 24, grav: 12, spread: 0, dmg: 5, splash: 6, reach: 40, size: 0.5, color: 0xff7a1a, fx: 'knock', stats: [4, 2, 3], hold: STAFF },
  { id: 'smasher', icon: '⚛️', name: 'Atom Smasher', price: 2000, verb: 'Fire', use: 'Four barrels, one enormous blast. The biggest boom on the island.', tale: 'Warning label: do not point at the moon.', rate: 0.55, speed: 42, grav: 0, spread: 0, dmg: 9, splash: 9, reach: 70, size: 0.55, long: 1.6, color: 0x39f0ff, fx: 'boom', stats: [5, 1, 5], hold: GUN },
].map((r) => ({ kind: 'relic', relic: true, ...r }));

// ------------------------------------------------------------------ painted textures
const rng = (s) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function paint(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h, rng(o.seed || 7));
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.data ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());
const rep = (t, x, y) => { const q = t.clone(); q.repeat.set(x, y); q.needsUpdate = true; return q; };

const T = {
  // what the shiny parts reflect: a bright studio with a warm floor and three soft lamps
  env: () => once('env', () => { const t = paint(1024, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#f4fbff'); sky.addColorStop(0.42, '#9fc4e8'); sky.addColorStop(0.5, '#e9eef2'); sky.addColorStop(0.56, '#5b5148'); sky.addColorStop(1, '#17130f');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (const [x, y, rw, rh, c] of [[180, 120, 190, 60, '#ffffff'], [560, 90, 120, 90, '#fff4d8'], [840, 150, 220, 40, '#dff1ff'], [380, 205, 60, 26, '#ffffff']]) { const r = g.createRadialGradient(x, y, 2, x, y, rw); r.addColorStop(0, c); r.addColorStop(0.35, c); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.save(); g.translate(x, y); g.scale(1, rh / rw); g.translate(-x, -y); g.fillRect(x - rw, y - rw, rw * 2, rw * 2); g.restore(); }
  }); t.mapping = THREE.EquirectangularReflectionMapping; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }),
  // fine scratches along the grain of machined metal
  brushed: () => once('brushed', () => paint(512, 512, (g, w, h, r) => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5200; i++) { const v = 90 + r() * 110 | 0; g.strokeStyle = `rgba(${v},${v},${v},${0.05 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 1.2; const y = r() * h, x = r() * w, l = 30 + r() * 220; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5) * 2); g.stroke(); } }, { data: true })),
  // soft lumps: goo, stone, leather, bark
  lumps: () => once('lumps', () => paint(512, 512, (g, w, h, r) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { const x = r() * w, y = r() * h, q = 6 + r() * 34, v = r() < 0.5 ? 255 : 0, a = 0.04 + r() * 0.1; for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, q); gr.addColorStop(0, `rgba(${v},${v},${v},${a})`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(x + ox - q, y + oy - q, q * 2, q * 2); } } }, { data: true, seed: 11 })),
  // plates, seams and rivets
  panels: () => once('panels', () => paint(1024, 1024, (g, w, h, r) => { g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2c2c2c'; g.lineWidth = 5;
    for (let y = 0; y < h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); let x = r() * 90; while (x < w) { const pw = 110 + r() * 190; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 128); g.stroke(); for (const [dx, dy] of [[14, 14], [14, 114], [pw - 14, 14], [pw - 14, 114]]) { g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(x + dx, y + dy, 6, 0, TAU); g.fill(); g.fillStyle = '#555'; g.beginPath(); g.arc(x + dx, y + dy, 2.2, 0, TAU); g.fill(); } if (r() < 0.4) { g.fillStyle = '#6e6e6e'; for (let k = 0; k < 4; k++) g.fillRect(x + 34 + k * 14, y + 44, 7, 40); } x += pw; } }
    for (let i = 0; i < 2600; i++) { const v = 120 + r() * 100 | 0; g.fillStyle = `rgba(${v},${v},${v},0.1)`; g.fillRect(r() * w, r() * h, 1 + r() * 40, 1); } }, { data: true, seed: 3 })),
  // cord wound in diamonds over a ray-skin grip
  wrap: () => once('wrap', () => paint(256, 512, (g, w, h, r) => { g.fillStyle = '#e9e2cf'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.5)' : 'rgba(150,140,110,.4)'; g.beginPath(); g.arc(r() * w, r() * h, 1.5 + r() * 2, 0, TAU); g.fill(); }
    const n = 8, s = h / n; for (let k = -1; k <= n; k++) for (const dir of [1, -1]) { g.save(); g.translate(w / 2, k * s + s / 2); g.transform(1, dir * (s / w), 0, 1, 0, 0); const gr = g.createLinearGradient(0, -s * 0.33, 0, s * 0.33); gr.addColorStop(0, '#0b1a3a'); gr.addColorStop(0.5, '#27478f'); gr.addColorStop(1, '#0b1a3a'); g.fillStyle = gr; g.fillRect(-w, -s * 0.31, w * 2, s * 0.62); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; for (let q = -5; q <= 5; q++) { g.beginPath(); g.moveTo(-w, q * s * 0.055); g.lineTo(w, q * s * 0.055); g.stroke(); } g.restore(); } })),
  // a clock face with no numbers, only marks
  clock: () => once('clock', () => paint(512, 512, (g, w) => { const c = w / 2; g.fillStyle = '#1b130a'; g.fillRect(0, 0, w, w); const f = g.createRadialGradient(c, c, 10, c, c, c); f.addColorStop(0, '#fff6dc'); f.addColorStop(0.8, '#f0d9a0'); f.addColorStop(1, '#c79b4a'); g.fillStyle = f; g.beginPath(); g.arc(c, c, c - 14, 0, TAU); g.fill();
    g.strokeStyle = '#2a1d0c'; g.lineCap = 'round'; for (let i = 0; i < 60; i++) { const a = (i / 60) * TAU, big = i % 5 === 0, r0 = c - (big ? 70 : 42), r1 = c - 26; g.lineWidth = big ? 9 : 3; g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.arc(c, c, c - 96, 0, TAU); g.stroke(); g.lineWidth = 14; g.beginPath(); g.moveTo(c, c); g.lineTo(c + 70, c - 96); g.stroke(); g.lineWidth = 8; g.beginPath(); g.moveTo(c, c); g.lineTo(c - 120, c - 60); g.stroke(); g.fillStyle = '#b3261e'; g.beginPath(); g.arc(c, c, 16, 0, TAU); g.fill(); })),
  // deep space: clouds of colour and a great many stars
  galaxy: () => once('galaxy', () => paint(1024, 512, (g, w, h, r) => { g.fillStyle = '#0a0620'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h, q = 50 + r() * 150, c = ['90,40,200', '30,90,220', '210,50,170', '20,170,190'][i % 4]; for (const ox of [0, w, -w]) { const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, q); gr.addColorStop(0, `rgba(${c},0.3)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x + ox - q, y - q, q * 2, q * 2); } }
    for (let i = 0; i < 900; i++) { const s = r() ** 3 * 2.6 + 0.4; g.fillStyle = `rgba(255,${230 + r() * 25 | 0},${200 + r() * 55 | 0},${0.5 + r() * 0.5})`; g.beginPath(); g.arc(r() * w, r() * h, s, 0, TAU); g.fill(); } }, { seed: 21 })),
  // molten cracks in black rock; the same picture lights the rock up
  lava: () => once('lava', () => paint(1024, 512, (g, w, h, r) => { g.fillStyle = '#0d0907'; g.fillRect(0, 0, w, h); g.lineCap = 'round'; g.lineJoin = 'round';
    const crack = (x, y, a, len, wd) => { g.beginPath(); g.moveTo(x, y); for (let k = 0; k < len; k++) { a += (r() - 0.5) * 1.3; x += Math.cos(a) * 22; y += Math.sin(a) * 22; g.lineTo(x, y); if (r() < 0.22 && wd > 2) crack(x, y, a + (r() < 0.5 ? 1 : -1), len * 0.5 | 0, wd * 0.6); } g.lineWidth = wd; g.stroke(); };
    for (const [col, k, blur] of [['#ff3d00', 2.6, 18], ['#ff9a1f', 1.3, 6], ['#fff3b0', 0.45, 0]]) { g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = blur; r = rng(5); for (let i = 0; i < 26; i++) crack(r() * w, r() * h, r() * TAU, 9, (3 + r() * 4) * k); } }, { seed: 5 })),
  // a band of made-up marks that glow
  marks: () => once('marks', () => paint(1024, 128, (g, w, h, r) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 8;
    for (let x = 34; x < w - 20; x += 62) { const k = r() * 5 | 0; g.beginPath(); if (k === 0) { g.arc(x, 64, 20, 0, TAU); g.moveTo(x, 44); g.lineTo(x, 84); } else if (k === 1) { g.moveTo(x - 18, 90); g.lineTo(x, 34); g.lineTo(x + 18, 90); } else if (k === 2) { g.moveTo(x - 16, 38); g.lineTo(x + 16, 38); g.moveTo(x, 38); g.lineTo(x, 92); g.moveTo(x - 12, 70); g.lineTo(x + 12, 70); } else if (k === 3) { g.moveTo(x - 16, 36); g.lineTo(x + 16, 64); g.lineTo(x - 16, 92); } else { g.arc(x, 64, 22, 0.6, TAU - 0.6); g.moveTo(x - 4, 64); g.lineTo(x + 4, 64); } g.stroke(); } }, { seed: 9 })),
};

// ------------------------------------------------------------------ materials
const std = (o) => new THREE.MeshStandardMaterial({ envMap: T.env(), envMapIntensity: 1, ...o });
const phys = (o) => new THREE.MeshPhysicalMaterial({ envMap: T.env(), envMapIntensity: 1, ...o });
const M = {
  metal: (color, rough = 0.32, o = {}) => std({ color, metalness: 1, roughness: rough, roughnessMap: T.brushed(), bumpMap: T.brushed(), bumpScale: 0.25, envMapIntensity: 1.25, ...o }),
  gold: (rough = 0.26) => M.metal(0xf0b23a, rough),
  steel: (rough = 0.3) => M.metal(0xc9d2dc, rough),
  iron: () => M.metal(0x3a3f47, 0.55, { bumpMap: T.lumps(), bumpScale: 1.2 }),
  plate: (color, o = {}) => phys({ color, metalness: 0.75, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, bumpMap: T.panels(), bumpScale: 1.6, roughnessMap: T.panels(), ...o }),
  glow: (color, k = 2) => std({ color: 0x000000, emissive: color, emissiveIntensity: k, roughness: 0.4, envMapIntensity: 0.2 }),
  glass: (color, o = {}) => phys({ color, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.34, envMapIntensity: 2.2, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, ...o }),
  goo: () => phys({ color: 0x030306, metalness: 0, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, bumpMap: rep(T.lumps(), 2, 4), bumpScale: 0.8, envMapIntensity: 1.0, sheen: 0.6, sheenColor: new THREE.Color(0x3a1a9a), sheenRoughness: 0.3 }),
  leather: (color) => std({ color, metalness: 0, roughness: 0.7, bumpMap: rep(T.lumps(), 4, 4), bumpScale: 1.5, envMapIntensity: 0.5 }),
  wood: (color) => std({ color, metalness: 0, roughness: 0.62, bumpMap: rep(T.brushed(), 1, 6), bumpScale: 2.2, envMapIntensity: 0.6 }),
};

// ------------------------------------------------------------------ shapes
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function put(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; }
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const ring = (r, t, seg = 64) => new THREE.TorusGeometry(r, t, 12, seg);
const ball = (r, seg = 32) => new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1));
const rod = (r, h, seg = 24, r2 = r) => new THREE.CylinderGeometry(r2, r, h, seg);
// A hose along a curve. taper(u) scales its thickness from one end (0) to the other (1), so tendrils and claws come to a point.
function tube(pts, r, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => V(p[0], p[1], p[2])), !!o.closed), seg = o.seg || 56, rs = o.rs || 10, g = new THREE.TubeGeometry(curve, seg, r, rs, !!o.closed);
  if (o.taper || o.flat) {
    const pos = g.attributes.position, c = V(0, 0, 0), v = V(0, 0, 0);
    for (let i = 0; i <= seg; i++) { curve.getPointAt(i / seg, c); const k = o.taper ? o.taper(i / seg) : 1; for (let j = 0; j <= rs; j++) { const n = i * (rs + 1) + j; v.fromBufferAttribute(pos, n).sub(c).multiplyScalar(k); if (o.flat) v[o.flat[0]] *= o.flat[1]; v.add(c); pos.setXYZ(n, v.x, v.y, v.z); } }
    g.computeVertexNormals();
  }
  return g;
}
// A flat outline given thickness, with its rim ground down to an edge.
function slab(outline, depth, edge, inset) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y))), { depth, bevelEnabled: true, bevelThickness: edge, bevelSize: inset, bevelOffset: -inset, bevelSegments: 2, steps: 1, curveSegments: 16 });
  g.translate(0, 0, -depth / 2); return g;
}
function halo(parent, color, size, x = 0, y = 0, z = 0, k = 1) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: k, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(size); s.position.set(x, y, z); parent.add(s); return s; }
// rings of the same thing round the Y axis
function around(n, f, a0 = 0) { for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; f(Math.cos(a), Math.sin(a), a, i); } }

// ------------------------------------------------------------------ the eight
const BUILD = {
  // A sword that is alive: a wavy black blade, tendrils winding up it, a violet vein that beats like a pulse.
  goo() {
    const g = new THREE.Group(), goo = M.goo(), vein = M.glow(0xb45cff, 2), sway = [], drips = [];
    const L = 1.34, y0 = 0.1, N = 46, R = [], Lf = [];
    for (let i = 0; i <= N; i++) { const u = i / N, w = 0.118 * (1 - Math.min(u, 0.955) ** 1.7) * (u > 0.955 ? (1 - u) / 0.045 : 1) + 0.012 * (1 - u), y = y0 + u * L; R.push([w + Math.sin(u * 14) * 0.024 * (1 - u), y]); if (i < N) Lf.push([-w - Math.abs(Math.sin(u * 9 + 0.5)) * 0.034 * (1 - u), y]); }
    put(g, slab([...R, ...Lf.reverse()], 0.03, 0.022, 0.03), goo);
    for (const s of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push([Math.sin(u * 11) * 0.03 * (1 - u), y0 + 0.03 + u * L * 0.9, s * 0.036]); }
      put(g, tube(pts, 0.011, { taper: (u) => 1.15 - u, rs: 6 }), vein);
      for (const [u0, dx] of [[0.18, 0.06], [0.33, -0.07], [0.5, 0.05], [0.66, -0.04]]) { const y = y0 + u0 * L * 0.9, x = Math.sin(u0 * 11) * 0.03; put(g, tube([[x, y, s * 0.036], [x + dx * 0.5, y + 0.035, s * 0.034], [x + dx, y + 0.1, s * 0.026]], 0.006, { taper: (u) => 1 - u * 0.9, rs: 5, seg: 12 }), vein); }
    }
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * TAU, top = 0.38 + (k % 3) * 0.14, pts = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12, rr = 0.11 - 0.055 * t, a = a0 + t * (3.6 + (k % 2)); pts.push([Math.cos(a) * rr * 1.25, 0.03 + t * top, Math.sin(a) * rr * 0.62]); }
      const m = put(g, tube(pts, 0.027, { taper: (u) => (1 - u) ** 0.8 + 0.03 }), goo); sway.push(m);
    }
    for (const s of [-1, 1]) put(g, tube([[s * 0.04, 0.06, 0], [s * 0.19, 0.01, 0.01], [s * 0.31, 0.08, 0], [s * 0.3, 0.2, -0.01], [s * 0.23, 0.25, 0]], 0.046, { taper: (u) => (1 - u) ** 0.7 + 0.04, rs: 12 }), goo);
    for (const [x, y, r0] of [[0.07, 0.34, 0.03], [-0.085, 0.48, 0.024], [0.06, 0.62, 0.02], [-0.06, 0.78, 0.022], [0.035, 0.95, 0.016], [-0.03, 1.1, 0.013], [0.09, 0.22, 0.022]]) for (const s of [-1, 1]) put(g, ball(r0, 16), goo, x, y, s * 0.022).scale.set(1, 1.5, 0.7);
    const hub = put(g, ball(0.1), goo, 0, 0.07, 0); hub.scale.set(1.25, 0.85, 0.82);
    for (const s of [-1, 1]) { put(g, ball(0.036), vein, 0, 0.075, s * 0.062); put(g, ring(0.04, 0.008, 32), M.metal(0x2a2a33, 0.25), 0, 0.075, s * 0.07); halo(g, 0xb45cff, 0.32, 0, 0.075, s * 0.1, 0.8); }
    put(g, rod(0.031, 0.3, 24, 0.027), M.leather(0x241238), 0, -0.14, 0);
    for (let i = 0; i < 6; i++) put(g, ring(0.034 - i * 0.0006, 0.006, 32), M.metal(0x4b4b58, 0.22), 0, -0.02 - i * 0.048, 0, Math.PI / 2);
    put(g, ball(0.058), goo, 0, -0.31, 0); put(g, new THREE.ConeGeometry(0.03, 0.11, 16), goo, 0, -0.39, 0, Math.PI);
    const tear = lathe([[0, 0.07], [0.006, 0.05], [0.016, 0.02], [0.02, 0], [0.014, -0.014], [0, -0.02]], 20);
    for (const [x, y, k] of [[-0.27, 0.03, 1], [0.24, 0.02, 1.25], [-0.13, -0.01, 0.8], [0.1, -0.02, 1], [0.31, 0.11, 0.7]]) { const d = put(g, tear, goo, x, y, 0); d.scale.setScalar(k); drips.push(d); }
    g.userData.tick = (t, hot) => { vein.emissiveIntensity = 1.7 + Math.sin(t * 3.2) * 0.7 + hot * 2.5; sway.forEach((m, k) => { m.rotation.y = Math.sin(t * 1.6 + k * 1.3) * 0.14; }); drips.forEach((d, k) => { d.scale.y = d.scale.x * (1.1 + 0.35 * Math.sin(t * 2.2 + k * 1.9)); }); };
    return g;
  },

  // A curved blade of living crystal with a core of light, on a wrapped grip with a gold guard.
  katana() {
    const g = new THREE.Group(), gold = M.gold(), sparks = [];
    const ice = phys({ color: 0x4fc4ff, metalness: 0.15, roughness: 0.05, transparent: true, opacity: 0.74, envMapIntensity: 1.5, clearcoat: 1, emissive: 0x0b6fd0, emissiveIntensity: 0.5, flatShading: true });
    const core = M.glow(0xa8ecff, 1.1);
    const L = 1.3, y0 = 0.08, N = 40, back = [], edge = [], cb = [], ce = [], bend = (u) => -0.16 * u * u;
    for (let i = 0; i <= N; i++) { const u = i / N, y = y0 + u * L, w = 0.062 * (u < 0.86 ? 1 : 1 - ((u - 0.86) / 0.14) ** 1.6); back.push([bend(u) - 0.03, y]); if (i < N) edge.push([bend(u) - 0.03 + w + (i % 4 === 0 && u < 0.84 ? 0.007 : 0), y]); cb.push([bend(u) - 0.016, y]); if (i < N) ce.push([bend(u) - 0.016 + w * 0.22, y]); }
    put(g, slab([...edge, ...back.reverse()], 0.012, 0.012, 0.022), ice);
    put(g, slab([...ce, ...cb.reverse()], 0.004, 0.002, 0.004), core);
    const shard = new THREE.ConeGeometry(1, 1, 6, 1);
    for (const [x, y, z, s, h, rz, rx] of [[0.05, 0.16, 0.012, 0.022, 0.13, -0.5, 0.2], [-0.05, 0.2, -0.012, 0.018, 0.1, 0.6, -0.3], [0.045, 0.3, -0.01, 0.015, 0.09, -0.7, -0.2], [-0.04, 0.12, 0.012, 0.024, 0.11, 0.9, 0.3], [0.03, 0.42, 0.01, 0.012, 0.07, -0.6, 0.4], [-0.07, 0.5, 0, 0.011, 0.06, 0.8, 0]]) { const m = put(g, shard, ice, x, y, z, rx, 0, rz); m.scale.set(s, h, s); }
    put(g, lathe([[0, 0], [0.036, 0], [0.04, 0.012], [0.034, 0.075], [0, 0.075]], 6), gold, -0.005, 0.05, 0).scale.set(1.25, 1, 0.5);
    put(g, lathe([[0, -0.012], [0.1, -0.012], [0.116, -0.004], [0.116, 0.006], [0.1, 0.014], [0.03, 0.02], [0, 0.02]], 56), M.metal(0xf0b23a, 0.3, { bumpMap: T.marks(), bumpScale: 2 }), 0, 0.03, 0).scale.set(1, 1, 0.82);
    around(8, (c, s) => put(g, ball(0.011, 12), M.glow(0x7fe3ff, 2.2), c * 0.088, 0.05, s * 0.072));
    const grip = put(g, rod(0.03, 0.36, 28, 0.028), std({ map: rep(T.wrap(), 2, 1), roughness: 0.6, metalness: 0, bumpMap: rep(T.wrap(), 2, 1), bumpScale: 2.5, envMapIntensity: 0.5 }), 0, -0.16, 0); grip.scale.set(1, 1, 0.78);
    put(g, lathe([[0, -0.05], [0.026, -0.046], [0.036, -0.03], [0.034, 0], [0.03, 0.008]], 32), gold, 0, -0.34, 0).scale.set(1, 1, 0.8);
    put(g, lathe([[0.034, 0], [0.036, 0.02], [0.03, 0.024]], 32), gold, 0, 0.0, 0).scale.set(1, 1, 0.8);
    put(g, tube([[0, -0.385, 0], [0.04, -0.43, 0.02], [0.02, -0.5, 0.01], [0.05, -0.57, 0]], 0.006, { rs: 6, seg: 24 }), std({ color: 0xc21f3a, roughness: 0.8 }));
    put(g, ball(0.02, 16), M.glow(0x7fe3ff, 1.6), 0.05, -0.58, 0); put(g, new THREE.ConeGeometry(0.02, 0.09, 12), std({ color: 0xc21f3a, roughness: 0.9 }), 0.05, -0.64, 0, Math.PI);
    for (let i = 0; i < 7; i++) { const u = 0.12 + i * 0.13; sparks.push(halo(g, 0xbfefff, 0.16, bend(u) + 0.01, y0 + u * L, 0, 0)); }
    halo(g, 0x58c8ff, 0.5, -0.02, 0.5, 0, 0.35); halo(g, 0x58c8ff, 0.5, -0.1, 1.05, 0, 0.3);
    g.userData.tick = (t, hot) => { ice.emissiveIntensity = 0.4 + Math.sin(t * 2.4) * 0.15 + hot * 1.2; core.emissiveIntensity = 1.0 + Math.sin(t * 5) * 0.2 + hot * 2; sparks.forEach((s, k) => { const q = Math.max(0, Math.sin(t * 3.1 + k * 2.4)); s.material.opacity = q ** 6; s.scale.setScalar(0.1 + q * 0.16); }); };
    return g;
  },

  // A scepter with an hourglass caged in its head, a clock in its collar and two rings that never stop turning.
  baton() {
    const g = new THREE.Group(), brass = M.gold(0.3), amber = M.glow(0xffb23e, 2.2), spin = [];
    put(g, lathe([[0, -0.3], [0.022, -0.3], [0.03, -0.27], [0.024, -0.2], [0.027, 0], [0.023, 0.2], [0.03, 0.34], [0.034, 0.38]], 32), M.wood(0x3b2416));
    for (const [y, r] of [[-0.25, 0.031], [-0.19, 0.027], [0.02, 0.03], [0.1, 0.028], [0.3, 0.031]]) put(g, ring(r, 0.007, 40), brass, 0, y, 0, Math.PI / 2);
    put(g, tube(Array.from({ length: 30 }, (_, i) => { const u = i / 29, a = u * TAU * 4; return [Math.cos(a) * 0.029, -0.17 + u * 0.17, Math.sin(a) * 0.029]; }), 0.0045, { rs: 6, seg: 90 }), brass);
    put(g, lathe([[0, -0.37], [0.014, -0.36], [0.03, -0.33], [0.034, -0.3], [0.024, -0.29]], 32), brass);
    put(g, new THREE.OctahedronGeometry(0.024, 0), M.glow(0x3dffb0, 1.6), 0, -0.385, 0);
    put(g, lathe([[0.03, 0.36], [0.06, 0.39], [0.07, 0.43], [0.062, 0.47], [0.04, 0.49], [0.03, 0.47]], 48), M.metal(0xf0b23a, 0.3, { bumpMap: rep(T.marks(), 2, 1), bumpScale: 2 }));
    for (const s of [-1, 1]) { put(g, new THREE.CircleGeometry(0.045, 40), std({ map: T.clock(), roughness: 0.35, metalness: 0.1 }), 0, 0.43, s * 0.071, 0, s < 0 ? Math.PI : 0); put(g, ring(0.047, 0.006, 40), brass, 0, 0.43, s * 0.071); }
    // the head: glass over an hourglass
    const hy = 0.66;
    put(g, lathe([[0.03, 0.49], [0.05, 0.53], [0.072, 0.6], [0.076, hy], [0.072, 0.72], [0.05, 0.79], [0.02, 0.83], [0, 0.835]], 48), M.glass(0xfff0c8));
    const sand = lathe([[0, -0.11], [0.05, -0.11], [0.05, -0.1], [0.012, -0.012], [0.012, 0.012], [0.05, 0.1], [0.05, 0.11], [0, 0.11]], 40);
    put(g, sand, M.glass(0xffffff, { opacity: 0.28 }), 0, hy, 0);
    put(g, new THREE.ConeGeometry(0.04, 0.07, 32), amber, 0, hy - 0.07, 0); put(g, new THREE.ConeGeometry(0.03, 0.05, 32), amber, 0, hy + 0.035, 0, Math.PI); put(g, rod(0.004, 0.09, 8), amber, 0, hy - 0.01, 0);
    for (const y of [-0.115, 0.115]) put(g, rod(0.056, 0.012, 40), brass, 0, hy + y, 0);
    around(3, (c, s) => { put(g, tube([[c * 0.05, 0.5, s * 0.05], [c * 0.098, 0.58, s * 0.098], [c * 0.102, hy, s * 0.102], [c * 0.09, 0.76, s * 0.09], [c * 0.03, 0.85, s * 0.03]], 0.009, { rs: 8 }), brass); put(g, ball(0.014, 12), brass, c * 0.102, hy, s * 0.102); });
    put(g, lathe([[0, 0.84], [0.03, 0.845], [0.02, 0.87], [0.008, 0.9], [0, 0.94]], 24), brass);
    for (const [r, rx, rz, sp] of [[0.135, 0.5, 0.2, 1.1], [0.16, -0.6, -0.4, -0.7]]) { const h = new THREE.Group(); h.position.y = hy; h.rotation.set(rx, 0, rz); const q = new THREE.Group(); h.add(q); put(q, ring(r, 0.006, 96), brass, 0, 0, 0, Math.PI / 2); around(12, (c, s, a, i) => put(q, ball(i % 3 ? 0.007 : 0.012, 10), i % 3 ? brass : amber, c * r, 0, s * r)); g.add(h); spin.push([q, sp]); }
    const glow = halo(g, 0xffa424, 0.6, 0, hy, 0, 0.75);
    g.userData.tick = (t, hot) => { for (const [q, sp] of spin) q.rotation.y = t * sp * (1 + hot * 6); amber.emissiveIntensity = 2 + Math.sin(t * 2) * 0.5 + hot * 3; glow.scale.setScalar(0.55 + Math.sin(t * 2) * 0.05 + hot * 0.5); };
    return g;
  },

  // A recurve bow painted with the night sky, strung with light, with a star-tipped arrow on the string.
  // Arrow along +Y, limbs up and down the Z axis.
  bow() {
    const g = new THREE.Group(), gold = M.gold(), gal = rep(T.galaxy(), 1, 1), sky = phys({ map: gal, roughness: 0.25, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0xffffff, emissiveMap: gal, emissiveIntensity: 0.55, envMapIntensity: 1.4 });
    const string = M.glow(0xbfa8ff, 2.4), stars = [];
    for (const s of [-1, 1]) {
      put(g, tube([[0, 0.02, s * 0.1], [0, 0.07, s * 0.3], [0, 0.02, s * 0.55], [0, -0.14, s * 0.74], [0, -0.2, s * 0.86], [0, -0.14, s * 0.93]], 0.034, { taper: (u) => 1 - u * 0.62, flat: ['x', 0.55], rs: 14 }), sky);
      put(g, tube([[0, -0.19, s * 0.84], [0, -0.14, s * 0.93], [0, -0.07, s * 0.96]], 0.018, { taper: (u) => 1.1 - u * 0.5, rs: 10, seg: 16 }), gold);
      put(g, ring(0.03, 0.007, 32), gold, 0, 0.035, s * 0.14, 0, 0, 0); put(g, ring(0.027, 0.006, 32), gold, 0, 0.065, s * 0.3);
      put(g, rod(0.004, 0.94, 8), string, 0, -0.17, s * 0.47, Math.PI / 2);
      for (const [y, z] of [[0.06, 0.3], [0.03, 0.52], [-0.1, 0.7]]) stars.push(halo(g, 0xd9ccff, 0.12, 0.03, y, s * z, 0));
    }
    put(g, lathe([[0.03, -0.11], [0.036, -0.08], [0.03, 0], [0.036, 0.08], [0.03, 0.11]], 32), M.leather(0x2a1750), 0, 0.01, 0, Math.PI / 2).scale.set(1, 1, 1.25);
    for (const z of [-0.115, 0.115]) put(g, ring(0.036, 0.008, 32), gold, 0, 0.01, z);
    put(g, new THREE.OctahedronGeometry(0.03, 0), M.glow(0x9d7bff, 2), 0.045, 0.01, 0); halo(g, 0x9d7bff, 0.3, 0.06, 0.01, 0, 0.7);
    // the arrow
    const ar = new THREE.Group(); ar.position.set(0.045, 0, 0); g.add(ar);
    put(ar, rod(0.007, 0.92, 12), M.glow(0xe9e2ff, 1.5), 0, 0.27, 0);
    const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 2, r = i % 2 ? 0.02 : 0.062; pts.push([Math.cos(a) * r, Math.sin(a) * r * 1.6]); }
    for (const ry of [0, Math.PI / 2]) put(ar, slab(pts, 0.008, 0.006, 0.008), gold, 0, 0.78, 0, 0, ry);
    for (const ry of [0, TAU / 3, (2 * TAU) / 3]) put(ar, slab([[0, 0], [0.04, -0.03], [0.04, 0.09], [0, 0.14]], 0.002, 0.001, 0.002), M.glow(0x7b5cff, 1.2), 0, -0.17, 0, 0, ry);
    const tip = halo(ar, 0xfff1c2, 0.34, 0, 0.8, 0, 0.8);
    g.userData.tick = (t, hot) => { gal.offset.x = t * 0.03; stars.forEach((s, k) => { const q = Math.max(0, Math.sin(t * 2.3 + k * 1.7)); s.material.opacity = q ** 4; }); string.emissiveIntensity = 2.2 + hot * 3; tip.scale.setScalar(0.3 + Math.sin(t * 6) * 0.04 + hot * 0.3); ar.position.y = -hot * 0.1; };
    return g;
  },

  // Three prongs of sea-blue steel on a gold-wound shaft, with lightning that jumps between the points.
  trident() {
    const g = new THREE.Group(), gold = M.gold(), blue = M.metal(0x4a8ff0, 0.2, { envMapIntensity: 1.6 }), bolt = std({ color: 0x000000, emissive: 0x9fdcff, emissiveIntensity: 3, roughness: 1 }), arcs = [];
    put(g, lathe([[0.024, -0.72], [0.027, -0.4], [0.024, 0], [0.027, 0.4], [0.03, 0.7]], 32), M.metal(0x1d2c52, 0.36));
    put(g, tube(Array.from({ length: 60 }, (_, i) => { const u = i / 59, a = u * TAU * 9; return [Math.cos(a) * 0.028, -0.6 + u * 1.2, Math.sin(a) * 0.028]; }), 0.005, { rs: 6, seg: 200 }), gold);
    for (const y of [-0.66, -0.2, 0.2, 0.62]) put(g, lathe([[0.027, -0.03], [0.036, -0.02], [0.038, 0], [0.036, 0.02], [0.027, 0.03]], 32), gold, 0, y, 0);
    put(g, new THREE.ConeGeometry(0.03, 0.16, 24), blue, 0, -0.8, 0, Math.PI); put(g, ball(0.034, 20), gold, 0, -0.72, 0);
    put(g, lathe([[0.03, 0.68], [0.06, 0.71], [0.075, 0.76], [0.06, 0.82], [0.04, 0.84], [0.03, 0.82]], 48), M.metal(0xf0b23a, 0.28, { bumpMap: rep(T.marks(), 2, 1), bumpScale: 2 }));
    const gem = M.glow(0x58b8ff, 2.2); for (const s of [-1, 1]) { put(g, new THREE.OctahedronGeometry(0.04, 0), gem, 0, 0.76, s * 0.062).scale.set(1, 1.3, 0.6); }
    const spear = (h, w) => [[-0.022, 0], [-w * 0.55, h * 0.55], [-w, h * 0.62], [0, h], [w, h * 0.62], [w * 0.55, h * 0.55], [0.022, 0]];
    put(g, slab(spear(0.62, 0.075), 0.022, 0.014, 0.02), blue, 0, 0.82, 0);
    for (const s of [-1, 1]) {
      const N = 20, outer = [], inner = [];
      for (let i = 0; i <= N; i++) { const u = i / N, x = s * (0.03 + 0.2 * Math.sin(u * 1.5) ** 0.8), y = 0.84 + u * 0.36, w = 0.03 * (1 - u * 0.5); outer.push([x + s * w, y]); inner.push([x - s * w, y]); }
      const tipx = outer[N][0] - s * 0.015; outer.push([tipx + s * 0.05, 1.27], [tipx, 1.44], [tipx - s * 0.05, 1.27]);
      put(g, slab([...outer, ...inner.reverse()], 0.02, 0.012, 0.012), blue, 0, 0, 0);
      put(g, ball(0.02, 12), gold, s * 0.17, 1.0, 0.016); put(g, ball(0.02, 12), gold, s * 0.17, 1.0, -0.016);
    }
    const r = rng(77), tips = [[-0.21, 1.42], [0, 1.44], [0.21, 1.42]];
    for (let k = 0; k < 6; k++) { const a = tips[k % 2], b = tips[(k % 2) + 1], pts = []; for (let i = 0; i <= 7; i++) { const u = i / 7, j = i && i < 7 ? 1 : 0; pts.push([a[0] + (b[0] - a[0]) * u + (r() - 0.5) * 0.05 * j, a[1] + (b[1] - a[1]) * u + (r() - 0.5) * 0.12 * j, (r() - 0.5) * 0.08 * j]); } const m = put(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p)), false, 'catmullrom', 0), 28, 0.006, 5), bolt); arcs.push(m); }
    const glows = tips.map(([x, y]) => halo(g, 0x7cc8ff, 0.3, x, y, 0, 0.7)); halo(g, 0x58b8ff, 0.4, 0, 0.76, 0, 0.6);
    g.userData.tick = (t, hot) => { const f = Math.floor(t * (9 + hot * 14)); arcs.forEach((m, k) => { m.visible = (f * 7 + k * 3) % 6 < 2 + (hot > 0.2 ? 2 : 0); }); glows.forEach((s, k) => s.scale.setScalar(0.26 + 0.08 * Math.sin(t * 9 + k * 2) + hot * 0.3)); gem.emissiveIntensity = 2 + Math.sin(t * 3) * 0.5 + hot * 2; };
    return g;
  },

  // An armoured glove with a purple star in the back of the hand, and rocks that circle it like moons.
  // The fist is at +Y; the cuff runs back up the arm.
  glove() {
    const g = new THREE.Group(), gold = M.gold(), plate = M.plate(0x3b2a78), dark = M.leather(0x17121f), core = M.glow(0xc77dff, 2.4), moons = [];
    const hand = put(g, ball(0.12, 40), plate, 0, 0.05, 0); hand.scale.set(1.0, 1.05, 1.15);
    for (let i = 0; i < 4; i++) { const z = -0.105 + i * 0.07; const f = put(g, new THREE.CapsuleGeometry(0.034, 0.07, 8, 16), dark, 0.035, 0.16, z, 0, 0, -0.5); put(g, new THREE.CapsuleGeometry(0.03, 0.05, 8, 16), dark, 0.09, 0.15, z, 0, 0, -2.0); const k = put(g, ball(0.04, 20), gold, -0.012, 0.165, z); k.scale.set(1, 0.8, 0.8); put(g, new THREE.ConeGeometry(0.018, 0.05, 12), gold, -0.04, 0.2, z, 0, 0, 0.5); }
    put(g, new THREE.CapsuleGeometry(0.036, 0.07, 8, 16), dark, 0.06, 0.06, 0.15, 0.9, 0, -0.3);
    // the star in the back of the hand
    put(g, ball(0.055, 32), core, -0.105, 0.05, 0); put(g, ring(0.062, 0.012, 48), gold, -0.103, 0.05, 0, 0, Math.PI / 2); around(8, (c, s) => put(g, ball(0.009, 10), gold, -0.112, 0.05 + c * 0.078, s * 0.078));
    put(g, lathe([[0.1, -0.02], [0.118, -0.06], [0.112, -0.13], [0.12, -0.2], [0.135, -0.3], [0.142, -0.33], [0.13, -0.34], [0.118, -0.33]], 56), plate).scale.set(1, 1, 1.12);
    for (const y of [-0.05, -0.2, -0.33]) put(g, ring(y < -0.3 ? 0.14 : y < -0.1 ? 0.122 : 0.116, 0.011, 56), gold, 0, y, 0, Math.PI / 2).scale.set(1, 1.12, 1);
    for (let i = 0; i < 3; i++) put(g, slab([[-0.05, 0], [0.05, 0], [0.036, 0.11], [0, 0.14], [-0.036, 0.11]], 0.012, 0.008, 0.01), gold, -0.125 - i * 0.004, -0.31 + i * 0.075, 0, 0, -Math.PI / 2, 0).scale.setScalar(1 - i * 0.14);
    put(g, tube([[-0.11, -0.02, 0.05], [-0.13, -0.1, 0.07], [-0.12, -0.2, 0.05]], 0.008, { rs: 6, seg: 20 }), core); put(g, tube([[-0.11, -0.02, -0.05], [-0.13, -0.1, -0.07], [-0.12, -0.2, -0.05]], 0.008, { rs: 6, seg: 20 }), core);
    const rock = std({ color: 0x6b6474, roughness: 0.9, metalness: 0, bumpMap: T.lumps(), bumpScale: 3, flatShading: true, envMapIntensity: 0.4 }), r = rng(31);
    for (const [rad, rx, rz] of [[0.27, 0.3, 0.2], [0.33, -0.5, 0.5]]) { const h = new THREE.Group(); h.position.y = 0.04; h.rotation.set(rx, 0, rz); const q = new THREE.Group(); h.add(q); g.add(h); put(q, ring(rad, 0.003, 96), M.glow(0xc77dff, 1.4), 0, 0, 0, Math.PI / 2);
      around(rad < 0.3 ? 3 : 4, (c, s, a, i) => { const geo = new THREE.DodecahedronGeometry(0.03 + r() * 0.028, 0); const m = put(q, geo, rock, c * rad, 0, s * rad, r() * 3, r() * 3, 0); m.scale.set(1, 0.7 + r() * 0.6, 0.8 + r() * 0.4); halo(q, 0xc77dff, 0.16, c * rad, 0, s * rad, 0.5); moons.push(m); });
      moons.push(q); q.userData.sp = rad < 0.3 ? 0.9 : -0.6; }
    const glow = halo(g, 0xb45cff, 0.5, -0.16, 0.05, 0, 0.8);
    g.userData.tick = (t, hot) => { for (const m of moons) { if (m.userData.sp) m.rotation.y = t * m.userData.sp * (1 + hot * 5); else { m.rotation.x += 0.01; m.rotation.z += 0.007; } } core.emissiveIntensity = 2.2 + Math.sin(t * 2.6) * 0.6 + hot * 3; glow.scale.setScalar(0.45 + Math.sin(t * 2.6) * 0.06 + hot * 0.6); };
    return g;
  },

  // A crooked staff of burnt wood. Four iron claws at the top hold a rock that is still on fire inside.
  meteor() {
    const g = new THREE.Group(), iron = M.iron(), embers = [];
    put(g, tube([[0, -0.78, 0], [0.02, -0.5, 0.01], [-0.015, -0.2, -0.01], [0.012, 0.1, 0.012], [-0.01, 0.4, 0], [0.01, 0.62, 0], [0, 0.74, 0]], 0.03, { taper: (u) => 0.85 + 0.25 * u + 0.08 * Math.sin(u * 20), rs: 14, seg: 80 }), M.wood(0x2a1a12));
    for (const [y, r] of [[-0.7, 0.031], [-0.1, 0.034], [0.06, 0.034], [0.6, 0.038]]) { put(g, rod(r, 0.045, 24), iron, 0, y, 0); around(6, (c, s) => put(g, ball(0.007, 8), M.steel(), c * (r + 0.002), y, s * (r + 0.002))); }
    put(g, tube([[0.03, -0.08, 0], [0.05, -0.02, 0.03], [0.02, 0.04, 0.045], [-0.03, 0.0, 0.03], [-0.04, -0.06, 0]], 0.007, { rs: 6, seg: 30 }), M.leather(0x6b2f1a));
    put(g, new THREE.ConeGeometry(0.03, 0.18, 16), iron, 0, -0.88, 0, Math.PI);
    put(g, lathe([[0.034, 0.7], [0.06, 0.73], [0.07, 0.78], [0.05, 0.82], [0.03, 0.8]], 32), iron);
    const hy = 1.0;
    around(4, (c, s) => put(g, tube([[c * 0.045, 0.78, s * 0.045], [c * 0.17, 0.84, s * 0.17], [c * 0.21, 0.98, s * 0.21], [c * 0.16, 1.14, s * 0.16], [c * 0.07, 1.2, s * 0.07]], 0.024, { taper: (u) => 1.1 - u * 0.95, rs: 10 }), iron), 0.4);
    // the rock: a ball pushed in and out until it is lumpy, with cracks that glow
    const geo = new THREE.IcosahedronGeometry(0.15, 5), pos = geo.attributes.position, v = V(0, 0, 0);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const n = Math.sin(v.x * 31) * Math.sin(v.y * 27 + 1) * Math.sin(v.z * 29 + 2) * 0.1 + Math.sin(v.x * 67 + v.y * 59) * Math.sin(v.z * 71) * 0.045; v.multiplyScalar(1 + n); pos.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals();
    const lava = std({ color: 0x1a1210, roughness: 0.85, metalness: 0, emissive: 0xffffff, emissiveMap: T.lava(), emissiveIntensity: 2.2, bumpMap: T.lumps(), bumpScale: 2, envMapIntensity: 0.3 });
    const rock = put(g, geo, lava, 0, hy, 0);
    const or = new THREE.Group(); or.position.y = hy; g.add(or); const r = rng(13);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, rad = 0.26 + r() * 0.1, m = put(or, new THREE.DodecahedronGeometry(0.014 + r() * 0.02, 0), lava, Math.cos(a) * rad, (r() - 0.5) * 0.24, Math.sin(a) * rad); halo(m, 0xff7a1a, 5, 0, 0, 0, 0.6).scale.setScalar(0.12); embers.push(m); }
    const glow = halo(g, 0xff6a10, 0.9, 0, hy, 0, 0.85);
    g.userData.tick = (t, hot) => { rock.rotation.y = t * 0.4; rock.rotation.x = t * 0.23; or.rotation.y = t * (0.8 + hot * 4); embers.forEach((m, k) => { m.position.y += Math.sin(t * 2 + k) * 0.0006; m.rotation.x = t + k; }); lava.emissiveIntensity = 2 + Math.sin(t * 2.2) * 0.6 + hot * 3; glow.scale.setScalar(0.8 + Math.sin(t * 2.2) * 0.08 + hot * 0.6); };
    return g;
  },

  // A four-barrelled cannon. An accelerator ring whirls round its middle and three sparks race round an atom at the back.
  // Barrels along +Y. The grip hangs below at the origin, so the body sits at -Z.
  smasher() {
    const g = new THREE.Group(), b = new THREE.Group(); b.position.set(0, 0.3, -0.17); g.add(b);
    const shell = M.plate(0xf2f4f7), orange = M.plate(0xff6a1a), dark = M.metal(0x23272e, 0.42), steel = M.steel(0.24), copper = M.metal(0xd9783a, 0.3), cyan = M.glow(0x39f0ff, 2.6), spin = [];
    put(b, lathe([[0, -0.36], [0.085, -0.36], [0.115, -0.33], [0.125, -0.2], [0.118, -0.02], [0.128, 0.0], [0.128, 0.16], [0.11, 0.2], [0.096, 0.3], [0.09, 0.31], [0, 0.31]], 64), shell);
    put(b, lathe([[0.119, -0.02], [0.134, -0.01], [0.134, 0.17], [0.119, 0.18]], 64), orange);
    for (let i = 0; i < 7; i++) put(b, ring(0.123 - i * 0.0012, 0.011, 56), copper, 0, -0.07 - i * 0.026, 0, Math.PI / 2);
    around(4, (c, s) => { const x = c * 0.058, z = s * 0.058; put(b, rod(0.034, 0.62, 28), dark, x, 0.58, z); put(b, rod(0.026, 0.02, 28), cyan, x, 0.893, z); put(b, lathe([[0.034, 0], [0.046, 0.01], [0.046, 0.05], [0.036, 0.06], [0.028, 0.06], [0.028, 0.0]], 32), steel, x, 0.84, z); for (const y of [0.4, 0.52, 0.64]) put(b, ring(0.036, 0.005, 28), steel, x, y, z, Math.PI / 2); }, Math.PI / 4);
    for (const y of [0.34, 0.72]) { put(b, rod(0.108, 0.03, 48), steel, 0, y, 0); around(8, (c, s) => put(b, rod(0.007, 0.036, 8), dark, c * 0.094, y, s * 0.094)); }
    put(b, rod(0.02, 0.62, 16), copper, 0, 0.58, 0); const muzzle = put(b, ball(0.03, 24), cyan, 0, 0.9, 0);
    // accelerator ring on three struts
    const acc = new THREE.Group(); acc.position.y = 0.08; b.add(acc);
    put(acc, ring(0.215, 0.026, 96), M.plate(0x2c3340), 0, 0, 0, Math.PI / 2); put(acc, ring(0.215, 0.012, 96), cyan, 0, 0.022, 0, Math.PI / 2);
    around(12, (c, s, a) => put(acc, rod(0.03, 0.03, 12), steel, c * 0.215, 0, s * 0.215, 0, -a, Math.PI / 2));
    around(3, (c, s, a) => put(b, rod(0.012, 0.1, 10), steel, c * 0.165, 0.08, s * 0.165, 0, -a, Math.PI / 2), 0.5);
    const orbs = new THREE.Group(); orbs.position.y = 0.105; b.add(orbs); around(3, (c, s) => { put(orbs, ball(0.016, 12), cyan, c * 0.215, 0, s * 0.215); halo(orbs, 0x39f0ff, 0.2, c * 0.215, 0, s * 0.215, 0.8); }); spin.push([orbs, 'y', 4]);
    // the atom at the back
    const atom = new THREE.Group(); atom.position.y = -0.47; b.add(atom); put(b, rod(0.03, 0.1, 16), steel, 0, -0.4, 0);
    put(atom, ball(0.045, 24), M.glow(0xff8a2a, 2.2)); halo(atom, 0xff8a2a, 0.3, 0, 0, 0, 0.7);
    for (let k = 0; k < 3; k++) { const o2 = new THREE.Group(); o2.rotation.y = (k / 3) * TAU; const h = new THREE.Group(); h.rotation.x = 1.1; o2.add(h); const q = new THREE.Group(); h.add(q); atom.add(o2); put(q, ring(0.1, 0.004, 64), steel, 0, 0, 0, Math.PI / 2); put(q, ball(0.013, 12), cyan, 0.1, 0, 0); spin.push([q, 'y', 5 + k * 1.3]); }
    // sight rail, cables, vents
    put(b, new THREE.BoxGeometry(0.03, 0.34, 0.03), dark, 0, 0.12, -0.145); for (let i = 0; i < 8; i++) put(b, new THREE.BoxGeometry(0.04, 0.012, 0.012), steel, 0, -0.02 + i * 0.04, -0.162);
    put(b, lathe([[0.018, 0], [0.03, 0.02], [0.03, 0.1], [0.022, 0.12]], 24), dark, 0, 0.16, -0.19); put(b, new THREE.CircleGeometry(0.02, 20), cyan, 0, 0.281, -0.19, -Math.PI / 2);
    for (const s of [-1, 1]) { put(b, tube([[s * 0.1, -0.3, 0.06], [s * 0.17, -0.2, 0.08], [s * 0.18, -0.02, 0.05], [s * 0.2, 0.07, 0.03]], 0.011, { rs: 8, seg: 32 }), std({ color: 0x14161a, roughness: 0.55 })); put(b, tube([[s * 0.09, -0.32, -0.05], [s * 0.16, -0.24, -0.08], [s * 0.19, -0.05, -0.05], [s * 0.21, 0.07, -0.02]], 0.007, { rs: 6, seg: 32 }), std({ color: 0xffd21f, roughness: 0.5 })); }
    // grip and front handle, under the body
    put(g, rod(0.032, 0.16, 20), M.leather(0x1a1c20), 0, -0.02, -0.02, -1.25); put(g, new THREE.BoxGeometry(0.05, 0.14, 0.07), dark, 0, 0.03, -0.08);
    put(g, tube([[0, 0.05, -0.05], [0, 0.1, 0.02], [0, 0.02, 0.05], [0, -0.04, 0.0]], 0.007, { rs: 6, seg: 20 }), steel);
    put(g, rod(0.026, 0.13, 20), M.leather(0x1a1c20), 0, 0.7, -0.03, Math.PI / 2); put(g, new THREE.BoxGeometry(0.04, 0.04, 0.08), dark, 0, 0.7, -0.07);
    const glow = halo(b, 0x39f0ff, 0.5, 0, 0.92, 0, 0.8);
    g.userData.tick = (t, hot) => { for (const [o, ax, sp] of spin) o.rotation[ax] = t * sp * (1 + hot * 4); cyan.emissiveIntensity = 2.3 + Math.sin(t * 4) * 0.5 + hot * 4; muzzle.scale.setScalar(1 + hot * 1.6); glow.scale.setScalar(0.45 + Math.sin(t * 4) * 0.05 + hot * 0.9); };
    return g;
  },
};

// One relic, ready to hold or to show. Built when first wanted, never before.
export function buildRelic(id) { const g = BUILD[id](); g.userData.id = id; return g; }

// ------------------------------------------------------------------ the display stand
// A small renderer of its own, used for the turntable in the Toolbox and for the pictures on the cards.
const POSE = { goo: [0.5, -0.5], katana: [0.4, -0.55], baton: [0.2, -0.4], bow: [0.45, 0.5, -Math.PI / 2], trident: [0.2, -0.45], glove: [0.9, -0.1], meteor: [0.2, -0.4], smasher: [1.0, -0.75] };
export class Vault {
  constructor() { this.items = {}; this.thumbs = {}; this.cur = null; this.t = 0; this.spin = 0; this.raf = 0; this.drag = null; }
  init() {
    if (this.r) return true;
    try { this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return false; }
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(28, 1, 0.05, 30);
    this.scene.add(new THREE.HemisphereLight(0xdfeeff, 0x3a2f28, 1.1));
    const key = new THREE.DirectionalLight(0xfff3dd, 2.6); key.position.set(2, 3, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb8ff, 1.8); rim.position.set(-3, 1.5, -3); this.scene.add(rim);
    this.stage = new THREE.Group(); this.scene.add(this.stage); this.box = new THREE.Box3(); this.v = V(0, 0, 0);
    return true;
  }
  // turn (spins) > tilt (leans it for the camera, and centres it) > the relic
  item(id) {
    if (this.items[id]) return this.items[id];
    const o = buildRelic(id), tilt = new THREE.Group(), turn = new THREE.Group(), p = POSE[id] || [0.3, 0];
    if (p[2]) o.rotation.y = p[2]; tilt.rotation.z = p[1]; tilt.add(o); turn.add(tilt); o.userData.tick(0, 0);
    turn.updateMatrixWorld(true); this.box.setFromObject(turn, true); tilt.position.sub(this.box.getCenter(this.v));
    const size = this.box.getSize(V(0, 0, 0)); turn.userData = { o, r: Math.hypot(size.x, size.y, size.z) / 2, yaw: p[0] };
    return (this.items[id] = turn);
  }
  frame(id, w, h, yaw) {
    const it = this.item(id), u = it.userData; if (this.on !== it) { if (this.on) this.stage.remove(this.on); this.stage.add(it); this.on = it; }
    it.rotation.y = yaw; this.cam.aspect = w / h; const fit = u.r / Math.tan((this.cam.fov * Math.PI) / 360) / Math.min(1, this.cam.aspect) * 0.94; this.cam.position.set(0, u.r * 0.12, fit); this.cam.lookAt(0, 0, 0); this.cam.updateProjectionMatrix();
    this.r.render(this.scene, this.cam);
  }
  // A square picture of a relic for its card.
  thumb(id, px = 192) {
    if (this.thumbs[id]) return this.thumbs[id]; if (!this.init()) return '';
    this.w = -1; this.r.setPixelRatio(1); this.r.setSize(px, px, false); this.item(id).userData.o.userData.tick(1.3, 0); this.frame(id, px, px, this.item(id).userData.yaw);
    return (this.thumbs[id] = this.r.domElement.toDataURL('image/png'));
  }
  // Put a relic on the turntable inside `host`. It turns by itself and can be dragged round.
  show(id, host) {
    if (!this.init()) return; const c = this.r.domElement; if (c.parentNode !== host) { host.textContent = ''; host.append(c); c.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab';
      c.onpointerdown = (e) => { this.drag = e.clientX; c.setPointerCapture(e.pointerId); }; c.onpointermove = (e) => { if (this.drag !== null) { this.spin += (e.clientX - this.drag) * 0.012; this.drag = e.clientX; this.idle = 0; } }; c.onpointerup = c.onpointercancel = () => { this.drag = null; }; }
    this.cur = id; this.spin = this.item(id).userData.yaw; this.idle = 9; this.host = host; this.hot = 0;
    if (!this.raf) { let last = performance.now(); const loop = (now) => { this.raf = this.cur ? requestAnimationFrame(loop) : 0; if (!this.cur) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; this.step(dt); }; this.raf = requestAnimationFrame(loop); }
  }
  step(dt) {
    const host = this.host, w = host.clientWidth || 300, h = host.clientHeight || 300, pr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.w !== w || this.h !== h || this.pr !== pr) { this.w = w; this.h = h; this.pr = pr; this.r.setPixelRatio(pr); this.r.setSize(w, h, false); }
    this.t += dt; this.idle += dt; if (this.idle > 1.2 && this.drag === null) this.spin += dt * 0.55; this.hot = Math.max(0, this.hot - dt * 1.4);
    this.item(this.cur).userData.o.userData.tick(this.t, this.hot); this.frame(this.cur, w, h, this.spin);
  }
  flash() { this.hot = 1; }
  hide() { this.cur = null; }
}
