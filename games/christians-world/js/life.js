// Everything that moves on its own: people on the pavements, birds, farm animals and Scout the puppy.
import * as THREE from './three.js';
import { Batch, MAT, GEO, POI, WATER_Y } from './world.js';
import { buildPuppy } from './player.js';
import { clamp, damp, angDiff, rng } from './util.js';

const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0), HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
const white = (build) => { const b = new Batch(); build(b); return b.geometry(); };
function instanced(scene, geo, n, shadow = true) {
  const m = new THREE.InstancedMesh(geo, MAT.solid, n);
  m.castShadow = shadow; m.receiveShadow = false; m.frustumCulled = false;
  for (let i = 0; i < n; i++) { m.setMatrixAt(i, HIDE); m.setColorAt(i, _c.set(0xffffff)); }
  scene.add(m); return m;
}

// ---------------------------------------------------------------- people
const SHIRTS = [0x2d6cdf, 0xe23b2e, 0x1f8a70, 0xff7a1a, 0x8e44ad, 0xff5fa2, 0x1fb7c9, 0xffd21f, 0xf7f9fb, 0x4f7a3a, 0x27323f];
const PANTS = [0x39414c, 0x27323f, 0x2b4f8f, 0x6b5a3a, 0x8d877c, 0x1d3f8f, 0x4a5058];
const SKINS = [0xf1c9a5, 0xe9b98f, 0xc98f66, 0xb9805a, 0x8d5a3c, 0x6e4530];
const HAIRS = [0x4a3323, 0x1c1c1f, 0x8a3f1d, 0xd9a441, 0x6b4428, 0xc9c9c9, 0xe23b2e, 0x2d6cdf, 0xffd21f];
const HALF = 42.2;   // how far out from the middle of a block people walk: between the lamp posts and the kerb

// People walking the pavements. They all share five meshes, drawn with instancing.
// They keep to the pavement, wave at Christian, and hop out of the way of any car that mounts the kerb.
export class Crowd {
  constructor(scene, world, n = 30) {
    this.world = world; this.n = n; this.R = rng(777);
    this.torso = instanced(scene, white((b) => b.box(0, 1.14, 0, 0.64, 0.68, 0.38, 0xffffff)), n);
    this.head = instanced(scene, white((b) => { b.box(0, 1.73, 0, 0.46, 0.46, 0.46, 0xffffff); for (const sx of [-0.11, 0.11]) b.box(sx, 1.77, 0.235, 0.07, 0.08, 0.03, 0x111111); b.box(0, 1.62, 0.235, 0.16, 0.04, 0.03, 0x8a4035); }), n);
    this.hair = instanced(scene, white((b) => { b.box(0, 2.0, 0, 0.5, 0.14, 0.5, 0xffffff); b.box(0, 1.86, -0.2, 0.5, 0.3, 0.12, 0xffffff); }), n);
    this.legs = instanced(scene, white((b) => { b.box(0, -0.4, 0, 0.27, 0.8, 0.3, 0xffffff); b.box(0, -0.85, 0.06, 0.29, 0.14, 0.42, 0x555555); }), n * 2);
    this.arms = instanced(scene, white((b) => b.box(0, -0.31, 0, 0.2, 0.62, 0.24, 0xffffff)), n * 2);
    this.meshes = [this.torso, this.head, this.hair, this.legs, this.arms];
    this.blocks = [];
    for (let bx = 0; bx < 6; bx++) for (let bz = 0; bz < 6; bz++) this.blocks.push(world.blockCenter(bx, bz));
    this.people = [];
    for (let i = 0; i < n; i++) {
      const R = this.R, kid = R() < 0.22;
      const p = { i, x: 0, z: 0, y: 0, h: 0, cx: 0, cz: 0, u: 0, dir: 1, speed: (kid ? 2.4 : 1.25) + R() * 0.7, scale: kid ? 0.68 + R() * 0.1 : 0.94 + R() * 0.14, t: R() * 9, pause: 0, wave: 0, look: 0, hop: 0, hx: 0, hz: 0, greet: 0, on: false };
      this.torso.setColorAt(i, _c.set(SHIRTS[(R() * SHIRTS.length) | 0]));
      const skin = SKINS[(R() * SKINS.length) | 0]; this.head.setColorAt(i, _c.set(skin));
      this.hair.setColorAt(i, _c.set(HAIRS[(R() * HAIRS.length) | 0]));
      const pants = PANTS[(R() * PANTS.length) | 0]; this.legs.setColorAt(i * 2, _c.set(pants)); this.legs.setColorAt(i * 2 + 1, _c.set(pants));
      this.torso.getColorAt(i, _c); this.arms.setColorAt(i * 2, _c); this.arms.setColorAt(i * 2 + 1, _c);
      this.people.push(p);
    }
    for (const m of this.meshes) m.instanceColor.needsUpdate = true;
    this.checkT = 0; this.active = 0; this.heyT = 0;
  }
  // A spot on the pavement that rings a block: u runs once around the square.
  ring(p) {
    const L = HALF * 2, u = ((p.u % (L * 4)) + L * 4) % (L * 4), side = (u / L) | 0, t = u - side * L - HALF;
    if (side === 0) { p.x = p.cx + t; p.z = p.cz - HALF; p.wh = Math.PI / 2; }
    else if (side === 1) { p.x = p.cx + HALF; p.z = p.cz + t; p.wh = 0; }
    else if (side === 2) { p.x = p.cx - t; p.z = p.cz + HALF; p.wh = -Math.PI / 2; }
    else { p.x = p.cx - HALF; p.z = p.cz - t; p.wh = Math.PI; }
    if (p.dir < 0) p.wh += Math.PI;
  }
  // Put someone on a pavement near (fx, fz), but not right on top of the camera.
  spawn(p, fx, fz, first) {
    const R = this.R, near = this.blocks.filter(([x, z]) => Math.hypot(x - fx, z - fz) < 215);
    if (!near.length) return false;
    for (let k = 0; k < 8; k++) {
      const [cx, cz] = near[(R() * near.length) | 0];
      p.cx = cx; p.cz = cz; p.u = R() * HALF * 8; p.dir = R() < 0.5 ? 1 : -1; this.ring(p);
      const d = Math.hypot(p.x - fx, p.z - fz);
      if (d < 200 && (first ? d > 12 : d > 70)) { p.h = p.wh; p.on = true; p.pause = 0; p.hop = 0; p.hx = p.hz = 0; return true; }
    }
    return false;
  }
  // Something startling close by (a splash, a bang): everyone within r metres throws their arms up and hops.
  startle(x, z, r) { let n = 0; for (const p of this.people) if (p.on && p.hop <= 0 && Math.hypot(p.x - x, p.z - z) < r) { p.hop = 0.55; n++; } return n; }
  update(dt, fx, fz, vlist, pv, player, night, honk, sound) {
    if (dt <= 0) return;
    const R = this.R, w = this.world, want = Math.round(this.n * (1 - 0.72 * clamp((night - 0.35) * 3, 0, 1)));
    // every so often move the people who are far away to somewhere nearer, or send them home at night
    if ((this.checkT -= dt) <= 0) {
      this.checkT = 0.6; let on = 0;
      for (const p of this.people) {
        const d = p.on ? Math.hypot(p.x - fx, p.z - fz) : 1e9;
        if (p.on && (d > 235 || (on >= want && d > 60))) p.on = false;
        if (!p.on && on < want) this.spawn(p, fx, fz, !this.started);
        if (p.on) on++;
      }
      this.started = true; this.active = on;
    }
    this.heyT -= dt;
    const onFoot = !pv, px = player.pos.x, pz = player.pos.z;
    for (const p of this.people) {
      const i = p.i;
      if (!p.on) { if (!p.hidden) { p.hidden = true; this.torso.setMatrixAt(i, HIDE); this.head.setMatrixAt(i, HIDE); this.hair.setMatrixAt(i, HIDE); for (const k of [0, 1]) { this.legs.setMatrixAt(i * 2 + k, HIDE); this.arms.setMatrixAt(i * 2 + k, HIDE); } } continue; }
      p.hidden = false; p.t += dt;
      // cars: jump clear of anything coming too close
      for (const v of vlist) {
        const dx = p.x + p.hx - v.pos.x, dz = p.z + p.hz - v.pos.z; if (Math.abs(dx) > 9 || Math.abs(dz) > 9 || Math.abs(v.pos.y - p.y) > 3) continue;
        const sp = Math.hypot(v.vx, v.vz); if (sp < 2 && Math.hypot(dx, dz) > v.radius + 0.6) continue;
        // closest the car's path comes in the next second
        const tt = sp > 0.1 ? clamp((dx * v.vx + dz * v.vz) / (sp * sp), 0, 1) : 0, nx = dx - v.vx * tt, nz = dz - v.vz * tt, miss = Math.hypot(nx, nz);
        if (miss < v.radius + 1.3) {
          const k = 1 / (miss || 1), ax = miss > 0.05 ? nx * k : -v.vz / (sp || 1), az = miss > 0.05 ? nz * k : v.vx / (sp || 1);
          if (p.hop <= 0) { p.hop = 0.55; if (v === pv && this.heyT <= 0) { this.heyT = 1.2; sound.hey(); } }
          p.hx += ax * 7 * dt; p.hz += az * 7 * dt;
        }
      }
      if (p.hop > 0) p.hop -= dt; else { p.hx = damp(p.hx, 0, 1.5, dt); p.hz = damp(p.hz, 0, 1.5, dt); }
      // say hello to Christian, or look round at a horn
      const dp = Math.hypot(px - p.x, pz - p.z);
      p.greet -= dt;
      if (onFoot && dp < 4.5 && p.greet <= 0 && p.hop <= 0) { p.greet = 14; p.wave = 2.2; p.look = 2.2; }
      // do not walk through him: wait a moment, then turn round and go the other way
      if (onFoot && dp < 1.5) { p.pause = Math.max(p.pause, 0.5); if ((p.block = (p.block || 0) + dt) > 2.2) { p.block = 0; p.dir = -p.dir; p.u += p.dir * 1.8; p.pause = 0; p.look = 0; } } else p.block = 0;
      if (honk && pv && dp < 28 && p.look <= 0) { p.look = 1.6; p.wave = R() < 0.5 ? 1.6 : 0; }
      let moving = 0;
      if (p.look > 0) { p.look -= dt; p.wave -= dt; p.h += angDiff(Math.atan2(px - p.x, pz - p.z), p.h) * Math.min(1, dt * 7); }
      else if (p.pause > 0) p.pause -= dt;
      else if (p.hop <= 0) {
        p.u += p.dir * p.speed * dt; this.ring(p); moving = 1;
        p.h += angDiff(p.wh, p.h) * Math.min(1, dt * 6);
        if (R() < dt * 0.045) p.pause = 1.5 + R() * 4;
        if (R() < dt * 0.012) p.dir = -p.dir;
      }
      const x = p.x + p.hx, z = p.z + p.hz;
      p.y = w.groundAt(x, z) + w.curbAt(x, z);
      const hop = p.hop > 0 ? Math.sin((1 - p.hop / 0.55) * Math.PI) * 0.5 : 0, ph = p.t * (p.speed > 2 ? 9 : 6.5), sw = moving ? Math.sin(ph) * 0.75 : 0, bob = moving ? Math.abs(Math.sin(ph)) * 0.05 : Math.sin(p.t * 2) * 0.012;
      _r.compose(_p.set(x, p.y + hop, z), _q.setFromAxisAngle(UP, p.h), _s.setScalar(p.scale));
      _m.copy(_r); _m.elements[13] += bob * p.scale;
      this.torso.setMatrixAt(i, _m); this.head.setMatrixAt(i, _m); this.hair.setMatrixAt(i, _m);
      for (const k of [0, 1]) {
        const sd = k ? -1 : 1;
        _l.makeRotationX(sw * 0.85 * sd).setPosition(0.16 * sd, 0.82, 0); _m.multiplyMatrices(_r, _l); this.legs.setMatrixAt(i * 2 + k, _m);
        if (p.hop > 0) _l.makeRotationZ(2.7 * sd);                                       // arms up: "whoa!"
        else if (p.wave > 0 && k === 0) _l.makeRotationZ(2.5 + Math.sin(p.t * 9) * 0.35);  // a wave
        else _l.makeRotationX(-sw * 0.7 * sd);
        _l.setPosition(0.43 * sd, 1.46 + bob, 0); _m.multiplyMatrices(_r, _l); this.arms.setMatrixAt(i * 2 + k, _m);
      }
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- birds
// Every bird is one instance of a small mesh; the wings flap in the vertex shader.
export class Birds {
  constructor(scene, world) {
    this.world = world; const R = this.R = rng(4321);
    // body along +z, wings out to the sides; `wing` is 0 on the body and ±1 at the tips
    const pos = [], wing = [], shade = [], idx = [];
    const v = (x, y, z, wg, sh) => { pos.push(x, y, z); wing.push(wg); shade.push(sh); return pos.length / 3 - 1; };
    const tri = (a, b, c) => idx.push(a, b, c);
    const nose = v(0, 0, 0.34, 0, 1), tail = v(0, 0.02, -0.34, 0, 0.8), top = v(0, 0.09, 0, 0, 1), bot = v(0, -0.07, 0, 0, 0.92), sl = v(0.09, 0, 0, 0, 0.95), sr = v(-0.09, 0, 0, 0, 0.95);
    for (const [a, b] of [[sl, top], [top, sr], [sr, bot], [bot, sl]]) { tri(nose, a, b); tri(tail, b, a); }
    for (const sd of [1, -1]) { const r0 = v(0.07 * sd, 0.03, 0.14, 0, 0.9), r1 = v(0.07 * sd, 0.03, -0.14, 0, 0.9), mid = v(0.42 * sd, 0.03, 0.02, 0.55 * sd, 0.72), tip = v(0.78 * sd, 0.03, -0.1, sd, 0.5); tri(r0, mid, r1); tri(mid, tip, r1); }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('wing', new THREE.Float32BufferAttribute(wing, 1)); g.setAttribute('shade', new THREE.Float32BufferAttribute(shade, 1)); g.setIndex(idx);
    const N = this.N = 46;
    this.at = new Float32Array(N * 4); this.fl = new Float32Array(N * 4);
    g.setAttribute('at', this.aAt = new THREE.InstancedBufferAttribute(this.at, 4));   // x y z heading
    g.setAttribute('fl', this.aFl = new THREE.InstancedBufferAttribute(this.fl, 4));   // flap angle, size, bank, tone
    g.instanceCount = N;
    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { light: { value: new THREE.Color(1, 1, 1) } }]), fog: true, side: THREE.DoubleSide,
      vertexShader: `
        attribute float wing; attribute float shade; attribute vec4 at; attribute vec4 fl; varying vec3 vC;
        #include <fog_pars_vertex>
        void main(){
          vec3 p = position;
          float folded = step(fl.x, -1.0);                          // on the ground the wings tuck in
          float a = fl.x * abs(wing) * (1.0 - folded);             // in the air the tips swing up and down
          p.y += sin(a) * abs(p.x); p.x *= mix(1.0, cos(a), abs(wing) * 0.6); p.x *= mix(1.0, mix(1.0, 0.2, abs(wing)), folded);
          float cb = cos(fl.z), sb = sin(fl.z); p = vec3(p.x * cb - p.y * sb, p.x * sb + p.y * cb, p.z);   // bank
          float ch = cos(at.w), sh = sin(at.w); p = vec3(p.x * ch + p.z * sh, p.y, -p.x * sh + p.z * ch) * fl.y;
          vC = mix(vec3(0.42, 0.44, 0.5), vec3(1.0), fl.w) * shade;
          vec4 mvPosition = viewMatrix * vec4(p + at.xyz, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 light; varying vec3 vC;
        #include <fog_pars_fragment>
        void main(){ gl_FragColor = vec4(vC * light, 1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.birds = [];
    const B = POI.beach, add = (o) => { o.i = this.birds.length; o.ph = R() * 9; this.birds.push(o); return o; };
    // gulls wheel over the pier, the lighthouse, the islet and the lake
    for (const [cx, cz, n, h] of [[B.pierEnd.x, B.pierEnd.z - 20, 7, 20], [B.lighthouse.x, B.lighthouse.z, 5, 40], [POI.islet.x, POI.islet.z, 6, 18], [POI.lake.x, POI.lake.z, 4, 16]])
      for (let k = 0; k < n; k++) add({ kind: 'gull', cx, cz, r: 12 + R() * 30, a: R() * 6.283, w: (0.16 + R() * 0.14) * (R() < 0.5 ? 1 : -1), h: h + R() * 12, size: 1.5 + R() * 0.5, tone: 1 });
    // pigeons peck about in little groups until something comes close
    this.spots = [[POI.park.x - 6, POI.park.z + 3], [POI.park.x + 22, POI.park.z - 20], [POI.townHall.front.x + 14, POI.townHall.front.z + 6], [POI.school.yard.x + 16, POI.school.yard.z + 4], [-246, 196], [POI.park.x - 24, POI.park.z + 24], [POI.beach.x - 30, 668], [150, 150 - 34]];
    for (let f = 0; f < 3; f++) { const flock = { spot: f, t: 0, state: 'ground', from: null, to: null }; for (let k = 0; k < 6; k++) add({ kind: 'pigeon', flock, ox: (R() - 0.5) * 5, oz: (R() - 0.5) * 5, size: 0.62, tone: 0.25 + R() * 0.35, hd: R() * 6.283, peck: R() * 9 }); }
    this.flocks = [...new Set(this.birds.filter((b) => b.flock).map((b) => b.flock))];
    // now and then a skein of geese crosses the whole island, high up
    this.geese = []; for (let k = 0; k < 7; k++) this.geese.push(add({ kind: 'goose', k, size: 2.1, tone: 0.55 }));
    this.gooseT = 20; this.goose = null;
  }
  update(dt, t, fx, fz, light, sound) {
    if (dt <= 0) return;
    const R = this.R, w = this.world, at = this.at, fl = this.fl;
    // pigeons: scatter when the player (or the player's car) gets close, land somewhere else
    for (const f of this.flocks) {
      const [sx, sz] = this.spots[f.spot];
      if (f.state === 'ground') { if (Math.hypot(fx - sx, fz - sz) < 11) { let n; do n = (R() * this.spots.length) | 0; while (n === f.spot || this.flocks.some((o) => o !== f && o.spot === n)); f.state = 'fly'; f.from = [sx, sz]; f.to = this.spots[n]; f.next = n; f.t = 0; f.dur = 5 + Math.hypot(f.to[0] - sx, f.to[1] - sz) / 22; if (sound && Math.hypot(fx - sx, fz - sz) < 30) sound.flutter(); } }
      else { f.t += dt; if (f.t >= f.dur) { f.state = 'ground'; f.spot = f.next; } }
    }
    // geese
    if (!this.goose && (this.gooseT -= dt) <= 0) { const a = R() * 6.283; this.goose = { x: Math.cos(a) * 1500, z: -250 + Math.sin(a) * 1500, h: a + Math.PI, t: 0 }; this.goose.hd = Math.atan2(-Math.cos(a), -Math.sin(a)); }
    if (this.goose) { const g = this.goose; g.t += dt; g.x += Math.sin(g.hd) * 19 * dt; g.z += Math.cos(g.hd) * 19 * dt; if (g.t > 160) { this.goose = null; this.gooseT = 60 + R() * 80; } }
    for (const b of this.birds) {
      const k = b.i * 4; let x, y, z, hd, flap, bank = 0;
      if (b.kind === 'gull') {
        b.a += b.w * dt; x = b.cx + Math.cos(b.a) * b.r; z = b.cz + Math.sin(b.a) * b.r; y = b.h + Math.sin(t * 0.4 + b.ph) * 3;
        hd = Math.atan2(-Math.sin(b.a) * b.w, Math.cos(b.a) * b.w); bank = -Math.sign(b.w) * 0.35;
        const beat = Math.sin(t * 0.23 + b.ph);   // glide for a while, then a few lazy beats
        flap = beat > 0.3 ? Math.sin(t * 5 + b.ph) * 0.5 : 0.12;
      } else if (b.kind === 'pigeon') {
        const f = b.flock;
        if (f.state === 'ground') {
          const [sx, sz] = this.spots[f.spot]; x = sx + b.ox; z = sz + b.oz; y = w.groundAt(x, z) + w.curbAt(x, z) + 0.14;
          b.peck += dt; hd = b.hd + Math.sin(b.peck * 0.7) * 0.6; flap = -1.25;   // wings folded
          if (Math.sin(b.peck * 3.1) > 0.82) y -= 0.05;
        } else {
          const u = clamp((f.t - b.peck % 0.6) / (f.dur - 0.6), 0, 1), e = u * u * (3 - 2 * u);
          const ax = f.from[0] + b.ox, az = f.from[1] + b.oz, bx = f.to[0] + b.ox, bz = f.to[1] + b.oz;
          x = ax + (bx - ax) * e + Math.sin(u * 3.1416) * b.ox * 2.5; z = az + (bz - az) * e + Math.sin(u * 3.1416) * b.oz * 2.5;
          const g0 = w.groundAt(ax, az) + w.curbAt(ax, az), g1 = w.groundAt(bx, bz) + w.curbAt(bx, bz);
          y = g0 + (g1 - g0) * e + 0.14 + Math.sin(u * 3.1416) * (26 + (b.i % 5) * 2.5);   // over the rooftops
          hd = Math.atan2(bx - ax, bz - az) + Math.sin(u * 6 + b.ph) * 0.3; flap = u > 0 && u < 1 ? Math.sin(t * 22 + b.ph) * 0.9 : -1.25;
        }
      } else {
        const g = this.goose; if (!g) { at[k + 1] = -500; continue; }
        const row = Math.ceil(b.k / 2), sd = b.k % 2 ? 1 : -1, lx = sd * row * 2.6, lz = -row * 3.2;
        x = g.x + Math.cos(g.hd) * lx + Math.sin(g.hd) * lz; z = g.z - Math.sin(g.hd) * lx + Math.cos(g.hd) * lz; y = 105 + Math.sin(t * 0.5 + b.k) * 0.8; hd = g.hd; flap = Math.sin(t * 6.5 + b.k * 0.7) * 0.55;
      }
      at[k] = x; at[k + 1] = y; at[k + 2] = z; at[k + 3] = hd; fl[k] = flap; fl[k + 1] = b.size; fl[k + 2] = bank; fl[k + 3] = b.tone;
    }
    this.aAt.needsUpdate = true; this.aFl.needsUpdate = true;
    this.mat.uniforms.light.value.setScalar(light);
  }
}

// ---------------------------------------------------------------- farm animals
function cowGeo() {
  const b = new Batch(), W = 0xf7f4ec, K = 0x2a2a2e;
  b.box(0, 1.15, 0, 0.95, 0.9, 1.9, W); b.box(0.2, 1.3, 0.35, 0.6, 0.62, 0.8, K); b.box(-0.25, 1.2, -0.5, 0.5, 0.74, 0.7, K);
  b.box(0, 1.5, 1.2, 0.6, 0.6, 0.7, W); b.box(0, 1.36, 1.6, 0.46, 0.34, 0.22, 0xf2b6b0); b.box(0.2, 1.62, 1.1, 0.24, 0.3, 0.5, K);
  for (const sx of [-1, 1]) { b.box(sx * 0.36, 1.78, 1.05, 0.2, 0.1, 0.1, K); b.box(sx * 0.2, 1.9, 1.0, 0.07, 0.2, 0.07, 0xe9dfc3); }
  for (const [x, z] of [[0.32, 0.7], [-0.32, 0.7], [0.32, -0.7], [-0.32, -0.7]]) b.box(x, 0.36, z, 0.22, 0.72, 0.22, W);
  b.box(0, 0.62, -0.35, 0.4, 0.2, 0.4, 0xf2b6b0); b.box(0, 1.2, -1.02, 0.07, 0.7, 0.07, W);
  return b.geometry();
}
function sheepGeo() {
  const b = new Batch(), W = 0xf3f1e6, K = 0x2e2a2a;
  b.add(GEO.sph, 0, 0.78, 0, 0.5, 0.46, 0.72, W); b.add(GEO.sph, 0, 0.98, -0.2, 0.42, 0.34, 0.5, W);
  b.box(0, 0.92, 0.72, 0.3, 0.32, 0.36, K); for (const sx of [-1, 1]) b.box(sx * 0.2, 1.0, 0.62, 0.12, 0.08, 0.14, K);
  for (const [x, z] of [[0.2, 0.34], [-0.2, 0.34], [0.2, -0.34], [-0.2, -0.34]]) b.box(x, 0.2, z, 0.11, 0.42, 0.11, K);
  return b.geometry();
}
function henGeo() {
  const b = new Batch(), W = 0xf7f4ec;
  b.add(GEO.sph, 0, 0.3, 0, 0.17, 0.17, 0.24, W); b.box(0, 0.5, 0.17, 0.14, 0.18, 0.14, W); b.box(0, 0.62, 0.17, 0.04, 0.08, 0.12, 0xe23b2e);
  b.box(0, 0.49, 0.27, 0.05, 0.04, 0.08, 0xf2a71b); b.box(0, 0.4, -0.22, 0.1, 0.18, 0.1, W);
  for (const sx of [-1, 1]) b.box(sx * 0.07, 0.08, 0, 0.03, 0.16, 0.03, 0xf2a71b);
  return b.geometry();
}

// Cows and sheep graze in the meadow north of the farm; hens scratch about behind the barn.
// They amble around, move aside for cars, and answer the horn.
export class Animals {
  constructor(scene, world) {
    this.world = world; const R = this.R = rng(99);
    const F = POI.farm;
    this.herds = [
      { kind: 'cow', n: 5, cx: F.pasture.x, cz: F.pasture.z, r: 20, speed: 0.55, geo: cowGeo(), size: [0.95, 1.12] },
      { kind: 'sheep', n: 6, cx: F.pasture.x - 6, cz: F.pasture.z - 26, r: 15, speed: 0.75, geo: sheepGeo(), size: [0.9, 1.1] },
      { kind: 'hen', n: 8, cx: F.barn.x - 21, cz: F.barn.z + 16, r: 8, speed: 1.3, geo: henGeo(), size: [0.9, 1.15] },
    ];
    this.all = [];
    for (const h of this.herds) {
      h.mesh = instanced(scene, h.geo, h.n);
      for (let i = 0; i < h.n; i++) {
        const a = R() * 6.283, d = Math.sqrt(R()) * h.r;
        const o = { herd: h, i, x: h.cx + Math.cos(a) * d, z: h.cz + Math.sin(a) * d, h: R() * 6.283, tx: 0, tz: 0, wait: R() * 6, size: h.size[0] + R() * (h.size[1] - h.size[0]), t: R() * 9, run: 0 };
        o.tx = o.x; o.tz = o.z; this.all.push(o);
      }
    }
    this.callT = 0;
  }
  // A splash or a bang near the animals: they bolt, and one of them says so. Nothing ever hurts them.
  startle(x, z, r, sound) {
    let kind = null;
    for (const o of this.all) {
      if (Math.hypot(o.x - x, o.z - z) > r) continue;
      const a = Math.atan2(o.x - x, o.z - z); o.tx = o.x + Math.sin(a) * 9; o.tz = o.z + Math.cos(a) * 9; o.wait = 0; o.run = 1.6; kind = kind || o.herd.kind;
    }
    if (kind && this.callT <= 0) { this.callT = 1.4; if (kind === 'cow') sound.moo(); else if (kind === 'sheep') sound.baa(); else sound.cluck(); }
    return kind;
  }
  update(dt, fx, fz, vlist, pv, honk, sound) {
    if (dt <= 0) return;
    const R = this.R, w = this.world, F = POI.farm;
    if (Math.abs(fx - F.barn.x) > 420 || Math.abs(fz - F.barn.z) > 420) return;   // nobody near the farm: let them stand
    this.callT -= dt;
    let answered = false;
    for (const o of this.all) {
      const h = o.herd, d = Math.hypot(fx - o.x, fz - o.z);
      o.t += dt;
      // run from anything fast and close; hens run from people too
      let scare = h.kind === 'hen' && d < 5.5 ? [fx, fz] : null;
      for (const v of vlist) { if (Math.abs(v.pos.x - o.x) > 9 || Math.abs(v.pos.z - o.z) > 9 || Math.abs(v.pos.y - w.groundAt(o.x, o.z)) > 4) continue; if (Math.hypot(v.vx, v.vz) > 2 || Math.hypot(v.pos.x - o.x, v.pos.z - o.z) < v.radius + 1.4) scare = [v.pos.x, v.pos.z]; }
      if (scare) { const a = Math.atan2(o.x - scare[0], o.z - scare[1]) + (R() - 0.5) * 0.6; o.tx = o.x + Math.sin(a) * 9; o.tz = o.z + Math.cos(a) * 9; o.wait = 0; o.run = 1.6; }
      if (honk && pv && d < 45 && !answered && this.callT <= 0) { answered = true; this.callT = 1.4; if (h.kind === 'cow') { sound.moo(); this.mooed = true; } else if (h.kind === 'sheep') sound.baa(); else sound.cluck(); }
      o.run = Math.max(0, o.run - dt);
      const dx = o.tx - o.x, dz = o.tz - o.z, left = Math.hypot(dx, dz);
      let moving = 0;
      if (o.wait > 0 && !o.run) o.wait -= dt;
      else if (left < 0.3) {
        // arrived: graze for a bit, then pick a new spot inside the meadow
        o.wait = 2 + R() * (h.kind === 'hen' ? 3 : 8);
        const a = R() * 6.283, r = Math.sqrt(R()) * h.r; o.tx = h.cx + Math.cos(a) * r; o.tz = h.cz + Math.sin(a) * r;
      } else {
        const sp = h.speed * (o.run ? (h.kind === 'cow' ? 5 : 4.2) : 1), st = Math.min(left, sp * dt);
        o.x += (dx / left) * st; o.z += (dz / left) * st; moving = 1;
        o.h += angDiff(Math.atan2(dx, dz), o.h) * Math.min(1, dt * (o.run ? 8 : 2.5));
      }
      const gy = w.groundAt(o.x, o.z), graze = !moving && o.wait > 0.6 ? (h.kind === 'hen' ? Math.max(0, Math.sin(o.t * 7)) * 0.5 : 0.1 + Math.sin(o.t * 0.8) * 0.03) : 0;
      const bob = moving ? Math.abs(Math.sin(o.t * (h.kind === 'hen' ? 16 : 7))) * 0.05 * (o.run ? 2 : 1) : 0;
      _q.setFromAxisAngle(UP, o.h); _r.makeRotationFromQuaternion(_q); _l.makeRotationX(graze); _m.multiplyMatrices(_r, _l);
      _m.scale(_s.setScalar(o.size)); _m.setPosition(o.x, gy + bob, o.z);
      h.mesh.setMatrixAt(o.i, _m);
    }
    for (const h of this.herds) h.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- Scout
// The puppy who comes along once the lost puppies are home. He trots after Christian, rides in whatever
// Christian drives, and when a gold star is near he runs to it, sits beside it and barks.
export class Pet {
  constructor(scene, world) {
    this.world = world; this.mesh = buildPuppy(0xd9a25c); this.mesh.scale.setScalar(1.25); this.mesh.visible = false; scene.add(this.mesh);
    this.x = 0; this.z = 0; this.y = 0; this.h = 0; this.t = 0; this.barkT = 0; this.sniff = null; this.on = false; this.speed = 0; this.top = 0;
  }
  // The ground under his paws: the street, or the roof Christian is standing on.
  ground(x, z) { const w = this.world; return Math.max(w.groundAt(x, z) + w.curbAt(x, z), w.roofAt(x, z, this.top + 0.6)); }
  place(x, z, h = 0) { this.x = x; this.z = z; this.h = h; this.y = this.ground(x, z); this.sniff = null; }
  // stars: [{ x, z, y, found }]   Returns the star he is pointing at, if any.
  update(dt, player, riding, stars, sound) {
    const m = this.mesh;
    if (!this.on || riding) { m.visible = false; if (riding) { this.x = player.pos.x; this.z = player.pos.z; this.sniff = null; } return null; }
    if (dt <= 0) return this.sniff;
    const w = this.world, px = player.pos.x, pz = player.pos.z; this.top = player.pos.y;
    if (!m.visible) { m.visible = true; this.place(px - Math.sin(player.heading) * 1.4 + 0.8, pz - Math.cos(player.heading) * 1.4, player.heading); }
    this.t += dt;
    // pick up a scent: the nearest star not yet found that a puppy can walk to
    if (!this.sniff || this.sniff.found) {
      this.sniff = null; let bd = 75;
      for (const s of stars) { if (s.found || s.y - Math.max(w.groundAt(s.x, s.z), WATER_Y) > 3.2 || w.roofAt(s.x, s.z, s.y) > -1e8) continue; const d = Math.hypot(s.x - px, s.z - pz); if (d < bd) { bd = d; this.sniff = s; } }
    }
    const far = Math.hypot(px - this.x, pz - this.z);
    if (this.sniff && Math.hypot(this.sniff.x - px, this.sniff.z - pz) > 95) this.sniff = null;   // Christian wandered off
    if (far > 60) { this.place(px - Math.sin(player.heading) * 2, pz - Math.cos(player.heading) * 2, player.heading); }   // left behind: catch up
    let tx, tz, stop, top;
    if (this.sniff) { tx = this.sniff.x; tz = this.sniff.z; stop = 1.5; top = 6.2; }
    else { tx = px - Math.sin(player.heading) * 1.5 + Math.cos(player.heading) * 0.9; tz = pz - Math.cos(player.heading) * 1.5 - Math.sin(player.heading) * 0.9; stop = 0.5; top = far > 6 ? 8.5 : 5; }
    const dx = tx - this.x, dz = tz - this.z, left = Math.hypot(dx, dz);
    let moving = false;
    if (left > stop) {
      const sp = Math.min(top, 1.5 + left * 2.2), nx = this.x + (dx / left) * sp * dt, nz = this.z + (dz / left) * sp * dt;
      // keep his paws dry and out of walls
      const gy = this.ground(nx, nz);
      if (gy > WATER_Y + 0.25 && Math.abs(gy - this.y) < 2.5 && !w.solidAt(nx, nz, 0.25, gy + 0.3)) { this.x = nx; this.z = nz; moving = true; this.speed = sp; }
      this.h += angDiff(Math.atan2(dx, dz), this.h) * Math.min(1, dt * 10);
    } else if (this.sniff) {
      // sitting by the star: look back at Christian and bark
      this.h += angDiff(Math.atan2(px - this.x, pz - this.z), this.h) * Math.min(1, dt * 5);
      if ((this.barkT -= dt) <= 0) { this.barkT = 1.7; if (far < 60) sound.bark(); }
    } else this.h += angDiff(player.heading, this.h) * Math.min(1, dt * 3);
    this.y = damp(this.y, this.ground(this.x, this.z), 18, dt);
    const hop = moving ? Math.abs(Math.sin(this.t * 13)) * 0.16 : this.sniff && left <= stop ? Math.max(0, Math.sin(this.t * 7)) * 0.1 : 0;
    m.position.set(this.x, this.y + hop, this.z); m.rotation.y = this.h;
    m.userData.tail.rotation.z = Math.sin(this.t * (this.sniff ? 20 : 11)) * 0.7;
    m.userData.head.rotation.x = !moving && !this.sniff ? Math.sin(this.t * 1.3) * 0.12 : 0;
    return this.sniff && left <= stop + 1 ? this.sniff : null;
  }
}
