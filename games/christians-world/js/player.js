// People: the player, mission givers, passengers and puppies.
import * as THREE from './three.js';
import { clamp, damp, angDiff } from './util.js';
import { WATER_Y, Batch, MAT } from './world.js';

const mats = new Map();
export function lam(color) {
  let m = mats.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color }); mats.set(color, m); }
  return m;
}
// Each body part is a handful of coloured boxes merged into one mesh, so a whole person is six draw calls.
// A box is [w, h, d, colour, x, y, z].
function part(boxes) {
  const b = new Batch();
  for (const [w, h, d, color, x = 0, y = 0, z = 0] of boxes) b.box(x, y, z, w, h, d, color);
  const m = b.mesh(MAT.solid); m.receiveShadow = false;
  return m;
}
function limb(w, h, d, color, x, y, z, tip) {
  // A limb pivots at its top, so it can swing.
  const g = new THREE.Group(); g.position.set(x, y, z);
  const boxes = [[w, h, d, color, 0, -h / 2, 0]];
  if (tip) boxes.push([tip.w, tip.h, tip.d, tip.color, 0, -h - tip.h / 2 + 0.02, tip.z || 0]);
  g.add(part(boxes));
  return g;
}

// A blocky person about 1.9 units tall, facing +z.
export function buildPerson(o = {}) {
  const skin = o.skin ?? 0xf1c9a5, shirt = o.shirt ?? 0x2d6cdf, pants = o.pants ?? 0x39414c, hair = o.hair ?? 0x4a3323;
  const g = new THREE.Group();
  const legL = limb(0.27, 0.8, 0.3, pants, 0.16, 0.82, 0, { w: 0.29, h: 0.14, d: 0.42, color: o.shoes ?? 0xf3f1e6, z: 0.06 });
  const legR = limb(0.27, 0.8, 0.3, pants, -0.16, 0.82, 0, { w: 0.29, h: 0.14, d: 0.42, color: o.shoes ?? 0xf3f1e6, z: 0.06 });
  const armL = limb(0.2, 0.62, 0.24, shirt, 0.43, 1.46, 0, { w: 0.19, h: 0.14, d: 0.22, color: skin });
  const armR = limb(0.2, 0.62, 0.24, shirt, -0.43, 1.46, 0, { w: 0.19, h: 0.14, d: 0.22, color: skin });
  const body = new THREE.Group();
  const torso = [[0.64, 0.68, 0.38, shirt, 0, 1.14, 0]];
  if (o.stripe) torso.push([0.66, 0.14, 0.4, o.stripe, 0, 1.2, 0]);
  body.add(part(torso));
  const head = new THREE.Group(); head.position.set(0, 1.5, 0);
  const hb = [[0.46, 0.46, 0.46, skin, 0, 0.23, 0], [0.07, 0.08, 0.03, 0x1c1c1f, 0.11, 0.27, 0.235], [0.07, 0.08, 0.03, 0x1c1c1f, -0.11, 0.27, 0.235], [0.16, 0.04, 0.03, 0x9c4a3c, 0, 0.12, 0.235]];
  if (o.hat) {
    hb.push([0.5, 0.16, 0.5, o.hat, 0, 0.52, 0]);
    if (o.hatStyle === 'chef') hb.push([0.42, 0.34, 0.42, o.hat, 0, 0.74, 0]);
    else if (o.hatStyle === 'wide') hb.push([0.86, 0.05, 0.86, o.hat, 0, 0.46, 0]);
    else hb.push([0.44, 0.05, 0.3, o.hat, 0, 0.46, 0.34]);
  } else {
    hb.push([0.5, 0.14, 0.5, hair, 0, 0.5, 0], [0.5, 0.3, 0.12, hair, 0, 0.36, -0.2]);
    if (o.longHair) hb.push([0.52, 0.5, 0.14, hair, 0, 0.1, -0.22]);
  }
  head.add(part(hb));
  body.add(head);
  g.add(legL, legR, armL, armR, body);
  g.userData = { legL, legR, armL, armR, body, head };
  const s = o.scale ?? 1; g.scale.setScalar(s);
  return g;
}

export function animatePerson(mesh, phase, amount, wave = 0) {
  const u = mesh.userData, sw = Math.sin(phase) * amount;
  u.legL.rotation.x = sw * 0.85; u.legR.rotation.x = -sw * 0.85;
  u.armL.rotation.x = -sw * 0.7; u.armR.rotation.x = sw * 0.7;
  u.armR.rotation.z = 0; u.armL.rotation.z = 0;
  if (wave > 0) { u.armL.rotation.x = 0; u.armL.rotation.z = 2.5 + Math.sin(phase * 3 + 1) * 0.35 * wave; }
  u.body.position.y = Math.abs(Math.sin(phase)) * 0.05 * amount;
}

export function buildPuppy(color = 0xc98b4f) {
  const g = new THREE.Group();
  const boxes = [[0.34, 0.3, 0.62, color, 0, 0.42, 0]];
  for (const [x, z] of [[0.11, 0.2], [-0.11, 0.2], [0.11, -0.2], [-0.11, -0.2]]) boxes.push([0.1, 0.28, 0.1, color, x, 0.14, z]);
  g.add(part(boxes));
  const head = new THREE.Group(); head.position.set(0, 0.6, 0.36);
  head.add(part([[0.3, 0.28, 0.3, color], [0.16, 0.12, 0.14, 0xfff3dc, 0, -0.05, 0.2], [0.06, 0.05, 0.04, 0x1c1c1f, 0, -0.01, 0.28],
    [0.05, 0.05, 0.03, 0x1c1c1f, 0.08, 0.06, 0.155], [0.05, 0.05, 0.03, 0x1c1c1f, -0.08, 0.06, 0.155], [0.09, 0.2, 0.12, 0x6b4428, 0.17, 0.02, -0.02], [0.09, 0.2, 0.12, 0x6b4428, -0.17, 0.02, -0.02]]));
  const tail = limb(0.07, 0.26, 0.07, color, 0, 0.56, -0.3); tail.rotation.x = -2.2;
  g.add(head, tail);
  g.userData = { head, tail };
  return g;
}

// Someone who stands around: mission givers, customers, passengers.
export class NPC {
  constructor(scene, world, o) {
    this.name = o.name || '';
    this.mesh = buildPerson(o.look || {});
    this.x = o.x; this.z = o.z; this.heading = o.h ?? 0;
    this.wave = !!o.wave; this.t = Math.random() * 6;
    this.world = world; this.scene = scene;
    this.visible = true;
    scene.add(this.mesh);
    this.place(o.x, o.z);
  }
  place(x, z) { this.x = x; this.z = z; this.mesh.position.set(x, this.world.groundAt(x, z) + this.world.curbAt(x, z), z); }
  show(v) { this.visible = v; this.mesh.visible = v; }
  // (px, pz): who to look at.  (cx, cz): the camera; anyone a long way from it is not drawn or animated.
  update(dt, px, pz, cx = px, cz = pz) {
    if (!this.visible) return;
    const far = Math.abs(this.x - cx) > 340 || Math.abs(this.z - cz) > 340;
    if (this.mesh.visible === far) this.mesh.visible = !far;
    if (far) return;
    this.t += dt;
    const d = Math.hypot(px - this.x, pz - this.z);
    if (d < 30) {
      const want = Math.atan2(px - this.x, pz - this.z);
      this.heading += angDiff(want, this.heading) * Math.min(1, dt * 5);
    }
    this.mesh.rotation.y = this.heading;
    const waving = this.wave && d < 45 ? 1 : 0;
    animatePerson(this.mesh, this.t * 2, 0.06, waving);
    this.mesh.userData.body.position.y = Math.sin(this.t * 2) * 0.015;
  }
  dispose() { this.scene.remove(this.mesh); }
}

const PLAIN = { run: 1, jump: 1, jet: false };

export class Player {
  constructor(scene) {
    this.mesh = buildPerson({ shirt: 0xd9342b, pants: 0x2b4f8f, hat: 0x2d6cdf, hair: 0x4a3323, shoes: 0xffffff, stripe: 0xffd21f });
    scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.heading = 0; this.onGround = true; this.vehicle = null;
    this.phase = 0; this.curb = 0; this.speed = 0;
    this.radius = 0.45; this.jetting = false; this.armPose = null;
    this._c = { x: 0, z: 0, nx: 0, nz: 0 };
  }
  // y is only needed to land on a roof; otherwise the player is put on the ground.
  teleport(x, z, world, heading, y) {
    this.pos.set(x, y === undefined ? world.groundAt(x, z) : Math.max(world.groundAt(x, z), world.roofAt(x, z, y + 0.3)), z); this.vx = this.vz = this.vy = 0;
    if (heading !== undefined) this.heading = heading;
    this.curb = world.curbAt(x, z); this.sync();
  }
  // mx: right is positive, my: forward is positive, both relative to the camera.
  // mod: what the worn tools change ({ run, jump, jet }).
  update(dt, inp, camYaw, world, vehicles, mod = PLAIN) {
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), lx = Math.cos(camYaw), lz = -Math.sin(camYaw);
    let dx = fx * inp.my - lx * inp.mx, dz = fz * inp.my - lz * inp.mx;
    const mag = Math.hypot(dx, dz);
    const top = inp.run ? 9.5 * mod.run : 5.2;
    let tx = 0, tz = 0;
    if (mag > 0.05) { const k = Math.min(1, mag) / mag; tx = dx * k * top; tz = dz * k * top; }
    const resp = this.onGround ? 12 : 3;
    this.vx = damp(this.vx, tx, resp, dt); this.vz = damp(this.vz, tz, resp, dt);
    this.speed = Math.hypot(this.vx, this.vz);
    if (mag > 0.05) this.heading += angDiff(Math.atan2(dx, dz), this.heading) * Math.min(1, dt * 12);
    if (inp.jump && this.onGround) { this.vy = 8.6 * mod.jump; this.onGround = false; this.jumped = true; }
    // jetpack: keep Jump held once you are off the ground
    this.jetting = !this.onGround && mod.jet && !!inp.jumpHeld;
    if (this.jetting && this.vy < 7.5) this.vy = Math.min(7.5, this.vy + 62 * dt);

    // Horizontal move, one axis at a time so the player slides along walls and ledges.
    const tryMove = (nx, nz) => {
      const c = this._c; c.x = nx; c.z = nz;
      world.collide(c, this.radius, this.pos.y);
      for (const v of vehicles) {
        if (Math.abs(v.pos.x - c.x) > 9 || Math.abs(v.pos.z - c.z) > 9 || Math.abs(v.pos.y - this.pos.y) > 3) continue;
        v.pushOut(c, this.radius);
      }
      const ph = world.platAt(c.x, c.z);
      if (ph - this.pos.y > 0.75 && ph > world.heightAt(c.x, c.z) + 0.7) return false;
      this.pos.x = c.x; this.pos.z = c.z; return true;
    };
    const nx = this.pos.x + this.vx * dt, nz = this.pos.z + this.vz * dt;
    if (!tryMove(nx, nz)) { if (!tryMove(nx, this.pos.z)) tryMove(this.pos.x, nz); }

    const g = Math.max(world.groundAt(this.pos.x, this.pos.z), world.roofAt(this.pos.x, this.pos.z, this.pos.y));
    this.vy -= 24 * dt; this.pos.y += this.vy * dt;
    if (this.pos.y <= g || (this.onGround && this.vy <= 0 && this.pos.y - g < 0.4)) { this.pos.y = g; this.vy = 0; this.onGround = true; }
    else this.onGround = false;

    this.curb = damp(this.curb, world.curbAt(this.pos.x, this.pos.z), 14, dt);
    this.phase += this.speed * dt * 1.9;
    animatePerson(this.mesh, this.phase, this.onGround ? clamp(this.speed / 5, 0, 1.25) : 0.5);
    const u = this.mesh.userData;
    if (!this.onGround) { u.armL.rotation.z = this.jetting ? 0.35 : 0.9; u.armR.rotation.z = this.jetting ? -0.35 : -0.9; }
    // something in his hand: the right arm carries it, or points it
    if (this.armPose !== null && this.armPose !== undefined) { u.armR.rotation.x = this.armPose; u.armR.rotation.z = 0; }
    this.sync();
    return this.pos.y < WATER_Y - 0.75;
  }
  sync() {
    this.mesh.position.set(this.pos.x, this.pos.y + this.curb, this.pos.z);
    this.mesh.rotation.y = this.heading;
  }
}
