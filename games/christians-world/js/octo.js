// Octoclank: an eight-legged machine that walks up out of the sea.
// The robot itself lives in bots.js like every other robot; this file is only what it looks like.
// Each leg is a bending cable that plants its foot on the ground and steps when the body has moved on.
import * as THREE from './three.js';
import { Batch, GEO, WATER_Y } from './world.js';

const LEGS = 8, SEG = 6;
const SHELL = 0x1f5f6b, SHELL2 = 0x174a55, DARK = 0x39414c, BLACK = 0x1b2430, IRON = 0x6b7785, RUST = 0xb5651d, WARN = 0xffd21f, BRASS = 0xc9a24a;
const UP = new THREE.Vector3(0, 1, 0);

export class OctoRig {
  constructor(scene, world) {
    this.world = world; this.on = false; this.by = 0; this.onStep = null;   // onStep(leg): a foot has just come down
    const g = this.group = new THREE.Group(); g.visible = false; scene.add(g);
    // ---- the body: a riveted diving-bell head with a long mantle behind it (origin: middle of the head, facing +z)
    const b = new Batch();
    b.add(GEO.sph, 0, 0.25, 0.1, 1.75, 1.5, 1.8, SHELL);                       // head
    b.add(GEO.sph, 0, 0.85, -1.5, 1.5, 1.65, 2.1, SHELL2);                     // mantle
    b.add(GEO.sph, 0, 1.1, -3.0, 0.9, 1.0, 1.1, SHELL);                        // mantle tip
    b.add(GEO.cyl, 0, -0.85, 0, 1.85, 0.4, 1.85, DARK);                        // collar the legs hang from
    b.add(GEO.cyl, 0, -0.62, 0, 1.88, 0.1, 1.88, WARN);
    b.add(GEO.cyl, 0, -1.2, 0, 1.35, 0.45, 1.35, BLACK);
    b.add(GEO.cone, 0, -1.65, 0, 0.6, 0.5, 0.6, RUST, 0, Math.PI);             // drill beak underneath
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; b.add(GEO.sph, Math.sin(a) * 1.9, -0.85, Math.cos(a) * 1.9, 0.09, 0.09, 0.09, BRASS); }
    for (const s of [-1, 1]) {
      b.add(GEO.sph, s * 0.78, 0.35, 1.5, 0.52, 0.52, 0.34, BLACK);            // eye sockets
      b.add(GEO.cyl, s * 0.78, 0.35, 1.62, 0.56, 0.12, 0.56, BRASS, 0, Math.PI / 2);   // porthole rims
      b.box(s * 0.78, 0.98, 1.5, 0.95, 0.16, 0.5, IRON, s * -0.25);            // heavy brows
      b.add(GEO.cyl, s * 1.25, 1.75, -0.9, 0.2, 1.3, 0.2, IRON);               // exhaust stacks
      b.add(GEO.cyl, s * 1.25, 2.42, -0.9, 0.26, 0.12, 0.26, BLACK);
      b.add(GEO.cyl, s * 1.55, 0.2, -1.6, 0.16, 1.5, 0.16, BRASS, 0, Math.PI / 2);     // side pipes
      b.add(GEO.sph, s * 1.72, 0.1, -0.2, 0.3, 0.3, 0.3, RUST);                // pressure tanks
    }
    b.box(0, -0.3, 1.72, 1.0, 0.34, 0.2, BLACK);                               // grille mouth
    for (let i = -2; i <= 2; i++) b.box(i * 0.2, -0.3, 1.82, 0.07, 0.3, 0.06, WARN);
    for (let i = 0; i < 5; i++) b.box(0, 2.05 + Math.sin(i * 0.7) * 0.25 - i * 0.05, -0.2 - i * 0.62, 0.22, 0.5 - i * 0.05, 0.42, RUST);   // back fins
    b.box(0, 1.75, 0.4, 0.07, 1.0, 0.07, DARK); b.add(GEO.sph, 0, 2.3, 0.4, 0.14, 0.14, 0.14, WARN);                                       // aerial
    b.add(GEO.cyl, 0.7, 1.45, 0.75, 0.24, 0.08, 0.24, BRASS, 0, 0.9); b.box(0.7, 1.5, 0.78, 0.03, 0.03, 0.2, BLACK, 0.6);                   // pressure gauge
    b.box(-0.9, 1.25, 0.2, 0.5, 0.06, 0.6, IRON, 0.3); b.box(0.2, 1.62, -0.6, 0.6, 0.06, 0.5, IRON, -0.2);                                  // patch plates
    this.bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.body = new THREE.Mesh(b.geometry(), this.bodyMat); this.body.castShadow = true; g.add(this.body);
    // ---- the eyes: two lamps that change colour with its mood
    const e = new Batch(); for (const s of [-1, 1]) { e.add(GEO.sph, s * 0.78, 0.35, 1.62, 0.36, 0.36, 0.2, 0xffffff); e.add(GEO.sph, s * 0.78, 0.35, 1.78, 0.14, 0.2, 0.08, 0x202020); }
    this.eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffb300 });
    g.add(new THREE.Mesh(e.geometry(), this.eyeMat));
    // ---- the legs: every piece of all eight is one instance (these are in world space, not inside the group)
    const lm = new THREE.MeshLambertMaterial();
    this.seg = new THREE.InstancedMesh(GEO.cyl, lm, LEGS * SEG); this.joint = new THREE.InstancedMesh(GEO.sph, lm, LEGS * (SEG + 1));
    const c = new THREE.Color();
    for (let i = 0; i < LEGS; i++) {
      for (let k = 0; k < SEG; k++) this.seg.setColorAt(i * SEG + k, c.set(k % 2 ? SHELL2 : SHELL));
      for (let k = 0; k <= SEG; k++) this.joint.setColorAt(i * (SEG + 1) + k, c.set(k === SEG ? WARN : k === 0 ? DARK : BRASS));
    }
    for (const m of [this.seg, this.joint]) { m.frustumCulled = false; m.castShadow = true; m.visible = false; scene.add(m); }
    this.feet = []; for (let i = 0; i < LEGS; i++) this.feet.push({ x: 0, y: 0, z: 0, sx: 0, sz: 0, tx: 0, tz: 0, t: 1 });
    this.P = []; for (let k = 0; k <= SEG; k++) this.P.push(new THREE.Vector3());
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.d = new THREE.Vector3();
  }
  ground(x, z) { const w = this.world; return Math.max(w.groundAt(x, z) + w.curbAt(x, z), WATER_Y); }
  hide() { if (!this.on) return; this.on = false; this.group.visible = this.seg.visible = this.joint.visible = false; }
  // b: the robot (bots.js).  time: the game clock.
  update(b, dt, time) {
    const g = this.group, down = b.phase === 'down', rise = b.phase === 'rise', stunned = b.stun > 0;
    const reach = down ? 4.7 : 3.5, speed = Math.hypot(b.vx, b.vz);
    if (!this.on) {
      this.on = true; g.visible = this.seg.visible = this.joint.visible = true; this.by = b.y + 3;
      this.feet.forEach((f, i) => { const a = b.h + ((i + 0.5) / LEGS) * 6.283; f.x = b.x + Math.sin(a) * reach; f.z = b.z + Math.cos(a) * reach; f.t = 1; });
    }
    // the body rides above the feet: low when it has overheated, reared up before a slam
    const want = b.y + (down ? 1.5 : 3.1) + (rise ? b.lift * 1.2 : 0) + Math.sin(time * 2.3) * 0.14 + Math.min(1, speed) * Math.abs(Math.sin(time * 7)) * 0.12;
    this.by += (want - this.by) * Math.min(1, dt * 7);
    g.position.set(b.x, this.by, b.z);
    g.rotation.set(down ? 0.28 : rise ? -0.3 : Math.min(0.12, speed * 0.03), b.h, stunned ? Math.sin(time * 26) * 0.08 : Math.sin(time * 1.7) * 0.03, 'YXZ');
    this.bodyMat.color.setScalar(b.flash > 0 ? 2.2 : 1);
    const hurt = b.hp / b.k.hp < 0.34;
    this.eyeMat.color.setHex(down ? (Math.sin(time * 22) > 0 ? 0x402a00 : 0xffb300) : b.whip > 0 ? 0xff2a2a : stunned ? 0x8fd8ff : hurt ? 0xff5a1f : 0xffb300);
    // feet: stay planted until the body has walked away from them, then step, never two neighbours at once
    const feet = this.feet, m = this.m, P = this.P;
    for (let i = 0; i < LEGS; i++) {
      const f = feet[i], a = b.h + ((i + 0.5) / LEGS) * 6.283, ix = b.x + Math.sin(a) * reach + b.vx * 0.3, iz = b.z + Math.cos(a) * reach + b.vz * 0.3;
      let lift = 0;
      if (f.t >= 1) {
        const off = Math.hypot(f.x - ix, f.z - iz), busy = feet[(i + 1) % LEGS].t < 1 || feet[(i + LEGS - 1) % LEGS].t < 1;
        if (!stunned && (off > 3.4 || (off > 1.25 && !busy))) { f.sx = f.x; f.sz = f.z; f.tx = ix + b.vx * 0.35; f.tz = iz + b.vz * 0.35; f.t = 0; }
      } else {
        f.t = Math.min(1, f.t + dt / 0.2); const e = f.t * f.t * (3 - 2 * f.t);
        f.x = f.sx + (f.tx - f.sx) * e; f.z = f.sz + (f.tz - f.sz) * e; lift = Math.sin(f.t * Math.PI) * 1.2;
        if (f.t >= 1 && this.onStep) this.onStep(i);
      }
      f.y = this.ground(f.x, f.z) + lift;
      let fx = f.x, fy = f.y, fz = f.z;
      // the cable whip: one front leg rears up and back before it lashes out
      if (b.whip > 0 && i === 0) { const k = Math.min(1, (0.9 - b.whip) * 3); fx = b.x + Math.sin(b.h) * (2 - k * 3); fz = b.z + Math.cos(b.h) * (2 - k * 3); fy = this.by + 2 + k * 2.5 + Math.sin(time * 30) * 0.15; }
      if (rise && i % 2 === 0) fy += b.lift * 1.6;
      // a bent cable from the collar to the foot
      const hx = b.x + Math.sin(a) * 1.7, hy = this.by - 0.9, hz = b.z + Math.cos(a) * 1.7;
      const cx = (hx + fx) / 2 + Math.sin(a) * 0.9, cy = Math.max(hy, fy) + 2.1 + Math.sin(time * 3 + i * 1.9) * 0.18 + (down ? -1.4 : 0), cz = (hz + fz) / 2 + Math.cos(a) * 0.9;
      for (let k = 0; k <= SEG; k++) { const t = k / SEG, u = 1 - t; P[k].set(u * u * hx + 2 * u * t * cx + t * t * fx, u * u * hy + 2 * u * t * cy + t * t * fy, u * u * hz + 2 * u * t * cz + t * t * fz); }
      for (let k = 0; k < SEG; k++) {
        const r = 0.36 - k * 0.04, len = this.d.subVectors(P[k + 1], P[k]).length();
        this.q.setFromUnitVectors(UP, this.d.divideScalar(len || 1));
        m.compose(this.v.addVectors(P[k], P[k + 1]).multiplyScalar(0.5), this.q, this.s.set(r, len, r)); this.seg.setMatrixAt(i * SEG + k, m);
      }
      this.q.identity();
      for (let k = 0; k <= SEG; k++) {
        const r = k === SEG ? 0.34 : (0.36 - k * 0.04) * 1.2;
        m.compose(P[k], this.q, k === SEG ? this.s.set(r, 0.16, r) : this.s.set(r, r, r)); this.joint.setMatrixAt(i * (SEG + 1) + k, m);
      }
    }
    this.seg.instanceMatrix.needsUpdate = true; this.joint.instanceMatrix.needsUpdate = true;
  }
}
