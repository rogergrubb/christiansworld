// The island: terrain, roads, town, landmarks, collision and map data.
import * as THREE from './three.js';
import { clamp, lerp, smoothstep, rng, fbm, noise2, segDist } from './util.js';

export const ROAD_HALF = 7;
export const RING = 520;
export const WATER_Y = -1.0;
export const CURB = 0.18;
export const TOWN = [-300, -200, -100, 0, 100, 200, 300];
export const GRID = { x0: -1000, z0: -1300, cell: 8, nx: 251, nz: 276 };
export const MAP_SCALE = 0.5; // map pixels per metre

const SUMMIT = { x: -180, z: -990 };
const BASE = { x: -15, z: -660 };
const LAKE = { x: -420, z: -420, r: 62 };
const ISLET = { x: 690, z: 700 };

// Named places. Everything else (missions, vehicles, stars) hangs off these.
export const POI = {
  home: { x: -250, z: 220, door: { x: -246, z: 208.6 }, car: { x: -238, z: 216, h: Math.PI } },
  townHall: { x: -50, z: -66, front: { x: -50, z: -34 }, street: { x: -50, z: 0 } },
  park: { x: 50, z: -50, ranger: { x: 22, z: -22 } },
  school: { x: -150, z: -176, yard: { x: -150, z: -146 }, bus: { x: -168, z: -124, h: Math.PI / 2 }, street: { x: -150, z: -100 } },
  garage: { x: 150, z: -176, lot: { x: 150, z: -146 }, sports: { x: 128, z: -138, h: 0 }, paint: { x: 180, z: -130 } },
  pizza: { x: -150, z: 176, lot: { x: -150, z: 146 }, car: { x: -130, z: 138, h: Math.PI } },
  taxi: { x: 128, z: 176, lot: { x: 140, z: 148 }, car: { x: 122, z: 138, h: Math.PI } },
  police: { x: 172, z: 176, car: { x: 176, z: 138, h: Math.PI } },
  farm: {
    pasture: { x: 616, z: -76 },
    barn: { x: 600, z: 68 }, giver: { x: 588, z: 30 }, truck: { x: 570, z: 26, h: -Math.PI / 2 },
    field: { x0: 545, x1: 640, z0: 105, z1: 200 }, drop: { x: 600, z: 46 }, windmill: { x: 575, z: -72 }, road: { x: 590, z: 0 },
  },
  camp: { x: -612, z: 55 },
  lake: LAKE,
  beach: { x: 0, z: 640, pierEnd: { x: 0, z: 792 }, lighthouse: { x: 90, z: 688 }, icecream: { x: -24, z: 634, h: Math.PI / 2 } },
  base: { x: 0, z: -600, giver: { x: 12, z: -612 }, monster: { x: -20, z: -624, h: -Math.PI / 2 } },
  summit: SUMMIT,
  trail: [0.2, 0.36, 0.52, 0.68, 0.84].map((t) => ({ x: lerp(BASE.x, SUMMIT.x, t), z: lerp(BASE.z, SUMMIT.z, t) })),
  stunt: { x: 410, z: 410 },
  airfield: { x: 366, z: 440, giver: { x: 357, z: 430 } },
  islet: ISLET,
  dock: { boat: { x: 6.2, z: 770, h: 0 }, giver: { x: -2.4, z: 758 }, duck: { x: LAKE.x + 4.4, z: LAKE.z + 46, h: Math.PI } },
  soccer: { x: 410, z: -410 },
};

// ---------------------------------------------------------------------------
// Geometry batching: thousands of little boxes become a handful of draw calls.
// ---------------------------------------------------------------------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3();
const _s = new THREE.Vector3(), _e = new THREE.Euler(), _v = new THREE.Vector3();
const _n3 = new THREE.Matrix3(), _c = new THREE.Color();

function roofGeo() {
  // Gable prism: ridge along z, base 1 x 1, apex at y = 1.
  const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], C = [0, 1, -0.5];
  const D = [-0.5, 0, 0.5], E = [0.5, 0, 0.5], F = [0, 1, 0.5];
  const tris = [A, D, F, A, F, C, B, C, F, B, F, E, D, E, F, B, A, C];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}
function wedgeGeo() {
  // Ramp: height 0 at z = -0.5 rising to 1 at z = +0.5.
  const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], D = [-0.5, 0, 0.5], E = [0.5, 0, 0.5];
  const F = [-0.5, 1, 0.5], G = [0.5, 1, 0.5];
  const tris = [A, F, G, A, G, B, D, E, G, D, G, F, A, D, F, B, G, E];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}
export function taperGeo(topX, topZ, shiftZ = 0) {
  // Box whose top face is scaled, for car bodies and cabins.
  const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) { p.setX(i, p.getX(i) * topX); p.setZ(i, p.getZ(i) * topZ + shiftZ); }
  }
  g.computeVertexNormals();
  return g;
}

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 10),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  sph: new THREE.IcosahedronGeometry(1, 1),
  roof: roofGeo(),
  wedge: wedgeGeo(),
};

export class Batch {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.count = 0; }
  add(geo, x, y, z, sx, sy, sz, color, ry = 0, rx = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    _n3.getNormalMatrix(_m);
    _c.set(color);
    const pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index;
    const base = this.count;
    for (let k = 0; k < pos.count; k++) {
      _v.fromBufferAttribute(pos, k).applyMatrix4(_m); this.p.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(nor, k).applyMatrix3(_n3).normalize(); this.n.push(_v.x, _v.y, _v.z);
      this.c.push(_c.r, _c.g, _c.b);
    }
    if (idx) for (let k = 0; k < idx.count; k++) this.i.push(base + idx.getX(k));
    else for (let k = 0; k < pos.count; k++) this.i.push(base + k);
    this.count += pos.count;
    return this;
  }
  box(x, y, z, sx, sy, sz, color, ry = 0) { return this.add(GEO.box, x, y, z, sx, sy, sz, color, ry); }
  cyl(x, y, z, r, h, color, r2) { return this.add(GEO.cyl, x, y, z, r, h, r2 ?? r, color); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
  mesh(material, shadows = true) {
    const m = new THREE.Mesh(this.geometry(), material);
    m.castShadow = shadows; m.receiveShadow = true;
    return m;
  }
}

export const MAT = {
  solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
};

export function shade(hex, k) { return new THREE.Color(hex).multiplyScalar(k); }

// Building walls with a tiling window texture.
class WallBatch {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; this.count = 0; }
  quad(ax, az, bx, bz, y0, h, nx, nz, color, bay, floor) {
    const len = Math.hypot(bx - ax, bz - az);
    const nu = Math.max(1, Math.round(len / bay)), nv = Math.max(1, Math.round(h / floor));
    _c.set(color);
    const b = this.count;
    this.p.push(ax, y0, az, bx, y0, bz, ax, y0 + h, az, bx, y0 + h, bz);
    this.u.push(0, 0, nu, 0, 0, nv, nu, nv);
    for (let k = 0; k < 4; k++) { this.n.push(nx, 0, nz); this.c.push(_c.r, _c.g, _c.b); }
    this.i.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    this.count += 4;
  }
  walls(cx, cz, w, d, y0, h, color, bay = 4, floor = 3.6) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    this.quad(x0, z1, x1, z1, y0, h, 0, 1, color, bay, floor);
    this.quad(x1, z0, x0, z0, y0, h, 0, -1, color, bay, floor);
    this.quad(x1, z1, x1, z0, y0, h, 1, 0, color, bay, floor);
    this.quad(x0, z0, x0, z1, y0, h, -1, 0, color, bay, floor);
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i);
    const m = new THREE.Mesh(g, material);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}

// ---------------------------------------------------------------------------
// Canvas textures
// ---------------------------------------------------------------------------
function canvasTex(w, h, draw, repeat = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  return t;
}

function speckle(g, w, h, n, R, lo, hi, alpha) {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(lerp(lo, hi, R()));
    g.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
  }
}

function windowTex(kind) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h);
    if (kind === 'office') {
      grad.addColorStop(0, '#3f6f9c'); grad.addColorStop(1, '#8fc3e8');
      g.fillStyle = grad; g.fillRect(6, 10, w - 12, h - 26);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath(); g.moveTo(6, 10); g.lineTo(60, 10); g.lineTo(16, h - 16); g.lineTo(6, h - 16); g.fill();
      g.fillStyle = '#dfe5ea'; g.fillRect(w / 2 - 2, 10, 4, h - 26);
    } else {
      grad.addColorStop(0, '#35506e'); grad.addColorStop(1, '#7fb0d6');
      g.fillStyle = '#ffffff'; g.fillRect(30, 26, 68, 76);
      g.fillStyle = grad; g.fillRect(36, 32, 56, 64);
      g.fillStyle = '#ffffff'; g.fillRect(62, 32, 4, 64); g.fillRect(36, 62, 56, 4);
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(26, 102, 76, 6);
    }
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, h - 4, w, 4);
  });
}

function litTex(kind, R) {
  const cell = 64;
  return canvasTex(cell * 4, cell * 4, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, cell * 4, cell * 4);
    const r = kind === 'office' ? [0.05, 0.08, 0.9, 0.8] : [0.28, 0.25, 0.44, 0.5];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (R() > (kind === 'office' ? 0.42 : 0.55)) continue;
      g.fillStyle = R() < 0.8 ? '#ffd9a0' : kind === 'office' ? '#d6ecff' : '#9fd0ff';
      g.globalAlpha = 0.55 + R() * 0.45;
      g.fillRect((i + r[0]) * cell, (j + r[1]) * cell, r[2] * cell, r[3] * cell);
    }
    g.globalAlpha = 1;
  });
}

export function makeLabel(text, w, h, bg, fg, opts = {}) {
  const pxW = 512, pxH = Math.max(32, Math.round((512 * h) / w));
  const tex = canvasTex(pxW, pxH, (g) => {
    const r = pxH * 0.16;
    g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, pxW, pxH, r); g.fill();
    if (opts.border !== false) {
      g.strokeStyle = fg; g.lineWidth = pxH * 0.05;
      g.beginPath(); g.roundRect(pxH * 0.07, pxH * 0.07, pxW - pxH * 0.14, pxH - pxH * 0.14, r * 0.7); g.stroke();
    }
    let size = pxH * 0.56;
    g.font = `${size}px Bungee, Impact, "Arial Black", sans-serif`;
    while (g.measureText(text).width > pxW * 0.84 && size > 10) { size *= 0.94; g.font = `${size}px Bungee, Impact, "Arial Black", sans-serif`; }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, pxW / 2, pxH / 2 + size * 0.04);
  }, false);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  return mesh;
}

// ---------------------------------------------------------------------------
// World builder
// ---------------------------------------------------------------------------
export function buildWorld(scene) {
  const R = rng(20261118);
  const world = { POI };
  const pick = (arr) => arr[Math.floor(R() * arr.length)];

  // ---- island shape and height ----
  const outRoads = [
    [0, -600, 0, -300], [0, 300, 0, 650], [-620, 0, -300, 0], [300, 0, 620, 0],
    [-RING, -RING, RING, -RING], [-RING, RING, RING, RING], [-RING, -RING, -RING, RING], [RING, -RING, RING, RING],
  ];
  const flatRects = [
    [-330, -330, 330, 330], [530, 14, 655, 210], [553, -95, 597, -48], [-665, 14, -560, 95],
    [-45, -660, 45, -590], [350, 360, 470, 460], [350, -460, 470, -360],
  ];
  function shapeR(x, z) {
    const a = Math.pow(Math.abs(x) / 740, 3.5) + Math.pow(Math.abs(z + 250) / 1000, 3.5);
    return Math.pow(a, 1 / 3.5) + (fbm(x * 0.004 + 3, z * 0.004 + 9, 3, 3) - 0.5) * 0.04;
  }
  function flatDist(x, z) {
    let d = 1e9;
    for (const s of outRoads) d = Math.min(d, segDist(x, z, s[0], s[1], s[2], s[3]) - ROAD_HALF);
    for (const r of flatRects) {
      const dx = Math.max(r[0] - x, 0, x - r[2]), dz = Math.max(r[1] - z, 0, z - r[3]);
      d = Math.min(d, Math.hypot(dx, dz));
    }
    return Math.max(0, d);
  }
  const ridge = (() => { const dx = BASE.x - SUMMIT.x, dz = BASE.z - SUMMIT.z, l = Math.hypot(dx, dz); return { ux: dx / l, uz: dz / l }; })();
  function mountainAt(x, z) {
    const dx = x - SUMMIT.x, dz = z - SUMMIT.z;
    const along = dx * ridge.ux + dz * ridge.uz, perp = dx * ridge.uz - dz * ridge.ux;
    const a = along > 0 ? 300 : 150;
    const t = Math.sqrt((along / a) ** 2 + (perp / 190) ** 2);
    if (t >= 1) return 0;
    const m = (1 - t * t) ** 2;
    return 72 * m + (fbm(x * 0.02, z * 0.02, 11, 3) - 0.5) * 7 * Math.min(1, m * 3) * (1 - m);
  }
  function heightRaw(x, z) {
    const r = shapeR(x, z);
    const f = smoothstep(14, 80, flatDist(x, z));
    const ld = Math.hypot(x - LAKE.x, z - LAKE.z) / LAKE.r;
    const lakeMask = smoothstep(1.3, 0.85, ld);
    const hills = 13 * Math.pow(fbm(x * 0.0042 + 10, z * 0.0042 + 20, 7, 4), 1.7);
    let h = f * (hills * (1 - lakeMask) + mountainAt(x, z));
    h *= 1 - smoothstep(0.8, 0.9, r);
    h += -5.2 * smoothstep(1.0, 0.45, ld);
    h = lerp(h, -14, smoothstep(0.94, 1.06, r));
    // Treasure Islet, a sandy bump out in the bay
    const di = Math.hypot(x - ISLET.x, z - ISLET.z);
    if (di < 70) h = Math.max(h, -14 + 17.6 * smoothstep(62, 20, di) + (di < 30 ? 0.6 * fbm(x * 0.05, z * 0.05, 9, 2) : 0));
    return h;
  }

  const { nx: NX, nz: NZ, cell: CS, x0: GX, z0: GZ } = GRID;
  const H = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) H[j * NX + i] = heightRaw(GX + i * CS, GZ + j * CS);

  function heightAt(x, z) {
    const fx = (x - GX) / CS, fz = (z - GZ) / CS;
    if (fx < 0 || fz < 0 || fx >= NX - 1 || fz >= NZ - 1) return -14;
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
    const a = H[j * NX + i], b = H[j * NX + i + 1], c = H[(j + 1) * NX + i], d = H[(j + 1) * NX + i + 1];
    return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d);
  }

  // Platforms sit on top of the terrain: the pier and the stunt ramps.
  const platforms = [];
  function addPlatform(x0, z0, x1, z1, h0, h1 = h0, axis = null) { platforms.push({ x0, z0, x1, z1, h0, h1, axis }); }
  // Height of a platform top at this point, or -Infinity when there is none.
  function platAt(x, z) {
    let g = -Infinity;
    for (let k = 0; k < platforms.length; k++) {
      const p = platforms[k];
      if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
      let ph = p.h0;
      if (p.axis === 'x') ph = lerp(p.h0, p.h1, (x - p.x0) / (p.x1 - p.x0));
      else if (p.axis === 'z') ph = lerp(p.h0, p.h1, (z - p.z0) / (p.z1 - p.z0));
      if (ph > g) g = ph;
    }
    return g;
  }
  function groundAt(x, z) {
    let g = heightAt(x, z);
    for (let k = 0; k < platforms.length; k++) {
      const p = platforms[k];
      if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
      let ph = p.h0;
      if (p.axis === 'x') ph = lerp(p.h0, p.h1, (x - p.x0) / (p.x1 - p.x0));
      else if (p.axis === 'z') ph = lerp(p.h0, p.h1, (z - p.z0) / (p.z1 - p.z0));
      if (ph > g) g = ph;
    }
    return g;
  }

  // ---- roads ----
  const vLines = [], hLines = [];
  for (const x of TOWN) vLines.push({ x, z0: x === 0 ? -600 : -300, z1: x === 0 ? 650 : 300 });
  vLines.push({ x: -RING, z0: -RING, z1: RING }, { x: RING, z0: -RING, z1: RING });
  for (const z of TOWN) hLines.push({ z, x0: z === 0 ? -620 : -300, x1: z === 0 ? 620 : 300 });
  hLines.push({ z: -RING, x0: -RING, x1: RING }, { z: RING, x0: -RING, x1: RING });

  function isRoad(x, z) {
    for (let k = 0; k < vLines.length; k++) { const l = vLines[k]; if (Math.abs(x - l.x) <= ROAD_HALF && z >= l.z0 - ROAD_HALF && z <= l.z1 + ROAD_HALF) return true; }
    for (let k = 0; k < hLines.length; k++) { const l = hLines[k]; if (Math.abs(z - l.z) <= ROAD_HALF && x >= l.x0 - ROAD_HALF && x <= l.x1 + ROAD_HALF) return true; }
    return false;
  }
  const inBlockAxis = (v) => { if (v <= -293 || v >= 293) return false; const m = (((v + 300) % 100) + 100) % 100; return m > ROAD_HALF && m < 100 - ROAD_HALF; };
  // Raised town blocks are only a visual offset; the physics ground stays smooth.
  function curbAt(x, z) { return inBlockAxis(x) && inBlockAxis(z) ? CURB : 0; }
  // 0 = paved, 1 = grass, 2 = sand
  function surfaceAt(x, z) {
    if (isRoad(x, z)) return 0;
    if (Math.abs(x) < 300 && Math.abs(z) < 300) return 0;
    if (x > 352 && x < 468 && z > 362 && z < 458) return 0; // stunt park tarmac
    if (shapeR(x, z) > 0.885) return 2;
    return 1;
  }

  const nodes = [], edges = [], nodeMap = new Map();
  const getNode = (x, z) => { const k = x + ',' + z; let n = nodeMap.get(k); if (!n) { n = { id: nodes.length, x, z, links: [] }; nodes.push(n); nodeMap.set(k, n); } return n; };
  const link = (a, b) => { const e = { a, b, len: Math.hypot(a.x - b.x, a.z - b.z) }; edges.push(e); a.links.push({ to: b, e }); b.links.push({ to: a, e }); };
  for (const v of vLines) {
    const zs = new Set([v.z0, v.z1]);
    for (const h of hLines) if (v.x >= h.x0 && v.x <= h.x1 && h.z >= v.z0 && h.z <= v.z1) zs.add(h.z);
    const arr = [...zs].sort((a, b) => a - b).map((z) => getNode(v.x, z));
    for (let k = 0; k + 1 < arr.length; k++) link(arr[k], arr[k + 1]);
  }
  for (const h of hLines) {
    const xs = new Set([h.x0, h.x1]);
    for (const v of vLines) if (h.z >= v.z0 && h.z <= v.z1 && v.x >= h.x0 && v.x <= h.x1) xs.add(v.x);
    const arr = [...xs].sort((a, b) => a - b).map((x) => getNode(x, h.z));
    for (let k = 0; k + 1 < arr.length; k++) link(arr[k], arr[k + 1]);
  }

  // Shortest road route between two points (used by the map's yellow line).
  function route(ax, az, bx, bz) {
    const nearestEdge = (x, z) => { let best = null, bd = 1e9; for (const e of edges) { const d = segDist(x, z, e.a.x, e.a.z, e.b.x, e.b.z); if (d < bd) { bd = d; best = e; } } return best; };
    const eb = nearestEdge(bx, bz), ea = nearestEdge(ax, az);
    const dist = new Float64Array(nodes.length).fill(1e12), prev = new Int32Array(nodes.length).fill(-1), done = new Uint8Array(nodes.length);
    dist[eb.a.id] = Math.hypot(bx - eb.a.x, bz - eb.a.z);
    dist[eb.b.id] = Math.hypot(bx - eb.b.x, bz - eb.b.z);
    for (;;) {
      let u = -1, ud = 1e12;
      for (let k = 0; k < nodes.length; k++) if (!done[k] && dist[k] < ud) { ud = dist[k]; u = k; }
      if (u < 0) break;
      done[u] = 1;
      for (const l of nodes[u].links) { const nd = ud + l.e.len; if (nd < dist[l.to.id]) { dist[l.to.id] = nd; prev[l.to.id] = u; } }
    }
    const ca = dist[ea.a.id] + Math.hypot(ax - ea.a.x, az - ea.a.z), cb = dist[ea.b.id] + Math.hypot(ax - ea.b.x, az - ea.b.z);
    if (ea === eb) return [[ax, az], [bx, bz]];
    const pts = [[ax, az]];
    let n = ca <= cb ? ea.a.id : ea.b.id;
    while (n >= 0) { pts.push([nodes[n].x, nodes[n].z]); n = prev[n]; }
    pts.push([bx, bz]);
    return pts;
  }

  // ---- collision ----
  const CELL = 32, CGX = -1024, CGZ = -1312, CN = 72;
  const cgrid = new Array(CN * CN);
  const cidx = (x, z) => clamp(Math.floor((z - CGZ) / CELL), 0, CN - 1) * CN + clamp(Math.floor((x - CGX) / CELL), 0, CN - 1);
  function insert(c, x0, z0, x1, z1) {
    const i0 = clamp(Math.floor((x0 - CGX) / CELL), 0, CN - 1), i1 = clamp(Math.floor((x1 - CGX) / CELL), 0, CN - 1);
    const j0 = clamp(Math.floor((z0 - CGZ) / CELL), 0, CN - 1), j1 = clamp(Math.floor((z1 - CGZ) / CELL), 0, CN - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) (cgrid[j * CN + i] ||= []).push(c);
  }
  const footprints = [];
  const chimneys = [];   // where smoke rises from
  const roofs = [];      // flat roofs a helicopter can land on
  // h is the height of the top of a thing above sea level: what can be flown over or stood on.
  function addBox(x0, z0, x1, z1, onMap = true, h) { insert({ t: 0, x0, z0, x1, z1, h: h ?? (onMap ? 1e9 : 1.5) }, x0, z0, x1, z1); if (onMap) footprints.push([x0, z0, x1, z1]); }
  function addCircle(x, z, r, h = 1e9) { insert({ t: 1, x, z, r, h }, x - r, z - r, x + r, z + r); }
  const boxAround = (cx, cz, w, d, onMap = true, h) => addBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, onMap, h);

  // Push a circle out of everything solid. Returns true when it touched something.
  // Things whose top is at or below y (plus a small step) are skipped: you are above them.
  function collide(o, r, y = -1e9) {
    let hit = false; o.nx = 0; o.nz = 0;
    for (let pass = 0; pass < 2; pass++) {
      const i0 = clamp(Math.floor((o.x - r - CGX) / CELL), 0, CN - 1), i1 = clamp(Math.floor((o.x + r - CGX) / CELL), 0, CN - 1);
      const j0 = clamp(Math.floor((o.z - r - CGZ) / CELL), 0, CN - 1), j1 = clamp(Math.floor((o.z + r - CGZ) / CELL), 0, CN - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const list = cgrid[j * CN + i]; if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const c = list[k];
          if (c.h <= y + 0.35) continue;
          if (c.t === 0) {
            const px = clamp(o.x, c.x0, c.x1), pz = clamp(o.z, c.z0, c.z1);
            const dx = o.x - px, dz = o.z - pz, d2 = dx * dx + dz * dz;
            if (d2 >= r * r) continue;
            if (d2 > 1e-8) { const d = Math.sqrt(d2); o.x += (dx / d) * (r - d); o.z += (dz / d) * (r - d); o.nx = dx / d; o.nz = dz / d; }
            else {
              const l = o.x - c.x0, rr = c.x1 - o.x, t = o.z - c.z0, b = c.z1 - o.z, m = Math.min(l, rr, t, b);
              if (m === l) { o.x = c.x0 - r; o.nx = -1; o.nz = 0; } else if (m === rr) { o.x = c.x1 + r; o.nx = 1; o.nz = 0; }
              else if (m === t) { o.z = c.z0 - r; o.nx = 0; o.nz = -1; } else { o.z = c.z1 + r; o.nx = 0; o.nz = 1; }
            }
            hit = true;
          } else {
            const dx = o.x - c.x, dz = o.z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
            if (d2 >= rr * rr) continue;
            const d = Math.sqrt(d2) || 0.001;
            o.x += (dx / d) * (rr - d); o.z += (dz / d) * (rr - d); o.nx = dx / d; o.nz = dz / d; hit = true;
          }
        }
      }
    }
    return hit;
  }
  // True when a point is inside a solid box (camera collision).
  function solidAt(x, z, pad = 0.4, y = 0) {
    const list = cgrid[cidx(x, z)]; if (!list) return false;
    for (let k = 0; k < list.length; k++) { const c = list[k]; if (c.t === 0 && y < c.h && x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return true; }
    return false;
  }
  // The highest roof under a point that is no more than a step above y. -Infinity when there is none.
  function roofAt(x, z, y, step = 0.6) {
    const list = cgrid[cidx(x, z)]; let best = -Infinity; if (!list) return best;
    for (let k = 0; k < list.length; k++) { const c = list[k]; if (c.t === 0 && c.h < 1e8 && c.h <= y + step && c.h > best && x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) best = c.h; }
    return best;
  }

  // ---- terrain mesh ----
  {
    const pos = new Float32Array(NX * NZ * 3), col = new Float32Array(NX * NZ * 3), uv = new Float32Array(NX * NZ * 2);
    const cSand = new THREE.Color(0xecdca8), cSea = new THREE.Color(0xb9a877), cG1 = new THREE.Color(0x6db650), cG2 = new THREE.Color(0x8fcc5f);
    const cForest = new THREE.Color(0x58a04a), cFarm = new THREE.Color(0xc2cf62), cRock = new THREE.Color(0x8d877c), cSnow = new THREE.Color(0xf6f9fc), cDirt = new THREE.Color(0xa98d5f);
    const tmp = new THREE.Color();
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, x = GX + i * CS, z = GZ + j * CS, h = H[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      uv[k * 2] = x / 28; uv[k * 2 + 1] = z / 28;
      const r = shapeR(x, z);
      const n = fbm(x * 0.012, z * 0.012, 5, 3);
      tmp.copy(cG1).lerp(cG2, smoothstep(0.3, 0.7, n));
      tmp.lerp(cForest, smoothstep(-250, -420, x) * 0.7);
      const fd = Math.hypot(x - 592, z - 150); tmp.lerp(cFarm, smoothstep(150, 70, fd) * 0.85);
      const m = mountainAt(x, z);
      if (m > 1) {
        const sl = Math.abs(H[Math.min(k + 1, H.length - 1)] - h) + Math.abs(H[Math.min(k + NX, H.length - 1)] - h);
        tmp.lerp(cRock, clamp(smoothstep(18, 44, h) + smoothstep(3.2, 6.5, sl) * 0.8, 0, 1));
        tmp.lerp(cSnow, smoothstep(56, 64, h));
      }
      // The dirt trail up the ridge.
      const td = segDist(x, z, BASE.x, BASE.z + 40, SUMMIT.x, SUMMIT.z);
      if (h < 60) tmp.lerp(cDirt, smoothstep(9, 4, td) * 0.8);
      const ld = Math.hypot(x - LAKE.x, z - LAKE.z) / LAKE.r;
      tmp.lerp(cSand, smoothstep(1.12, 0.98, ld));
      tmp.lerp(cSand, smoothstep(0.87, 0.9, r));
      if (h < WATER_Y) tmp.lerp(cSea, smoothstep(WATER_Y, WATER_Y - 4, h));
      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
    }
    const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6);
    let q = 0;
    for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const detail = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, w, h); speckle(c, w, h, 1400, R, 190, 255, 0.5); });
    const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: detail }));
    ground.receiveShadow = true;
    scene.add(ground);
  }

  // (the water surface lives in water.js; it needs the finished height map)

  // ---- road meshes ----
  {
    const strip = { p: [], u: [], i: [], n: 0 }, junc = { p: [], u: [], i: [], n: 0 };
    const Y = 0.05;
    const quad = (o, x0, z0, x1, z1, alongX, plain) => {
      const b = o.n;
      o.p.push(x0, Y, z0, x1, Y, z0, x0, Y, z1, x1, Y, z1);
      if (plain) o.u.push(x0 / 14, z0 / 14, x1 / 14, z0 / 14, x0 / 14, z1 / 14, x1 / 14, z1 / 14);
      else if (alongX) o.u.push(0, x0 / 14, 0, x1 / 14, 1, x0 / 14, 1, x1 / 14);
      else o.u.push(0, z0 / 14, 1, z0 / 14, 0, z1 / 14, 1, z1 / 14);
      o.i.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); o.n += 4;
    };
    for (const e of edges) {
      const horiz = e.a.z === e.b.z;
      const ta = e.a.links.length > 1 ? ROAD_HALF : 0, tb = e.b.links.length > 1 ? ROAD_HALF : 0;
      if (horiz) quad(strip, e.a.x + ta, e.a.z - ROAD_HALF, e.b.x - tb, e.a.z + ROAD_HALF, true);
      else quad(strip, e.a.x - ROAD_HALF, e.a.z + ta, e.a.x + ROAD_HALF, e.b.z - tb, false);
    }
    for (const n of nodes) {
      if (n.links.length > 1) quad(junc, n.x - ROAD_HALF, n.z - ROAD_HALF, n.x + ROAD_HALF, n.z + ROAD_HALF, false, true);
      else {
        // Dead ends finish in a turning circle.
        const b = junc.n, seg = 20, rad = 12;
        junc.p.push(n.x, Y + 0.01, n.z); junc.u.push(n.x / 14, n.z / 14);
        for (let k = 0; k <= seg; k++) { const a = (k / seg) * Math.PI * 2; const x = n.x + Math.cos(a) * rad, z = n.z + Math.sin(a) * rad; junc.p.push(x, Y + 0.01, z); junc.u.push(x / 14, z / 14); }
        for (let k = 0; k < seg; k++) junc.i.push(b, b + 2 + k, b + 1 + k);
        junc.n += seg + 2;
      }
    }
    const asphalt = (c, w, h) => { c.fillStyle = '#3d4149'; c.fillRect(0, 0, w, h); speckle(c, w, h, 2600, R, 40, 95, 0.55); };
    const stripTex = canvasTex(256, 256, (c, w, h) => {
      asphalt(c, w, h);
      c.fillStyle = '#f3f1e6'; c.fillRect(w * 0.045, 0, w * 0.022, h); c.fillRect(w * 0.933, 0, w * 0.022, h);
      c.fillStyle = '#ffd21f'; c.fillRect(w * 0.488, h * 0.12, w * 0.024, h * 0.52);
    });
    const juncTex = canvasTex(256, 256, asphalt);
    const mk = (o, tex) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(o.u, 2));
      g.setIndex(o.i); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      m.receiveShadow = true; scene.add(m);
    };
    mk(strip, stripTex); mk(junc, juncTex);
  }

  // ---- batches for everything static ----
  const B = new Batch();
  const NB = new Batch();       // window panes that glow after dark
  const lights = [];            // lamps and other glows: { x, y, z, size, power, pool, px, pz, py }
  const RL = rng(4242);
  const litColor = () => (RL() < 0.86 ? 0xffd58a : 0xa9d4ff);
  // A lamp post with a glow and a pool of light under it.
  const lamp = (x, z, h = 6, pool = 9, y0 = 0, power = 0.9) => {
    B.cyl(x, y0 + h / 2, z, 0.14, h, 0x4a5058); B.box(x, y0 + h + 0.1, z, 0.7, 0.24, 0.7, 0xfff3c2);
    lights.push({ x, y: y0 + h, z, size: 5 + pool * 0.35, power, pool, px: x, pz: z, py: y0 + 0.07 });
  };
  const D = new Batch(); // flat overlays, drawn with a depth offset so they never flicker
  const walls = { apt: new WallBatch(), office: new WallBatch() };
  const labels = [];
  const trees = { round: [], pine: [], palm: [] };
  const animated = [];
  const putLabel = (text, w, h, bg, fg, x, y, z, ry = 0, both = false) => {
    const m = makeLabel(text, w, h, bg, fg); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); labels.push(m);
    if (both) { const b = new THREE.Mesh(m.geometry, m.material); b.position.set(x - Math.sin(ry) * 0.06, y, z - Math.cos(ry) * 0.06); b.rotation.y = ry + Math.PI; scene.add(b); }
    return m;
  };
  const tree = (x, z, kind = 'round', s = 1, solid = true) => { trees[kind].push([x, z, s * (0.8 + R() * 0.5), R()]); if (solid) addCircle(x, z, 0.55, groundAt(x, z) + 6.5 * s); };

  const PASTEL = [0xf6d6ad, 0xf2b9a0, 0xbfe0c4, 0xb9d7ee, 0xf7e7a6, 0xe8c3dd, 0xfff3dc, 0xcfe3a8, 0xd9c7b0];
  const ROOFS = [0xb5483a, 0x596a7b, 0x7b5a3c, 0x3f6f5a, 0x8a3f52, 0x44505c];
  const TINT_MID = [0xc98469, 0xeadfc6, 0xdc9a6f, 0xb4c7ab, 0xb0cbe0, 0xe6c96f, 0xe7b1ab, 0xd2c2e4];
  const TINT_TALL = [0xbcd6ea, 0xc6dfd3, 0xdfe4ea, 0xf3e7cb, 0xcad3f0, 0xeed6c6];
  const AWN = [0xe23b2e, 0x1f8a70, 0x2d6cdf, 0xf2a71b, 0x8e44ad];

  function house(x, z, ry, o = {}) {
    const w = o.w ?? 13, d = o.d ?? 10, hw = o.hw ?? 4.6, base = curbAt(x, z);
    const wall = o.wall ?? pick(PASTEL), roof = o.roof ?? pick(ROOFS);
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const L = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    B.box(x, base + hw / 2, z, w, hw, d, wall, ry);
    B.add(GEO.roof, x, base + hw, z, d + 1.4, o.roofH ?? 3.2, w + 1.4, roof, ry + Math.PI / 2);
    let [px, pz] = L(0, d / 2 + 0.06);
    B.box(px, base + 1.2, pz, 1.5, 2.4, 0.16, o.door ?? 0x6b3f2a, ry);
    for (const sx of [-0.31, 0.31]) { [px, pz] = L(w * sx, d / 2 + 0.05); B.box(px, base + 2.5, pz, 2.0, 1.6, 0.14, 0xa9daf5, ry); B.box(px, base + 1.62, pz, 2.3, 0.14, 0.3, 0xffffff, ry); if (RL() < 0.66) NB.box(px, base + 2.5, pz, 2.0, 1.6, 0.2, litColor(), ry); }
    for (const sx of [-1, 1]) { [px, pz] = L(sx * (w / 2 + 0.05), 0); B.box(px, base + 2.5, pz, 0.14, 1.6, 2.2, 0xa9daf5, ry); if (RL() < 0.5) NB.box(px, base + 2.5, pz, 0.2, 1.6, 2.2, litColor(), ry); }
    [px, pz] = L(w * 0.28, -d * 0.12); B.box(px, base + hw + 2.0, pz, 1.1, 2.6, 1.1, 0x9a5b45, ry); chimneys.push([px, base + hw + 3.4, pz]);
    [px, pz] = L(0, d / 2 + 0.8); B.box(px, base + 0.12, pz, 2.6, 0.24, 1.4, 0xd9d4c7, ry);
    const pathLen = o.path ?? 5.5;
    [px, pz] = L(0, d / 2 + 1.5 + pathLen / 2); D.box(px, base + 0.03, pz, 1.6, 0.06, pathLen, 0xdcd6c6, ry);
    const rot = Math.abs(Math.sin(ry)) > 0.5;
    boxAround(x, z, rot ? d : w, rot ? w : d, true, base + hw + (o.roofH ?? 3.2) * 0.55);
  }

  function lot(cx, cz, w, d, h, tint, kind, roofTint) {
    walls[kind].walls(cx, cz, w, d, CURB, h, tint, kind === 'office' ? 4 : 4.4, kind === 'office' ? 3.8 : 3.5);
    B.box(cx, CURB + h + 0.3, cz, w + 0.8, 0.6, d + 0.8, roofTint ?? shade(tint, 0.55));
    boxAround(cx, cz, w, d, true, CURB + h + 0.6);
    roofs.push({ x: cx, z: cz, w, d, top: CURB + h + 0.6, kind });
  }

  // ---- town blocks ----
  const blockCenter = (bx, bz) => [-250 + 100 * bx, -250 + 100 * bz];
  const frame = (cx, cz, col) => { for (const s of [-1, 1]) { B.box(cx, CURB - 0.15, cz + s * 41.5, 86, 0.3, 3, col); B.box(cx + s * 41.5, CURB - 0.15, cz, 3, 0.3, 80, col); } };
  const special = { '2,2': 'hall', '3,2': 'park', '1,1': 'school', '4,1': 'garage', '1,4': 'pizza', '4,4': 'taxi' };
  for (let bx = 0; bx < 6; bx++) for (let bz = 0; bz < 6; bz++) {
    const [cx, cz] = blockCenter(bx, bz);
    const city = bx >= 1 && bx <= 4 && bz >= 1 && bz <= 4;
    const kind = special[bx + ',' + bz] || (city ? ((bx === 2 || bx === 3) && bz === 3 ? 'tall' : 'mid') : 'homes');
    if (kind === 'park') {
      frame(cx, cz, 0xd2cec4); B.box(cx, CURB - 0.15, cz, 80, 0.3, 80, 0x7cc75c);
      D.box(cx, CURB + 0.02, cz, 80, 0.04, 4, 0xe9dfc3); D.box(cx, CURB + 0.02, cz, 4, 0.04, 80, 0xe9dfc3);
    } else if (kind === 'homes') {
      frame(cx, cz, 0xd2cec4); B.box(cx, CURB - 0.15, cz, 80, 0.3, 80, 0x8ed066);
    } else {
      B.box(cx, CURB - 0.15, cz, 86, 0.3, 86, 0xcbc7bd);
    }

    if (kind === 'homes') {
      const isHome = bx === 0 && bz === 5;
      for (const sx of [-27, 0, 27]) {
        if (isHome && sx === 0) continue;
        house(cx + sx, cz - 30, Math.PI); house(cx + sx, cz + 30, 0);
      }
      if (isHome) house(cx, cz + 30, 0);
      house(cx - 30, cz, -Math.PI / 2); house(cx + 30, cz, Math.PI / 2);
      for (let k = 0; k < 4; k++) tree(cx + (R() - 0.5) * 30, cz + (R() - 0.5) * 30, R() < 0.8 ? 'round' : 'pine');
      for (let k = 0; k < 5; k++) { const a = R() * 6.28; B.add(GEO.sph, cx + Math.cos(a) * (8 + R() * 10), CURB + 0.6, cz + Math.sin(a) * (8 + R() * 10), 1.1, 0.8, 1.1, pick([0x4f9a45, 0x62ad4f, 0x3f8a52])); }
    } else if (kind === 'mid' || kind === 'tall') {
      for (const ox of [-21.5, 21.5]) for (const oz of [-21.5, 21.5]) {
        const tall = kind === 'tall';
        const w = 30 + R() * 7, d = 30 + R() * 7;
        const h = tall ? 30 + R() * 46 : 9 + Math.floor(R() * 4) * 3.5;
        const tint = pick(tall ? TINT_TALL : TINT_MID);
        const x = cx + ox, z = cz + oz;
        lot(x, z, w, d, h, tint, tall ? 'office' : 'apt'); roofs[roofs.length - 1].block = true;
        if (tall) {
          const ax = (R() - 0.5) * 8, az = (R() - 0.5) * 8;
          B.box(x + ax, CURB + h + 1.6, z + az, 5, 2, 5, 0x9aa3ad); roofs[roofs.length - 1].ac = [ax, az];
          if (R() < 0.6) B.cyl(x, CURB + h + 5, z, 0.18, 9, 0x7c8590);
          if (R() < 0.5) { const sw = w * 0.7, sd = d * 0.7, sh = 8 + R() * 12; walls.office.walls(x, z, sw, sd, CURB + h + 0.6, sh, tint); B.box(x, CURB + h + 0.6 + sh + 0.3, z, sw + 0.6, 0.6, sd + 0.6, shade(tint, 0.55)); addBox(x - sw / 2, z - sd / 2, x + sw / 2, z + sd / 2, false, CURB + h + 1.2 + sh); roofs[roofs.length - 1].setback = true; }
        } else {
          const ac = pick(AWN);
          B.box(x + Math.sign(ox) * (w / 2 + 0.6), CURB + 3.5, z, 1.3, 0.3, d * 0.8, ac);
          B.box(x, CURB + 3.5, z + Math.sign(oz) * (d / 2 + 0.6), w * 0.8, 0.3, 1.3, ac);
        }
      }
      // Street trees and lamp posts on the corners.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) tree(cx + sx * 39.5, cz + sz * 39.5, 'round', 0.75, false);
    }
  }
  // Lamp posts at every town corner.
  for (const x of TOWN) for (const z of TOWN) {
    if (Math.abs(x) === 300 && Math.abs(z) === 300) continue;
    const lx = x + 8.6, lz = z + 8.6;
    if (!inBlockAxis(lx) || !inBlockAxis(lz)) continue;
    B.cyl(lx, CURB + 3, lz, 0.14, 6, 0x4a5058); B.box(lx - 0.7, CURB + 6, lz - 0.7, 1.6, 0.14, 0.2, 0x4a5058, Math.PI / 4); B.box(lx - 1.2, CURB + 5.85, lz - 1.2, 0.5, 0.22, 0.5, 0xfff3c2);
    lights.push({ x: lx - 1.2, y: CURB + 5.7, z: lz - 1.2, pool: 10, px: lx - 2.8, pz: lz - 2.8 });
  }

  // ---- Christian's house ----
  {
    const { x, z } = POI.home;
    house(x, z, Math.PI, { w: 16, d: 12, hw: 5.2, roofH: 3.8, wall: 0x3f8fe0, roof: 0xd9342b, door: 0xffd21f, path: 4 });
    D.box(-238, CURB + 0.03, 216.5, 6, 0.06, 19, 0xbdb9b0);               // driveway
    B.cyl(-262, CURB + 4, 211, 0.1, 8, 0xdfe3e7); B.box(-260.6, CURB + 7.2, 211, 2.6, 1.5, 0.08, 0xffd21f); // flag
    B.box(-244, CURB + 0.7, 208.4, 0.16, 1.4, 0.16, 0x5a4634); B.box(-244, CURB + 1.5, 208.4, 0.5, 0.4, 0.8, 0xd9342b); // mailbox
    putLabel("CHRISTIAN'S HOUSE", 9, 1.5, '#0a7a4b', '#ffffff', x, CURB + 4.6, z - 6.12, Math.PI);
    lights.push({ x, y: CURB + 3.7, z: z - 6.5, size: 5, power: 0.85, pool: 6.5, px: x, pz: z - 9.5, py: CURB + 0.07 });
  }

  // ---- Town Hall ----
  {
    const { x, z } = POI.townHall, y = CURB;
    B.box(x, y + 0.5, z, 56, 1, 32, 0xd8d2c2);
    B.box(x, y + 8, z, 52, 14, 28, 0xf1e8d2);
    B.box(x, y + 15.4, z, 54, 0.8, 30, 0xcfc6ad);
    for (let k = 0; k < 6; k++) B.cyl(x - 17.5 + k * 7, y + 6, z + 17, 0.95, 10, 0xffffff);
    B.box(x, y + 11.6, z + 17, 40, 1.4, 4, 0xe9e0c8);
    B.add(GEO.roof, x, y + 12.3, z + 17, 40, 5, 4, 0xe9e0c8);
    for (let k = 0; k < 3; k++) B.box(x, y + 0.2 + k * 0.3, z + 20 + (2 - k) * 0.9, 38, 0.3, 2.4, 0xcfc8b6);
    B.box(x, y + 20.4, z, 9, 10, 9, 0xf1e8d2);
    B.add(GEO.cone4, x, y + 28.6, z, 7.4, 6.4, 7.4, 0x1f8a70, Math.PI / 4);
    B.cyl(x, y + 33, z, 0.12, 3, 0xdfe3e7);
    for (const [ox, oz, r] of [[0, 4.6, 0], [0, -4.6, 0], [4.6, 0, 1], [-4.6, 0, 1]]) B.add(GEO.cyl, x + ox, y + 21.5, z + oz, 2.4, 0.2, 2.4, 0xffffff, 0, r ? 0 : Math.PI / 2, r ? Math.PI / 2 : 0);
    for (let k = 0; k < 5; k++) { B.box(x - 20 + k * 10, y + 8.6, z + 14.08, 3, 5, 0.16, 0x7fb0d6); NB.box(x - 20 + k * 10, y + 8.6, z + 14.08, 3, 5, 0.22, 0xffd58a); }
    lights.push({ x, y: y + 21.5, z: z + 5.2, size: 8, power: 0.7 }); lamp(x - 22, z + 26, 5, 9, y); lamp(x + 22, z + 26, 5, 9, y);
    B.box(x, y + 2.6, z + 14.1, 4.4, 5, 0.2, 0x6b3f2a);
    for (const sx of [-1, 1]) { B.cyl(x + sx * 30, y + 5, z + 30, 0.12, 10, 0xdfe3e7); B.box(x + sx * 30 + 1.5, y + 9, z + 30, 3, 1.8, 0.08, sx < 0 ? 0xe23b2e : 0x2d6cdf); }
    putLabel('TOWN HALL', 14, 2, '#f1e8d2', '#27323f', x, y + 11.6, z + 19.05);
    boxAround(x, z + 1, 56, 34, true, y + 15.8); boxAround(x, z, 9, 9, false, y + 26);
    for (let k = 0; k < 6; k++) { B.add(GEO.sph, x - 38, y + 0.8, z + 28 - k * 9, 1.4, 1.1, 1.4, 0x4f9a45); B.add(GEO.sph, x + 38, y + 0.8, z + 28 - k * 9, 1.4, 1.1, 1.4, 0x4f9a45); }
  }

  // ---- Central Park ----
  {
    const { x, z } = POI.park, y = CURB;
    B.cyl(x, y + 0.5, z, 5.2, 1, 0xcfd3d6); B.cyl(x, y + 1.02, z, 4.6, 0.06, 0x6fc3ee);
    B.cyl(x, y + 1.6, z, 0.6, 2.4, 0xcfd3d6); B.cyl(x, y + 2.9, z, 1.8, 0.3, 0xcfd3d6); B.add(GEO.sph, x, y + 3.5, z, 0.7, 0.9, 0.7, 0xbfe8ff);
    addCircle(x, z, 5.3, y + 3.6);
    for (let k = 0; k < 26; k++) {
      const tx = x + (R() - 0.5) * 74, tz = z + (R() - 0.5) * 74;
      if (Math.abs(tx - x) < 5 || Math.abs(tz - z) < 5 || Math.hypot(tx - x, tz - z) < 9) continue;
      if (tx > x + 18 && tz > z + 14) continue; // playground corner
      tree(tx, tz, R() < 0.8 ? 'round' : 'pine');
    }
    for (const [bx, bz, r] of [[8, 4, 0], [-8, -4, 0], [4, -9, 1], [-4, 9, 1]]) { B.box(x + bx, y + 0.5, z + bz, r ? 0.7 : 2.6, 0.14, r ? 2.6 : 0.7, 0x9a6b3f); B.box(x + bx, y + 0.25, z + bz, r ? 0.5 : 2.2, 0.5, r ? 2.2 : 0.5, 0x4a5058); }
    // Playground
    const px = x + 30, pz = z + 26;
    D.box(px, y + 0.04, pz, 20, 0.08, 16, 0xe9c98a);
    B.box(px - 6, y + 1.6, pz - 4, 0.2, 3.2, 0.2, 0xe23b2e); B.box(px - 1, y + 1.6, pz - 4, 0.2, 3.2, 0.2, 0xe23b2e); B.box(px - 3.5, y + 3.2, pz - 4, 5.4, 0.2, 0.2, 0xe23b2e);
    B.box(px - 4.6, y + 0.9, pz - 4, 0.9, 0.1, 0.5, 0x2d6cdf); B.box(px - 2.4, y + 0.9, pz - 4, 0.9, 0.1, 0.5, 0xffd21f);
    B.box(px + 5, y + 1.5, pz + 2, 2, 3, 2, 0x8e44ad); B.add(GEO.box, px + 5, y + 1.5, pz + 5.2, 1.6, 0.16, 5.4, 0xffd21f, 0, 0.55);
    B.add(GEO.sph, px - 2, y + 0.45, pz + 4, 0.45, 0.45, 0.45, 0xff7a1a);
    putLabel('CENTRAL PARK', 9, 1.5, '#0a7a4b', '#ffffff', x - 34, y + 3.2, z + 40.5, 0, true);
    B.box(x - 38, y + 1.6, z + 40.5, 0.2, 3.2, 0.2, 0x4a5058); B.box(x - 30, y + 1.6, z + 40.5, 0.2, 3.2, 0.2, 0x4a5058);
  }

  // ---- service buildings ----
  function hallBuilding(cx, cz, w, d, h, tint, sign, signBg, signFg, faceSouth) {
    lot(cx, cz, w, d, h, tint, 'apt');
    const fz = cz + (faceSouth ? d / 2 : -d / 2), dir = faceSouth ? 1 : -1;
    putLabel(sign, Math.min(w * 0.7, 22), 2.2, signBg, signFg, cx, CURB + h - 1.6, fz + dir * 0.12, faceSouth ? 0 : Math.PI);
    return { fz, dir };
  }
  {
    // School
    const s = POI.school;
    const f = hallBuilding(s.x, s.z, 70, 26, 9, 0xc76b52, 'SUNNY SIDE SCHOOL', '#ffd21f', '#27323f', true);
    B.box(s.x, CURB + 2, f.fz + 0.12, 5, 4, 0.2, 0x2d6cdf);
    B.cyl(s.x + 24, CURB + 5, f.fz + 6, 0.12, 10, 0xdfe3e7); B.box(s.x + 25.5, CURB + 9, f.fz + 6, 3, 1.8, 0.08, 0xe23b2e);
    B.box(s.x, CURB + 10.5, s.z, 8, 3, 8, 0xc76b52); B.add(GEO.cone4, s.x, CURB + 13.6, s.z, 6.6, 3.4, 6.6, 0x44505c, Math.PI / 4);
    // Garage
    const g = POI.garage;
    const gf = hallBuilding(g.x, g.z, 70, 26, 8, 0xaeb9c4, "SPEEDY'S GARAGE", '#e23b2e', '#ffffff', true);
    for (let k = -1; k <= 1; k++) B.box(g.x + k * 20, CURB + 2.6, gf.fz + 0.12, 12, 5.2, 0.2, 0x39414c);
    for (let k = 0; k < 9; k++) B.box(g.x - 32 + k * 8, CURB + 7.3, gf.fz + 0.14, 4, 0.9, 0.16, k % 2 ? 0x27323f : 0xffffff);
    // Spray booth
    const p = g.paint;
    B.box(p.x - 4.2, CURB + 2.4, p.z - 3, 0.5, 4.8, 12, 0xe23b2e); B.box(p.x + 4.2, CURB + 2.4, p.z - 3, 0.5, 4.8, 12, 0x2d6cdf);
    B.box(p.x, CURB + 5, p.z - 3, 9, 0.5, 12, 0xffd21f);
    putLabel('PAINT SHOP', 7.6, 1.3, '#27323f', '#ffd21f', p.x, CURB + 5.9, p.z + 3.05, 0, true);
    addBox(p.x - 4.5, p.z - 9, p.x - 3.9, p.z + 3, false, CURB + 5.3); addBox(p.x + 3.9, p.z - 9, p.x + 4.5, p.z + 3, false, CURB + 5.3);
    // Pizza
    const z = POI.pizza;
    const pf = hallBuilding(z.x, z.z, 44, 26, 7, 0xf2e6d0, 'SLICE SHACK PIZZA', '#e23b2e', '#ffffff', false);
    for (let k = 0; k < 10; k++) B.box(z.x - 19.8 + k * 4.4, CURB + 3.6, pf.fz - 1.2, 4.4, 0.3, 2.4, k % 2 ? 0xe23b2e : 0xffffff);
    B.add(GEO.cyl, z.x, CURB + 9.2, z.z, 5, 0.5, 5, 0xe8b65a, 0, 0.5); B.add(GEO.cyl, z.x, CURB + 9.45, z.z - 0.12, 4.3, 0.3, 4.3, 0xf4d35e, 0, 0.5);
    for (const [ox, oz] of [[-1.8, -1], [1.6, -1.6], [0.2, 1.4], [-1.4, 2], [2.2, 1]]) B.add(GEO.cyl, z.x + ox, CURB + 9.62 - oz * 0.52, z.z + oz * 0.86, 0.75, 0.2, 0.75, 0xc0392b, 0, 0.5);
    lot(z.x - 34, z.z, 16, 24, 10.5, 0xb4c7ab, 'apt'); lot(z.x + 34, z.z, 16, 24, 7, 0xe7b1ab, 'apt');
    // Taxi depot and police station
    const t = POI.taxi;
    const tf = hallBuilding(t.x, t.z, 34, 26, 7, 0xf5c518, 'TAXI', '#27323f', '#ffd21f', false);
    for (let k = 0; k < 8; k++) B.box(t.x - 14.9 + k * 4.25, CURB + 4.2, tf.fz - 0.14, 2.1, 0.9, 0.16, 0x27323f);
    B.box(t.x - 6, CURB + 2.4, tf.fz - 0.12, 9, 4.8, 0.2, 0x39414c);
    const pl = POI.police;
    const plf = hallBuilding(pl.x, pl.z, 34, 26, 8, 0x9fb7d6, 'POLICE', '#1d3f8f', '#ffffff', false);
    B.box(pl.x, CURB + 2, plf.fz - 0.12, 4, 4, 0.2, 0x1d3f8f);
    B.add(GEO.sph, pl.x - 8, CURB + 8.9, pl.z, 1, 1, 1, 0x2d6cdf); B.add(GEO.sph, pl.x + 8, CURB + 8.9, pl.z, 1, 1, 1, 0xe23b2e);
    // Parking bay lines for the lots
    const bays = (cx, cz, n) => { for (let k = 0; k <= n; k++) D.box(cx - (n * 2.2) + k * 4.4, CURB + 0.02, cz, 0.18, 0.04, 7, 0xf3f1e6); };
    bays(g.x - 20, -138, 4); bays(z.x + 18, 138, 4); bays(t.x - 2, 138, 3); bays(pl.x + 2, 138, 3);
    lamp(g.x + 30, -112, 6, 10, CURB); lamp(z.x - 24, 112, 6, 10, CURB); lamp(t.x + 22, 112, 6, 10, CURB); lamp(s.x + 30, -112, 6, 10, CURB);
  }

  // ---- farm ----
  {
    const f = POI.farm, bx = f.barn.x, bz = f.barn.z;
    B.box(bx, 4.5, bz, 24, 9, 16, 0xb3372e); B.add(GEO.roof, bx, 9, bz, 17.5, 5.5, 25.5, 0x5a3b34, Math.PI / 2);
    B.box(bx, 3, bz - 8.08, 7, 6, 0.2, 0x8f2b24); B.box(bx, 3, bz - 8.2, 7.4, 0.3, 0.1, 0xffffff); B.box(bx, 6, bz - 8.2, 7.4, 0.3, 0.1, 0xffffff);
    B.box(bx - 3.6, 3, bz - 8.2, 0.3, 6, 0.1, 0xffffff); B.box(bx + 3.6, 3, bz - 8.2, 0.3, 6, 0.1, 0xffffff);
    B.add(GEO.box, bx, 3, bz - 8.2, 9, 0.28, 0.1, 0xffffff, 0, 0, 0.72); B.add(GEO.box, bx, 3, bz - 8.2, 9, 0.28, 0.1, 0xffffff, 0, 0, -0.72);
    boxAround(bx, bz, 24, 16, true, 11.6);
    B.cyl(bx + 19, 7, bz - 2, 4, 14, 0xd9dde1); B.add(GEO.cone, bx + 19, 15.5, bz - 2, 4.3, 3, 4.3, 0x8e959c); addCircle(bx + 19, bz - 2, 4.1, 17);
    house(552, 60, Math.PI, { wall: 0xfff3dc, roof: 0x3f6f5a });
    lamp(585, 40, 6, 11);
    putLabel('MAPLE FARM', 9, 1.6, '#7b5a3c', '#fff3dc', 560, 4.2, 14.5, Math.PI, true); B.box(556, 2, 14.5, 0.3, 4, 0.3, 0x7b5a3c); B.box(564, 2, 14.5, 0.3, 4, 0.3, 0x7b5a3c);
    // Field fence with gates
    const F = f.field, post = (x, z) => B.box(x, 0.7, z, 0.25, 1.4, 0.25, 0xf5f2ea);
    const rail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = Math.abs(x1 - x0) > 0.1;
      for (const y of [0.55, 1.1]) B.box(cx, y, cz, alongX ? len : 0.12, 0.14, alongX ? 0.12 : len, 0xf5f2ea);
      for (let t = 0; t <= len + 0.1; t += 5) post(lerp(x0, x1, t / len), lerp(z0, z1, t / len));
      addBox(Math.min(x0, x1) - 0.15, Math.min(z0, z1) - 0.15, Math.max(x0, x1) + 0.15, Math.max(z0, z1) + 0.15, false);
    };
    rail(F.x0, F.z0, 578, F.z0); rail(606, F.z0, F.x1, F.z0); rail(F.x0, F.z1, F.x1, F.z1); rail(F.x0, F.z0, F.x0, F.z1); rail(F.x1, F.z0, F.x1, F.z1);
    for (let k = 0; k < 9; k++) D.box(lerp(F.x0 + 6, F.x1 - 6, k / 8), 0.06, (F.z0 + F.z1) / 2, 1.4, 0.1, F.z1 - F.z0 - 8, 0x9c7a45);
    for (const [hx, hz] of [[612, 52], [615, 55], [613.5, 53.5]]) B.add(GEO.cyl, hx, hz === 53.5 ? 2.4 : 0.9, hz, 0.9, 1.6, 0.9, 0xe2c35a, 0, 0, Math.PI / 2);
    // Windmill
    const w = f.windmill;
    B.add(GEO.cone4, w.x, 9, w.z, 5.2, 18, 5.2, 0xf5f2ea, Math.PI / 4); B.add(GEO.cone4, w.x, 19.2, w.z, 3.4, 3, 3.4, 0xb5483a, Math.PI / 4); addCircle(w.x, w.z, 3.6, 21);
    const blades = new Batch();
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; blades.add(GEO.box, Math.cos(a) * 5, Math.sin(a) * 5, 0, 9, 1.6, 0.14, 0xfdfbf3, 0, 0, a); }
    blades.add(GEO.cyl, 0, 0, 0, 0.6, 0.8, 0.6, 0x7b5a3c, 0, Math.PI / 2);
    const bm = blades.mesh(MAT.solid); bm.position.set(w.x, 16.5, w.z + 1.5); B.box(w.x, 16.5, w.z + 0.7, 0.7, 0.7, 1.6, 0x7b5a3c); scene.add(bm);
    animated.push((dt) => { bm.rotation.z += dt * 0.9; });
    for (let k = 0; k < 10; k++) tree(535 + R() * 110, -30 - R() * 14, 'round');
  }

  // ---- Sunset Camp (west) ----
  {
    const c = POI.camp;
    for (const [tx, tz, col, ry] of [[-626, 44, 0xff7a1a, 0.3], [-600, 40, 0x1f8a70, -0.4], [-590, 66, 0x2d6cdf, 1.2]]) { B.add(GEO.roof, tx, 0, tz, 5, 3.2, 6, col, ry); addCircle(tx, tz, 2.4, 3.2); }
    B.cyl(c.x, 0.2, c.z, 1.4, 0.4, 0x8d877c); for (let k = 0; k < 3; k++) B.add(GEO.cone, c.x + Math.cos(k * 2.1) * 0.35, 0.9, c.z + Math.sin(k * 2.1) * 0.35, 0.45, 1.3, 0.45, k ? 0xff7a1a : 0xffd21f);
    lights.push({ x: c.x, y: 1.1, z: c.z, size: 7, power: 1, r: 1, g: 0.55, b: 0.2, pool: 8, px: c.x, pz: c.z, py: 0.08 }); lamp(-596, 24, 5, 9);
    addCircle(c.x, c.z, 1.5, 1.4);
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.5; B.add(GEO.cyl, c.x + Math.cos(a) * 3.4, 0.35, c.z + Math.sin(a) * 3.4, 0.4, 2, 0.4, 0x7b5a3c, a, 0, Math.PI / 2); }
    house(-640, 72, Math.PI / 2, { wall: 0x9a6b3f, roof: 0x3f6f5a, w: 11, d: 9 });
    putLabel('SUNSET CAMP', 9, 1.6, '#7b5a3c', '#fff3dc', -574, 4.2, 16, Math.PI, true); B.box(-578, 2, 16, 0.3, 4, 0.3, 0x7b5a3c); B.box(-570, 2, 16, 0.3, 4, 0.3, 0x7b5a3c);
    // A canoe and a little dock on the lake
    B.add(GEO.sph, LAKE.x + 20, WATER_Y + 0.2, LAKE.z + 30, 0.8, 0.5, 3.2, 0xb5483a, 0.6);
    B.box(LAKE.x, WATER_Y + 0.45, LAKE.z + 50, 4, 0.3, 22, 0x9a6b3f);
    addPlatform(LAKE.x - 2, LAKE.z + 39, LAKE.x + 2, LAKE.z + 61, WATER_Y + 0.6);
    addBox(LAKE.x - 2, LAKE.z + 39, LAKE.x + 2, LAKE.z + 61, false, WATER_Y + 0.5);   // boats bump the dock, feet do not
  }

  // ---- beach, pier and lighthouse ----
  {
    const b = POI.beach;
    B.box(0, 1.1, 745, 8, 0.4, 110, 0xa77b4c);
    for (const pz of [705, 735, 765, 795]) lamp(pz % 2 ? -3.3 : 3.3, pz, 3.6, 7, 1.3, 0.8);
    lamp(-14, 652, 6, 10); lamp(14, 652, 6, 10);
    for (let z = 695; z <= 800; z += 15) for (const sx of [-3.6, 3.6]) B.cyl(sx, -2, z, 0.35, 7, 0x7b5a3c);
    B.add(GEO.wedge, 0, -0.1, 685, 8, 1.4, 10, 0xa77b4c);
    for (const sx of [-3.9, 3.9]) { B.box(sx, 2.3, 746, 0.14, 0.14, 108, 0x7b5a3c); for (let z = 694; z <= 800; z += 6) B.box(sx, 1.8, z, 0.16, 1.1, 0.16, 0x7b5a3c); addBox(sx - 0.15, 692, sx + 0.15, 800, false, 2.5); }
    B.box(0, 2.3, 800, 8, 0.14, 0.14, 0x7b5a3c); addBox(-4, 799.85, 4, 800.15, false, 2.5);
    addPlatform(-4, 690, 4, 800, 1.3); addPlatform(-4, 680, 4, 690, 0, 1.3, 'z');
    const L = b.lighthouse;
    for (let k = 0; k < 5; k++) B.cyl(L.x, 3 + k * 5, L.z, 4 - k * 0.42, 5, k % 2 ? 0xe23b2e : 0xffffff, 4 - k * 0.42);
    B.cyl(L.x, 26.3, L.z, 3.4, 0.5, 0x39414c); B.cyl(L.x, 28, L.z, 1.7, 3, 0xfff3a8); B.add(GEO.cone, L.x, 30.6, L.z, 2.6, 2.4, 2.6, 0xe23b2e);
    lights.push({ x: L.x, y: 28, z: L.z, size: 20, power: 1, r: 1, g: 0.95, b: 0.72 });
    B.cyl(L.x, 0.4, L.z, 6, 1.2, 0x8d877c); addCircle(L.x, L.z, 4.3, 31);
    const UMB = [0xe23b2e, 0xffd21f, 0x2d6cdf, 0x1f8a70, 0xff7a1a, 0x8e44ad];
    for (let k = 0; k < 14; k++) {
      const ux = -230 + k * 34 + (R() - 0.5) * 12, uz = 664 + (R() - 0.5) * 16 - Math.abs(ux) * 0.035;
      if (Math.abs(ux) < 16 || Math.hypot(ux - L.x, uz - L.z) < 9) continue;
      B.cyl(ux, 1.2, uz, 0.07, 2.4, 0xf3f1e6); B.add(GEO.cone, ux, 2.6, uz, 2.2, 0.9, 2.2, UMB[k % 6]);
      B.box(ux + 1.6, 0.04, uz + 0.6, 1, 0.06, 2.2, UMB[(k + 2) % 6], R());
    }
    B.box(40, 2.4, 650, 3.4, 0.3, 3.4, 0xf5f2ea); B.box(40, 3.6, 650, 3, 2, 3, 0xe23b2e); for (const [sx, sz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) B.cyl(40 + sx, 1.2, 650 + sz, 0.12, 2.4, 0xf5f2ea);
    addCircle(40, 650, 2.2, 4.7);
    for (let k = 0; k < 14; k++) { const px = -260 + k * 40 + (R() - 0.5) * 16; if (Math.abs(px) < 18) continue; tree(px, 646 - Math.abs(px) * 0.045 + (R() - 0.5) * 8, 'palm'); }
    putLabel('SANDY BEACH', 9, 1.6, '#0a7a4b', '#ffffff', 16, 4.2, 612, -Math.PI / 2, true); B.box(16, 2, 608, 0.3, 4, 0.3, 0x4a5058); B.box(16, 2, 616, 0.3, 4, 0.3, 0x4a5058);
  }

  // ---- mountain base camp, trail flags and summit ----
  {
    const b = POI.base;
    house(26, -634, Math.PI, { wall: 0x9a6b3f, roof: 0x596a7b, w: 12, d: 9 });
    lamp(4, -596, 6, 10);
    putLabel('SUMMIT TRAIL', 8, 1.5, '#7b5a3c', '#fff3dc', -30, 4, -652, 0.5, true); B.box(-33.4, 2, -650.2, 0.3, 4, 0.3, 0x7b5a3c); B.box(-26.6, 2, -653.8, 0.3, 4, 0.3, 0x7b5a3c);
    const flag = (x, z, col, big) => { const y = heightAt(x, z); B.cyl(x, y + (big ? 4 : 1.6), z, big ? 0.14 : 0.08, big ? 8 : 3.2, 0xdfe3e7); B.box(x + (big ? 1.6 : 0.7), y + (big ? 7 : 2.8), z, big ? 3.2 : 1.3, big ? 2 : 0.8, 0.08, col); };
    for (let k = 0; k <= 12; k++) { const t = k / 12, x = lerp(BASE.x, SUMMIT.x, t), z = lerp(BASE.z, SUMMIT.z, t); for (const s of [-9, 9]) flag(x + ridge.uz * s, z - ridge.ux * s, k % 2 ? 0xff7a1a : 0xffd21f); }
    flag(SUMMIT.x + 3, SUMMIT.z - 3, 0xe23b2e, true);
    const sy = heightAt(SUMMIT.x, SUMMIT.z);
    for (let k = 0; k < 4; k++) B.add(GEO.sph, SUMMIT.x - 4, sy + 0.5 + k * 0.8, SUMMIT.z + 4, 1.3 - k * 0.28, 0.6, 1.3 - k * 0.28, 0x8d877c);
    world.summitY = sy;
  }

  // ---- stunt park ----
  {
    const s = POI.stunt;
    D.box(s.x, 0.03, s.z, 116, 0.06, 96, 0x4a4f58);
    for (let k = 0; k < 12; k++) D.box(s.x - 52 + k * 9.5, 0.07, s.z - 30, 4.6, 0.02, 0.5, 0xffd21f);
    const ramp = (x0, z0, len, wid, h, dir) => {
      // dir +1 rises toward +x, -1 rises toward -x
      const cx = x0 + (dir * len) / 2;
      B.add(GEO.wedge, cx, 0, z0, wid, h, len, 0xffd21f, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      B.add(GEO.wedge, cx, 0.01, z0, wid * 0.5, h, len, 0xe23b2e, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      if (dir > 0) addPlatform(x0, z0 - wid / 2, x0 + len, z0 + wid / 2, 0, h, 'x'); else addPlatform(x0 - len, z0 - wid / 2, x0, z0 + wid / 2, h, 0, 'x');
    };
    ramp(s.x - 20, s.z - 30, 14, 9, 3.4, 1); ramp(s.x + 50, s.z - 8, 14, 9, 3.4, -1);
    ramp(s.x - 14, s.z + 10, 18, 10, 5.4, 1);
    ramp(s.x + 6, s.z + 34, 10, 8, 2, -1);
    putLabel('STUNT PARK', 12, 2, '#27323f', '#ffd21f', s.x, 6, s.z - 46.5, Math.PI, true); B.box(s.x - 5.5, 2.6, s.z - 46.5, 0.3, 5.2, 0.3, 0x4a5058); B.box(s.x + 5.5, 2.6, s.z - 46.5, 0.3, 5.2, 0.3, 0x4a5058);
    for (const [ox, oz] of [[-52, -42], [52, -42], [-52, 42], [52, 42]]) lamp(s.x + ox, s.z + oz, 11, 20, 0, 1);
    world.bigRamp = { x: s.x + 4, z: s.z + 10 };
  }

  // ---- soccer field ----
  {
    const s = POI.soccer;
    D.box(s.x, 0.03, s.z, 100, 0.06, 64, 0x57b04a);
    for (let k = 0; k < 10; k += 2) D.box(s.x - 45 + k * 10, 0.05, s.z, 10, 0.04, 64, 0x62bd53);
    const ln = (x, z, w, d) => D.box(x, 0.08, z, w, 0.03, d, 0xffffff);
    ln(s.x, s.z - 31.8, 100, 0.4); ln(s.x, s.z + 31.8, 100, 0.4); ln(s.x - 49.8, s.z, 0.4, 64); ln(s.x + 49.8, s.z, 0.4, 64); ln(s.x, s.z, 0.4, 64);
    for (const sx of [-1, 1]) {
      const gx = s.x + sx * 50;
      B.box(gx, 2, s.z - 7, 0.3, 4, 0.3, 0xffffff); B.box(gx, 2, s.z + 7, 0.3, 4, 0.3, 0xffffff); B.box(gx, 4, s.z, 0.3, 0.3, 14.3, 0xffffff);
      B.box(gx + sx * 2.5, 2, s.z, 0.1, 4, 14, 0xdfe7ee); addBox(gx + sx * 2.5 - 0.15, s.z - 7, gx + sx * 2.5 + 0.15, s.z + 7, false, 4.2);
    }
    world.soccer = { x: s.x, z: s.z, halfL: 50, goalHalf: 7 };
    for (const [ox, oz] of [[-46, -36], [46, -36], [-46, 36], [46, 36]]) lamp(s.x + ox, s.z + oz, 11, 20, 0, 1);
  }

  // ---- countryside trees and rocks ----
  for (let k = 0; k < 5200; k++) {
    const x = -760 + R() * 1520, z = -1240 + R() * 2000;
    const r = shapeR(x, z);
    if (r > 0.865) continue;
    if (flatDist(x, z) < 10) continue;
    const h = heightAt(x, z);
    if (h < 0.4 || h > 46) continue;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r * 1.15) continue;
    if (segDist(x, z, BASE.x, BASE.z, SUMMIT.x, SUMMIT.z) < 16) continue;
    const dens = 0.16 + 0.75 * smoothstep(0.42, 0.62, fbm(x * 0.006 + 40, z * 0.006 + 7, 21, 3)) + (x < -330 ? 0.25 : 0) + (z < -540 ? 0.2 : 0);
    if (R() > dens) continue;
    const pine = z < -540 || h > 14 || (x < -330 && R() < 0.6) || R() < 0.15, big = 1 + R() * 0.5;
    // the meadows where the cows and sheep graze stay clear (the two spare draws keep every other tree where it was)
    const pa = POI.farm.pasture;
    if (Math.hypot(x - pa.x, z - pa.z) < 27 || Math.hypot(x - pa.x + 6, z - pa.z + 26) < 21) { R(); R(); continue; }
    tree(x, z, pine ? 'pine' : 'round', big);
  }
  const rocks = [];
  for (let k = 0; k < 420; k++) {
    const x = -760 + R() * 1520, z = -1240 + R() * 2000, h = heightAt(x, z);
    if (h < 0.3 || flatDist(x, z) < 12) continue;
    if (mountainAt(x, z) < 6 && R() > 0.12) continue;
    rocks.push([x, h, z, 0.6 + R() * 1.6]);
  }

  // ---- boost pads: drive over the arrows for a burst of speed ----
  const boosts = [];
  {
    const pad = (cx, cz, h) => {
      const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
      D.box(cx, 0.05, cz, 4.4, 0.02, 7.6, 0x2b2f36, h);
      for (const o of [-2.3, 0, 2.3]) for (const sd of [-1, 1]) D.box(cx + fx * o + rx * 0.82 * sd, 0.09, cz + fz * o + rz * 0.82 * sd, 0.5, 0.02, 2.45, o === 0 ? 0xffd21f : 0xff7a1a, h + 0.726 * sd);
      boosts.push({ x: cx, z: cz, h });
      lights.push({ x: cx, y: 0.5, z: cz, size: 5, power: 0.55, r: 1, g: 0.55, b: 0.12 });
    };
    // a pad sits in the right-hand lane of the road it is on
    const lane = (x, z, h) => pad(x - Math.cos(h) * 3.4, z + Math.sin(h) * 3.4, h);
    const E = Math.PI / 2, W = -Math.PI / 2, S = 0, N = Math.PI;
    for (const t of [-260, 260]) {
      lane(t, -RING, E); lane(t, -RING, W); lane(t, RING, E); lane(t, RING, W);
      lane(-RING, t, S); lane(-RING, t, N); lane(RING, t, S); lane(RING, t, N);
    }
    lane(420, 0, E); lane(420, 0, W); lane(-420, 0, E); lane(-420, 0, W);
    lane(0, -430, S); lane(0, -430, N); lane(0, 420, S); lane(0, 420, N);
    const sp = POI.stunt;
    pad(sp.x - 38, sp.z - 30, E); pad(sp.x - 36, sp.z + 10, E); pad(sp.x + 32, sp.z + 34, W);
  }

  // ---- helipads, the rooftop pad and Treasure Islet (after everything that uses the main random stream) ----
  const helipads = [];
  const helipad = (name, x, z, y, r = 5.5) => {
    D.add(GEO.cyl, x, y + 0.03, z, r, 0.04, r, 0xffd21f); D.add(GEO.cyl, x, y + 0.05, z, r - 0.5, 0.04, r - 0.5, 0x39414c);
    for (const sx of [-1, 1]) D.box(x + sx * 1.3, y + 0.08, z, 0.6, 0.04, 4, 0xffffff);
    D.box(x, y + 0.08, z, 2.6, 0.04, 0.6, 0xffffff);
    helipads.push({ name, x, z, y });
  };
  helipad('Airfield', POI.airfield.x, POI.airfield.z, 0.07);
  helipad('Farm', 628, 30, 0.02);
  {
    const flat = roofs.filter((r) => r.kind === 'office' && !r.setback).sort((a, b) => b.top - a.top)[0] || roofs.slice().sort((a, b) => b.top - a.top)[0];
    const ac = flat.ac || [-1, -1];   // keep the pad clear of the air-conditioning box
    world.roofPad = { x: flat.x - Math.sign(ac[0] || 1) * (flat.w / 2 - 7), z: flat.z - Math.sign(ac[1] || 1) * (flat.d / 2 - 7), y: flat.top };
    helipad('Tower roof', world.roofPad.x, world.roofPad.z, flat.top, 4.6);
    lights.push({ x: world.roofPad.x, y: flat.top + 0.6, z: world.roofPad.z, size: 6, power: 0.8, r: 1, g: 0.3, b: 0.25 });
    // palms and a treasure chest on the islet
    for (const [ox, oz] of [[-8, 6], [9, -4], [2, 13], [-12, -9], [14, 10]]) { const x = ISLET.x + ox, z = ISLET.z + oz; trees.palm.push([x, z, 0.9 + RL() * 0.4, RL()]); addCircle(x, z, 0.5, groundAt(x, z) + 7); }
    const cy = groundAt(ISLET.x, ISLET.z);
    B.box(ISLET.x, cy + 0.45, ISLET.z, 1.6, 0.9, 1.1, 0x8a5a2b); B.box(ISLET.x, cy + 0.95, ISLET.z, 1.7, 0.3, 1.2, 0x6b4428);
    for (const sx of [-0.55, 0.55]) B.box(ISLET.x + sx, cy + 0.6, ISLET.z, 0.14, 1.3, 1.24, 0xffd21f);
    B.box(ISLET.x, cy + 0.75, ISLET.z + 0.58, 0.3, 0.34, 0.08, 0xffd21f);
    addCircle(ISLET.x, ISLET.z, 1.1, cy + 1.2);
    lights.push({ x: ISLET.x, y: cy + 1.6, z: ISLET.z, size: 5, power: 0.7, r: 1, g: 0.85, b: 0.4 });
  }

  // Tree geometry: trunk and foliage merged, drawn with instancing.
  const treeGeo = {
    round: new Batch().cyl(0, 1.6, 0, 0.32, 3.2, 0x7a5636, 0.4).add(GEO.sph, 0, 4.6, 0, 2.5, 2.3, 2.5, 0x5fb04a).add(GEO.sph, 1.1, 3.9, 0.6, 1.6, 1.4, 1.6, 0x55a443).add(GEO.sph, -0.9, 4.1, -0.8, 1.7, 1.5, 1.7, 0x69ba52).geometry(),
    pine: new Batch().cyl(0, 1.1, 0, 0.3, 2.2, 0x6b4a30).add(GEO.cone, 0, 3.4, 0, 2.4, 3.4, 2.4, 0x2f7d4a).add(GEO.cone, 0, 5.4, 0, 1.8, 3, 1.8, 0x358a52).add(GEO.cone, 0, 7.1, 0, 1.2, 2.4, 1.2, 0x3d965a).geometry(),
    palm: (() => { const b = new Batch(); b.add(GEO.cyl, 0.4, 3, 0, 0.24, 6.2, 0.24, 0x9a7b55, 0, 0, -0.13); for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.283; b.add(GEO.sph, 0.8 + Math.cos(a) * 1.7, 6, Math.sin(a) * 1.7, 2, 0.16, 0.6, 0x3fa55a, -a, 0, -0.35); } return b.geometry(); })(),
  };
  const dummy = new THREE.Object3D(), tc = new THREE.Color();
  for (const kind of ['round', 'pine', 'palm']) {
    // One instanced mesh per 500 m square, so trees behind the camera are skipped.
    const cells = new Map();
    for (const t of trees[kind]) { const key = Math.floor(t[0] / 500) + ',' + Math.floor(t[1] / 500); (cells.get(key) || cells.set(key, []).get(key)).push(t); }
    for (const list of cells.values()) {
      const im = new THREE.InstancedMesh(treeGeo[kind], MAT.solid, list.length);
      list.forEach(([x, z, s, rot], k) => {
        dummy.position.set(x, groundAt(x, z) + curbAt(x, z) - 0.05, z); dummy.rotation.set(0, rot * 6.283, 0); dummy.scale.set(s, s * (0.9 + rot * 0.3), s); dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix); tc.setHSL(0, 0, 0.82 + rot * 0.18); im.setColorAt(k, tc);
      });
      im.computeBoundingSphere();
      im.castShadow = true; im.receiveShadow = true; scene.add(im);
    }
  }
  {
    const im = new THREE.InstancedMesh(GEO.sph, new THREE.MeshLambertMaterial({ color: 0x9a948a, flatShading: true }), rocks.length);
    rocks.forEach(([x, y, z, s], k) => { dummy.position.set(x, y + s * 0.2, z); dummy.rotation.set(k, k * 2, k * 3); dummy.scale.set(s, s * 0.7, s * 1.2); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); });
    im.castShadow = true; im.receiveShadow = true; scene.add(im);
  }

  // ---- finish the static meshes ----
  scene.add(B.mesh(MAT.solid));
  { const dm = D.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), false); scene.add(dm); }
  const wallMat = (kind) => {
    const em = litTex(kind, RL); em.repeat.set(0.25, 0.25);
    return new THREE.MeshLambertMaterial({ map: windowTex(kind), vertexColors: true, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 0 });
  };
  const matA = wallMat('apt'), matO = wallMat('office');
  scene.add(walls.apt.mesh(matA)); scene.add(walls.office.mesh(matO));
  const nightMesh = NB.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 }), false);
  nightMesh.visible = false; nightMesh.receiveShadow = false; scene.add(nightMesh);
  let lastNight = -1;
  // Called every frame with 0 (day) to 1 (night); cheap when nothing changed.
  function setNight(n) {
    if (Math.abs(n - lastNight) < 0.004) return;
    lastNight = n;
    matA.emissiveIntensity = matO.emissiveIntensity = n * 1.1;
    nightMesh.visible = n > 0.02; nightMesh.material.opacity = Math.min(1, n * 1.15);
    const k = 1 - n * 0.55; for (const m of labels) m.material.color.setScalar(k);
  }

  // ---- clouds (the sky itself lives in sky.js) ----
  const cloudB = new Batch();
  for (const [ox, oy, oz, s] of [[0, 0, 0, 1], [1.5, 0.2, 0.3, 0.8], [-1.6, 0.1, -0.2, 0.75], [0.6, 0.5, -0.5, 0.7], [-0.5, 0.45, 0.5, 0.65]]) cloudB.add(GEO.sph, ox, oy, oz, s * 1.5, s, s * 1.2, 0xffffff);
  const clouds = new THREE.InstancedMesh(cloudB.geometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), 34);
  const cloudData = [];
  for (let k = 0; k < 34; k++) cloudData.push({ x: -2200 + R() * 4400, y: 230 + R() * 170, z: -2400 + R() * 4400, s: 26 + R() * 44, v: 4 + R() * 5 });
  clouds.frustumCulled = false; scene.add(clouds);
  const updClouds = (dt) => {
    cloudData.forEach((c, k) => { c.x += c.v * dt; if (c.x > 2300) c.x = -2300; dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(c.s, c.s * 0.6, c.s); dummy.updateMatrix(); clouds.setMatrixAt(k, dummy.matrix); });
    clouds.instanceMatrix.needsUpdate = true;
  };
  updClouds(0);

  // ---- the map (also drawn onto the minimap) ----
  const mapW = Math.round((NX - 1) * CS * MAP_SCALE), mapH = Math.round((NZ - 1) * CS * MAP_SCALE);
  const toMap = (x, z) => [(x - GX) * MAP_SCALE, (z - GZ) * MAP_SCALE];
  const mapCanvas = document.createElement('canvas'); mapCanvas.width = mapW; mapCanvas.height = mapH;
  {
    const g = mapCanvas.getContext('2d');
    const small = document.createElement('canvas'); small.width = NX; small.height = NZ;
    const sg = small.getContext('2d'), img = sg.createImageData(NX, NZ);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, h = H[k], x = GX + i * CS, z = GZ + j * CS;
      let c;
      if (h < WATER_Y) c = [86, 178, 232];
      else if (shapeR(x, z) > 0.885 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r * 1.05) c = [240, 226, 178];
      else if (h > 56) c = [246, 249, 252];
      else if (h > 22) c = [176, 170, 158];
      else { const t = clamp(h / 22, 0, 1); c = [lerp(150, 122, t), lerp(206, 178, t), lerp(112, 96, t)]; }
      img.data[k * 4] = c[0]; img.data[k * 4 + 1] = c[1]; img.data[k * 4 + 2] = c[2]; img.data[k * 4 + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, NX, NZ, 0, 0, mapW, mapH);
    const rect = (x0, z0, x1, z1, fill) => { const [a, b] = toMap(x0, z0), [c, d] = toMap(x1, z1); g.fillStyle = fill; g.fillRect(a, b, c - a, d - b); };
    for (let bx = 0; bx < 6; bx++) for (let bz = 0; bz < 6; bz++) { const [cx, cz] = blockCenter(bx, bz); const k = special[bx + ',' + bz]; const city = bx >= 1 && bx <= 4 && bz >= 1 && bz <= 4; rect(cx - 43, cz - 43, cx + 43, cz + 43, k === 'park' ? '#86cf68' : city ? '#dcd7cb' : '#a9dc84'); }
    rect(POI.stunt.x - 58, POI.stunt.z - 48, POI.stunt.x + 58, POI.stunt.z + 48, '#7b818b'); rect(POI.soccer.x - 50, POI.soccer.z - 32, POI.soccer.x + 50, POI.soccer.z + 32, '#57b04a');
    rect(POI.farm.field.x0, POI.farm.field.z0, POI.farm.field.x1, POI.farm.field.z1, '#c9b46a'); rect(-4, 680, 4, 800, '#a77b4c');
    for (const pass of [['#5d646f', ROAD_HALF * 2 + 4], ['#fbf8ee', ROAD_HALF * 2 - 1]]) {
      g.strokeStyle = pass[0]; g.lineWidth = pass[1] * MAP_SCALE; g.lineCap = 'round';
      for (const e of edges) { const [a, b] = toMap(e.a.x, e.a.z), [c, d] = toMap(e.b.x, e.b.z); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
    }
    g.fillStyle = '#9d968a'; for (const f of footprints) { const [a, b] = toMap(f[0], f[1]), [c, d] = toMap(f[2], f[3]); g.fillRect(a, b, c - a, d - b); }
    g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const h of helipads) { const [a, b] = toMap(h.x, h.z); g.fillStyle = '#ffd21f'; g.beginPath(); g.arc(a, b, 6, 0, 6.3); g.fill(); g.fillStyle = '#27323f'; g.fillText('H', a, b + 0.5); }
    g.strokeStyle = '#a98d5f'; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); { const [a, b] = toMap(BASE.x, BASE.z + 50), [c, d] = toMap(SUMMIT.x, SUMMIT.z); g.moveTo(a, b); g.lineTo(c, d); } g.stroke(); g.setLineDash([]);
  }

  Object.assign(world, {
    heightAt, groundAt, platAt, curbAt, surfaceAt, isRoad, shapeR, collide, solidAt, addBox, addCircle, addPlatform,
    nodes, edges, route, mapCanvas, mapW, mapH, toMap, blockCenter, flatDist, roofAt, lights, setNight, heightGrid: H, cloudMat: clouds.material, roofs, helipads, boosts, chimneys,
    update(dt, t) {
      for (const f of animated) f(dt, t);
      updClouds(dt);
    },
  });
  return world;
}
