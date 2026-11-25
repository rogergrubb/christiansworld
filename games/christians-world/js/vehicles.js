// Cars: how they look, how they drive, and the traffic that shares the road.
import * as THREE from './three.js';
import { clamp, damp, angDiff, lerp } from './util.js';
import { Batch, GEO, MAT, taperGeo, WATER_Y } from './world.js';

const T = (o) => Object.assign({
  style: 'car', len: 4.2, wid: 1.8, h: 0.62, clr: 0.3, wr: 0.34, ww: 0.26, cab: { l: 2.2, h: 0.6, z: -0.2 },
  max: 27, acc: 7.5, brk: 17, steer: 0.6, steerV: 15, grip: 9, off: 0.42, mass: 1100,
}, o);

// max is top speed in metres per second, off is how well it copes away from the road (0 to 1).
export const CAR_TYPES = {
  hatch: T({ name: 'Little Red', color: 0xd9342b, len: 3.9, cab: { l: 2.3, h: 0.62, z: -0.35 } }),
  sedan: T({ name: 'Sedan', color: 0x4d7ea8, len: 4.4, cab: { l: 2.2, h: 0.58, z: -0.15 } }),
  taxi: T({ name: 'Taxi', color: 0xf5c518, len: 4.5, cab: { l: 2.3, h: 0.6, z: -0.15 }, extra: 'taxi', max: 30, acc: 8 }),
  pizza: T({ name: 'Pizza Car', color: 0xfdf8ee, len: 3.6, wid: 1.7, cab: { l: 2.1, h: 0.66, z: -0.3 }, extra: 'pizza', max: 28, acc: 8.5 }),
  pickup: T({ name: 'Farm Truck', style: 'pickup', color: 0x2f6fb3, len: 5.2, wid: 2.0, h: 0.72, clr: 0.5, wr: 0.45, cab: { l: 1.9, h: 0.7, z: 0.55 }, max: 26, acc: 7.5, off: 0.9, mass: 1700 }),
  sports: T({ name: 'Sunfire GT', color: 0xff7a1a, len: 4.4, wid: 1.95, h: 0.5, clr: 0.2, wr: 0.35, cab: { l: 1.9, h: 0.42, z: -0.3 }, extra: 'spoiler', max: 47, acc: 12.5, brk: 24, grip: 11, off: 0.25, steerV: 19 }),
  police: T({ name: 'Police Cruiser', color: 0xf7f9fb, len: 4.6, cab: { l: 2.3, h: 0.6, z: -0.15 }, extra: 'police', max: 40, acc: 10.5, brk: 22, grip: 10 }),
  monster: T({ name: 'Monster Truck', style: 'pickup', color: 0x7a3fd1, len: 4.8, wid: 2.5, h: 0.85, clr: 1.3, wr: 1.05, ww: 0.75, cab: { l: 1.8, h: 0.75, z: 0.5 }, extra: 'monster', max: 25, acc: 9.5, off: 1.0, mass: 3000, steer: 0.55, grip: 8 }),
  bus: T({ name: 'School Bus', style: 'bus', color: 0xf2b705, len: 9.5, wid: 2.6, h: 2.3, clr: 0.5, wr: 0.5, ww: 0.34, max: 19, acc: 4.6, brk: 13, steerV: 11, mass: 6000 }),
  icecream: T({ name: 'Ice Cream Truck', style: 'van', color: 0xfff6fa, len: 5.2, wid: 2.1, h: 2.0, clr: 0.42, wr: 0.4, extra: 'icecream', max: 21, acc: 5.5, mass: 2400 }),
  van: T({ name: 'Van', style: 'van', color: 0xe8e8e8, len: 5.0, wid: 2.0, h: 1.7, clr: 0.4, wr: 0.38, max: 23, acc: 6 }),
  rocket: T({ name: 'Rocket Car', color: 0x1fb7c9, len: 4.7, wid: 1.95, h: 0.5, clr: 0.2, wr: 0.36, cab: { l: 1.7, h: 0.42, z: -0.1 }, extra: 'rocket', max: 62, acc: 19, brk: 30, grip: 12.5, off: 0.35, steerV: 24 }),
  speedboat: T({ name: 'Speedboat', style: 'boat', color: 0xf7f9fb, len: 5.6, wid: 2.2, h: 0.85, clr: -0.3, wr: 0, max: 24, acc: 9, turn: 1.2, mass: 1300 }),
  duck: T({ name: 'Duck Boat', style: 'duck', color: 0xffd21f, len: 3.2, wid: 2.0, h: 0.9, clr: -0.25, wr: 0, max: 6.5, acc: 3.2, turn: 1.5, mass: 500 }),
  heli: T({ name: 'Sky Hopper', style: 'heli', color: 0xe23b2e, len: 6.6, wid: 2.3, h: 1.5, clr: 0.55, wr: 0, max: 34, acc: 14, mass: 1600 }),
};
export const TRAFFIC_COLORS = [0x4d7ea8, 0x8fb9a8, 0xe8e2d0, 0x9b5de5, 0x2a9d8f, 0xe76f51, 0x577590, 0xf4a261, 0x6d6875, 0x90be6d];
export const PAINT_COLORS = [0xd9342b, 0x2d6cdf, 0x1f8a70, 0xffd21f, 0xff7a1a, 0x8e44ad, 0xff5fa2, 0x27323f, 0xf7f9fb, 0x1fb7c9, 0x7cc75c];

const BODY = taperGeo(0.95, 0.97), CAB = taperGeo(0.84, 0.64), CAB_PICK = taperGeo(0.86, 0.8, -0.04);
const DARK = 0x222830, GLASS = 0x1c2a3a, LIGHT = 0xfff6c4, TAIL = 0xd91e18;

const wheelGeo = (() => {
  const b = new Batch();
  b.add(GEO.cyl, 0, 0, 0, 1, 1, 1, 0x1b1c1f, 0, 0, Math.PI / 2);
  b.add(GEO.cyl, 0, 0, 0, 0.55, 1.06, 0.55, 0xcfd6dc, 0, 0, Math.PI / 2);
  b.add(GEO.box, 0, 0, 0, 1.08, 0.9, 0.16, 0x8c949c);
  return b.geometry();
})();

function boatGeometry(s, color) {
  const b = new Batch(), L = s.len, W = s.wid, H = s.h, y = s.clr;
  b.box(0, y + H / 2, -L * 0.1, W, H, L * 0.6, color);                              // hull
  b.add(GEO.roof, 0, y + H / 2, L * 0.2, W, L * 0.3, H, color, 0, Math.PI / 2);      // pointed bow
  b.box(0, y + H * 0.42, -L * 0.1, W + 0.06, 0.18, L * 0.6, 0x2d6cdf);               // stripe
  b.box(0, y + H + 0.03, -L * 0.12, W * 0.86, 0.06, L * 0.52, 0xc9a26b);             // deck
  b.add(GEO.box, 0, y + H + 0.36, L * 0.13, W * 0.8, 0.62, 0.08, GLASS, 0, -0.5);    // raked screen
  for (const sx of [-1, 1]) b.box(sx * W * 0.2, y + H + 0.28, -L * 0.12, 0.52, 0.5, 0.52, 0xe23b2e);
  b.box(0, y + H * 0.7, -L * 0.43, 0.5, 1.0, 0.46, DARK);                            // outboard motor
  b.box(0, y + H + 0.5, -L * 0.34, 0.06, 1.0, 0.06, 0xcfd6dc); b.box(0.28, y + H + 0.86, -L * 0.34, 0.5, 0.3, 0.03, 0xffd21f); // little flag
  return b.geometry();
}
function duckGeometry(s) {
  const b = new Batch(), L = s.len, W = s.wid, H = s.h, y = s.clr, Y = 0xffd21f;
  b.add(GEO.sph, 0, y + H * 0.5, -0.1, W / 2, H * 0.62, L / 2, Y);
  b.add(GEO.cone, 0, y + H * 0.8, -L / 2 + 0.1, 0.42, 0.7, 0.42, Y, 0, -0.9);
  b.add(GEO.sph, 0, y + H + 0.62, L * 0.3, 0.52, 0.52, 0.52, Y);
  b.cyl(0, y + H + 0.2, L * 0.3, 0.26, 0.6, Y);
  b.add(GEO.cone, 0, y + H + 0.56, L * 0.3 + 0.62, 0.2, 0.5, 0.16, 0xff7a1a, 0, Math.PI / 2);
  for (const sx of [-1, 1]) b.add(GEO.sph, sx * 0.3, y + H + 0.78, L * 0.3 + 0.36, 0.09, 0.09, 0.09, DARK);
  b.box(0, y + H * 0.98, -0.25, 1.0, 0.12, 1.0, 0x8a5a2b); b.box(0, y + H + 0.3, -0.7, 0.9, 0.5, 0.12, 0xe23b2e);
  return b.geometry();
}
function heliGeometry(s, color) {
  const b = new Batch(), y = s.clr, M = 0xcfd6dc;
  b.add(GEO.sph, 0, y + 0.95, 0.4, 1.15, 0.98, 1.75, color);                         // cabin
  b.add(GEO.sph, 0, y + 1.02, 1.2, 1.0, 0.8, 1.1, GLASS);                            // bubble screen
  b.box(0, y + 1.2, -2.7, 0.36, 0.42, 3.6, color);                                   // tail boom
  b.add(GEO.box, 0, y + 1.85, -4.3, 0.12, 1.3, 0.75, color, 0, -0.35);               // fin
  b.box(0, y + 1.25, -4.1, 1.1, 0.08, 0.5, color);
  b.add(GEO.sph, 0, y + 0.74, 0.34, 1.13, 0.8, 1.7, 0xffffff);                       // white belly
  b.cyl(0, y + 2.05, 0.2, 0.16, 0.5, DARK);                                          // mast
  for (const sx of [-1, 1]) { b.box(sx * 1.05, y - 0.45, 0.3, 0.11, 0.11, 3.5, M); for (const sz of [-0.8, 1.4]) b.box(sx * 0.92, y - 0.12, sz, 0.08, 0.72, 0.08, M); }
  return b.geometry();
}

function bodyGeometry(s, color) {
  if (s.style === 'boat') return boatGeometry(s, color);
  if (s.style === 'duck') return duckGeometry(s);
  if (s.style === 'heli') return heliGeometry(s, color);
  const b = new Batch();
  const L = s.len, W = s.wid, H = s.h, y0 = s.clr;
  const lights = () => {
    for (const sx of [-1, 1]) {
      b.box(sx * W * 0.33, y0 + Math.min(H, 0.8) * 0.62, L / 2 + 0.02, W * 0.2, 0.16, 0.08, LIGHT);
      b.box(sx * W * 0.34, y0 + Math.min(H, 0.8) * 0.66, -L / 2 - 0.02, W * 0.18, 0.14, 0.08, TAIL);
    }
    b.box(0, y0 + 0.16, L / 2 + 0.05, W * 0.98, 0.24, 0.2, DARK); b.box(0, y0 + 0.16, -L / 2 - 0.05, W * 0.98, 0.24, 0.2, DARK);
    b.box(0, y0 + Math.min(H, 0.8) * 0.4, L / 2 + 0.03, W * 0.46, 0.16, 0.06, DARK);
  };
  if (s.style === 'car' || s.style === 'pickup') {
    const c = s.cab;
    b.add(BODY, 0, y0 + H / 2, 0, W, H, L, color);
    const cg = s.style === 'pickup' ? CAB_PICK : CAB;
    b.add(cg, 0, y0 + H + c.h / 2, c.z, W * 0.92, c.h, c.l, GLASS);
    const topZ = s.style === 'pickup' ? 0.8 : 0.64;
    b.box(0, y0 + H + c.h + 0.035, c.z + (s.style === 'pickup' ? -0.04 * c.l : 0), W * 0.92 * (s.style === 'pickup' ? 0.86 : 0.84) + 0.04, 0.07, c.l * topZ + 0.06, color);
    // corner pillars so the cabin reads as a car, not a glass box
    for (const sx of [-1, 1]) b.box(sx * W * 0.415, y0 + H + c.h / 2, c.z, 0.07, c.h, 0.16, color);
    lights();
    if (s.style === 'pickup') {
      const bedL = L / 2 + (c.z - c.l / 2) - 0.1, bz = -L / 2 + bedL / 2 + 0.06;
      for (const sx of [-1, 1]) b.box(sx * (W / 2 - 0.09), y0 + H + 0.2, bz, 0.12, 0.4, bedL, color);
      b.box(0, y0 + H + 0.2, -L / 2 + 0.1, W - 0.1, 0.4, 0.12, color);
      b.box(0, y0 + H + 0.02, bz, W - 0.3, 0.04, bedL - 0.1, DARK);
    }
  } else {
    // van and bus: one tall box with a window band
    b.box(0, y0 + H / 2, 0, W, H, L, color);
    b.box(0, y0 + H + 0.04, 0, W * 0.94, 0.08, L * 0.97, s.extra === 'icecream' ? 0xff8fb8 : 0xf8f8f4);
    b.box(0, y0 + H * 0.68, L / 2 + 0.02, W * 0.86, H * 0.36, 0.06, GLASS);
    b.box(0, y0 + H * 0.68, -L / 2 - 0.02, W * 0.6, H * 0.28, 0.06, GLASS);
    if (s.style === 'bus') {
      const n = 7;
      for (let k = 0; k < n; k++) for (const sx of [-1, 1]) b.box(sx * (W / 2 + 0.01), y0 + H * 0.68, -L / 2 + 0.9 + k * ((L - 2.4) / (n - 1)), 0.05, H * 0.3, (L - 2.4) / n * 0.78, GLASS);
      for (const sx of [-1, 1]) { b.box(sx * (W / 2 + 0.012), y0 + H * 0.36, 0, 0.04, 0.16, L * 0.96, DARK); b.box(sx * (W / 2 + 0.012), y0 + H * 0.2, 0, 0.04, 0.08, L * 0.96, DARK); }
      b.box(0, y0 + 0.7, L / 2 + 0.5, W * 0.9, 1.0, 1.0, color);
    } else {
      for (const sx of [-1, 1]) b.box(sx * (W / 2 + 0.01), y0 + H * 0.68, L / 2 - 0.9, 0.05, H * 0.32, 1.2, GLASS);
    }
    lights();
  }
  const top = y0 + H + (s.style === 'car' || s.style === 'pickup' ? s.cab.h : 0);
  switch (s.extra) {
    case 'taxi':
      b.box(0, top + 0.2, s.cab.z, 0.8, 0.26, 0.34, 0xfff3a8); b.box(0, top + 0.2, s.cab.z, 0.3, 0.27, 0.35, DARK);
      for (let k = 0; k < 8; k++) for (const sx of [-1, 1]) b.box(sx * (W / 2 - 0.01), y0 + H * 0.72, -1.4 + k * 0.4, 0.04, 0.16, 0.2, k % 2 ? DARK : 0xffffff);
      break;
    case 'pizza':
      b.box(0, top + 0.28, s.cab.z, 1.1, 0.5, 0.5, 0xe23b2e); b.add(GEO.cyl, 0, top + 0.3, s.cab.z + 0.27, 0.36, 0.06, 0.36, 0xf4d35e, 0, Math.PI / 2); b.add(GEO.cyl, 0, top + 0.3, s.cab.z - 0.27, 0.36, 0.06, 0.36, 0xf4d35e, 0, Math.PI / 2);
      for (const sx of [-1, 1]) b.box(sx * (W / 2 - 0.02), y0 + H * 0.6, 0, 0.04, 0.18, L * 0.86, 0xe23b2e);
      break;
    case 'spoiler':
      b.box(0, y0 + H + 0.34, -L / 2 + 0.22, W * 0.92, 0.06, 0.34, DARK); for (const sx of [-1, 1]) b.box(sx * W * 0.34, y0 + H + 0.17, -L / 2 + 0.24, 0.07, 0.34, 0.14, DARK);
      b.box(0, y0 + H + 0.012, L * 0.2, 0.34, 0.03, L * 0.5, 0xffffff); b.box(0, y0 + H * 0.5, 0, W + 0.02, 0.06, L * 0.7, DARK);
      break;
    case 'police':
      for (const sx of [-1, 1]) b.box(sx * (W / 2 - 0.02), y0 + H * 0.5, -0.15, 0.06, H * 0.82, 1.9, 0x1d3f8f);
      b.box(0, top + 0.1, s.cab.z, 1.1, 0.1, 0.3, DARK); b.box(0, y0 + H + 0.012, L * 0.3, W * 0.8, 0.03, 0.9, 0x1d3f8f);
      break;
    case 'monster':
      for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) b.add(GEO.box, sx * (W / 2 + 0.012), y0 + H * 0.5, 1.6 - k * 0.55, 0.04, 0.34 - k * 0.06, 0.6, k % 2 ? 0xffd21f : 0x7cc75c, 0, 0.5);
      b.box(0, top + 0.16, s.cab.z - 0.9, W * 0.8, 0.1, 0.1, 0xcfd6dc); for (const sx of [-1, 1]) b.box(sx * W * 0.4, top - 0.25, s.cab.z - 0.9, 0.1, 0.9, 0.1, 0xcfd6dc);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * W * 0.3, y0 - 0.3, sz * L * 0.31, 0.16, 0.7, 0.16, 0xcfd6dc);
      for (const sx of [-1, 1]) b.box(sx * 0.35, top + 0.26, s.cab.z + 0.3, 0.22, 0.14, 0.22, 0xfff6c4);
      break;
    case 'icecream':
      b.add(GEO.cone, 0, top + 0.9, 0.6, 0.42, 1.1, 0.42, 0xe2a760, 0, Math.PI); b.add(GEO.sph, 0, top + 1.62, 0.6, 0.5, 0.48, 0.5, 0xff8fb8); b.add(GEO.sph, 0, top + 2.12, 0.6, 0.4, 0.38, 0.4, 0xfff3dc);
      b.box(-(W / 2 + 0.3), y0 + H * 0.82, -0.4, 0.7, 0.06, 2.2, 0xff8fb8); b.box(-(W / 2 + 0.012), y0 + H * 0.58, -0.4, 0.04, H * 0.34, 2.0, GLASS);
      for (let k = 0; k < 6; k++) b.box(W / 2 + 0.012, y0 + H * 0.35, -2 + k * 0.8, 0.04, H * 0.5, 0.4, k % 2 ? 0xff8fb8 : 0x8fd3ff);
      break;
    case 'rocket':
      b.add(GEO.cyl, 0, y0 + H * 0.6, -L / 2 - 0.3, 0.42, 0.9, 0.42, 0x8c949c, 0, Math.PI / 2);
      for (const sx of [-1, 1]) b.add(GEO.box, sx * (W / 2 - 0.05), y0 + H + 0.35, -L / 2 + 0.7, 0.08, 0.8, 1.3, 0xffd21f, 0, -0.5);
      b.box(0, y0 + H + 0.012, L * 0.22, 0.5, 0.03, L * 0.5, 0xffd21f); b.box(0, y0 + H * 0.5, 0, W + 0.02, 0.08, L * 0.8, 0xffffff);
      break;
  }
  return b.geometry();
}

const _c = { x: 0, z: 0, nx: 0, nz: 0 };
const ZERO = { throttle: 0, steer: 0, handbrake: true };

export class Vehicle {
  constructor(id, type, x, z, heading, world, scene, color) {
    this.id = id; this.type = type; this.spec = CAR_TYPES[type];
    this.world = world; this.scene = scene;
    this.home = { x, z, h: heading };
    this.color = color ?? this.spec.color;
    this.pos = new THREE.Vector3(x, world.groundAt(x, z), z);
    this.heading = heading; this.vx = 0; this.vz = 0; this.vy = 0;
    this.speed = 0; this.steer = 0; this.pitch = 0; this.roll = 0; this.lean = 0; this.gPitch = 0;
    this.onGround = true; this.surface = 0; this.curb = world.curbAt(x, z); this.prevG = this.pos.y;
    this.driver = null; this.ai = null; this.siren = false; this.impact = 0; this.spin = 0; this.air = 0;
    const s = this.spec;
    this.wb = s.len * 0.62; this.tw = s.wid / 2 - s.ww * 0.35;
    this.radius = s.wid * 0.56;
    this.offsets = s.len > 7 ? [-s.len * 0.38, -s.len * 0.19, 0, s.len * 0.19, s.len * 0.38] : [-s.len * 0.3, 0, s.len * 0.3];
    this.reach = s.len / 2 + this.radius;
    this.group = new THREE.Group();
    this.body = new THREE.Mesh(bodyGeometry(s, this.color), MAT.solid);
    this.body.castShadow = true; this.body.receiveShadow = true;
    this.chassis = new THREE.Group(); this.chassis.add(this.body);
    this.group.add(this.chassis);
    this.wheels = [];
    if (s.wr) for (const sz of [1, -1]) for (const sx of [1, -1]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * this.tw, s.wr, sz * this.wb / 2);
      const w = new THREE.Mesh(wheelGeo, MAT.solid); w.scale.set(s.ww, s.wr, s.wr); w.castShadow = true;
      pivot.add(w); this.group.add(pivot); this.wheels.push({ pivot, w, front: sz > 0 });
    }
    if (s.extra === 'police') {
      const top = s.clr + s.h + s.cab.h + 0.2;
      this.lightA = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: 0x7a1010 })); this.lightA.scale.set(0.5, 0.18, 0.28); this.lightA.position.set(0.3, top, s.cab.z);
      this.lightB = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: 0x101c7a })); this.lightB.scale.set(0.5, 0.18, 0.28); this.lightB.position.set(-0.3, top, s.cab.z);
      this.chassis.add(this.lightA, this.lightB);
    }
    if (s.extra === 'rocket') {
      this.flame = new THREE.Mesh(GEO.cone, new THREE.MeshBasicMaterial({ color: 0xffb020 })); this.flame.rotation.x = -Math.PI / 2;
      this.flame.position.set(0, s.clr + s.h * 0.6, -s.len / 2 - 1.2); this.chassis.add(this.flame);
    }
    this.group.rotation.order = 'YXZ';
    scene.add(this.group);
    this.sync(0);
  }

  // Far from the camera a car is a few pixels: drop the wheels first, then the whole thing.
  lod(d2) { const near = d2 < 19600, show = d2 < 490000; if (show !== this.group.visible) this.group.visible = show; if (near !== this.wheelsOn) { this.wheelsOn = near; for (const w of this.wheels) w.pivot.visible = near; } }
  setColor(color) {
    this.color = color;
    this.body.geometry.dispose(); this.body.geometry = bodyGeometry(this.spec, color);
  }
  place(x, z, heading) {
    this.pos.set(x, this.world.groundAt(x, z), z); this.heading = heading; this.vx = this.vz = this.vy = 0; this.speed = 0; this.steer = 0;
    this.prevG = this.pos.y; this.curb = this.world.curbAt(x, z); this.onGround = true; this.pitch = this.roll = 0; this.sync(0);
  }
  goHome() { this.place(this.home.x, this.home.z, this.home.h); }
  get inWater() { return this.pos.y < WATER_Y - 0.7; }

  // Push a circle (the player, a ball) out of this car's body.
  pushOut(c, r) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let hit = false;
    for (const o of this.offsets) {
      const cx = this.pos.x + fx * o, cz = this.pos.z + fz * o;
      const dx = c.x - cx, dz = c.z - cz, rr = r + this.radius, d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.001;
      c.x += (dx / d) * (rr - d); c.z += (dz / d) * (rr - d); c.nx = dx / d; c.nz = dz / d; hit = true;
    }
    return hit;
  }

  step(dt, inp) {
    const s = this.spec, world = this.world;
    inp = inp || ZERO;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading), lx = fz, lz = -fx;
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * lx + this.vz * lz;
    const surf = this.surface = world.surfaceAt(this.pos.x, this.pos.z);
    const off = surf === 0 ? 1 : 0.5 + 0.5 * (surf === 1 ? s.off : s.off * 0.85); // traction away from the road
    const maxV = s.max * (surf === 0 ? 1 : 0.42 + 0.58 * s.off) * (inp.boost || 1);
    const thr = inp.throttle, st = inp.steer;
    this.braking = !!this.driver || !!this.ai ? (thr < 0 && vf > 0.5) || (thr > 0 && vf < -0.5) || (!!inp.handbrake && Math.abs(vf) > 0.5) : false;
    let yaw = 0;
    if (this.onGround) {
      if (thr > 0) {
        if (vf < -0.5) vf += s.brk * thr * dt;
        else vf += s.acc * off * (inp.boost || 1) * thr * Math.max(0, 1 - (vf / maxV) ** 2) * dt;
      } else if (thr < 0) {
        if (vf > 0.5) vf += s.brk * thr * dt;
        else vf += s.acc * 0.7 * off * thr * Math.max(0, 1 - (vf / (maxV * 0.35)) ** 2) * dt;
      }
      vf -= 9.8 * Math.sin(this.gPitch) * (surf === 0 ? 1 : 1 + (1 - s.off) * 0.8) * dt; // road cars struggle on steep grass
      const rr = (thr === 0 ? 2.4 : 0.35) + (surf === 0 ? 0 : (1 - s.off) * 1.2);
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), rr * dt);
      if (Math.abs(vf) > maxV) vf -= Math.sign(vf) * Math.min(Math.abs(vf) - maxV, 14 * dt);
      if (inp.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), s.brk * 0.75 * dt);
      const grip = s.grip * (surf === 0 ? 1 : 0.55 + 0.45 * s.off) * (inp.handbrake ? 0.22 : 1);
      vl *= Math.exp(-grip * dt);
      const sf = 1 / (1 + (Math.abs(vf) / s.steerV) ** 2);
      this.steer = damp(this.steer, st * s.steer * (0.22 + 0.78 * sf), 9, dt);
      yaw = (vf / this.wb) * Math.tan(this.steer);
      const maxYaw = ((surf === 0 ? 13 : 8.5) * (inp.handbrake ? 1.5 : 1)) / Math.max(Math.abs(vf), 3.5);
      yaw = clamp(yaw, -maxYaw, maxYaw);
      this.heading += yaw * dt;
    } else {
      this.steer = damp(this.steer, st * s.steer * 0.5, 5, dt);
      this.air += dt;
    }
    this.vx = fx * vf + lx * vl; this.vz = fz * vf + lz * vl;
    this.speed = vf; this.slip = Math.abs(vl);
    this.lean = damp(this.lean, clamp(yaw * vf * 0.009, -0.09, 0.09), 6, dt);

    const px = this.pos.x, pz = this.pos.z;
    this.pos.x += this.vx * dt; this.pos.z += this.vz * dt;

    // solid things
    const hx = Math.sin(this.heading), hz = Math.cos(this.heading);
    let blocked = false;
    for (const o of this.offsets) {
      const ox = this.pos.x + hx * o, oz = this.pos.z + hz * o;
      _c.x = ox; _c.z = oz;
      if (world.collide(_c, this.radius)) {
        this.pos.x += _c.x - ox; this.pos.z += _c.z - oz;
        const vn = this.vx * _c.nx + this.vz * _c.nz;
        if (vn < 0) {
          this.vx -= 1.2 * vn * _c.nx; this.vz -= 1.2 * vn * _c.nz;
          this.vx *= 0.985; this.vz *= 0.985;
          this.impact = Math.max(this.impact, -vn);
          this.heading += clamp(o * (_c.nx * hz - _c.nz * hx) * 0.012 * -vn, -0.12, 0.12);
        }
      }
      const ph = world.platAt(ox, oz);
      if (ph - this.pos.y > 1.0 && ph > world.heightAt(ox, oz) + 0.9) blocked = true;
    }
    if (blocked) {
      this.pos.x = px; this.pos.z = pz;
      this.impact = Math.max(this.impact, Math.hypot(this.vx, this.vz));
      this.vx *= -0.3; this.vz *= -0.3;
    }

    // ground following; leaving a crest or a ramp at speed gets air
    const x = this.pos.x, z = this.pos.z, hw = this.wb / 2;
    const gc = world.groundAt(x, z);
    const hf = world.groundAt(x + hx * hw, z + hz * hw), hb = world.groundAt(x - hx * hw, z - hz * hw);
    const hl = world.groundAt(x + hz * this.tw, z - hx * this.tw), hr = world.groundAt(x - hz * this.tw, z + hx * this.tw);
    const g = Math.max(gc, (hf + hb) / 2);
    const prevY = this.pos.y, climb = (g - this.prevG) / dt;
    this.vy -= 25 * dt; this.pos.y += this.vy * dt;
    const wasAir = !this.onGround;
    if (this.pos.y <= g || (this.pos.y - g < 0.3 && this.vy - climb < 2.5)) {
      this.pos.y = g; this.vy = clamp((g - prevY) / dt, -40, 16); this.onGround = true;
      if (wasAir && this.air > 0.25) this.landed = this.air;
      this.air = 0;
    } else this.onGround = false;
    this.prevG = g;
    if (this.onGround) {
      this.gPitch = Math.atan2(hf - hb, this.wb);
      this.pitch = damp(this.pitch, this.gPitch, 12, dt);
      this.roll = damp(this.roll, Math.atan2(hl - hr, this.tw * 2), 12, dt);
    } else {
      this.gPitch = 0;
      this.pitch = damp(this.pitch, clamp(this.vy * 0.02, -0.3, 0.25), 2.5, dt);
      this.roll = damp(this.roll, 0, 2, dt);
    }
    this.curb = damp(this.curb, world.curbAt(x, z), 14, dt);
    this.spin += (vf / s.wr) * dt;
    this.sync(dt);
  }

  sync(dt) {
    const g = this.group;
    g.position.set(this.pos.x, this.pos.y + this.curb, this.pos.z);
    g.rotation.set(-this.pitch, this.heading, this.roll);
    this.chassis.rotation.z = -this.lean;
    for (const w of this.wheels) { w.w.rotation.x = this.spin; if (w.front) w.pivot.rotation.y = this.steer; }
    if (this.lightA) {
      const on = this.siren, ph = (performance.now() / 180) % 2 < 1;
      this.lightA.material.color.setHex(on && ph ? 0xff2020 : 0x7a1010); this.lightB.material.color.setHex(on && !ph ? 0x3060ff : 0x101c7a);
    }
    if (this.flame) { const k = clamp(Math.abs(this.speed) / 30, 0.05, 1.6) * (0.85 + Math.random() * 0.3); this.flame.scale.set(0.34, 1.6 * k, 0.34); this.flame.visible = !!this.driver; }
  }
}

// Boats float at sea level, cannot climb onto land, and slide more than they grip.
export class Boat extends Vehicle {
  constructor(...a) { super(...a); this.t = Math.random() * 9; this.place(this.home.x, this.home.z, this.home.h); }
  place(x, z, heading) { this.pos.set(x, WATER_Y, z); this.heading = heading; this.vx = this.vz = this.vy = 0; this.speed = 0; this.curb = 0; this.onGround = true; this.pitch = this.roll = 0; this.sync(0); }
  get inWater() { return false; }
  // Highest bit of seabed under the hull.
  shallow(x, z) { const hx = Math.sin(this.heading), hz = Math.cos(this.heading); let m = -1e9; for (const o of this.offsets) m = Math.max(m, this.world.heightAt(x + hx * o, z + hz * o)); return m; }
  step(dt, inp) {
    inp = inp || ZERO;
    const s = this.spec, w = this.world;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading), lx = fz, lz = -fx;
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * lx + this.vz * lz;
    const thr = this.driver ? inp.throttle : 0, st = this.driver ? inp.steer : 0;
    if (thr > 0) vf += s.acc * thr * Math.max(0, 1 - (vf / s.max) ** 2) * dt;
    else if (thr < 0) vf += s.acc * 0.8 * thr * (vf > 0 ? 1.4 : Math.max(0, 1 - (vf / (s.max * 0.3)) ** 2)) * dt;
    vf -= vf * (this.driver && inp.handbrake ? 2.6 : thr > 0 ? 0.1 : 0.5) * dt; vl *= Math.exp(-2.4 * dt);
    const yaw = st * s.turn * clamp(Math.abs(vf) / 5, 0, 1) * (vf < -0.3 ? -1 : 1);
    this.heading += yaw * dt;
    this.vx = fx * vf + lx * vl; this.vz = fz * vf + lz * vl; this.speed = vf; this.slip = Math.abs(vl);
    const px = this.pos.x, pz = this.pos.z, was = this.shallow(px, pz);
    this.pos.x += this.vx * dt; this.pos.z += this.vz * dt;
    const hx = Math.sin(this.heading), hz = Math.cos(this.heading);
    for (const o of this.offsets) {
      const ox = this.pos.x + hx * o, oz = this.pos.z + hz * o;
      _c.x = ox; _c.z = oz;
      if (w.collide(_c, this.radius, WATER_Y)) {
        this.pos.x += _c.x - ox; this.pos.z += _c.z - oz;
        const vn = this.vx * _c.nx + this.vz * _c.nz;
        if (vn < 0) { this.vx -= 1.2 * vn * _c.nx; this.vz -= 1.2 * vn * _c.nz; this.impact = Math.max(this.impact, -vn); }
      }
    }
    // run aground: the hull stops where the water gets too shallow, but can always back out to deeper water
    const now = this.shallow(this.pos.x, this.pos.z);
    this.aground = now > WATER_Y - 0.4;
    if (this.aground && now >= was) { this.pos.x = px; this.pos.z = pz; this.impact = Math.max(this.impact, Math.hypot(this.vx, this.vz) * 0.4); this.vx *= -0.2; this.vz *= -0.2; }
    this.edge = keepNear(this);
    this.t += dt;
    const sp = Math.abs(vf) / s.max;
    this.pos.y = WATER_Y + 0.06 * Math.sin(this.t * 1.7) + sp * 0.12;
    this.pitch = damp(this.pitch, sp * 0.13 + 0.02 * Math.sin(this.t * 1.3), 4, dt);
    this.roll = damp(this.roll, -yaw * 0.2 * sp + 0.03 * Math.sin(this.t * 1.1 + 1), 4, dt);
    this.onGround = true; this.curb = 0; this.braking = false;
    this.sync(dt);
  }
}

// Nudges a boat or helicopter back when it strays too far out to sea. Returns true while nudging.
function keepNear(v) {
  const dx = v.pos.x, dz = v.pos.z + 250, far = Math.hypot(dx, dz);
  if (far < 1500) return false;
  const k = (far - 1500) * 0.03; v.vx -= (dx / far) * k; v.vz -= (dz / far) * k;
  return true;
}

// The helicopter hovers on its own. Climb, descend, fly forward, turn. It can land on roofs.
export class Heli extends Vehicle {
  constructor(...a) {
    super(...a);
    const s = this.spec;
    const rb = new Batch(); rb.box(0, 0, 0, 8.4, 0.06, 0.34, DARK); rb.box(0, 0, 0, 0.34, 0.06, 8.4, DARK); rb.cyl(0, 0, 0, 0.3, 0.22, 0xcfd6dc);
    this.rotorMesh = rb.mesh(MAT.solid); this.rotorMesh.position.set(0, s.clr + 2.32, 0.2); this.chassis.add(this.rotorMesh);
    const tb = new Batch(); tb.box(0, 0, 0, 0.05, 1.5, 0.16, DARK); tb.box(0, 0, 0, 0.05, 0.16, 1.5, DARK);
    this.tailMesh = tb.mesh(MAT.solid); this.tailMesh.position.set(0.26, s.clr + 1.55, -4.35); this.chassis.add(this.tailMesh);
    this.rotor = 0; this.alt = 0; this.radius = 2.3; this.offsets = [0]; this.reach = 4.4;
    this.place(this.home.x, this.home.z, this.home.h);
  }
  get inWater() { return false; }
  support(y = this.pos.y) { const w = this.world, x = this.pos.x, z = this.pos.z; return Math.max(w.groundAt(x, z) + w.curbAt(x, z), w.roofAt(x, z, y + 0.3), WATER_Y + 0.45); }
  place(x, z, heading, y) {
    this.pos.set(x, 0, z); this.pos.y = y === undefined ? this.support(1e9) : y; this.heading = heading;
    this.vx = this.vz = this.vy = 0; this.speed = 0; this.curb = 0; this.onGround = y === undefined; this.pitch = this.roll = 0; this.sync(0);
  }
  step(dt, inp) {
    inp = inp || ZERO;
    const s = this.spec, w = this.world, on = !!this.driver;
    this.rotor = damp(this.rotor, on ? 1 : 0, on ? 1.6 : 0.5, dt);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading), lx = fz, lz = -fx;
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * lx + this.vz * lz;
    const air = this.pos.y - this.support() > 0.25, power = this.rotor > 0.85;
    const thr = power ? inp.throttle : 0, st = power ? inp.steer : 0, lift = power ? (inp.up ? 1 : 0) - (inp.down ? 1 : 0) : 0;
    if (power) this.vy = damp(this.vy, lift * 10, 3.2, dt); else if (air) this.vy -= 18 * dt; else this.vy = 0;
    if (air) { vf = damp(vf, thr >= 0 ? thr * s.max : thr * s.max * 0.4, thr ? 0.85 : 1.5, dt); vl = damp(vl, 0, 1.4, dt); }
    else { vf = damp(vf, 0, 5, dt); vl = damp(vl, 0, 5, dt); }
    this.heading += st * 1.45 * dt;
    this.vx = fx * vf + lx * vl; this.vz = fz * vf + lz * vl; this.speed = vf;
    this.pos.x += this.vx * dt; this.pos.z += this.vz * dt; this.pos.y += this.vy * dt;
    if (this.pos.y > 320) { this.pos.y = 320; this.vy = Math.min(this.vy, 0); }
    _c.x = this.pos.x; _c.z = this.pos.z;
    if (w.collide(_c, this.radius, this.pos.y)) {
      const vn = this.vx * _c.nx + this.vz * _c.nz; this.pos.x = _c.x; this.pos.z = _c.z;
      if (vn < 0) { this.vx -= 1.3 * vn * _c.nx; this.vz -= 1.3 * vn * _c.nz; this.impact = Math.max(this.impact, -vn * 0.6); }
    }
    this.edge = keepNear(this);
    const sup = this.support();
    // settle onto the ground when close and not climbing, so a landing on a slope counts as landed
    if (this.pos.y <= sup + (lift > 0 ? 0 : 0.12)) { if (this.vy < -7) this.impact = Math.max(this.impact, -this.vy * 0.8); this.pos.y = sup; this.vy = Math.max(this.vy, 0); this.onGround = true; }
    else this.onGround = false;
    this.alt = this.pos.y - Math.max(w.groundAt(this.pos.x, this.pos.z), WATER_Y);
    const k = air ? 1 : 0;
    this.pitch = damp(this.pitch, -(vf / s.max) * 0.3 * k, 3, dt);
    this.roll = damp(this.roll, -st * 0.26 * k * Math.min(1, Math.abs(vf) / 8 + 0.3), 3, dt);
    this.curb = 0; this.braking = false;
    this.rotorMesh.rotation.y += this.rotor * 30 * dt; this.tailMesh.rotation.x += this.rotor * 40 * dt;
    this.sync(dt);
  }
}

export function createVehicle(id, type, x, z, heading, world, scene, color) {
  const style = CAR_TYPES[type].style;
  const Cls = style === 'boat' || style === 'duck' ? Boat : style === 'heli' ? Heli : Vehicle;
  return new Cls(id, type, x, z, heading, world, scene, color);
}

// A driving line through a list of places: the road route between them, shifted into the right-hand lane
// and cut into short steps. Each point is [x, z]; `at` holds the distance along the line to each point.
export function lanePath(world, stops, lane = 3.3, step = 6) {
  const raw = [];
  for (let k = 0; k + 1 < stops.length; k++) {
    const r = world.route(stops[k][0], stops[k][1], stops[k + 1][0], stops[k + 1][1]);
    for (const p of r) { const l = raw[raw.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.5) raw.push(p); }
  }
  // even spacing along the centre line
  const mid = [raw[0]];
  for (let k = 1; k < raw.length; k++) {
    const a = raw[k - 1], b = raw[k], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / step));
    for (let i = 1; i <= n; i++) mid.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  }
  // slide each point to the right of the way the line is heading
  const pts = [], at = [0], n = mid.length;
  for (let k = 0; k < n; k++) {
    const a = mid[Math.max(0, k - 2)], b = mid[Math.min(n - 1, k + 2)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    pts.push([mid[k][0] - (dz / l) * lane, mid[k][1] + (dx / l) * lane]);
    if (k) at.push(at[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  }
  return { pts, at, length: at[n - 1] };
}
// Where something is along such a line: the index of the nearest point at or after `from`.
export function pathIndex(path, x, z, from = 0, span = 30) {
  let best = from, bd = 1e12;
  for (let k = from, e = Math.min(path.pts.length - 1, from + span); k <= e; k++) { const p = path.pts[k], d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; best = k; } }
  return best;
}

// Drives a car flat out along a lane path: the rival racers and the cookie bandit.
// It brakes for corners, swings round slower cars, backs out when stuck and never gives up.
export class RaceDriver {
  constructor(vehicle, world, path, o = {}) {
    this.v = vehicle; this.world = world; this.path = path; vehicle.ai = this;
    this.cruise = o.cruise ?? 28; this.corner = o.corner ?? 11; this.loop = !!o.loop;
    this.k = o.start ?? 0; this.go = o.go ?? false; this.pace = 1; this.done = false; this.laps = 0;
    this.stuck = 0; this.rev = 0; this.swing = 0; this.stuckT = 0;
    this.inp = { throttle: 0, steer: 0, handbrake: true };
  }
  // distance covered so far, for working out who is ahead
  get progress() { return this.laps * this.path.length + this.path.at[this.k]; }
  point(k) { const n = this.path.pts.length; return this.path.pts[this.loop ? ((k % n) + n) % n : Math.min(n - 1, Math.max(0, k))]; }
  respawn() { const p = this.point(this.k), q = this.point(this.k + 2); this.v.place(p[0], p[1], Math.atan2(q[0] - p[0], q[1] - p[1])); this.stuck = 0; this.rev = 0; }
  control(dt, others) {
    const v = this.v, inp = this.inp, path = this.path, n = path.pts.length;
    if (!this.go || this.done) { inp.throttle = 0; inp.steer = 0; inp.handbrake = true; return inp; }
    // keep track of the nearest point ahead
    let k = pathIndex(path, v.pos.x, v.pos.z, this.k, 14);
    if (this.loop && this.k > n - 16 && k >= n - 2) { const w = pathIndex(path, v.pos.x, v.pos.z, 0, 8); const a = path.pts[w], b = path.pts[k]; if ((a[0] - v.pos.x) ** 2 + (a[1] - v.pos.z) ** 2 <= (b[0] - v.pos.x) ** 2 + (b[1] - v.pos.z) ** 2) { k = w; this.laps++; } }
    this.k = k;
    if (!this.loop && k >= n - 2) { this.done = true; inp.throttle = -1; inp.steer = 0; inp.handbrake = true; return inp; }
    const sp = Math.abs(v.speed), look = 2 + Math.min(4, Math.floor(sp / 8));
    let [tx, tz] = this.point(k + look);
    const dirAt = (j) => { const a = this.point(j), b = this.point(j + 1); return Math.atan2(b[0] - a[0], b[1] - a[1]); };
    // swing out past anything slower in the lane ahead
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let blocked = false;
    for (const o of others) {
      if (o === v || Math.abs(o.pos.x - v.pos.x) > 30 || Math.abs(o.pos.z - v.pos.z) > 30 || Math.abs(o.pos.y - v.pos.y) > 3) continue;
      const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z, f = dx * fx + dz * fz, side = dx * fz - dz * fx;
      if (f > 2 && f < 9 + sp * 0.7 && Math.abs(side) < 2.4 && o.speed * (o.vx * fx + o.vz * fz >= 0 ? 1 : -1) < sp - 1) { blocked = true; if (f < 6 + o.spec.len / 2) inp.throttle = -1; }
    }
    if (blocked) this.swing = 1.6; else this.swing = Math.max(0, this.swing - dt);
    if (this.swing > 0) { const h = dirAt(k + look); tx += Math.cos(h) * 5.6; tz -= Math.sin(h) * 5.6; }
    const err = angDiff(Math.atan2(tx - v.pos.x, tz - v.pos.z), v.heading);
    inp.steer = clamp(err * 2.2, -1, 1); inp.handbrake = false;
    // the fastest speed that still lets it slow down for every bend coming up
    const h0 = dirAt(k);
    let target = this.cruise * this.pace;
    for (let j = 2; j <= 16; j += 2) {
      const bend = Math.abs(angDiff(dirAt(k + j), h0)); if (bend < 0.35) continue;
      const vc = this.corner * (bend > 1 ? 1 : 1.5), room = Math.max(0, (j - 2) * 6);
      target = Math.min(target, Math.sqrt(vc * vc + 2 * 9 * room));
    }
    if (Math.abs(err) > 0.7) target = Math.min(target, 9);
    const dv = target - v.speed;
    if (!(blocked && inp.throttle < 0)) inp.throttle = dv > 0.5 ? 1 : dv < -2.5 ? -1 : dv < -0.8 ? -0.2 : 0.35;
    // wedged against something: back out, and if that fails start again from the line
    if (this.rev > 0) { this.rev -= dt; inp.throttle = -1; inp.steer = -inp.steer; }
    else if (sp < 1.2) { this.stuck += dt; if (this.stuck > 1.5) { this.rev = 1.3; this.jams = (this.jams || 0) + 1; this.stuck = 0; if (this.jams >= 3) { this.jams = 0; this.respawn(); } } }
    else { this.stuck = 0; if (sp > 8) this.jams = 0; }
    return inp;
  }
}

// Cars push each other around instead of passing through.
export function collideVehicles(list) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const ddx = b.pos.x - a.pos.x, ddz = b.pos.z - a.pos.z, reach = a.reach + b.reach;
      if (Math.abs(ddx) > reach || Math.abs(ddz) > reach) continue;
      if (Math.abs(a.pos.y - b.pos.y) > 2.2) continue;
      const afx = Math.sin(a.heading), afz = Math.cos(a.heading), bfx = Math.sin(b.heading), bfz = Math.cos(b.heading);
      for (const oa of a.offsets) for (const ob of b.offsets) {
        const ax = a.pos.x + afx * oa, az = a.pos.z + afz * oa, bx = b.pos.x + bfx * ob, bz = b.pos.z + bfz * ob;
        const dx = bx - ax, dz = bz - az, rr = a.radius + b.radius, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.001, nx = dx / d, nz = dz / d, pen = rr - d;
        const ma = a.spec.mass, mb = b.spec.mass, wa = mb / (ma + mb), wbt = ma / (ma + mb);
        a.pos.x -= nx * pen * wa; a.pos.z -= nz * pen * wa; b.pos.x += nx * pen * wbt; b.pos.z += nz * pen * wbt;
        const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rv < 0) {
          const jimp = (-(1.25) * rv) / (1 / ma + 1 / mb);
          a.vx -= (jimp / ma) * nx; a.vz -= (jimp / ma) * nz; b.vx += (jimp / mb) * nx; b.vz += (jimp / mb) * nz;
          a.impact = Math.max(a.impact, -rv * wa); b.impact = Math.max(b.impact, -rv * wbt);
        }
      }
    }
  }
}

// A simple driver that keeps to the right-hand lane and picks a turn at each corner.
export class TrafficDriver {
  constructor(vehicle, world, R) {
    this.v = vehicle; this.world = world; this.R = R;
    this.cruise = 9.5 + R() * 4; this.blockedT = 0; this.pushT = 0; this.stuckT = 0;
    this.inp = { throttle: 0, steer: 0, handbrake: false };
    this.respawn();
  }
  respawn(avoid) {
    const { nodes } = this.world;
    for (let tries = 0; tries < 30; tries++) {
      const a = nodes[Math.floor(this.R() * nodes.length)];
      const l = a.links[Math.floor(this.R() * a.links.length)];
      const mx = (a.x + l.to.x) / 2, mz = (a.z + l.to.z) / 2;
      if (avoid && Math.hypot(mx - avoid.x, mz - avoid.z) < 160) continue;
      this.setEdge(a, l.to);
      const t = 0.3 + this.R() * 0.4;
      this.v.place(lerp(this.p0x, this.p1x, t), lerp(this.p0z, this.p1z, t), Math.atan2(this.dx, this.dz));
      return;
    }
  }
  setEdge(a, b) {
    this.a = a; this.b = b;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    this.dx = (b.x - a.x) / len; this.dz = (b.z - a.z) / len; this.len = len;
    const rx = -this.dz, rz = this.dx;
    this.p0x = a.x + rx * 3.3; this.p0z = a.z + rz * 3.3; this.p1x = b.x + rx * 3.3; this.p1z = b.z + rz * 3.3;
    const opts = b.links.filter((l) => l.to !== a);
    this.next = opts.length ? opts[Math.floor(this.R() * opts.length)].to : a;
    const ndx = this.next.x - b.x, ndz = this.next.z - b.z, nl = Math.hypot(ndx, ndz) || 1;
    this.turning = Math.abs((ndx / nl) * this.dx + (ndz / nl) * this.dz) < 0.9;
  }
  control(dt, others, player) {
    const v = this.v, inp = this.inp;
    let s = (v.pos.x - this.p0x) * this.dx + (v.pos.z - this.p0z) * this.dz;
    if (s > this.len - 9) { this.setEdge(this.b, this.next); s = (v.pos.x - this.p0x) * this.dx + (v.pos.z - this.p0z) * this.dz; }
    const la = 6 + Math.abs(v.speed) * 0.5, st = clamp(Math.max(0, s) + la, 0, this.len + 4);
    const tx = this.p0x + this.dx * st, tz = this.p0z + this.dz * st;
    const err = angDiff(Math.atan2(tx - v.pos.x, tz - v.pos.z), v.heading);
    inp.steer = clamp(err * 1.7, -1, 1);
    let target = this.cruise;
    if (Math.abs(err) > 0.3) target = 4.5;
    else if (this.turning && this.len - s < 24) target = 5.5;
    // look ahead for anything in the way
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let block = false;
    const look = 5 + Math.max(0, v.speed) * 1.1 + v.spec.len / 2;
    const check = (ox, oz, r) => {
      const dx = ox - v.pos.x, dz = oz - v.pos.z, f = dx * fx + dz * fz;
      if (f <= 0 || f > look + r) return;
      if (Math.abs(dx * fz - dz * fx) < 1.4 + r * 0.6) block = true;
    };
    for (const o of others) { if (o === v) continue; if (Math.abs(o.pos.x - v.pos.x) > 40 || Math.abs(o.pos.z - v.pos.z) > 40 || Math.abs(o.pos.y - v.pos.y) > 3) continue; check(o.pos.x, o.pos.z, o.spec.len * 0.4); }
    if (player) check(player.x, player.z, 0.8);
    if (this.pushT > 0) { this.pushT -= dt; if (block) { block = false; target = 2.5; } }
    if (block) { this.blockedT += dt; target = 0; if (this.blockedT > 6) { this.pushT = 2.5; this.blockedT = 0; } } else this.blockedT = Math.max(0, this.blockedT - dt * 2);
    const dv = target - v.speed;
    inp.throttle = clamp(dv * 0.6, -1, 1);
    inp.handbrake = target === 0 && Math.abs(v.speed) < 1;
    // unstick: wedged against something for a long time
    if (Math.abs(v.speed) < 0.4 && target > 0) this.stuckT += dt; else this.stuckT = 0;
    return inp;
  }
}
