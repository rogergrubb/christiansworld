// Runaway robots, the coins they drop, and the little fires they leave behind.
// Robots cannot hurt anyone: the worst they do is bonk Christian backwards.
import * as THREE from './three.js';
import { Batch, GEO, WATER_Y } from './world.js';
import { clamp, damp, angDiff } from './util.js';
import { glowTexture } from './fx.js';

const STEEL = 0x9aa7b4, DARK = 0x39414c, BLACK = 0x27323f, RUST = 0xb5651d, TEAL = 0x1fb7c9, WARN = 0xffd21f, EYE = 0xff3b30, IRON = 0x6b7785;
const SIDE = [-1, 1];

// r: how wide, h: how tall, hp: hits to stop it, see: how far it notices Christian, fly: how high it hovers.
export const KINDS = {
  roller: { name: 'Roller', r: 0.55, h: 1.25, hp: 2, speed: 5.0, coins: 1, max: 28, see: 24 },
  walker: { name: 'Clanker', r: 0.6, h: 1.95, hp: 4, speed: 3.6, coins: 2, max: 20, see: 26 },
  brute: { name: 'Big Clanker', r: 1.1, h: 2.75, hp: 10, speed: 2.7, coins: 4, max: 8, see: 28 },
  drone: { name: 'Buzz Drone', r: 0.7, h: 0.6, hp: 1.5, speed: 6.5, coins: 1, max: 20, see: 30, fly: 4.2 },
  mega: { name: 'Mega Clanker', r: 2.7, h: 7.6, hp: 360, speed: 2.5, coins: 14, max: 1, see: 400, boss: true },
};

// Each robot is one merged shape, standing on the origin and facing +z.
const BUILD = {
  roller(b) {
    b.add(GEO.cyl, 0, 0.3, 0, 0.3, 0.28, 0.3, BLACK, 0, 0, Math.PI / 2);
    b.box(0, 0.74, 0, 0.72, 0.5, 0.6, STEEL); b.box(0, 0.6, 0, 0.75, 0.1, 0.63, WARN);
    b.add(GEO.sph, 0, 1.03, 0, 0.3, 0.24, 0.3, TEAL); b.box(0, 1.03, 0.27, 0.24, 0.12, 0.06, EYE);
    b.box(0.18, 1.32, 0, 0.04, 0.32, 0.04, DARK); b.add(GEO.sph, 0.18, 1.5, 0, 0.07, 0.07, 0.07, EYE);
    for (const s of SIDE) b.box(s * 0.45, 0.74, 0.12, 0.12, 0.12, 0.5, DARK);
  },
  walker(b) {
    for (const s of SIDE) {
      b.box(s * 0.22, 0.42, 0, 0.2, 0.84, 0.24, DARK); b.box(s * 0.22, 0.08, 0.08, 0.26, 0.16, 0.42, BLACK);
      b.box(s * 0.52, 1.1, 0.1, 0.16, 0.6, 0.18, STEEL); b.box(s * 0.52, 0.76, 0.2, 0.2, 0.14, 0.3, DARK);
      b.box(s * 0.12, 1.76, 0.23, 0.12, 0.1, 0.04, EYE); b.box(s * 0.2, 2.02, 0, 0.04, 0.2, 0.04, DARK);
    }
    b.box(0, 1.16, 0, 0.8, 0.76, 0.5, RUST); b.box(0, 1.2, 0.26, 0.4, 0.3, 0.04, WARN); b.box(0, 1.73, 0, 0.5, 0.36, 0.44, STEEL);
  },
  brute(b) {
    for (const s of SIDE) {
      b.box(s * 0.42, 0.5, 0, 0.42, 1.0, 0.5, DARK); b.box(s * 1.05, 1.2, 0.25, 0.5, 0.9, 0.6, RUST);
      b.add(GEO.cyl, s * 0.82, 2.2, 0, 0.2, 0.2, 0.2, BLACK);
    }
    b.box(0, 1.62, 0, 1.6, 1.3, 1.0, IRON); b.box(0, 1.25, 0, 1.64, 0.18, 1.04, WARN);
    b.box(0, 2.47, 0.05, 0.6, 0.42, 0.55, DARK); b.box(0, 2.49, 0.33, 0.46, 0.14, 0.04, EYE);
  },
  drone(b) {
    b.add(GEO.sph, 0, 0.3, 0, 0.36, 0.24, 0.36, STEEL); b.add(GEO.sph, 0, 0.22, 0.3, 0.12, 0.12, 0.08, EYE);
    b.box(0, 0.36, 0, 1.3, 0.06, 0.1, DARK, Math.PI / 4); b.box(0, 0.36, 0, 1.3, 0.06, 0.1, DARK, -Math.PI / 4);
    for (const sx of SIDE) for (const sz of SIDE) b.add(GEO.cyl, sx * 0.46, 0.44, sz * 0.46, 0.3, 0.03, 0.3, BLACK);
    b.box(0, 0.05, 0, 0.3, 0.1, 0.3, DARK);
  },
  mega(b) {
    for (const s of SIDE) {
      b.box(s * 1.1, 1.4, 0, 1.0, 2.8, 1.2, DARK); b.box(s * 1.1, 0.25, 0.3, 1.4, 0.5, 2.2, BLACK);
      b.box(s * 2.7, 4.5, 0.2, 1.0, 2.8, 1.1, IRON); b.box(s * 2.7, 2.8, 0.4, 1.4, 1.2, 1.5, DARK);
      b.box(s * 0.45, 6.7, 0.92, 0.5, 0.36, 0.06, EYE); b.add(GEO.cyl, s * 1.2, 6.6, -0.9, 0.3, 1.5, 0.3, BLACK);
    }
    b.box(0, 3.0, 0, 3.4, 0.7, 1.6, IRON); b.box(0, 4.6, 0, 4.2, 2.6, 2.4, RUST); b.box(0, 3.5, 0, 4.24, 0.3, 2.44, WARN);
    b.add(GEO.sph, 0, 4.7, 1.2, 0.8, 0.8, 0.3, TEAL);
    b.box(0, 6.6, 0.1, 1.8, 1.3, 1.6, STEEL); b.box(0, 6.15, 0.86, 1.2, 0.2, 0.1, BLACK);
    b.box(0, 7.6, 0, 0.1, 0.9, 0.1, DARK); b.add(GEO.sph, 0, 8.1, 0, 0.2, 0.2, 0.2, EYE);
  },
};

// Robot camps: once the Professor's first robots are caught, more turn up around the island.
export const CAMPS = [
  { x: -420, z: 180, mix: ['roller', 'roller', 'walker'] },
  { x: 410, z: -230, mix: ['roller', 'walker', 'walker', 'drone'] },
  { x: -330, z: 560, mix: ['roller', 'roller', 'drone', 'drone'] },
  { x: 600, z: 300, mix: ['walker', 'walker', 'roller', 'brute'] },
  { x: -440, z: -120, mix: ['roller', 'walker', 'drone', 'brute'] },
  { x: 300, z: 560, mix: ['drone', 'drone', 'drone', 'walker'] },
  { x: -560, z: -330, mix: ['walker', 'walker', 'roller', 'roller', 'brute'] },
];

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _col = new THREE.Color();
const WHITE = [1, 1, 1], HOT = [2.2, 2.2, 2.2], ICE = [0.55, 0.9, 1.5], NET = [0.95, 0.8, 0.55], DIZZY = [1.25, 1.2, 0.6];

function instanced(scene, geo, mat, max, shadows = true) {
  const im = new THREE.InstancedMesh(geo, mat, max);
  im.setColorAt(0, _col.set(0xffffff)); im.count = 0; im.frustumCulled = false; im.castShadow = shadows; scene.add(im);
  return im;
}

export class Bots {
  constructor(game) {
    const scene = game.scene; this.g = game; this.list = []; this.coins = []; this.dirty = false; this.coinT = 0; this.campT = 0;
    this._c = { x: 0, z: 0, nx: 0, nz: 0 };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mesh = {};
    for (const kind of Object.keys(KINDS)) { const b = new Batch(); BUILD[kind](b); this.mesh[kind] = instanced(scene, b.geometry(), mat, KINDS[kind].max); }
    this.shell = instanced(scene, GEO.sph, new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.38, depthWrite: false }), 40, false);
    this.shell.renderOrder = 3;
    const bale = new THREE.CylinderGeometry(0.42, 0.42, 0.9, 10); bale.rotateZ(Math.PI / 2);
    this.hay = instanced(scene, bale, new THREE.MeshLambertMaterial({ color: 0xe2c35a }), 16);
    const coin = new THREE.CylinderGeometry(0.24, 0.24, 0.07, 12); coin.rotateX(Math.PI / 2);
    this.coinMesh = instanced(scene, coin, new THREE.MeshLambertMaterial({ color: 0xffd21f, emissive: 0x7a5a00 }), 80, false);
    // a heap of scrap and a flag marks each camp
    const w = game.world, pile = new Batch();
    this.campList = CAMPS.map((c) => {
      const y = w.groundAt(c.x, c.z);
      pile.add(GEO.cyl, c.x - 0.9, y + 0.2, c.z + 0.3, 0.55, 0.4, 0.55, BLACK); pile.add(GEO.cyl, c.x - 0.7, y + 0.58, c.z + 0.1, 0.5, 0.36, 0.5, DARK);
      pile.box(c.x + 0.5, y + 0.4, c.z - 0.2, 0.9, 0.8, 0.9, RUST, 0.4); pile.box(c.x + 0.3, y + 1.05, c.z, 0.6, 0.5, 0.6, IRON, 0.9);
      pile.box(c.x, y + 1.9, c.z + 0.6, 0.08, 3.8, 0.08, DARK); pile.box(c.x + 0.42, y + 3.5, c.z + 0.6, 0.8, 0.5, 0.05, EYE);
      w.addCircle(c.x, c.z, 1.3, y + 1.4);
      return { ...c, bots: null, cool: 0 };
    });
    const heap = new THREE.Mesh(pile.geometry(), mat); heap.castShadow = true; heap.receiveShadow = true; scene.add(heap);
  }
  count(kind) { let n = 0; for (const b of this.list) if (!b.dead && b.kind === kind) n++; return n; }
  alive(group) { let n = 0; for (const b of this.list) if (!b.dead && b.group === group) n++; return n; }
  // Put a robot in the world. o: home {x, z, r}, mode ('guard', 'goal', 'flee', 'boss'), goal, path, group, carry, onZonk, onGoal.
  spawn(kind, x, z, o = {}) {
    const k = KINDS[kind], w = this.g.world; if (!k || this.count(kind) >= k.max) return null;
    const floor = Math.max(w.groundAt(x, z) + w.curbAt(x, z), WATER_Y);
    const b = {
      kind, k, x, z, y: floor + (k.fly || 0), floor, h: o.h ?? Math.random() * 6.283, vx: 0, vz: 0, vy: 0, hp: k.hp * (o.tough || 1), alt: k.fly || 0,
      mode: o.mode || 'guard', home: o.home || { x, z, r: 8 }, goal: o.goal || null, path: o.path || null, pi: o.pi || 0, group: o.group || null, carry: o.carry || null,
      onZonk: o.onZonk || null, onGoal: o.onGoal || null, atGoal: false,
      t: Math.random() * 9, born: 0, a: Math.random() * 6.283, wanderT: 0, tx: x, tz: z, stuckT: 0, lastD: 1e9,
      stun: 0, ice: 0, cold: 0, net: 0, bub: 0, blind: 0, bonkT: 0, ramT: 0, flash: 0, tint: null, dead: false, air: false, fall: false,
      phase: 'walk', pt: 0, stompT: 5, spawnT: 9, next: 0.667, lift: 0, stepT: 0,
    };
    this.list.push(b); return b;
  }
  // Take robots away with no fuss: the end of a mission, or a camp left far behind.
  clear(group) { for (const b of this.list) if (group === undefined || b.group === group) b.dead = true; this.dirty = true; }
  reset() { this.clear(); this.list = []; this.coins = []; for (const c of this.campList) { c.bots = null; c.cool = 0; } this.draw(); }

  // One hit on one robot. fx says what kind of blaster it was.
  hit(b, dmg, fx, vx = 0, vz = 0, col = null) {
    if (b.dead) return;
    const k = b.k, g = this.g;
    if (fx === 'net') { if (k.boss) b.stun = Math.max(b.stun, 0.8); else b.net = 6; }
    else if (fx === 'freeze') { b.cold += 0.24; if (b.cold >= 1) { b.cold = 0; if (k.boss) b.stun = Math.max(b.stun, 1.5); else { b.ice = 5; g.sound.freeze(); } } }
    else if (fx === 'bubble') { if (k.boss || b.kind === 'brute') dmg = 0.5; else if (b.bub <= 0) { b.bub = 3; b.floor = b.y - (b.alt || 0); g.sound.pop(); } }
    else if (fx === 'stun') b.stun = Math.max(b.stun, k.boss ? 1.4 : 3.2);
    else if (fx === 'paint') { b.tint = col; b.blind = 4; }
    if (b.ice > 0 && dmg >= 1 && fx !== 'freeze') dmg = 99;          // frozen robots shatter
    if (k.boss && b.phase === 'down') dmg *= 2;
    if (k.boss && dmg > 20) dmg = 20;
    b.hp -= dmg; b.flash = 0.12;
    if (!k.boss && !b.air && b.bub <= 0) { b.vx += vx * 0.06; b.vz += vz * 0.06; }
    if (b.hp <= 0) this.zonk(b); else if (dmg >= 0.5) g.sound.clank();
  }
  // Everything within r metres of a point. Returns how many robots it caught.
  radial(x, z, r, dmg, fx, y = 0) {
    let n = 0;
    for (const b of this.list) {
      if (b.dead) continue;
      const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz);
      if (d > r + b.k.r || Math.abs(b.y - y) > r + 3) continue;
      n++;
      if (fx === 'knock' && !b.k.boss) { const q = d || 1; b.air = true; b.vy = 9; b.vx = (dx / q) * 11; b.vz = (dz / q) * 11; b.bub = 0; b.net = 0; }
      this.hit(b, dmg, fx, dx, dz);
    }
    return n;
  }
  // A robot shuts down: sparks, a clatter, and coins.
  zonk(b) {
    if (b.dead) return;
    const g = this.g, fx = g.fx, k = b.k, y = b.y + k.h * 0.5;
    b.dead = true; this.dirty = true; g.state.stats.bots++;
    fx.burst(b.x, y, b.z, k.boss ? 60 : 16, k.boss ? 12 : 6, 0.6, 0.16, 0.05, 1, 0.85, 0.3, 1, 14, 1.2);
    fx.burst(b.x, y, b.z, k.boss ? 26 : 8, k.boss ? 6 : 2.5, 1.1, 0.7, k.boss ? 5 : 2.2, 0.55, 0.57, 0.6, 0.55, 0, 0.5);
    g.burst(b.x, y + 0.4, b.z, k.boss ? 320 : 26, k.boss ? 14 : 5);
    g.sound.zonk(!!k.boss || b.kind === 'brute');
    for (let i = 0; i < k.coins; i++) { const a = Math.random() * 6.283, v = 0.8 + Math.random() * 1.6; this.coins.push({ x: b.x, y: y, z: b.z, vx: Math.cos(a) * v, vy: 5 + Math.random() * 3, vz: Math.sin(a) * v, t: 0, pull: false }); }
    if (this.coins.length > 80) this.coins.splice(0, this.coins.length - 80);
    if (b.onZonk) b.onZonk(b);
  }

  // ---- camps in free roam
  camps(dt, f) {
    const g = this.g; if ((this.campT -= dt) > 0) return; this.campT = 0.5;
    if (g.mode !== 'play' || !g.state.done.includes('bots')) return;
    const busy = !!g.missions.active;
    for (const c of this.campList) {
      const d = Math.hypot(f.x - c.x, f.z - c.z); c.cool = Math.max(0, c.cool - 0.5);
      if (!c.bots) {
        if (!busy && c.cool <= 0 && d < 150 && d > 40) c.bots = c.mix.map((kind, i) => this.spawn(kind, c.x + Math.cos(i * 2.4) * (3.5 + i), c.z + Math.sin(i * 2.4) * (3.5 + i), { home: { x: c.x, z: c.z, r: 9 }, group: c })).filter(Boolean);
        if (c.bots && !c.bots.length) c.bots = null;
      } else if (c.bots.every((b) => b.dead)) {
        const pay = 20 * c.mix.length; c.bots = null; c.cool = 300;
        g.addMoney(pay); g.state.stats.camps++; g.save(); g.sound.star(); g.ui.toast(`Robot camp cleared!  +$${pay}`, 3); g.burst(c.x, g.world.groundAt(c.x, c.z) + 2.5, c.z, 110, 9);
      } else if (d > 260) { this.clear(c); c.bots = null; }
    }
  }

  // ---- the giant: walks after Christian, stamps, and sends out helpers
  boss(b, dt, p, onFoot, f, dp, out) {
    const g = this.g, k = b.k, fx = g.fx;
    if (b.hp / k.hp < b.next && b.phase !== 'down') {
      b.next -= 0.333; b.phase = 'down'; b.pt = 4.5; b.lift = 0;
      g.ui.toast('It is overheating. Blast it now!', 2.6); g.sound.zonk(true);
      for (let i = 0; i < 5; i++) { const a = Math.random() * 6.283; this.coins.push({ x: b.x, y: b.y + 4, z: b.z, vx: Math.cos(a) * 6, vy: 7, vz: Math.sin(a) * 6, t: 0, pull: false }); }
    }
    if (b.phase === 'down') {
      b.pt -= dt; out.sp = 0;
      if (Math.random() < dt * 14) fx.emit(b.x + (Math.random() - 0.5) * 3, b.y + 3 + Math.random() * 3, b.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.9, 0.5, 2.4, 0.9, 0.9, 0.92, 0.55);
      if (b.pt <= 0) { b.phase = 'walk'; b.stompT = 3; }
      return;
    }
    if (b.phase === 'rise') {
      b.pt -= dt; b.lift = Math.min(1.5, b.lift + dt * 2.2); out.sp = 0;
      if (b.pt <= 0) {
        // the stamp: a ring of dust, and anyone standing close goes flying
        b.phase = 'walk'; b.lift = 0; b.stompT = 5 + Math.random() * 2;
        for (let i = 0; i < 46; i++) { const a = (i / 46) * 6.283; fx.emit(b.x + Math.cos(a) * 2.5, b.y + 0.3, b.z + Math.sin(a) * 2.5, Math.cos(a) * 22, 1.2, Math.sin(a) * 22, 0.7, 0.9, 3, 0.78, 0.72, 0.6, 0.7); }
        fx.emit(b.x, b.y + 0.15, b.z, 0, 0, 0, 0.6, 3, 24, 1, 1, 1, 0.5, 0, true);
        g.cam.shake = Math.max(g.cam.shake, dp < 60 ? 0.55 : 0); g.sound.thud(9); g.input.rumble(1, 0.6, 320);
        if (dp < 11.5) {
          const pv = p.vehicle;
          if (pv) { pv.vx += (f.x - b.x) / dp * 9; pv.vz += (f.z - b.z) / dp * 9; }
          else if (p.onGround) g.bonk(b, (f.x - b.x) / dp, (f.z - b.z) / dp, 1.5);
        }
      }
      return;
    }
    // walking
    out.dx = (f.x - b.x) / dp; out.dz = (f.z - b.z) / dp; if (dp < k.r + 1.5) out.sp = 0;
    if ((b.stepT -= dt) <= 0) { b.stepT = 0.62; if (dp < 90) { g.sound.thud(dp < 30 ? 4 : 1.5); if (dp < 30) g.cam.shake = Math.max(g.cam.shake, 0.1); fx.burst(b.x, b.y + 0.2, b.z, 6, 4, 0.7, 0.6, 2, 0.78, 0.72, 0.6, 0.5, 0, 0.3); } }
    if ((b.stompT -= dt) <= 0 && dp < 17) { b.phase = 'rise'; b.pt = 0.85; }
    if ((b.spawnT -= dt) <= 0) {
      b.spawnT = 11;
      if (this.alive(b.group) < 6) for (const s of SIDE) this.spawn('roller', b.x + Math.cos(b.h) * s * 4.5, b.z - Math.sin(b.h) * s * 4.5, { home: { x: b.home.x, z: b.home.z, r: b.home.r }, group: b.group });
    }
  }

  update(dt, p, onFoot) {
    if (dt <= 0) return;
    const g = this.g, w = g.world, fx = g.fx, c = this._c, f = g.focus(), pv = p.vehicle, out = this._o || (this._o = { dx: 0, dz: 0, sp: 1 });
    this.camps(dt, f);
    const list = this.list, n = list.length;
    for (let i = 0; i < n; i++) {
      const b = list[i]; if (b.dead) continue;
      const k = b.k; b.t += dt; b.born += dt;
      b.stun = Math.max(0, b.stun - dt); b.ice = Math.max(0, b.ice - dt); b.net = Math.max(0, b.net - dt); b.blind = Math.max(0, b.blind - dt);
      b.bonkT = Math.max(0, b.bonkT - dt); b.ramT = Math.max(0, b.ramT - dt); b.flash = Math.max(0, b.flash - dt); b.cold = Math.max(0, b.cold - dt * 0.25);
      const dxp = f.x - b.x, dzp = f.z - b.z, dp = Math.hypot(dxp, dzp) || 0.001;
      // floating off in a bubble, then dropped
      if (b.bub > 0) {
        b.bub -= dt; b.y = Math.min(b.y + 2.6 * dt, b.floor + 6.5); b.h += dt * 2.5;
        if (b.bub <= 0) { b.air = true; b.fall = true; b.vy = 0; b.vx = b.vz = 0; fx.burst(b.x, b.y + k.h * 0.5, b.z, 12, 4, 0.4, 0.2, 0.6, 0.85, 0.95, 1, 0.8, 4, 0.6); g.sound.pop(); }
        continue;
      }
      // thrown through the air
      if (b.air) {
        b.vy -= 22 * dt; b.y += b.vy * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.h += dt * 9;
        const gy = Math.max(w.groundAt(b.x, b.z) + w.curbAt(b.x, b.z), WATER_Y);
        if (b.y <= gy && b.vy < 0) {
          b.y = gy; b.air = false; b.vx = b.vz = b.vy = 0; b.alt = 0;
          if (gy <= WATER_Y + 0.05) { fx.burst(b.x, WATER_Y + 0.3, b.z, 18, 4, 0.7, 0.3, 0.8, 1, 1, 1, 0.8, 10, 1.2); this.zonk(b); }
          else { fx.burst(b.x, gy + 0.2, b.z, 8, 3, 0.6, 0.5, 1.6, 0.78, 0.72, 0.6, 0.5, 0, 0.3); if (b.fall || k.fly) this.hit(b, 99, 'hit'); else this.hit(b, 1, 'stun'); b.fall = false; }   // dropped from a bubble: that is that. Thrown: a crash landing, and it sees stars
        }
        continue;
      }
      const held = b.stun > 0 || b.ice > 0 || b.net > 0;
      out.dx = 0; out.dz = 0; out.sp = 1;
      let fly = k.fly || 0;
      if (held || b.bonkT > 0.9) out.sp = 0;
      else if (b.mode === 'boss') this.boss(b, dt, p, onFoot, f, dp, out);
      else if (b.blind > 0) {
        // paint in its eyes: it blunders about
        if ((b.wanderT -= dt) <= 0) { b.wanderT = 0.5; b.a = Math.random() * 6.283; }
        out.dx = Math.sin(b.a); out.dz = Math.cos(b.a); out.sp = 0.5;
      } else if (b.mode === 'goal' && b.goal) {
        const gx = b.goal.x - b.x, gz = b.goal.z - b.z, gl = Math.hypot(gx, gz);
        if (gl < (b.goal.r || 1.8)) { b.atGoal = true; out.sp = 0; if (b.onGoal) b.onGoal(b); }
        else {
          b.atGoal = false; out.dx = gx / gl; out.dz = gz / gl;
          // going nowhere: step sideways round whatever is in the way
          if ((b.wanderT -= dt) <= 0) { b.wanderT = 1; b.stuckT = gl > b.lastD - 0.4 ? b.stuckT + 1 : 0; b.lastD = gl; }
          if (b.stuckT >= 2) { const s = b.stuckT % 4 < 2 ? 1 : -1; out.dx = (gz / gl) * s; out.dz = (-gx / gl) * s; }
        }
      } else if (b.mode === 'flee' && b.path) {
        const q = b.path[b.pi], qx = q[0] - b.x, qz = q[1] - b.z, ql = Math.hypot(qx, qz) || 1;
        if (ql < 2.5) b.pi = (b.pi + 1) % b.path.length;
        out.dx = qx / ql; out.dz = qz / ql; if (dp < 14) out.sp = 1.3;
      } else {
        const home = b.home, near = Math.hypot(f.x - home.x, f.z - home.z) < home.r + 30;
        if (onFoot && near && dp < k.see && Math.abs(f.y - (b.y - b.alt)) < 9) {
          out.dx = dxp / dp; out.dz = dzp / dp; if (dp < k.r + 0.35) out.sp = 0;
          if (fly && dp < 9) fly = clamp(f.y + 1.2 - (b.y - b.alt), 1.2, k.fly);
        } else if (fly) {
          // drones circle
          b.a += (dt * k.speed * 0.5) / Math.max(4, home.r * 0.7);
          const tx = home.x + Math.cos(b.a) * home.r * 0.7 - b.x, tz = home.z + Math.sin(b.a) * home.r * 0.7 - b.z, tl = Math.hypot(tx, tz) || 1;
          out.dx = tx / tl; out.dz = tz / tl; out.sp = tl > 1 ? 0.55 : 0.2;
        } else {
          if ((b.wanderT -= dt) <= 0 || Math.hypot(b.tx - b.x, b.tz - b.z) < 1) { b.wanderT = 2 + Math.random() * 3; const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * home.r; b.tx = home.x + Math.cos(a) * r; b.tz = home.z + Math.sin(a) * r; }
          const tx = b.tx - b.x, tz = b.tz - b.z, tl = Math.hypot(tx, tz);
          if (tl > 0.5) { out.dx = tx / tl; out.dz = tz / tl; } out.sp = 0.42;
        }
      }
      const sp = k.speed * out.sp;
      if (held) b.vx = b.vz = 0;   // stunned, frozen or netted: stock still
      else { b.vx = damp(b.vx, out.dx * sp, 5, dt); b.vz = damp(b.vz, out.dz * sp, 5, dt); }
      const mv = Math.hypot(b.vx, b.vz);
      if (mv > 0.05) {
        let nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
        if (!k.fly && w.heightAt(nx, nz) < WATER_Y + 0.3 && w.platAt(nx, nz) === -Infinity) { nx = b.x; nz = b.z; b.vx *= -0.5; b.vz *= -0.5; b.wanderT = 0; }
        c.x = nx; c.z = nz; w.collide(c, k.r, b.y + 0.3); b.x = c.x; b.z = c.z;
        if (mv > 0.4) b.h += angDiff(Math.atan2(b.vx, b.vz), b.h) * Math.min(1, dt * 7);
      }
      // cars shove robots about, and a fast one sends them flying
      for (const v of g.vlist) {
        if (Math.abs(v.pos.x - b.x) > 9 || Math.abs(v.pos.z - b.z) > 9 || Math.abs(v.pos.y - b.y) > 2.6) continue;
        c.x = b.x; c.z = b.z; if (!v.pushOut(c, k.r)) continue;
        const vs = Math.hypot(v.vx, v.vz);
        if (!k.boss) { b.x = c.x; b.z = c.z; }
        if (vs > 5 && b.ramT <= 0) {
          b.ramT = 0.7;
          if (!k.boss) { b.air = true; b.vy = 4 + vs * 0.25; b.vx = v.vx * 1.1 + c.nx * 3; b.vz = v.vz * 1.1 + c.nz * 3; }
          else { v.vx *= -0.35; v.vz *= -0.35; }
          this.hit(b, Math.min(3, vs / 5), 'hit');
          if (v === pv) { g.cam.shake = Math.max(g.cam.shake, 0.22); g.sound.thud(vs * 0.4); }
        }
      }
      if (b.dead) continue;
      // height: on the ground, or hovering over whatever is below
      const base = Math.max(w.groundAt(b.x, b.z) + w.curbAt(b.x, b.z), WATER_Y);
      if (k.fly) { const roof = w.roofAt(b.x, b.z, 1e6); b.alt = damp(b.alt, fly + Math.sin(b.t * 1.7) * 0.5, 3, dt); b.y = Math.max(base, roof) + b.alt; }
      else b.y = base;
      // touching Christian: a jump on the head stops a small robot, anything else is a bonk
      if (onFoot && b.bonkT <= 0 && dp < k.r + 0.55) {
        const py = p.pos.y;
        if (py > b.y + k.h * 0.5 && py < b.y + k.h + 0.5 && p.vy < -1.5) { this.hit(b, k.boss ? 1.5 : 2, 'hit'); p.vy = 10; p.onGround = false; b.bonkT = 0.6; g.sound.jump(); }
        else if (!held && py < b.y + k.h + 0.3 && py + 1.9 > b.y) { b.bonkT = 1.5; b.vx = -(dxp / dp) * 5; b.vz = -(dzp / dp) * 5; g.bonk(b, dxp / dp, dzp / dp, k.boss ? 1.4 : b.kind === 'brute' ? 1.2 : 1); }
      }
    }
    // robots keep out of each other's way
    for (let i = 0; i < n; i++) {
      const a = list[i]; if (a.dead || a.air || a.bub > 0) continue;
      for (let j = i + 1; j < n; j++) {
        const b = list[j]; if (b.dead || b.air || b.bub > 0 || Math.abs(a.y - b.y) > 2.5) continue;
        const dx = b.x - a.x, dz = b.z - a.z, rr = a.k.r + b.k.r, d2 = dx * dx + dz * dz; if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (rr - d) / d, wa = a.k.boss ? 0 : b.k.boss ? 1 : 0.5;
        a.x -= dx * push * wa; a.z -= dz * push * wa; b.x += dx * push * (1 - wa); b.z += dz * push * (1 - wa);
      }
    }
    if (this.dirty) { this.dirty = false; this.list = list.filter((b) => !b.dead); }
    this.loot(dt, f);
    this.draw();
  }

  // Coins: they bounce, lie about for a while, and jump into Christian's pocket when he is close (or has the magnet).
  loot(dt, f) {
    const g = this.g, w = g.world, coins = this.coins; if (!coins.length) return;
    const reach = g.gear.has('magnet') ? 13 : g.player.vehicle ? 3.4 : 2.3;
    this.coinT -= dt; let gone = false;
    for (const c of coins) {
      c.t += dt;
      const dx = f.x - c.x, dy = f.y + 1 - c.y, dz = f.z - c.z, d = Math.hypot(dx, dy, dz) || 0.001;
      if (c.t > 0.5 && d < reach) c.pull = true;
      if (c.pull) {
        const v = 18 * dt; c.x += (dx / d) * Math.min(v, d); c.y += (dy / d) * Math.min(v, d); c.z += (dz / d) * Math.min(v, d);
        if (d < 1) { c.t = 1e9; gone = true; g.addMoney(5); g.state.stats.coins++; if (this.coinT <= 0) { this.coinT = 0.07; g.sound.coin(); } }
        continue;
      }
      const gy = Math.max(w.groundAt(c.x, c.z) + w.curbAt(c.x, c.z), WATER_Y) + 0.4;
      if (c.y > gy || c.vy > 0) { c.vy -= 20 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; if (c.y <= gy) { c.y = gy; c.vy = c.vy < -4 ? -c.vy * 0.4 : 0; c.vx *= 0.5; c.vz *= 0.5; } }
      if (c.t > 45) gone = true;
    }
    if (gone) { this.coins = coins.filter((c) => c.t <= 45); g.save(); }
  }

  draw() {
    const g = this.g, time = g.time;
    for (const kind in this.mesh) this.mesh[kind].count = 0;
    let shells = 0, bales = 0; const shell = this.shell, hay = this.hay;
    for (const b of this.list) {
      if (b.dead) continue;
      const k = b.k, im = this.mesh[b.kind], i = im.count++;
      const moving = Math.hypot(b.vx, b.vz), s = Math.min(1, b.born * 5);
      let rx = Math.min(0.16, moving * 0.035), rz = 0, y = b.y + b.lift;
      if (b.stun > 0) { rz = Math.sin(time * 28 + b.t) * 0.1; rx = 0; }
      else if (b.kind === 'walker' || b.kind === 'brute') { rz = Math.sin(b.t * 9) * 0.05 * Math.min(1, moving); y += Math.abs(Math.sin(b.t * 9)) * 0.06 * Math.min(1, moving); }
      else if (b.kind === 'mega' && b.phase === 'walk') { rz = Math.sin(b.t * 5) * 0.045; y += Math.abs(Math.sin(b.t * 5)) * 0.3; }
      else if (b.kind === 'mega' && b.phase === 'down') { rx = 0.3; y -= 0.5; }
      else if (b.kind === 'drone') { rx = Math.min(0.3, moving * 0.05); rz = Math.sin(b.t * 3) * 0.06; }
      if (b.air || b.bub > 0) { rx = Math.sin(b.t * 5) * 0.6; rz = Math.cos(b.t * 4) * 0.6; }
      _e.set(rx, b.h, rz, 'YXZ'); _q.setFromEuler(_e);
      _m.compose(_p.set(b.x, y, b.z), _q, _s.set(s, s, s)); im.setMatrixAt(i, _m);
      const col = b.flash > 0 ? HOT : b.ice > 0 ? ICE : b.stun > 0 && Math.sin(time * 20) > 0 ? DIZZY : WHITE;
      if (b.tint !== null && col === WHITE) { _col.set(b.tint); _col.r = 0.45 + _col.r * 0.9; _col.g = 0.45 + _col.g * 0.9; _col.b = 0.45 + _col.b * 0.9; } else _col.setRGB(col[0], col[1], col[2]);
      im.setColorAt(i, _col);
      if ((b.bub > 0 || b.ice > 0 || b.net > 0) && shells < 40) {
        const r = Math.max(k.h * 0.62, k.r * 1.25) * (b.bub > 0 ? 1.15 + Math.sin(time * 6 + b.t) * 0.04 : 1);
        _m.compose(_p.set(b.x, b.y + k.h * 0.5, b.z), _q.identity(), _s.set(r, r, r)); shell.setMatrixAt(shells, _m);
        const sc = b.bub > 0 ? WHITE : b.ice > 0 ? ICE : NET; shell.setColorAt(shells, _col.setRGB(sc[0], sc[1], sc[2])); shells++;
      }
      if (b.carry && bales < 16) { _e.set(0, b.h, 0, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(b.x, y + k.h + 0.45, b.z), _q, _s.set(1, 1, 1)); hay.setMatrixAt(bales++, _m); }
    }
    for (const kind in this.mesh) { const im = this.mesh[kind]; if (im.count) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; } }
    shell.count = shells; if (shells) { shell.instanceMatrix.needsUpdate = true; shell.instanceColor.needsUpdate = true; }
    hay.count = bales; if (bales) hay.instanceMatrix.needsUpdate = true;
    const cm = this.coinMesh; let n = 0;
    for (const c of this.coins) { if (n >= 80) break; _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, time * 5 + c.x); _m.compose(_p.set(c.x, c.y + Math.sin(time * 3 + c.z) * 0.06, c.z), _q, _s.set(1, 1, 1)); cm.setMatrixAt(n++, _m); }
    cm.count = n; if (n) cm.instanceMatrix.needsUpdate = true;
  }
}

// A small fire: something smouldering that a Water Blaster can put out.
export class Fire {
  constructor(game, x, z, onOut) {
    const w = game.world; this.g = game; this.x = x; this.z = z; this.y = w.groundAt(x, z) + w.curbAt(x, z); this.heat = 1; this.t = Math.random() * 9; this.acc = 0; this.onOut = onOut || null;
    const b = new Batch();
    b.add(GEO.cyl, 0, 0.45, 0, 0.46, 0.9, 0.46, DARK); b.add(GEO.cyl, 0, 0.92, 0, 0.5, 0.08, 0.5, BLACK); b.box(0, 0.5, 0.47, 0.4, 0.3, 0.03, WARN);
    this.mesh = new THREE.Mesh(b.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true })); this.mesh.position.set(x, this.y, z); this.mesh.castShadow = true;
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff8a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); this.glow.position.set(0, 1.5, 0); this.mesh.add(this.glow);
    game.scene.add(this.mesh);
  }
  update(dt) {
    if (this.heat <= 0 || dt <= 0) return;
    const fx = this.g.fx, R = Math.random, h = this.heat; this.t += dt; this.acc += dt * (10 + 22 * h);
    while (this.acc >= 1) {
      this.acc -= 1;
      fx.emit(this.x + (R() - 0.5) * 0.6, this.y + 0.95, this.z + (R() - 0.5) * 0.6, (R() - 0.5) * 0.8, 1.8 + R() * 2.2 * h, (R() - 0.5) * 0.8, 0.45 + R() * 0.3, 0.5 + 0.5 * h, 0.08, 1, 0.5 + R() * 0.35, 0.08, 0.9);
      if (R() < 0.18) fx.emit(this.x, this.y + 1.8, this.z, 0.4, 1.4 + R(), 0.2, 2.2, 0.6, 2.6, 0.3, 0.3, 0.32, 0.4);
    }
    this.glow.scale.setScalar((4 + Math.sin(this.t * 17) * 0.5) * (0.4 + 0.6 * h));
  }
  // Water lands on it. a: how much one splash cools it.
  douse(a) {
    if (this.heat <= 0) return;
    const fx = this.g.fx; this.heat -= a;
    fx.emit(this.x, this.y + 1.2, this.z, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5, 0.9, 0.5, 2, 0.95, 0.95, 0.97, 0.6);
    if (this.heat <= 0) {
      this.heat = 0; this.glow.visible = false; this.g.sound.hiss();
      fx.burst(this.x, this.y + 1, this.z, 16, 2.5, 1.4, 0.8, 3, 0.95, 0.95, 0.97, 0.6, 0, 1.2);
      if (this.onOut) this.onOut(this);
    }
  }
  dispose() { this.heat = 0; this.g.scene.remove(this.mesh); }
}
