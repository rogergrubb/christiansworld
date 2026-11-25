// The toolbox: every tool and blaster Christian can earn, keep and use.
// Worn tools work by themselves once he has them. Everything else is held, one thing at a time.
// Blasters are toys: they stop runaway robots and nothing else. People and animals only get a fright.
import * as THREE from './three.js';
import { Batch, GEO, WATER_Y } from './world.js';
import { clamp, angDiff } from './util.js';

const hex = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const PAINTS = [0xff5fa2, 0x2d6cdf, 0xffd21f, 0x1f8a70, 0xff7a1a, 0x8e44ad, 0x1fb7c9, 0xe23b2e, 0x7cc75c];

// from: the mission that awards it.  use: one line for the toolbox; [F], [hold F], [V], [Shift] and [Space] become
// the right words for a keyboard, a touch screen or a controller.
// Blasters: rate (shots a second), speed, grav (how fast the shot drops), spread, dmg, splash (metres), reach.
export const GEAR = [
  { id: 'whistle', icon: '📯', name: 'Car Whistle', kind: 'tool', worn: true, from: 'welcome', use: 'Your last car comes to you when you [V].' },
  { id: 'skates', icon: '👟', name: 'Rocket Skates', kind: 'tool', worn: true, from: 'pizza', use: 'You run nearly twice as fast when you [Shift].' },
  { id: 'nitro', icon: '🔥', name: 'Nitro Tank', kind: 'tool', worn: true, from: 'taxi', use: 'In any car, [F] for a burst of speed.' },
  { id: 'horn', icon: '📢', name: 'Air Horn', kind: 'tool', from: 'bus', use: 'HONK! Robots nearby freeze on the spot.', cool: 2.5, shape: 'horn' },
  { id: 'magnet', icon: '🧲', name: 'Super Magnet', kind: 'tool', worn: true, from: 'farm', use: 'Gold stars and coins fly to you from far away.' },
  { id: 'boots', icon: '👢', name: 'Spring Boots', kind: 'tool', worn: true, from: 'stunts', use: 'You jump more than twice as high.' },
  { id: 'jetpack', icon: '🚀', name: 'Jetpack', kind: 'tool', worn: true, from: 'rings', use: 'Jump, then [Space] to fly. It fills up again on the ground.' },
  { id: 'light', icon: '🔦', name: 'Flashlight', kind: 'tool', worn: true, from: 'lanterns', use: 'Lights your way at night.' },
  { id: 'rod', icon: '🎣', name: 'Fishing Rod', kind: 'tool', from: 'slalom', use: 'Face deep water, then [F] to cast. Do it again when you get a bite.', shape: 'rod' },
  { id: 'detector', icon: '📡', name: 'Treasure Detector', kind: 'tool', from: 'bottles', use: 'It beeps faster near buried treasure. To dig, [F].', shape: 'detector' },
  { id: 'water', icon: '🔫', name: 'Water Blaster', kind: 'blaster', from: 'bots', use: 'Soaks robots and puts out fires. To spray, [hold F].', rate: 14, speed: 27, grav: 11, spread: 0.04, dmg: 0.34, reach: 22, size: 0.17, color: 0x4fc3f7, fx: 'wet' },
  { id: 'darts', icon: '🎯', name: 'Foam Dart Blaster', kind: 'blaster', from: 'bandit', use: 'Straight and quick. Two darts stop a small robot.', rate: 3.2, speed: 50, grav: 2.5, spread: 0.008, dmg: 1, reach: 45, size: 0.15, color: 0xff7a1a, fx: 'hit', long: 3 },
  { id: 'snow', icon: '⛄', name: 'Snowball Launcher', kind: 'blaster', from: 'mountain', use: 'Lobs snowballs that splat everything close by.', rate: 2.2, speed: 25, grav: 13, spread: 0.02, dmg: 1, splash: 2.4, reach: 34, size: 0.3, color: 0xffffff, fx: 'hit' },
  { id: 'net', icon: '🕸️', name: 'Net Launcher', kind: 'blaster', from: 'kittens', use: 'Tangles robots up so they cannot move.', rate: 0.9, speed: 27, grav: 9, spread: 0, dmg: 0, splash: 2.8, reach: 30, size: 0.45, color: 0xc9a26b, fx: 'net' },
  { id: 'freeze', icon: '❄️', name: 'Freeze Ray', kind: 'blaster', from: 'icecream', use: 'Turns robots into ice blocks. One more hit and they shatter.', rate: 9, speed: 36, grav: 0, spread: 0.02, dmg: 0.2, reach: 28, size: 0.2, color: 0xaee9ff, fx: 'freeze' },
  { id: 'paint', icon: '🎨', name: 'Paint Blaster', kind: 'blaster', from: 'race', use: 'Splat! Gives any car a new colour, and robots cannot see where they are going.', rate: 4, speed: 31, grav: 7, spread: 0.03, dmg: 0.5, reach: 34, size: 0.22, color: 0xff5fa2, fx: 'paint' },
  { id: 'popcorn', icon: '🍿', name: 'Popcorn Cannon', kind: 'blaster', from: 'hay', use: 'One big POP that scatters a whole crowd of robots.', rate: 0.8, speed: 21, grav: 15, spread: 0, dmg: 3, splash: 5.5, reach: 30, size: 0.42, color: 0xffe9a8, fx: 'hit' },
  { id: 'bubble', icon: '🔮', name: 'Bubble Blaster', kind: 'blaster', from: 'fires', use: 'Robots float away in a bubble, then drop.', rate: 4, speed: 12, grav: -1.2, spread: 0.09, dmg: 0, reach: 18, size: 0.46, color: 0xcfefff, fx: 'bubble', life: 3 },
  { id: 'boomerang', icon: '🌙', name: 'Boomerang', kind: 'blaster', from: 'treasure', use: 'Flies out, bonks every robot on the way and comes back.', rate: 1.2, speed: 23, grav: 0, spread: 0, dmg: 2, reach: 20, size: 0.5, color: 0x8a5a2b, fx: 'hit', back: true, shape: 'boomerang' },
  { id: 'fireworks', icon: '🎆', name: 'Fireworks Launcher', kind: 'blaster', from: 'jets', use: 'A rocket that bursts in colours. Huge.', rate: 0.7, speed: 31, grav: 3, spread: 0, dmg: 4, splash: 7.5, reach: 60, size: 0.3, color: 0xff3d6e, fx: 'boom', long: 3 },
  { id: 'zap', icon: '⚡', name: 'Zap Pulse', kind: 'blaster', from: 'drones', use: 'A ring of sparks. Every robot around you drops.', cool: 4.5, radius: 10, dmg: 2, color: 0xffd21f, fx: 'stun' },
  { id: 'laser', icon: '☄️', name: 'Laser Blaster', kind: 'blaster', from: 'lighthouse', use: 'Pew pew pew. Fast, far and dead straight.', rate: 6, speed: 85, grav: 0, spread: 0.004, dmg: 1.5, reach: 70, size: 0.13, color: 0xff2a2a, fx: 'hit', long: 6 },
  { id: 'hammer', icon: '🔨', name: 'Thunder Hammer', kind: 'blaster', from: 'mega', use: 'BOOM. Sends every robot near you flying.', cool: 0.75, radius: 4.6, dmg: 3, color: 0x8e44ad, fx: 'knock', shape: 'hammer' },
];
export const gearById = (id) => GEAR.find((g) => g.id === id);
export const gearFrom = (missionId) => GEAR.find((g) => g.from === missionId);
const WORDS = {
  key: { '[F]': 'press F', '[hold F]': 'hold F', '[V]': 'press V', '[Shift]': 'hold Shift', '[Space]': 'hold Space' },
  touch: { '[F]': 'tap the tool button', '[hold F]': 'hold the tool button', '[V]': 'open the Menu and tap Bring my car', '[Shift]': 'push the stick all the way', '[Space]': 'hold Jump' },
  pad: { '[F]': 'press RB', '[hold F]': 'hold RB', '[V]': 'press down on the d-pad', '[Shift]': 'push the stick all the way', '[Space]': 'hold A' },
};
// The toolbox line for an item, in the words of whatever the player is holding.
export const useText = (it, how = 'key') => it.use.replace(/\[[^\]]+\]/g, (m) => WORDS[how][m] || m);

// Buried treasure: found with the detector, dug up with the same button.
export const TREASURE = [[-225, 236], [-180, 652], [205, 655], [612, 180], [560, -92], [690, 694], [-600, 90], [-470, -360], [-330, -600], [-170, -972], [140, -620], [420, -330], [300, 330], [-640, -220], [632, 414], [40, -40]];
const FISH = [['Sunny Perch', 15, 0.3], ['Bluegill', 20, 0.24], ['Striped Bass', 35, 0.18], ['Rainbow Trout', 45, 0.12], ['an Old Boot', 5, 0.08], ['Golden Carp', 120, 0.05], ['a Treasure Bottle', 80, 0.03]];

// What Christian holds. Each shape hangs from the hand along the arm, so it points wherever the arm points.
// pose: the arm's angle while carrying it and while using it.
const SHAPES = {
  gun: { pose: [0, -1.45], build(b) { b.box(0, -0.92, 0.03, 0.15, 0.46, 0.2, 0xffffff); b.box(0, -1.2, 0.03, 0.09, 0.14, 0.1, 0x555e68); b.box(0, -0.76, -0.1, 0.1, 0.12, 0.16, 0x8d8d8d); b.add(GEO.sph, 0, -0.9, 0.17, 0.09, 0.14, 0.09, 0xffffff); } },
  horn: { pose: [0, -1.6], build(b) { b.add(GEO.cone, 0, -1.02, 0, 0.22, 0.5, 0.22, 0xe23b2e); b.add(GEO.cyl, 0, -0.74, 0, 0.08, 0.2, 0.08, 0xfdf8ee); } },
  rod: { pose: [-2.0, -2.3], build(b) { b.box(0, -1.5, 0, 0.05, 1.6, 0.05, 0x8a5a2b); b.box(0, -0.84, 0.07, 0.1, 0.1, 0.12, 0x39414c); } },
  detector: { pose: [-0.95, -0.6], build(b) { b.box(0, -1.25, 0, 0.05, 1.1, 0.05, 0x39414c); b.add(GEO.cyl, 0, -1.82, 0.04, 0.3, 0.05, 0.3, 0xffd21f, 0, 0.95); b.box(0, -0.8, 0.06, 0.12, 0.12, 0.08, 0x1fb7c9); } },
  hammer: { pose: [-2.6, -0.7], build(b) { b.box(0, -1.15, 0, 0.07, 0.9, 0.07, 0x8a5a2b); b.box(0, -1.62, 0, 0.3, 0.3, 0.62, 0x8e44ad); b.box(0, -1.62, 0, 0.32, 0.1, 0.64, 0xffd21f); } },
  boomerang: { pose: [0, -1.45], build(b) { b.box(0, -0.9, 0, 0.07, 0.36, 0.1, 0x8a5a2b); b.box(0.13, -1.08, 0, 0.32, 0.07, 0.1, 0x8a5a2b); } },
};

// ---------------------------------------------------------------- shots
// Everything a blaster fires, drawn as one instanced mesh.
export class Shots {
  constructor(scene, max = 160) {
    this.max = max; this.live = 0; this.fired = 0;
    this.s = []; for (let i = 0; i < max; i++) this.s.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, item: null, col: 0, hit: null, back: 0, ox: 0, oy: 0, oz: 0 });
    this.mesh = new THREE.InstancedMesh(GEO.sph, new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    this.mesh.setColorAt(0, new THREE.Color(0xffffff)); this.mesh.frustumCulled = false; this.mesh.count = 0; scene.add(this.mesh);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.sc = new THREE.Vector3(); this.c = new THREE.Color(); this.fwd = new THREE.Vector3(0, 0, 1); this.d = new THREE.Vector3();
  }
  fire(item, x, y, z, dx, dy, dz, col) {
    const s = this.s.find((q) => !q.on); if (!s) return null;
    s.on = true; s.x = x; s.y = y; s.z = z; s.vx = dx * item.speed; s.vy = dy * item.speed; s.vz = dz * item.speed; s.t = 0; s.item = item; s.col = col ?? item.color; s.hit = item.back ? new Set() : null; s.back = 0; s.ox = x; s.oy = y; s.oz = z;
    this.fired++; return s;
  }
  // world(s) says whether a shot has run into the ground, a wall, a car or somebody.
  // impact(s, bot) is called for every hit; for a robot it returns true when the shot is used up.
  update(dt, bots, px, py, pz, world, impact) {
    let n = 0; const m = this.m;
    for (const s of this.s) {
      if (!s.on) continue;
      const it = s.item; s.t += dt;
      if (it.back) {
        // boomerang: out to its reach, then home to the thrower
        if (!s.back && (Math.hypot(s.x - s.ox, s.z - s.oz) > it.reach || s.t > 1.6)) s.back = 1;
        if (s.back) { const dx = px - s.x, dy = py + 1.2 - s.y, dz = pz - s.z, l = Math.hypot(dx, dy, dz) || 1; if (l < 1.3 || s.t > 6) { s.on = false; continue; } s.vx = (dx / l) * it.speed; s.vy = (dy / l) * it.speed; s.vz = (dz / l) * it.speed; }
      } else s.vy -= it.grav * dt;
      if (it.fx === 'bubble') { const k = Math.max(0, 1 - 1.1 * dt); s.vx *= k; s.vz *= k; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      let done = !it.back && (s.t > (it.life || 2.6) || Math.hypot(s.x - s.ox, s.z - s.oz) > it.reach * 1.25);
      for (const b of bots) {
        if (b.dead || (s.hit && s.hit.has(b))) continue;
        const dx = b.x - s.x, dy = b.y + b.k.h * 0.5 - s.y, dz = b.z - s.z, r = b.k.r + it.size + 0.25;
        if (dx * dx + dz * dz > r * r || Math.abs(dy) > b.k.h * 0.6 + it.size + 0.35) continue;
        if (s.hit) { s.hit.add(b); impact(s, b); } else if (impact(s, b)) { done = true; break; }
      }
      if (!done && world(s)) { if (it.back) s.back = 1; else { impact(s, null); done = true; } }
      if (done) { s.on = false; continue; }
      // a ball, a streak along the way it is going, or a spinning blade
      this.p.set(s.x, s.y, s.z); const k = it.size;
      if (it.long) { this.d.set(s.vx, s.vy, s.vz).normalize(); this.q.setFromUnitVectors(this.fwd, this.d); this.sc.set(k, k, k * it.long); }
      else if (it.back) { this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.t * 18); this.sc.set(k, k * 0.22, k * 0.4); }
      else { this.q.identity(); this.sc.set(k, k, k); }
      m.compose(this.p, this.q, this.sc); this.mesh.setMatrixAt(n, m); this.mesh.setColorAt(n, this.c.set(s.col)); n++;
    }
    this.live = n; this.mesh.count = n;
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
  }
  clear() { for (const s of this.s) s.on = false; this.mesh.count = 0; this.live = 0; }
}

// ---------------------------------------------------------------- toolbox
export class Toolbox {
  constructor(game) {
    this.g = game; this.shots = new Shots(game.scene);
    this.cool = 0; this.lent = null; this.fuel = 1; this.nitroT = 0; this.aimT = 0; this.beepT = 0; this.near = null; this.fish = null; this.chests = [];
    this._c = { x: 0, z: 0, nx: 0, nz: 0 }; this._d = { x: 0, y: 0, z: 0 }; this.mod = { run: 1, jump: 1, jet: false };
    // what is in Christian's hand: one shape at a time
    const arm = game.player.mesh.userData.armR; this.shapes = {};
    for (const [name, sh] of Object.entries(SHAPES)) { const b = new Batch(); sh.build(b); const m = new THREE.Mesh(b.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true })); m.visible = false; arm.add(m); this.shapes[name] = m; }
    // the jetpack on his back
    const jp = new Batch(); for (const s of [-1, 1]) { jp.add(GEO.cyl, s * 0.15, 1.16, -0.29, 0.11, 0.5, 0.11, 0xcfd6dc); jp.add(GEO.cone, s * 0.15, 0.84, -0.29, 0.1, 0.16, 0.1, 0xe23b2e, 0, Math.PI); } jp.box(0, 1.2, -0.24, 0.42, 0.3, 0.08, 0x39414c);
    this.pack = new THREE.Mesh(jp.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true })); this.pack.visible = false; game.player.mesh.userData.body.add(this.pack);
    // the marker over whatever a blaster is pointing at
    this.mark = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 4), new THREE.MeshBasicMaterial({ color: 0xffd21f, fog: false })); this.mark.rotation.x = Math.PI; this.mark.visible = false; game.scene.add(this.mark);
    // the fishing float
    this.bob = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: 0xe23b2e })); this.bob.scale.setScalar(0.22); this.bob.visible = false; game.scene.add(this.bob);
  }
  get owned() { return this.g.state.gear; }
  has(id) { return this.owned.includes(id) || this.lent === id; }
  // everything that can be held, in toolbox order
  get hands() { return GEAR.filter((q) => !q.worn && this.has(q.id)); }
  get hand() { const id = this.g.state.equip, it = id && this.has(id) ? gearById(id) : null; return it && !it.worn ? it : null; }
  // Earned for keeps. Returns the item when it is new.
  grant(id, quiet) {
    const it = gearById(id), g = this.g; if (!it || this.owned.includes(id)) return null;
    this.owned.push(id); if (this.lent === id) this.lent = null;
    if (!it.worn && (!this.hand || !quiet)) g.state.equip = id;
    if (!quiet) { g.ui.sticker({ icon: it.icon, name: it.name }, it.kind === 'blaster' ? 'New blaster!' : 'New tool!'); g.sound.star(); }
    return it;
  }
  // A mission hands over what it needs; it goes back afterwards unless it has been earned by then.
  lend(id) { if (!this.owned.includes(id)) this.lent = id; this.g.state.equip = id; this.cancelFishing(); }
  giveBack() { if (!this.lent) return; const st = this.g.state; if (st.equip === this.lent) st.equip = (this.owned.map(gearById).find((q) => q && !q.worn) || {}).id || null; this.lent = null; }
  equip(id) { const it = gearById(id); if (!it || it.worn || !this.has(id)) return false; this.g.state.equip = id; this.cancelFishing(); this.g.sound.click(); this.g.save(); return true; }
  cycle() {
    const all = this.hands, g = this.g; if (!all.length) return g.ui.toast('Your toolbox is empty. Missions fill it up.');
    const it = all[(all.findIndex((q) => q.id === g.state.equip) + 1) % all.length];
    this.equip(it.id); g.ui.toast(`${it.icon} ${it.name}`, 1.4);
  }
  // Older saves: everything their finished missions should have paid out.
  catchUp() { let n = 0; for (const it of GEAR) if (this.g.state.done.includes(it.from) && this.grant(it.id, true)) n++; if (n) this.g.save(); return n; }

  // What a blaster would hit right now: the robot (or fire) nearest to where the camera is looking.
  target(it) {
    const g = this.g, p = g.player.pos, yaw = g.cam.yaw, reach = (it.reach || it.radius || 20) * 1.05; let best = null, score = 1e9;
    const consider = (o, x, y, z, top) => { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d > reach || d < 0.3) return; const off = Math.abs(angDiff(Math.atan2(dx, dz), yaw)); if (off > 0.75 && d > 7) return; const sc = off * 22 + d; if (sc < score) { score = sc; best = { o, x, y, z, d, top }; } };
    for (const b of g.bots.list) if (!b.dead) consider(b, b.x, b.y + b.k.h * 0.55, b.z, b.y + b.k.h);
    if (it.fx === 'wet') for (const f of g.fires) if (f.heat > 0) consider(f, f.x, f.y + 0.6, f.z, f.y + 1.6);
    return best;
  }
  // One frame. inp: { fire, pressed }. Returns what the worn tools change about walking: { run, jump, jet }.
  update(dt, inp, onFoot) {
    const g = this.g, p = g.player, it = onFoot ? this.hand : null, fx = g.fx, mod = this.mod;
    this.cool = Math.max(0, this.cool - dt); this.nitroT = Math.max(0, this.nitroT - dt); this.aimT = Math.max(0, this.aimT - dt);
    const can = onFoot && !(g.dizzy > 0) && !g.missions.frozen;
    let tgt = null;
    if (it && it.kind === 'blaster') {
      tgt = this.target(it);
      if (can && inp.fire && this.cool <= 0) this.shoot(it, tgt);
    } else if (it && can && inp.pressed) {
      if (it.id === 'horn') { if (this.cool <= 0) this.honk(it); }
      else if (it.id === 'rod') this.castOrReel();
      else if (it.id === 'detector') this.dig();
    }
    if (it && it.id === 'detector') this.detect(dt); else this.near = null;
    if (this.fish) this.fishing(dt, it);
    if (!onFoot && inp.pressed && this.has('nitro')) this.nitro();
    // the marker, the thing in his hand, the arm that holds it
    const mark = this.mark; mark.visible = !!tgt;
    if (tgt) { mark.position.set(tgt.x, tgt.top + 0.9 + Math.sin(g.time * 6) * 0.12, tgt.z); mark.rotation.y += dt * 3; }
    const shape = it ? it.shape || 'gun' : null;
    for (const name in this.shapes) { const m = this.shapes[name], on = name === shape; if (m.visible !== on) m.visible = on; if (on && name === 'gun') m.material.color.setHex(it.color || 0xcfd6dc); }
    p.armPose = shape ? SHAPES[shape].pose[this.aimT > 0 || (it.kind === 'blaster' && inp.fire && can) ? 1 : 0] : null;
    this.shots.update(dt, g.bots.list, p.pos.x, p.pos.y, p.pos.z, (s) => this.blocked(s), (s, b) => this.impact(s, b));
    for (const c of this.chests) c.update(dt); if (this.chests.length && this.chests[0].gone) this.chests.shift();
    // worn tools
    const jet = this.has('jetpack'); if (this.pack.visible !== jet) this.pack.visible = jet;
    if (jet && onFoot) {
      if (p.jetting) {
        this.fuel = Math.max(0, this.fuel - dt / 2.6);
        const bx = p.pos.x - Math.sin(p.heading) * 0.32, bz = p.pos.z - Math.cos(p.heading) * 0.32;
        for (let i = 0; i < 2; i++) fx.emit(bx + (Math.random() - 0.5) * 0.3, p.pos.y + 0.8, bz + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.5, -6 - Math.random() * 3, (Math.random() - 0.5) * 1.5, 0.3, 0.5, 0.15, 1, 0.55 + Math.random() * 0.3, 0.1, 0.9);
      } else if (p.onGround) this.fuel = Math.min(1, this.fuel + dt * 0.9);
    }
    g.sound.jet(!!(onFoot && p.jetting));
    const skates = this.has('skates');
    if (skates && onFoot && p.onGround && p.speed > 11 && Math.random() < dt * 40) fx.emit(p.pos.x, p.pos.y + 0.12, p.pos.z, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.3, 0.14, 0.04, 1, 0.8, 0.3, 1, 9);
    mod.run = skates ? 1.75 : 1; mod.jump = this.has('boots') ? 1.55 : 1; mod.jet = jet && this.fuel > 0;
    return mod;
  }
  // Has this shot run into the world? The ground, water, a wall or tree, a car, a person, an animal.
  blocked(s) {
    const g = this.g, w = g.world, c = this._c, it = s.item;
    const floor = Math.max(w.groundAt(s.x, s.z) + w.curbAt(s.x, s.z), WATER_Y);
    if (s.y <= floor + it.size * 0.5) { s.y = floor + 0.1; return true; }
    c.x = s.x; c.z = s.z; if (w.collide(c, 0.12, s.y)) return true;
    if (s.y - floor > 3) return false;
    for (const v of g.vlist) { if (Math.abs(v.pos.x - s.x) > 8 || Math.abs(v.pos.z - s.z) > 8 || Math.abs(v.pos.y + 1 - s.y) > 1.8) continue; c.x = s.x; c.z = s.z; if (v.pushOut(c, 0.12)) return true; }
    for (const f of g.fires) if (f.heat > 0 && Math.abs(f.x - s.x) < 0.7 && Math.abs(f.z - s.z) < 0.7 && s.y < f.y + 1.9) return true;
    for (const q of g.crowd.people) if (q.on && Math.abs(q.x - s.x) < 0.45 && Math.abs(q.z - s.z) < 0.45 && s.y < q.y + 2) return true;
    if (Math.abs(s.x - 600) < 300) for (const o of g.animals.all) if (Math.abs(o.x - s.x) < 0.7 && Math.abs(o.z - s.z) < 0.7 && s.y < floor + 1.6) return true;
    return false;
  }
  aimDir(it, tgt, out) {
    const g = this.g, p = g.player.pos;
    if (tgt) {
      const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz), t = d / it.speed, dy = tgt.y - (p.y + 1.25) + 0.5 * (it.grav || 0) * t * t;
      const l = Math.hypot(dx, dy, dz) || 1; out.x = dx / l; out.y = dy / l; out.z = dz / l; return Math.atan2(dx, dz);
    }
    // nothing to aim at: straight ahead and nearly flat, so it meets whatever is in front
    const yaw = g.cam.yaw, up = it.grav < 0 ? 0.02 : 0.05, c = Math.cos(up);
    out.x = Math.sin(yaw) * c; out.y = Math.sin(up); out.z = Math.cos(yaw) * c; return yaw;
  }
  shoot(it, tgt) {
    const g = this.g, p = g.player, snd = g.sound, d = this._d;
    this.aimT = 0.35;
    if (it.radius) {
      // a ring around Christian: the Zap Pulse and the Thunder Hammer
      this.cool = it.cool; const c = hex(it.color);
      g.bots.radial(p.pos.x, p.pos.z, it.radius, it.dmg, it.fx, p.pos.y);
      for (let i = 0; i < 40; i++) { const a = (i / 40) * 6.283, q = it.radius * 3.2; g.fx.emit(p.pos.x + Math.cos(a) * 0.6, p.pos.y + 0.5, p.pos.z + Math.sin(a) * 0.6, Math.cos(a) * q, it.fx === 'knock' ? 2 : 0.4, Math.sin(a) * q, 0.45, 0.5, 1.6, c[0], c[1], c[2], 0.9); }
      g.fx.emit(p.pos.x, p.pos.y + 0.15, p.pos.z, 0, 0, 0, 0.5, 1, it.radius * 2.2, c[0], c[1], c[2], 0.6, 0, true);
      g.cam.shake = Math.max(g.cam.shake, it.fx === 'knock' ? 0.3 : 0.14); g.input.rumble(0.6, 0.6, 160); snd.blast(it.id); g.life(p.pos.x, p.pos.z, it.radius);
      return;
    }
    const yaw = this.aimDir(it, tgt, d); p.heading += angDiff(yaw, p.heading) * 0.7;
    this.cool = 1 / it.rate;
    const sp = it.spread, mx = p.pos.x + Math.sin(yaw) * 0.6, my = p.pos.y + 1.25, mz = p.pos.z + Math.cos(yaw) * 0.6;
    const col = it.fx === 'paint' ? PAINTS[(Math.random() * PAINTS.length) | 0] : it.color;
    this.shots.fire(it, mx, my, mz, d.x + (Math.random() - 0.5) * sp, d.y + (Math.random() - 0.5) * sp, d.z + (Math.random() - 0.5) * sp, col);
    snd.blast(it.id); if (it.rate < 2) { g.cam.shake = Math.max(g.cam.shake, 0.08); g.input.rumble(0.3, 0.2, 90); }
  }
  // A shot has landed on a robot (b) or on the world (b is null). Returns true when the shot is spent.
  impact(s, b) {
    const g = this.g, it = s.item, c = hex(s.col), fx = g.fx;
    if (it.splash) {
      g.bots.radial(s.x, s.z, it.splash, it.dmg, it.fx, s.y);
      if (it.fx === 'boom') { for (let k = 0; k < 3; k++) { const q = hex(PAINTS[(Math.random() * PAINTS.length) | 0]); fx.burst(s.x, s.y + 0.6, s.z, 26, 12, 0.9, 0.5, 0.2, q[0], q[1], q[2], 1, 5, 0.8); } g.burst(s.x, s.y + 1, s.z, 90, 11); g.sound.thud(5); g.cam.shake = Math.max(g.cam.shake, 0.2); }
      else fx.burst(s.x, s.y + 0.3, s.z, it.fx === 'net' ? 10 : 22, it.splash * 1.6, 0.6, 0.4, 1.2, c[0], c[1], c[2], 0.85, 6, 0.7);
      fx.emit(s.x, Math.max(s.y - 0.2, WATER_Y) + 0.12, s.z, 0, 0, 0, 0.5, 0.8, it.splash * 2, c[0], c[1], c[2], 0.5, 0, true);
      g.life(s.x, s.z, it.splash + 1); g.sound.splat();
      return true;
    }
    if (b) g.bots.hit(b, it.dmg, it.fx, s.vx, s.vz, s.col);
    fx.burst(s.x, s.y, s.z, it.fx === 'wet' ? 3 : 7, 3.5, 0.35, 0.18, 0.5, c[0], c[1], c[2], 0.85, 9, 0.6);
    if (!b) {
      // the world: fires go out, cars change colour, people and animals get a fright
      if (it.fx === 'wet') for (const f of g.fires) if (f.heat > 0 && Math.hypot(f.x - s.x, f.z - s.z) < 2.1 && Math.abs(f.y + 0.6 - s.y) < 2.6) f.douse(0.085);
      if (it.fx === 'paint') for (const v of g.vlist) if (v.spec.wr && Math.hypot(v.pos.x - s.x, v.pos.z - s.z) < v.reach + 0.4 && Math.abs(v.pos.y + 1 - s.y) < 2.5) { v.setColor(s.col); g.state.stats.splats++; break; }
      g.life(s.x, s.z, 1.5);
    }
    return true;
  }
  honk(it) {
    const g = this.g, p = g.player.pos; this.cool = it.cool; this.aimT = 0.6;
    g.sound.horn(true, true); setTimeout(() => g.sound.horn(false), 420);
    const n = g.bots.radial(p.x, p.z, 14, 0, 'stun', p.y); g.life(p.x, p.z, 18, true);
    g.fx.emit(p.x, p.y + 0.15, p.z, 0, 0, 0, 0.6, 1, 30, 1, 1, 1, 0.35, 0, true);
    if (n) g.ui.toast(n === 1 ? 'One robot frozen stiff!' : `${n} robots frozen stiff!`, 1.6);
  }
  nitro() {
    const g = this.g, v = g.player.vehicle; if (!v || !v.spec.wr || g.missions.frozen) return;
    if (this.nitroT > 0) return g.ui.toast(`Nitro is filling up: ${Math.ceil(this.nitroT)}`, 1);
    if (!v.onGround) return;
    this.nitroT = 9; v.turboT = 2.4; v.vx += Math.sin(v.heading) * 7; v.vz += Math.cos(v.heading) * 7; g.sound.boost(); g.cam.shake = 0.16; g.input.rumble(0.3, 0.9, 420); g.state.stats.nitros++;
  }
  // ---- treasure: the detector beeps faster the closer it gets; the same button digs
  detect(dt) {
    const g = this.g, p = g.player.pos; let best = null, bd = 400;
    const quest = g.spots.some((t) => t.quest && !t.dug);   // on a treasure hunt, the detector only has ears for the map's crosses
    for (const t of g.spots) { if (t.dug || (quest && !t.quest)) continue; const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < bd) { bd = d; best = t; } }
    this.near = best ? { spot: best, d: bd } : null;
    if (best && bd < 120 && (this.beepT -= dt) <= 0) { this.beepT = clamp(bd / 50, 0.12, 1.8); g.sound.beep(bd < 3.2 ? 1500 : 880); }
  }
  dig() {
    const g = this.g, n = this.near; if (!g.player.onGround) return;
    if (!n) return g.ui.toast('No treasure anywhere near here');
    if (n.d > 3.2) return g.ui.toast(n.d > 120 ? 'Nothing close. Walk until the number gets smaller.' : n.d > 40 ? 'Something is buried not far off' : n.d > 12 ? 'Getting warmer…' : 'Very close! A few more steps');
    const t = n.spot; t.dug = true; if (t.k !== undefined && !g.state.dug.includes(t.k)) g.state.dug.push(t.k);
    const y = g.world.groundAt(t.x, t.z) + g.world.curbAt(t.x, t.z), gold = t.gold || 40 + ((t.k * 37) % 5) * 15;
    g.fx.burst(t.x, y + 0.2, t.z, 22, 4, 0.7, 0.5, 1.4, 0.6, 0.48, 0.33, 0.8, 9, 1.2); g.burst(t.x, y + 1, t.z, 60, 6);
    this.chests.push(g.makeChest(t.x, y, t.z)); g.addMoney(gold); g.state.stats.dug++; g.sound.coin(); g.sound.star(); g.ui.toast(`Buried treasure!  +$${gold}`, 3); g.save();
    this.aimT = 0.6; this.near = null;
    if (t.onDig) t.onDig(t);
  }
  // ---- fishing: cast, wait for the float to dip, reel in
  castOrReel() {
    const g = this.g, p = g.player, w = g.world;
    if (this.fish) {
      const f = this.fish;
      if (f.state === 'bite') {
        const r = Math.random(); let acc = 0, got = FISH[0]; for (const q of FISH) { acc += q[2]; if (r < acc) { got = q; break; } }
        g.addMoney(got[1]); g.state.stats.fish++; g.sound.coin(); g.sound.plop(); g.ui.toast(`You caught ${/^an? /.test(got[0]) ? got[0] : 'a ' + got[0]}!  +$${got[1]}`, 3);
        g.fx.burst(f.x, WATER_Y + 0.3, f.z, 14, 3, 0.6, 0.25, 0.6, 1, 1, 1, 0.8, 9, 1.3); g.save();
      } else g.ui.toast('Reeled in. Nothing yet.');
      return this.cancelFishing();
    }
    if (!p.onGround) return;
    // the float lands in the first deep water straight ahead
    const hx = Math.sin(p.heading), hz = Math.cos(p.heading);
    for (let d = 3; d <= 14; d += 1) {
      const x = p.pos.x + hx * d, z = p.pos.z + hz * d;
      if (w.heightAt(x, z) < WATER_Y - 0.5 && w.platAt(x, z) === -Infinity) { this.fish = { x, z, state: 'wait', t: 1.6 + Math.random() * 3.6, px: p.pos.x, pz: p.pos.z }; this.aimT = 0.6; g.sound.plop(); return g.ui.toast('Wait for a bite…', 2); }
    }
    g.ui.toast('Face some deep water to fish');
  }
  cancelFishing() { this.fish = null; this.bob.visible = false; }
  fishing(dt, it) {
    const g = this.g, f = this.fish, p = g.player.pos;
    if (!it || it.id !== 'rod' || Math.hypot(p.x - f.px, p.z - f.pz) > 1.5) return this.cancelFishing();
    f.t -= dt; this.aimT = 0.3;
    if (f.state === 'wait' && f.t <= 0) { f.state = 'bite'; f.t = 1.3; g.sound.beep(1200); g.ui.toast('A bite! Reel it in!', 1.3); g.fx.emit(f.x, WATER_Y + 0.1, f.z, 0, 0, 0, 0.6, 0.4, 3, 1, 1, 1, 0.7, 0, true); }
    else if (f.state === 'bite' && f.t <= 0) { g.ui.toast('It got away'); return this.cancelFishing(); }
    this.bob.visible = true; this.bob.position.set(f.x, WATER_Y + 0.08 + (f.state === 'bite' ? -0.12 + Math.sin(g.time * 30) * 0.06 : Math.sin(g.time * 2.5) * 0.04), f.z);
  }
  // What the dashboard shows: the thing in hand and whichever meter matters right now.
  chip(onFoot) {
    const it = this.hand, g = this.g, p = g.player;
    if (!onFoot) return this.has('nitro') && p.vehicle && p.vehicle.spec.wr ? { icon: '🔥', name: 'Nitro', key: 'F', label: 'Nitro', meter: 1 - this.nitroT / 9, note: '' } : null;
    const jet = this.has('jetpack') && (this.fuel < 0.999 || p.jetting) ? this.fuel : null;
    if (!it) return jet === null ? null : { icon: '🚀', name: 'Jetpack', key: '', label: '', meter: jet, note: '' };
    let meter = jet, note = '';
    if (it.cool) meter = 1 - this.cool / it.cool;
    if (it.id === 'detector') { const n = this.near; note = !n ? 'nothing near' : n.d < 3.2 ? 'Dig here!' : `${Math.max(10, Math.round((n.d * 3.281) / 10) * 10)} ft`; }
    if (it.id === 'rod' && this.fish) note = this.fish.state === 'bite' ? 'BITE!' : 'waiting…';
    return { icon: it.icon, name: it.name, key: 'F', label: it.id === 'detector' ? 'Dig' : it.id === 'rod' ? (this.fish ? 'Reel' : 'Cast') : it.id === 'horn' ? 'Honk' : 'Fire', meter, note };
  }
  reset() { this.shots.clear(); this.cancelFishing(); this.lent = null; this.cool = 0; this.fuel = 1; this.nitroT = 0; this.aimT = 0; for (const c of this.chests) c.dispose(); this.chests = []; this.mark.visible = false; }
}
