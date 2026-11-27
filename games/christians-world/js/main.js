// Christian's World: game loop, camera, interactions and saving.
import * as THREE from './three.js';
import { buildWorld, POI, WATER_Y, GEO, Batch, MAT } from './world.js';
import { createVehicle, TrafficDriver, RaceDriver, lanePath, pathIndex, collideVehicles, TRAFFIC_COLORS, PAINT_COLORS } from './vehicles.js';
import { Player, buildPuppy } from './player.js';
import { Missions, MISSIONS, SHIFTS } from './missions.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { STATIONS } from './music.js';
import { Sky } from './sky.js';
import { makeWater } from './water.js';
import { NightLights, Particles, SkidMarks, glowTexture } from './fx.js';
import { Progress, PLACES, STICKERS, freshState, mergeState } from './progress.js';
import { Crowd, Birds, Animals, Pet } from './life.js';
import { Toolbox, TREASURE, gearFrom } from './gear.js';
import { Evo } from './evolve.js';
import { Bots, Fire } from './bots.js';
import { clamp, damp, angDiff, rng, segDist, smoothstep } from './util.js';

const SAVE_KEY = 'christians-world-v1', SETTINGS_KEY = 'christians-world-settings';
const P = POI;
// Hidden gold stars: [x, z] or [x, z, height] for the one you have to jump for.
const GREY = [0.8, 0.8, 0.8], DIRT = [0.76, 0.67, 0.5], SAND = [0.95, 0.89, 0.7], SNOW = [1, 1, 1];
const ORD = ['1st', '2nd', '3rd', '4th'];
const AMB = { sea: 0, wind: 0, birds: 0, crickets: 0 }, QUIET = { sea: 0, wind: 0, birds: 0, crickets: 0 };
const RIVALS = [{ name: 'Zoe', color: 0x2d6cdf, cruise: 28.5, corner: 12.5 }, { name: 'Dev', color: 0xffd21f, cruise: 25.5, corner: 11.5 }, { name: 'Tom', color: 0x8e44ad, cruise: 23, corner: 10.5 }];
const TITLE_LOOK = { x: -10, z: -20 };
const IDLE = { mx: 0, my: 0, run: false, jump: false, action: false, horn: false, handbrake: false };
const STARS = [
  [P.summit.x + 2, P.summit.z + 3], [0, 794], [98, 694], [-420, -352], [-632, 30], [575, -60], [50, -59], [-72, -30], [-182, -150], [423, 420, 7.2],
  [-140, 655], [160, 658], [536, -536], [-250, 256], [-420, 180], [410, -382], [190, -176], [-98, -828], [-50, 50], [592, 150],
];
const $ = (id) => document.getElementById(id);

function starGeometry() {
  const sh = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 0.45 : 1; if (k) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.28, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 1 });
  g.center();
  return g;
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd3e9fb, 420, 2100);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 6000);
    this.sky = new Sky(this.scene);

    this.R = rng(77);
    this.world = buildWorld(this.scene);
    this.water = makeWater(this.scene, this.world, this.sky);
    this.lights = new NightLights(this.scene, this.world);
    this.fx = new Particles(this.scene); this.skids = new SkidMarks(this.scene);
    this.progress = new Progress(this); this.stickerList = STICKERS; this.placeCount = PLACES.length;
    this.settings = this.loadSettings(); this.timeSet = 'auto';
    // how a photo can be saved here: 'link' (an ordinary download), the host app's own saver, or not at all
    this.saver = null;
    try { if (window.self === window.top) this.saver = 'link'; } catch (e) { /* inside another page */ }
    try { const ask = window.claude && window.claude.use && window.claude.use('downloads'); if (ask && ask.then) ask.then((d) => { if (d && d.save) { this.saver = d; if (!$('photo-view').hidden) $('photo-save').hidden = false; } }, () => {}); } catch (e) { /* no host app */ }   // the answer can arrive late, even after a photo is up
    this.crowd = new Crowd(this.scene, this.world); this.birds = new Birds(this.scene, this.world); this.animals = new Animals(this.scene, this.world); this.pet = new Pet(this.scene, this.world);
    this.input = new Input(); this.input.attach(canvas);
    this.sound = new Sound();
    this.state = freshState();
    this.mode = 'title'; this.paused = false; this.time = 0; this.quality = 0; this.slowT = 0; this.fps = 60;
    this.cam = { yaw: Math.PI, pitch: 0.3, d: 7, tx: 0, ty: 0, tz: 0, idle: 9, zoom: 1, zi: 0, shake: 0 };
    this.safe = { x: P.home.door.x, z: P.home.door.z, h: 0.3 }; this.safeT = 0;
    this.route = null; this.routeDirty = true; this.routeT = 0;
    this.anim = []; this.fireworksT = 0; this.barkT = 0;

    this.player = new Player(this.scene);
    // the toolbox, the robots it is for, small fires, buried treasure
    this.gear = new Toolbox(this); this.evo = new Evo(this); this.bots = new Bots(this); this.fires = []; this.spots = []; this.dizzy = 0; this.fireWas = false;
    this.vehicles = new Map(); this.vlist = [];
    const add = (id, type, s, color) => { const v = createVehicle(id, type, s.x, s.z, s.h, this.world, this.scene, color); this.vehicles.set(id, v); this.vlist.push(v); return v; };
    this.addVehicle = add;
    add('home', 'hatch', P.home.car); add('pizza', 'pizza', P.pizza.car); add('taxi', 'taxi', P.taxi.car); add('police', 'police', P.police.car);
    add('bus', 'bus', P.school.bus); add('sports', 'sports', P.garage.sports); add('pickup', 'pickup', P.farm.truck); add('monster', 'monster', P.base.monster);
    add('icecream', 'icecream', P.beach.icecream);
    add('camper', 'van', { x: -584, z: 30, h: Math.PI / 2 }, 0x8fd3a0); add('beachcar', 'sedan', { x: 24, z: 618, h: Math.PI }, 0xff5fa2);
    add('stunter', 'sports', { x: 372, z: 372, h: Math.PI / 2 }, 0x7cc75c); add('parkcar', 'hatch', { x: 164, z: -138, h: 0 }, 0x2d6cdf);
    add('boat', 'speedboat', P.dock.boat); add('duck', 'duck', P.dock.duck); add('heli', 'heli', { x: P.airfield.x, z: P.airfield.z, h: Math.PI });
    for (let k = 0; k < 11; k++) {
      const type = k % 5 === 4 ? 'van' : k % 4 === 3 ? 'hatch' : 'sedan';
      const v = add('t' + k, type, { x: 0, z: 0, h: 0 }, TRAFFIC_COLORS[k % TRAFFIC_COLORS.length]);
      v.ai = new TrafficDriver(v, this.world, this.R);
    }

    this.ui = new UI(this);
    this.missions = new Missions(this);
    this.buildMarkers();
    this.buildConfetti();
    this.buildBall();
    this.bindMenus();
    this.applySettings(false);
    window.addEventListener('resize', () => this.resize()); this.resize();
  }

  // ---- markers, pickups, effects -------------------------------------------------
  buildMarkers() {
    this.starGeo = starGeometry();
    this.starMat = new THREE.MeshLambertMaterial({ color: 0xffd21f, emissive: 0x7a5a00 });
    this.doneMat = new THREE.MeshLambertMaterial({ color: 0x8fd3a0, emissive: 0x1f5a33 });
    this.lockMat = new THREE.MeshLambertMaterial({ color: 0xc9c9c9 });
    for (const g of this.missions.givers) {
      const m = new THREE.Mesh(this.starGeo, this.starMat); m.scale.setScalar(0.75);
      const y = this.world.groundAt(g.def.giver.x, g.def.giver.z) + this.world.curbAt(g.def.giver.x, g.def.giver.z);
      m.position.set(g.def.giver.x, y + 3.3, g.def.giver.z); this.scene.add(m); g.marker = m; g.baseY = y + 3.3;
    }
    // objective beacon: a column of light and a ring on the ground
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd21f }));
    this.ring.rotation.x = Math.PI / 2; this.beacon.visible = this.ring.visible = false; this.scene.add(this.beacon, this.ring);
    this.hoop = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 10, 44), new THREE.MeshBasicMaterial({ color: 0xffd21f, fog: false }));
    this.hoop.visible = false; this.scene.add(this.hoop);
    // free-roam stars
    this.starMeshes = [];
    const pad = this.world.roofPad, stars = [...STARS, [pad.x, pad.z, pad.y + 1.5], [P.islet.x + 4, P.islet.z + 3]];
    this.starCount = stars.length;
    stars.forEach(([x, z, y], k) => {
      const m = new THREE.Mesh(this.starGeo, this.starMat);
      const gy = y ?? this.world.groundAt(x, z) + this.world.curbAt(x, z) + 1.5;
      m.position.set(x, gy, z); m.userData = { k, y: gy, bx: x, by: gy, bz: z }; m.castShadow = true; this.scene.add(m); this.starMeshes.push(m);
    });
    this.starList = this.starMeshes.map((m) => ({ x: m.position.x, z: m.position.z, y: m.userData.y, k: m.userData.k, found: false }));   // what Scout sniffs for
  }
  refreshStars() { for (const m of this.starMeshes) { const u = m.userData; m.visible = !this.state.stars.includes(u.k); u.y = u.by; m.position.set(u.bx, u.by, u.bz); } for (const s of this.starList) s.found = this.state.stars.includes(s.k); }

  makeProp(kind, x, z, y) {
    let m;
    if (kind === 'buoy') {
      const b = new Batch();
      b.add(GEO.cyl, 0, 0.3, 0, 0.9, 0.7, 0.9, 0xe23b2e); b.add(GEO.cone, 0, 1.5, 0, 0.75, 1.7, 0.75, 0xffffff); b.add(GEO.sph, 0, 2.5, 0, 0.28, 0.28, 0.28, 0xffd21f);
      m = b.mesh(MAT.solid); y = WATER_Y;
    } else { m = buildPuppy(0xff9d3c); m.scale.setScalar(1.15); }
    m.position.set(x, y ?? this.world.groundAt(x, z), z); this.scene.add(m);
    return m;
  }
  makePickup(kind, x, z, y0) {
    const y = y0 ?? (kind === 'bottle' ? WATER_Y + 0.1 : this.world.groundAt(x, z) + this.world.curbAt(x, z));
    let m;
    if (kind === 'bottle') {
      const b = new Batch();
      b.add(GEO.cyl, 0, 0.5, 0, 0.32, 1.0, 0.32, 0x3fa56b, 0, 0.5); b.add(GEO.cyl, 0.0, 1.12, 0.36, 0.13, 0.5, 0.13, 0x3fa56b, 0, 0.5); b.add(GEO.cyl, 0, 1.36, 0.5, 0.15, 0.14, 0.15, 0xc9a26b, 0, 0.5);
      b.add(GEO.box, 0, 0.5, 0, 0.3, 0.5, 0.3, 0xfdf8ee, 0, 0.5);
      m = b.mesh(MAT.solid); m.userData.bob = true;
      const glow = new THREE.Mesh(this.ring.geometry, this.ring.material); glow.rotation.x = Math.PI / 2; glow.scale.setScalar(3); glow.position.y = 0.1; m.add(glow);
      m.position.set(x, y, z); m.userData.baseY = y; this.scene.add(m); this.anim.push(m);
      return m;
    }
    if (kind === 'hay') {
      const b = new Batch();
      b.add(GEO.cyl, 0, 0.75, 0, 0.75, 1.5, 0.75, 0xe2c35a, 0, 0, Math.PI / 2); b.add(GEO.cyl, 0, 0.75, 0, 0.78, 0.12, 0.78, 0xb9963c, 0, 0, Math.PI / 2);
      m = b.mesh(MAT.solid); m.rotation.y = x * 7;
      const glow = new THREE.Mesh(this.ring.geometry, this.ring.material); glow.rotation.x = Math.PI / 2; glow.scale.setScalar(2.2); glow.position.y = 0.15; m.add(glow);
    } else {
      m = buildPuppy([0xc98b4f, 0xf3e3c3, 0x7b5a3c, 0xd9a441, 0x8d877c][Math.floor(Math.abs(x * 3 + z)) % 5]);
      m.scale.setScalar(1.25); m.userData.puppy = true; m.rotation.y = x;
    }
    m.position.set(x, y, z); m.userData.baseY = y; this.scene.add(m); this.anim.push(m);
    return m;
  }
  onCollect(it) {
    if (it.kind === 'hay') {
      const v = this.vehicles.get('pickup'), n = (this.bales ||= []).length;
      const b = new THREE.Mesh(GEO.cyl, this.hayMat ||= new THREE.MeshLambertMaterial({ color: 0xe2c35a }));
      b.scale.set(0.42, 0.9, 0.42); b.rotation.z = Math.PI / 2; b.position.set((n % 2 ? 0.45 : -0.45), v.spec.clr + v.spec.h + 0.45 + Math.floor(n / 4) * 0.8, -1.0 - (Math.floor(n / 2) % 2) * 0.9);
      v.chassis.add(b); this.bales.push(b);
      this.sound.coin(); this.ui.toast(`Hay bale ${n + 1} of 6`);
    } else if (it.kind === 'bottle') { this.sound.coin(); this.ui.toast('A message in a bottle!'); }
    else { this.sound.bark(); this.sound.coin(); this.ui.toast('Got one! Good puppy.'); }
    this.burst(it.x, Math.max(this.world.groundAt(it.x, it.z), WATER_Y) + 1.5, it.z, 24, 4);
  }
  onMissionEnd() { if (this.bales) { for (const b of this.bales) b.parent?.remove(b); this.bales = []; } }

  buildConfetti() {
    const N = 900; this.cN = N; this.cPos = new Float32Array(N * 3).fill(-999); this.cVel = new Float32Array(N * 3); this.cLife = new Float32Array(N); this.cNext = 0;
    const col = new Float32Array(N * 3), c = new THREE.Color(), pal = [0xffd21f, 0xe23b2e, 0x2d6cdf, 0x1f8a70, 0xff7a1a, 0xff5fa2, 0xffffff];
    for (let k = 0; k < N; k++) { c.set(pal[k % pal.length]); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.cPos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.confetti = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.17, vertexColors: true, sizeAttenuation: true }));
    this.confetti.frustumCulled = false; this.scene.add(this.confetti);
  }
  burst(x, y, z, n = 120, power = 9) {
    for (let k = 0; k < n; k++) {
      const i = this.cNext = (this.cNext + 1) % this.cN, a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u), sp = power * (0.4 + Math.random() * 0.6);
      this.cPos[i * 3] = x; this.cPos[i * 3 + 1] = y; this.cPos[i * 3 + 2] = z;
      this.cVel[i * 3] = Math.cos(a) * s * sp; this.cVel[i * 3 + 1] = Math.abs(u) * sp + 3; this.cVel[i * 3 + 2] = Math.sin(a) * s * sp;
      this.cLife[i] = 1.6 + Math.random() * 1.6;
    }
  }
  updateConfetti(dt) {
    let any = false;
    for (let i = 0; i < this.cN; i++) {
      if (this.cLife[i] <= 0) continue;
      any = true; this.cLife[i] -= dt;
      const k = i * 3; this.cVel[k + 1] -= 9 * dt; const dr = Math.exp(-1.4 * dt); this.cVel[k] *= dr; this.cVel[k + 2] *= dr;
      this.cPos[k] += this.cVel[k] * dt; this.cPos[k + 1] += this.cVel[k + 1] * dt; this.cPos[k + 2] += this.cVel[k + 2] * dt;
      if (this.cLife[i] <= 0) this.cPos[k + 1] = -999;
    }
    if (any || this.cDirty) this.confetti.geometry.attributes.position.needsUpdate = true;
    this.cDirty = any;
  }
  celebrate() { const f = this.focus(); this.burst(f.x, f.y + 3, f.z, 220, 11); this.sound.win(); }
  finale() {
    const had = this.state.rocket;
    this.state.rocket = true; this.spawnRocket(); this.save(); this.fireworksT = 14;
    if (had) return this.ui.dialog({ name: 'Mayor Maple', text: 'Every single mission, robots and all! Christian\'s World has never been safer, or more fun. The whole town is letting off fireworks for you.', yes: 'Hooray!' });
    this.ui.dialog({ name: 'Mayor Maple', text: 'Every mission on the island is done! You are the hero of Christian\'s World. The town built you a thank-you present: a rocket car. It is parked in front of Town Hall.', yes: 'Wow!' });
  }
  removeVehicle(id) { const v = this.vehicles.get(id); if (!v) return; if (this.player.vehicle === v) { v.driver = null; this.player.vehicle = null; this.player.mesh.visible = true; } this.scene.remove(v.group); this.vehicles.delete(id); this.vlist.splice(this.vlist.indexOf(v), 1); }
  // ---- the Grand Prix: three rivals, a grid, places ----
  raceGrid(m, stops) {
    const w = this.world, pv = this.player.vehicle, path = lanePath(w, stops), slot = (k) => { const a = path.pts[k * 2], b = path.pts[k * 2 + 1]; return [a[0], a[1], Math.atan2(b[0] - a[0], b[1] - a[1])]; };
    this.ui.flash();
    // traffic keeps off the grid
    for (const v of this.vlist) if (v.ai && v.ai.respawn && Math.hypot(v.pos.x - stops[0][0], v.pos.z - stops[0][1]) < 110) v.ai.respawn(this.focus());
    const rivals = RIVALS.map((r, k) => {
      const [x, z, h] = slot(3 - k), v = this.addVehicle('rival' + k, 'sports', { x, z, h }, r.color); v.locked = true;
      const d = new RaceDriver(v, w, path, { cruise: r.cruise, corner: r.corner, start: (3 - k) * 2 }); d.name = r.name; d.base = 1;
      m.temps.push({ update() {}, dispose: () => this.removeVehicle('rival' + k) });
      return d;
    });
    const [x, z, h] = slot(0); pv.place(x, z, h); this.cam.yaw = h; this.snapCam = true;
    this.race = { path, rivals, pk: 0, place: 4, said: 4, sayT: 0 };
    m.temps.push({ update() {}, dispose: () => { this.race = null; } });
    m.place = 4;
  }
  raceGo() { if (this.race) for (const d of this.race.rivals) d.go = true; }
  // Where Christian is in the race right now; also keeps the rivals honest (they ease off when far ahead, push when far behind).
  racePlace(m) {
    const r = this.race, pv = this.player.vehicle; if (!r) return '';
    if (pv) { r.pk = pathIndex(r.path, pv.pos.x, pv.pos.z, r.pk, 40); const q = r.path.pts[r.pk]; if (Math.hypot(q[0] - pv.pos.x, q[1] - pv.pos.z) > 70) r.pk = pathIndex(r.path, pv.pos.x, pv.pos.z, r.pk, r.path.pts.length); }   // took a short cut
    const mine = r.path.at[r.pk]; let place = 1;
    for (const d of r.rivals) { const gap = d.progress - mine; if (d.done || gap > 0) place++; d.pace = clamp(1 - gap / 600, 0.8, 1.05); }   // they wait for you far more than they chase you
    if (place !== r.place && this.time > r.sayT) { r.sayT = this.time + 1.5; if (place < r.place) { this.ui.toast(place === 1 ? 'You are in the lead!' : `Up to ${ORD[place - 1]} place!`, 1.8); this.sound.step(); } r.place = place; }
    m.place = place;
    return `${ORD[place - 1]} of 4`;
  }
  // ---- the cookie bandit's van, lapping the town ----
  startChase(m, loop) {
    const w = this.world, path = lanePath(w, loop), k0 = 12, a = path.pts[k0], b = path.pts[k0 + 1];
    const v = this.addVehicle('bandit', 'van', { x: a[0], z: a[1], h: Math.atan2(b[0] - a[0], b[1] - a[1]) }, 0x8e44ad); v.locked = true;
    const driver = new RaceDriver(v, w, path, { cruise: 17.5, corner: 9, loop: true, start: k0, go: true });
    m.temps.push({ update() {}, dispose: () => this.removeVehicle('bandit') });
    return { v, driver };
  }
  // ---- Lantern Run: the evening comes on quickly, and the clock holds at night until the run is over ----
  nightfall(m) {
    const sky = this.sky, mode = sky.mode;
    if (sky.night < 0.9) { sky.mode = 'hold'; this.dusk = { to: 0.9 }; this.ui.toast('The sun is going down…', 3); }
    m.temps.push({ update() {}, dispose: () => { this.dusk = null; sky.mode = mode; this.timeSet = null; this.applySettings(false); } });
  }
  makeLantern(x, z) {
    const y = this.world.groundAt(x, z) + this.world.curbAt(x, z), b = new Batch();
    b.box(0, 0.3, 0, 0.26, 0.4, 0.26, 0xffd98a); b.box(0, 0.06, 0, 0.34, 0.1, 0.34, 0x39414c); b.box(0, 0.54, 0, 0.34, 0.08, 0.34, 0x39414c); b.box(0, 0.68, 0, 0.05, 0.2, 0.05, 0x39414c);
    const g = new THREE.Group(), lamp = new THREE.Mesh(b.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb648, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.setScalar(5.5); glow.position.y = 0.4;
    g.add(lamp, glow); g.position.set(x, y, z); this.scene.add(g);
    return { update() {}, show() {}, dispose: () => this.scene.remove(g) };
  }
  // ---- tools, robots, treasure ----
  // The words for this player's controls: a keyboard, a touch screen or a controller.
  words() { return document.body.classList.contains('touch') ? 'touch' : this.input.padUsed ? 'pad' : 'key'; }
  // A robot has bumped into Christian: he goes flying, sees stars, and is fine.
  bonk(b, nx, nz, power = 1) {
    const p = this.player; if (p.vehicle) return;
    p.vx = nx * 8.5 * power; p.vz = nz * 8.5 * power; p.vy = 5.5 * power; p.onGround = false;
    this.dizzy = 0.7; this.cam.shake = Math.max(this.cam.shake, 0.22 * power); this.sound.bonk(); this.input.rumble(0.7, 0.4, 180); this.state.stats.bonks++;
    for (let i = 0; i < 5; i++) { const a = i * 1.257; this.fx.emit(p.pos.x + Math.cos(a) * 0.5, p.pos.y + 2.1, p.pos.z + Math.sin(a) * 0.5, Math.cos(a) * 1.5, 1.2, Math.sin(a) * 1.5, 0.7, 0.22, 0.1, 1, 0.9, 0.3, 1); }
  }
  // A splash, a bang or a honk: people nearby throw their arms up and animals bolt. Nobody is ever hurt.
  life(x, z, r, loud) {
    const n = this.crowd.startle(x, z, r);
    if (n && this.time > (this.heyT || 0)) { this.heyT = this.time + 1.2; this.sound.hey(); }
    if (Math.abs(x - P.farm.barn.x) < 450) this.animals.startle(x, z, r * (loud ? 2.5 : 1.6), this.sound);
    return n;
  }
  // Something smouldering for a mission; it goes when the mission does.
  makeFire(m, x, z) {
    const f = new Fire(this, x, z); this.fires.push(f);
    m.temps.push({ update: (dt) => f.update(dt), dispose: () => { f.dispose(); const i = this.fires.indexOf(f); if (i >= 0) this.fires.splice(i, 1); } });
    return f;
  }
  // The chest that comes up out of the ground where Christian digs. It shrinks away after a few seconds.
  makeChest(x, y, z) {
    const b = new Batch();
    b.box(0, 0.3, 0, 0.9, 0.6, 0.6, 0x8a5a2b); b.box(0, 0.62, 0, 0.94, 0.08, 0.64, 0xffd21f); b.box(0, 0.3, 0.31, 0.16, 0.2, 0.04, 0xffd21f); b.box(0, 0.86, -0.3, 0.9, 0.5, 0.08, 0x6b4428);
    for (const [cx, cz] of [[-0.2, 0], [0.15, 0.1], [0, -0.1]]) b.add(GEO.sph, cx, 0.7, cz, 0.14, 0.1, 0.14, 0xffd21f);
    const m = b.mesh(MAT.solid); m.position.set(x, y - 0.8, z); m.rotation.y = this.player.heading + Math.PI; this.scene.add(m);
    const o = { t: 0, gone: false, update: (dt) => { o.t += dt; m.position.y = y - 0.8 * Math.max(0, 1 - o.t * 3); if (o.t > 7) { const k = Math.max(0, 1 - (o.t - 7) * 2); m.scale.setScalar(Math.max(k, 0.001)); if (k <= 0) o.dispose(); } }, dispose: () => { if (o.gone) return; o.gone = true; this.scene.remove(m); m.geometry.dispose(); } };
    return o;
  }
  // The flashlight: at night, on foot, the same beam the cars use shines from Christian's hand.
  updateTorch() {
    const p = this.player, n = this.sky.night;
    this.torchOn = this.mode === 'play' && !p.vehicle && n > 0.35 && this.gear.has('light');
    if (!this.torchOn) return;
    const sp = this.lights.spot, hx = Math.sin(p.heading), hz = Math.cos(p.heading);
    sp.position.set(p.pos.x + hx * 0.4, p.pos.y + 1.5, p.pos.z + hz * 0.4);
    this.lights.spotTarget.position.set(p.pos.x + hx * 14, p.pos.y + 0.1, p.pos.z + hz * 14);
    sp.distance = 46; sp.intensity = n * 150;
  }
  // Your last car, brought to wherever you are.
  callCar() {
    const p = this.player, v = this.lastCar, w = this.world;
    if (this.mode !== 'play' || this.cine || p.vehicle || this.missions.frozen) return;
    if (!this.gear.has('whistle')) return this.ui.toast('The Mayor has a Car Whistle for you. Finish Welcome Home first.');
    if (!v || !this.vehicles.has(v.id)) return this.ui.toast('Drive a car first, then you can call it');
    if (this.time < (this.callT || 0)) return this.ui.toast('Your car is on its way…');
    if (p.pos.y - w.groundAt(p.pos.x, p.pos.z) > 3) return this.ui.toast('It cannot reach you up here');
    // the nearest stretch of road, or failing that the open ground beside you
    let best = null, bd = 70;
    for (const e of w.edges) { const d = segDist(p.pos.x, p.pos.z, e.a.x, e.a.z, e.b.x, e.b.z); if (d < bd) { bd = d; best = e; } }
    let x, z, h;
    if (best) {
      const ex = best.b.x - best.a.x, ez = best.b.z - best.a.z, len = Math.hypot(ex, ez), t = clamp(((p.pos.x - best.a.x) * ex + (p.pos.z - best.a.z) * ez) / (len * len), 0.08, 0.92);
      let dx = ex / len, dz = ez / len; const cx = best.a.x + ex * t, cz = best.a.z + ez * t;
      if ((p.pos.x - cx) * -dz + (p.pos.z - cz) * dx < 0) { dx = -dx; dz = -dz; }   // park on Christian's side of the road
      x = cx - dz * 3.3; z = cz + dx * 3.3; h = Math.atan2(dx, dz);
    } else {
      for (let a = 0; a < 6.3 && x === undefined; a += 0.8) { const tx = p.pos.x + Math.cos(a) * 5, tz = p.pos.z + Math.sin(a) * 5; if (w.groundAt(tx, tz) > WATER_Y + 0.6 && !w.solidAt(tx, tz, 2.4, w.groundAt(tx, tz) + 0.5)) { x = tx; z = tz; h = p.heading; } }
      if (x === undefined) return this.ui.toast('There is no room for it here');
    }
    v.place(x, z, h); this.callT = this.time + 8; this.sound.horn(true); setTimeout(() => this.sound.horn(false), 260);
    this.fx.burst(x, v.pos.y + 0.4, z, 14, 4, 0.8, 0.8, 2.6, 0.9, 0.9, 0.9, 0.35, 0, 0.3);
    this.ui.toast(`Your ${v.spec.name} is here`);
  }
  spawnRocket() { if (!this.vehicles.has('rocket')) this.addVehicle('rocket', 'rocket', { x: P.townHall.x + 16, z: P.townHall.z + 44, h: Math.PI / 2 }); }

  buildBall() {
    const s = this.world.soccer;
    const tex = (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#1d232b'; for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(i * 16 + (j % 2) * 8 + 4, j * 22 + 10, 5.5, 0, 6.3); g.fill(); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 14), new THREE.MeshLambertMaterial({ map: tex })); m.castShadow = true; this.scene.add(m);
    this.ball = { m, r: 0.85, x: s.x, y: 0.85, z: s.z, vx: 0, vy: 0, vz: 0, resetT: 0 };
    m.position.set(s.x, 0.85, s.z);
  }
  updateBall(dt) {
    const b = this.ball, s = this.world.soccer, f = this.focus();
    if (Math.hypot(f.x - b.x, f.z - b.z) > 220) return;
    if (b.resetT > 0 && (b.resetT -= dt) <= 0) { b.x = s.x; b.z = s.z; b.y = 3; b.vx = b.vy = b.vz = 0; }
    b.vy -= 22 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    const g = this.world.groundAt(b.x, b.z) + b.r;
    if (b.y < g) { b.y = g; b.vy = b.vy < -2.5 ? -b.vy * 0.55 : 0; const fr = Math.exp(-0.8 * dt); b.vx *= fr; b.vz *= fr; }
    const c = this._bc ||= { x: 0, z: 0, nx: 0, nz: 0 }; c.x = b.x; c.z = b.z;
    if (b.y < 4 && this.world.collide(c, b.r)) { const vn = b.vx * c.nx + b.vz * c.nz; if (vn < 0) { b.vx -= 1.6 * vn * c.nx; b.vz -= 1.6 * vn * c.nz; } b.x = c.x; b.z = c.z; }
    for (const v of this.vlist) {
      if (Math.abs(v.pos.x - b.x) > 8 || Math.abs(v.pos.z - b.z) > 8 || b.y - v.pos.y > 2.6) continue;
      c.x = b.x; c.z = b.z;
      if (v.pushOut(c, b.r)) { b.x = c.x; b.z = c.z; const sp = Math.hypot(v.vx, v.vz); b.vx = v.vx * 1.15 + c.nx * (3 + sp * 0.25); b.vz = v.vz * 1.15 + c.nz * (3 + sp * 0.25); b.vy = Math.max(b.vy, 2.5 + sp * 0.22); if (sp > 3) this.sound.thud(2); }
    }
    const p = this.player;
    if (!p.vehicle) { const dx = b.x - p.pos.x, dz = b.z - p.pos.z, d = Math.hypot(dx, dz); if (d < b.r + 0.55 && Math.abs(b.y - p.pos.y - 0.8) < 1.6) { const k = 7 + p.speed; b.vx = (dx / d) * k; b.vz = (dz / d) * k; b.vy = 4.5; b.x = p.pos.x + (dx / d) * (b.r + 0.56); b.z = p.pos.z + (dz / d) * (b.r + 0.56); this.sound.thud(1); } }
    const ox = b.x - s.x;
    if (b.resetT <= 0 && Math.abs(ox) > s.halfL && Math.abs(ox) < s.halfL + 2.6 && Math.abs(b.z - s.z) < s.goalHalf && b.y < 4.2) { this.ui.banner('GOAL!', 'Nice shot'); this.state.stats.goals++; this.sound.star(); this.burst(b.x, 3, b.z, 160, 10); b.resetT = 2.2; }
    if (b.resetT <= 0 && (Math.hypot(ox, b.z - s.z) > 150 || b.y < WATER_Y - 1)) b.resetT = 0.01;
    b.m.position.set(b.x, b.y, b.z); b.m.rotation.x += b.vz * dt / b.r; b.m.rotation.z -= b.vx * dt / b.r;
  }

  // ---- menus and saving ----------------------------------------------------------
  bindMenus() {
    $('btn-new').addEventListener('click', () => { this.sound.unlock(); this.newGame(); });
    $('btn-continue').addEventListener('click', () => { this.sound.unlock(); this.continueGame(); });
    $('p-resume').addEventListener('click', () => this.pause(false));
    $('p-quit').addEventListener('click', () => { this.missions.cancel(); this.pause(false); });
    $('p-sound').addEventListener('click', () => { this.state.sound = !this.state.sound; this.sound.setOn(this.state.sound); this.save(); this.ui.pauseMenu(true, !!this.missions.active, this.state.sound); });
    $('p-full').addEventListener('click', () => { try { (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())?.catch?.(() => {}); } catch (e) { /* not allowed here */ } });
    $('p-title').addEventListener('click', () => { this.pause(false); this.missions.cleanup(); this.save(); this.toTitle(); });
    $('p-car').addEventListener('click', () => { this.pause(false); this.callCar(); });
    $('btn-radio').addEventListener('click', () => { if (this.mode === 'play' && this.player.vehicle) this.nextStation(); });
    $('p-book').addEventListener('click', () => { this.pause(false); this.ui.book(true); });
    $('p-tools').addEventListener('click', () => { this.pause(false); this.ui.tools(true); });
    $('p-evolve').addEventListener('click', () => { this.pause(false); this.ui.evolve(true); });
    $('p-photo').addEventListener('click', () => { this.pause(false); this.photoMode(true); });
    for (const [id, key] of [['s-music', 'music'], ['s-sfx', 'sfx'], ['s-quality', 'quality'], ['s-time', 'time']]) $(id).addEventListener('input', (e) => { this.settings[key] = e.target.type === 'range' ? +e.target.value : e.target.value; this.applySettings(); });
    $('ph-done').addEventListener('click', () => this.photoMode(false));
    $('ph-snap').addEventListener('click', () => { if (this.photo) this.takePhoto(); });
    $('photo-save').addEventListener('click', () => this.savePhoto());
    const hold = (id, prop, v) => { const el = $(id), off = () => { this[prop] = 0; }; el.addEventListener('pointerdown', (e) => { e.preventDefault(); this[prop] = v; }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, off); };
    hold('ph-in', 'zoomHeld', -1); hold('ph-out', 'zoomHeld', 1); hold('ph-early', 'timeHeld', -1); hold('ph-late', 'timeHeld', 1);
    this.canvas.addEventListener('pointerdown', () => { this.sound.unlock(); this.canvas.focus(); });
    window.addEventListener('pointerdown', () => { if (this.cine && this.cine.t > 0.6) this.cine.skip = true; });
  }
  loadSave() {
    try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; const s = JSON.parse(raw); if (s && Array.isArray(s.done) && Array.isArray(s.stars)) return s; } catch (e) { /* storage may be unavailable */ }
    return null;
  }
  save() { this.state.time = +this.sky.t.toFixed(4); try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch (e) { /* play on without saving */ } }
  addMoney(n) { this.state.money += n; }
  toTitle() { this.mode = 'title'; this.bots.reset(); this.gear.reset(); this.sound.jet(false); this.sound.engine(false, 0, 0); this.sound.horn(false); this.sound.siren(false); this.ui.title(true, !!this.loadSave()); }

  resetWorld() {
    const p = this.player;
    if (p.vehicle) { p.vehicle.driver = null; p.vehicle = null; }
    p.mesh.visible = true;
    for (const v of this.vlist) { if (v.ai) v.ai.respawn(P.home); else v.goHome(); v.siren = false; }
    if (this.state.rocket) this.spawnRocket();
    else if (this.vehicles.has('rocket')) { const r = this.vehicles.get('rocket'); this.scene.remove(r.group); this.vehicles.delete('rocket'); this.vlist.splice(this.vlist.indexOf(r), 1); }
    p.teleport(P.home.door.x, P.home.door.z, this.world, 0.3);
    this.cam.yaw = 0.3; this.cam.pitch = 0.3; this.cam.idle = 9; this.snapCam = true;
    this.safe = { x: P.home.door.x, z: P.home.door.z, h: 0.3 };
    this.refreshStars(); this.missions.cleanup(); this.routeDirty = true; this.lastCar = null; this.dusk = null;
    this.gear.reset(); this.bots.reset(); this.fires = []; this.dizzy = 0; this.fireWas = false;
    this.spots = TREASURE.map(([x, z], k) => ({ x, z, k, dug: this.state.dug.includes(k) }));
  }
  newGame() {
    this.state = freshState(this.state.sound);
    this.sky.t = 0.33; this.sky.apply();
    this.save(); this.begin(true);
  }
  continueGame() { const s = this.loadSave(); if (s) this.state = mergeState(s); this.sky.t = Number.isFinite(this.state.time) ? this.state.time : 0.36; this.sky.apply(); this.begin(false); }
  begin(fresh) {
    this.resetWorld(); this.mode = 'play'; this.paused = false;
    this.evo.told = false; this.evo.dress();
    this.gear.catchUp();   // a save from before the toolbox gets what its finished missions pay out
    this.timeSet = null; this.applySettings(false); this.sound.setOn(this.state.sound); this.sound.tune(Number.isInteger(this.state.radio) ? this.state.radio : 0); this.ui.title(false); this.canvas.focus();
    // A new game opens with a flight over the island. Tests step the clock by hand and skip it.
    if (fresh && !this.manual) this.startIntro(); else this.greet(fresh);
  }
  greet(fresh) {
    const welcome = this.missions.byId('welcome');
    if (!this.state.done.includes('welcome')) this.ui.dialog({ name: 'Mayor Maple', text: welcome.intro, yes: "Let's go!", onYes: () => this.missions.start(welcome) });
    else if (!fresh) this.ui.toast('Welcome back, Christian!');
  }
  startIntro() {
    const p = this.player.pos, y = p.y + this.player.curb;
    // camera spots and what each one looks at; the last matches the normal view behind Christian
    this.cine = { t: 0, dur: 11, skip: false, keys: [
      [40, 330, 1380, 0, 0, 260], [170, 110, 800, 20, 8, 560], [150, 150, 250, -30, 30, -30], [-110, 75, 340, p.x, 4, p.z],
      [p.x - 1.8, y + 3.45, p.z - 5.84, p.x, y + 1.8, p.z],
    ] };
    this.ui.cine(true);
  }
  endIntro() { this.cine = null; this.ui.cine(false); this.cam.yaw = 0.3; this.cam.pitch = 0.3; this.snapCam = true; this.greet(true); }
  pause(on) { if (this.mode !== 'play') return; this.paused = on; this.ui.pauseMenu(on, !!this.missions.active, this.state.sound); if (on) { this.sound.engine(false, 0, 0); this.sound.horn(false); } }
  resize() { const w = window.innerWidth, h = window.innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  // ---- helpers -------------------------------------------------------------------
  focus() { const v = this.player.vehicle; return v ? v.pos : this.player.pos; }
  freeText() {
    if (this.state.done.length >= MISSIONS.length) return 'Every mission is done. The island is yours!';
    return 'Find a gold star on the map to start a mission';
  }
  nearestVehicle() {
    const p = this.player.pos; let best = null, bd = 2.0;
    for (const v of this.vlist) {
      if (v.locked || Math.abs(v.pos.x - p.x) > 10 || Math.abs(v.pos.z - p.z) > 10 || Math.abs(v.speed) > 5 || Math.abs(v.pos.y - p.y) > 3.2) continue;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      // boats are boarded from a pier or the shallows, so they can be reached from a little further off
      for (const o of v.offsets) { const d = Math.hypot(p.x - (v.pos.x + fx * o), p.z - (v.pos.z + fz * o)) - v.radius - (v.spec.wr ? 0 : 1.3); if (d < bd) { bd = d; best = v; } }
    }
    return best;
  }
  enter(v) {
    const p = this.player; p.vehicle = v; v.driver = 'player'; v.ai = null; p.mesh.visible = false;
    this.sound.door(); this.cam.idle = 9; this.routeDirty = true;
    if (v.spec.wr && !/^(rival|bandit|t\d)/.test(v.id)) this.lastCar = v;
    if (!this.state.driven.includes(v.type)) { this.state.driven.push(v.type); this.save(); }
    const k = this.keyName;
    if (v.spec.style === 'heli') this.ui.toast(`${k('up')} climbs, ${k('down')} comes down, forward flies`, 5);
    else if (!v.spec.wr) this.ui.toast('Forward to go, steer left and right', 3.5);
  }
  // Where the player would stand after hopping out: [x, z, height], or null when nowhere is dry and clear.
  exitSpot(v) {
    const w = this.world, s = v.spec, c = this._ec ||= { x: 0, z: 0, nx: 0, nz: 0 };
    const lx = Math.cos(v.heading), lz = -Math.sin(v.heading), fx = -lz, fz = lx;
    const side = s.wid / 2 + 0.95, end = s.len / 2 + 1;
    const tries = [[lx * side, lz * side], [-lx * side, -lz * side], [-fx * end, -fz * end], [fx * end, fz * end]];
    if (!s.wr) for (const r of s.style === 'heli' ? [side + 1.2, side + 3] : [side + 1.2, side + 3, side + 5, side + 7.5, side + 11]) for (let k = 0; k < 12; k++) tries.push([Math.cos(k * 0.5236) * r, Math.sin(k * 0.5236) * r]);
    const y0 = v.pos.y + v.curb, boat = !s.wr && s.style !== 'heli';
    let best = null;
    for (const [ox, oz] of tries) {
      c.x = v.pos.x + ox; c.z = v.pos.z + oz; const sx = c.x, sz = c.z;
      const g = Math.max(w.groundAt(c.x, c.z), w.roofAt(c.x, c.z, y0 + 0.4));
      if (g < WATER_Y - (boat ? 0.45 : -0.35)) continue;      // dry land, or from a boat the knee-deep shallows
      if (Math.abs(g - y0) > (s.wr ? 2.5 : 3.2)) continue;    // not off the edge of a roof, not up a wall
      w.collide(c, 0.5, g);
      if (Math.hypot(c.x - sx, c.z - sz) > 0.3) continue;
      if (g >= WATER_Y + 0.35) return [c.x, c.z, g];          // the nearest dry spot wins
      if (!best || g > best[2]) best = [c.x, c.z, g];         // otherwise the shallowest water in reach
    }
    return best;
  }
  exit() {
    const p = this.player, v = p.vehicle, w = this.world;
    let spot = this.exitSpot(v);
    if (!spot) {
      if (!v.spec.wr) return this.ui.toast(v.spec.style === 'heli' ? 'No room to hop out here' : 'Sail up to the pier or a beach to hop out');
      spot = [v.pos.x + Math.cos(v.heading) * (v.spec.wid / 2 + 0.95), v.pos.z - Math.sin(v.heading) * (v.spec.wid / 2 + 0.95), undefined];
    }
    v.driver = null; p.vehicle = null; p.mesh.visible = true; v.siren = false; this.sound.siren(false); this.sound.horn(false);
    this.input.down.delete('ShiftLeft');   // the touch Down button disappears with the helicopter
    p.teleport(spot[0], spot[1], w, v.heading, spot[2]); this.sound.door(); this.routeDirty = true;
  }
  // The words for a control, so hints match what the player is holding.
  keyName = (what) => (document.body.classList.contains('touch') ? { up: 'Up', down: 'Down', use: 'Use' } : { up: 'Space', down: 'Shift', use: 'E' })[what];
  talk(def) {
    const ms = this.missions;
    if (!ms.unlocked(def)) {
      if (def.needs && !ms.isDone(def.needs)) return this.ui.dialog({ name: def.giver.name, text: def.needsText, yes: 'OK' });
      const left = def.requires - this.state.done.length; return this.ui.dialog({ name: def.giver.name, text: `${def.locked} (${left} more to go.)`, yes: 'OK' });
    }
    const prize = gearFrom(def.id), gift = prize && !this.gear.owned.includes(prize.id) ? prize : null;
    const sh = ms.isDone(def.id) && SHIFTS[def.id];
    if (sh) return this.ui.dialog({ name: def.giver.name, text: sh.intro, yes: 'Start a shift', alt: 'Play the mission again', no: 'Not now', onYes: () => ms.startShift(def.id), onAlt: () => ms.start(def) });
    this.ui.dialog({ name: def.giver.name, text: def.intro, reward: def.reward, gift, yes: ms.isDone(def.id) ? 'Play again' : 'Start', no: 'Not now', onYes: () => ms.start(def) });
  }
  backOnRoad() {
    const v = this.player.vehicle; if (!v) return;
    if (!v.spec.wr) { v.goHome(); this.snapCam = true; this.sound.step(); return this.ui.toast(v.spec.style === 'heli' ? 'Back at the helipad' : 'Back at the dock'); }
    let best = null, bd = 1e9;
    for (const e of this.world.edges) { const d = segDist(v.pos.x, v.pos.z, e.a.x, e.a.z, e.b.x, e.b.z); if (d < bd) { bd = d; best = e; } }
    const ex = best.b.x - best.a.x, ez = best.b.z - best.a.z, len = Math.hypot(ex, ez);
    const t = clamp(((v.pos.x - best.a.x) * ex + (v.pos.z - best.a.z) * ez) / (len * len), 0.06, 0.94);
    // face whichever way along the road is closest to where the car already points
    let dx = ex / len, dz = ez / len;
    if (dx * Math.sin(v.heading) + dz * Math.cos(v.heading) < 0) { dx = -dx; dz = -dz; }
    v.place(best.a.x + ex * t - dz * 3.3, best.a.z + ez * t + dx * 3.3, Math.atan2(dx, dz));
    this.snapCam = true; this.ui.toast('Back on the road'); this.sound.step();
  }
  splash() {
    const p = this.player, v = p.vehicle, s = this.safe;
    this.sound.splash(); this.ui.flash(); this.ui.toast('Splash! Back to dry land.'); this.state.stats.splashes++;
    { const f = this.focus(); this.fx.burst(f.x, WATER_Y + 0.3, f.z, 30, 5, 0.8, 0.35, 0.9, 1, 1, 1, 0.8, 11, 1.3); this.fx.emit(f.x, WATER_Y + 0.1, f.z, 0, 0, 0, 1.6, 1, 9, 1, 1, 1, 0.6, 0, true); }
    if (v) v.place(s.x, s.z, s.h); else p.teleport(s.x, s.z, this.world, s.h);
    this.snapCam = true;
  }
  mapState() {
    const f = this.focus(), p = this.player, v = p.vehicle, ms = this.missions;
    const givers = [];
    if (!ms.active) for (const g of ms.givers) if (ms.open(g.def)) givers.push({ x: g.def.giver.x, z: g.def.giver.z, done: ms.isDone(g.def.id), locked: !ms.unlocked(g.def) });
    return {
      x: f.x, z: f.z, heading: v ? v.heading : p.heading, yaw: this.cam.yaw, zoom: v ? clamp(0.95 - Math.abs(v.speed) * 0.012, 0.5, 0.95) : 1.05,
      route: this.route, target: this.target, givers, items: ms.items.filter((i) => !i.got), bots: this.bots.list.filter((b) => !b.dead).map((b) => ({ x: b.x, z: b.z, big: !!b.k.boss })),
      rides: this.vlist.filter((r) => !r.spec.wr && r !== v).map((r) => ({ x: r.pos.x, z: r.pos.z, kind: r.spec.style === 'heli' ? 'heli' : 'boat' })),
    };
  }

  // ---- one frame of the game -----------------------------------------------------
  tick(dt) {
    this.time += dt;
    const inp = this.input, ui = this.ui;
    inp.poll(dt);
    this.skyDt = this.mode === 'title' ? dt * 0.6 : this.paused || ui.dialogOpen || ui.mapOpen || ui.bookOpen || ui.toolsOpen || this.photo ? 0 : dt;
    if (this.mode === 'play') {
      if (ui.dialogOpen) { if (inp.pressed('KeyE', 'Enter', 'Space')) ui.answer(true); else if ((inp.pressed('Escape') || (inp.pad.on && inp.pressed('ShiftLeft'))) && ui.dlg && ui.dlg.no) ui.answer(false); }
      else if (ui.mapOpen) { if (inp.pressed('KeyM', 'Escape')) ui.map(false); }
      else if (ui.bookOpen) { if (inp.pressed('KeyB', 'Escape')) ui.book(false); }
      else if (ui.toolsOpen) ui.toolsKeys(inp);
      else if (this.photo) this.photoStep(dt);
      else if (this.paused) { if (inp.pressed('Escape', 'KeyP')) this.pause(false); }
      else if (this.cine) {
        const c = this.cine; c.t += dt;
        if (c.skip || c.t >= c.dur || (c.t > 0.4 && inp.hit.size)) this.endIntro(); else this.simulate(dt, IDLE);
      } else {
        if (inp.pressed('Escape', 'KeyP')) this.pause(true);
        else if (inp.pressed('KeyM')) ui.map(true);
        else if (inp.pressed('KeyB')) ui.book(true);
        else if (inp.pressed('KeyG')) ui.tools(true);
        else if (inp.pressed('KeyX')) ui.evolve(true);
        else if (inp.pressed('KeyT')) this.photoMode(true);
        else this.simulate(dt, inp.read());
      }
    } else {
      if ((inp.pressed('Enter') || (inp.pad.on && inp.pressed('Space', 'Escape'))) && !$('btn-new').disabled) { this.sound.unlock(); if (this.loadSave()) this.continueGame(); else this.newGame(); inp.endFrame(); return; }
      // title screen: the town carries on in the background
      for (const v of this.vlist) if (v.ai) v.step(dt, v.ai.control(dt, this.vlist, null));
      collideVehicles(this.vlist);
    }
    this.world.update(dt, this.time);
    { const cp = this.camera.position; for (const g of this.missions.givers) g.npc.update(dt, this.player.pos.x, this.player.pos.z, cp.x, cp.z); }
    this.updateConfetti(dt);
    this.updateCamera(dt);
    const f = this.focus();
    this.water.update(this.time);
    this.world.cloudMat.color.copy(this.sky.col.cloud);
    this.lights.update(dt, this.time, this.sky.night, this.vlist, this.mode === 'play' ? this.player.vehicle : null, f.x, f.z);
    this.updateTorch();
    const live = this.paused || ui.dialogOpen || ui.mapOpen || ui.bookOpen || ui.toolsOpen || this.photo ? 0 : dt;
    this.updateFx(live); this.updateLife(live); this.progress.update(live); this.updateSound(live);
    if (this.dusk && live) { const sky = this.sky; sky.t = Math.min(this.dusk.to, sky.t + live * 0.05); sky.apply(); }
    ui.clock(this.sky.clock(), this.sky.night > 0.5);
    ui.tick(dt);
    inp.endFrame();
  }

  simulate(dt, inp) {
    const p = this.player, w = this.world, ms = this.missions, ui = this.ui, snd = this.sound;
    const n = dt > 1 / 70 ? (dt > 1 / 35 ? 3 : 2) : 1, h = dt / n;
    let drowned = false; const hold = ms.frozen;
    // the tool in hand (F, or the right trigger on foot), and what the worn tools change about walking
    const fire = !!inp.fire || (!p.vehicle && !!inp.rt), mod = this.gear.update(dt, { fire, pressed: fire && !this.fireWas }, !p.vehicle);
    this.fireWas = fire; this.dizzy = Math.max(0, this.dizzy - dt); this.evo.update();
    if (p.vehicle && p.vehicle.spec.wr) this.turbo(p.vehicle, dt);
    for (let k = 0; k < n; k++) {
      const pv = p.vehicle;
      const car = pv ? { throttle: hold ? 0 : inp.gas ?? inp.my, steer: -inp.mx, handbrake: hold || inp.handbrake, boost: pv.turboT > 0 ? 1.4 : 1, up: inp.up ?? inp.handbrake, down: inp.down ?? inp.run } : null;
      for (const v of this.vlist) {
        if (v === pv) v.step(h, car);
        else if (v.ai) v.step(h, v.ai.control(h, this.vlist, pv || p.pos.y > 3 ? null : p.pos));
        else if (Math.abs(v.vx) + Math.abs(v.vz) > 0.02 || !v.onGround || Math.abs(v.pos.x - p.pos.x) + Math.abs(v.pos.z - p.pos.z) < 60) v.step(h, null);
      }
      collideVehicles(this.vlist);
      if (pv) { p.pos.copy(pv.pos); p.heading = pv.heading; }
      else { const step = k === 0 ? inp : { ...inp, jump: false }; if (p.update(h, step, this.cam.yaw, w, this.vlist, mod)) drowned = true; if (p.jumped) { p.jumped = false; snd.jump(); } }
    }
    const pv = p.vehicle, f = this.focus();
    this.bots.update(dt, p, !pv);
    if (p.jetting && !pv) this.state.stats.jet += dt;

    // water and the last safe spot
    if (drowned || (pv && pv.inWater)) this.splash();
    else if ((this.safeT -= dt) <= 0) {
      this.safeT = 0.5;
      const ok = pv ? pv.onGround && pv.pos.y > WATER_Y + 0.9 : p.onGround && p.pos.y > WATER_Y + 0.9;
      if (ok && w.platAt(f.x, f.z) === -Infinity && w.roofAt(f.x, f.z, 1e6) === -Infinity) this.safe = { x: f.x, z: f.z, h: pv ? pv.heading : p.heading };
    }
    for (const v of this.vlist) {
      if (v !== pv && v.inWater) { if (v.ai) v.ai.respawn(f); else v.goHome(); }
      if (v.ai && v.ai.stuckT > 12 && Math.hypot(v.pos.x - f.x, v.pos.z - f.z) > 110) { v.ai.respawn(f); v.ai.stuckT = 0; }
      if (v.impact > 3.5) { if (Math.hypot(v.pos.x - f.x, v.pos.z - f.z) < 60) { snd.thud(v.impact); if (v.impact > 7) this.fx.burst(v.pos.x + Math.sin(v.heading) * v.spec.len * 0.4, v.pos.y + v.curb + 0.8, v.pos.z + Math.cos(v.heading) * v.spec.len * 0.4, 12, 7, 0.4, 0.16, 0.06, 1, 0.82, 0.3, 1, 16, 0.5); } if (v === pv) { this.cam.shake = Math.min(0.5, v.impact * 0.03); this.input.rumble(v.impact * 0.08, 0.3, 180); } }
      v.impact = 0;
      if (v.landed) { if (v === pv) { snd.thud(4); this.cam.shake = 0.25; this.input.rumble(0.5, 0.5, 200); if (v.landed > 0.9) ui.toast('Big air!'); const st = this.state.stats; if (v.landed > 0.6) st.jumps++; st.air = Math.max(st.air, +v.landed.toFixed(2)); } const c = this.dust(v.pos.x, v.pos.z); this.fx.burst(v.pos.x, v.pos.y + v.curb + 0.3, v.pos.z, 16, 5, 0.9, 0.8, 3.2, c[0], c[1], c[2], 0.36, 0, 0.25); v.landed = 0; }
    }

    // what E does right now
    let key = '', text = '';
    const inPaint = pv && Math.hypot(pv.pos.x - P.garage.paint.x, pv.pos.z - (P.garage.paint.z - 3)) < 5.5;
    const canExit = pv && Math.abs(pv.speed) < 6 && (pv.spec.wr ? true : pv.onGround && !!this.exitSpot(pv));
    if (pv) {
      if (inPaint && Math.abs(pv.speed) < 4) { key = 'E'; text = 'New paint job ($25)'; }
      else if (canExit) { key = 'E'; text = 'Hop out'; }
    } else {
      const near = this.nearestVehicle(), giver = ms.giverNear(p.pos.x, p.pos.z);
      if (giver) { key = 'E'; text = `Talk to ${giver.giver.name}`; this._act = () => this.talk(giver); }
      else if (near) { key = 'E'; text = `${near.spec.style === 'heli' ? 'Fly' : near.spec.wr ? 'Drive' : 'Sail'} the ${near.spec.name}`; this._act = () => this.enter(near); }
      else if (this.sky.night > 0.45 && this.sky.mode === 'auto' && Math.hypot(p.pos.x - P.home.x, p.pos.z - (P.home.z - 7.6)) < 2.8) { key = 'E'; text = 'Sleep until morning'; this._act = () => this.sleep(); }
    }
    ui.prompt(key, text);
    if (inp.action) {
      if (pv) {
        if (inPaint && Math.abs(pv.speed) < 4) this.paint(pv);
        else if (canExit) this.exit();
        else ui.toast(pv.spec.style === 'heli' ? 'Land first, then hop out' : pv.spec.wr ? 'Slow down to hop out' : 'Sail up to the pier or a beach to hop out');
      } else if (text) this._act();
    }
    if (this.input.pressed('KeyR') && p.vehicle) this.backOnRoad();
    if (this.input.pressed('KeyC')) { this.cam.zi = (this.cam.zi + 1) % 3; this.cam.zoom = [1, 1.5, 0.72][this.cam.zi]; }
    if (this.input.pressed('KeyV')) this.callCar();
    if (this.input.pressed('KeyQ') && !pv) this.gear.cycle();
    if (this.input.pressed('KeyN') && pv) this.nextStation();
    // things worth remembering for the sticker book
    { const st = this.state.stats; if (pv && pv.spec.wr && pv.onGround) st.speed = Math.max(st.speed, Math.round(Math.abs(pv.speed) * 2.237)); if (this.sky.night > 0.97) st.night = 1;
      if (pv && pv.spec.style === 'heli' && pv.onGround && !st.roof && Math.hypot(pv.pos.x - w.roofPad.x, pv.pos.z - w.roofPad.z) < 12 && Math.abs(pv.pos.y - w.roofPad.y) < 1) st.roof = 1; }

    ms.update(dt);

    // free-roam stars
    const reach = p.vehicle ? 3.9 : 2.3, magnet = this.gear.has('magnet');
    for (const m of this.starMeshes) {
      if (!m.visible) continue;
      m.rotation.y += dt * 2; m.position.y = m.userData.y + Math.sin(this.time * 2 + m.userData.k) * 0.25;
      if (magnet) {
        // the Super Magnet: a star close by comes to Christian
        const dx = f.x - m.position.x, dz = f.z - m.position.z, d = Math.hypot(dx, dz), u = m.userData;
        if (d < 15 && d > 0.01 && Math.abs(u.y - f.y - 1) < 9) { const st = Math.min(d, 15 * dt); m.position.x += (dx / d) * st; m.position.z += (dz / d) * st; u.y += clamp(f.y + 1.2 - u.y, -7 * dt, 7 * dt); }
      }
      if (Math.abs(m.position.x - f.x) < reach && Math.abs(m.position.z - f.z) < reach && Math.abs(m.userData.y - f.y - 1) < 3.6) {
        m.visible = false; this.state.stars.push(m.userData.k); this.starList[m.userData.k].found = true; this.addMoney(25); this.save();
        snd.star(); this.burst(m.position.x, m.position.y, m.position.z, 70, 7);
        const got = this.state.stars.length;
        if (got === this.starCount) { ui.banner(`All ${this.starCount} stars!`, 'You found every one  +$500'); this.addMoney(500); this.save(); snd.win(); }
        else ui.toast(`Star ${got} of ${this.starCount}!  +$25`);
      }
    }
    // pickups and giver markers
    this.anim = this.anim.filter((m) => m.parent);
    for (const m of this.anim) {
      if (m.userData.bob) { m.position.y = m.userData.baseY + Math.sin(this.time * 1.8 + m.position.x) * 0.12; m.rotation.y += dt * 0.6; }
      if (m.userData.puppy) { const t = this.time * 6 + m.position.x; m.position.y = m.userData.baseY + Math.max(0, Math.sin(t)) * 0.22; m.userData.tail.rotation.z = Math.sin(t * 2.2) * 0.7; m.rotation.y += angDiff(Math.atan2(f.x - m.position.x, f.z - m.position.z), m.rotation.y) * Math.min(1, dt * 4); }
    }
    if (ms.active && ms.active.id === 'puppies' && (this.barkT -= dt) <= 0) { this.barkT = 2.2 + Math.random() * 2; const t = ms.target(); if (t && t.item && Math.hypot(t.x - f.x, t.z - f.z) < 32) snd.bark(); }
    for (const g of ms.givers) {
      const open = ms.open(g.def) && !ms.active; g.marker.visible = open;
      if (open) { g.marker.rotation.y += dt * 1.8; g.marker.position.y = g.baseY + Math.sin(this.time * 2.4) * 0.18; g.marker.material = ms.isDone(g.def.id) ? this.doneMat : ms.unlocked(g.def) ? this.starMat : this.lockMat; }
    }
    for (const n of ms.temps) n.update(dt, f.x, f.z);
    if (this.fireworksT > 0) { this.fireworksT -= dt; if (Math.random() < dt * 3.2) { this.burst(P.townHall.x + (Math.random() - 0.5) * 70, 24 + Math.random() * 22, P.townHall.z + 20 + (Math.random() - 0.5) * 60, 110, 13); if (Math.random() < 0.5) snd.thud(3); } }
    this.updateBall(dt);

    // objective, route line, beacon
    const t = this.target = ms.target();
    if ((this.routeT -= dt) <= 0 || this.routeDirty) {
      this.routeT = 1.2; this.routeDirty = false;
      const far = t && Math.hypot(t.x - f.x, t.z - f.z) > 45;
      // boats and the helicopter do not follow roads: draw the straight line instead
      this.route = !far ? null : pv && !pv.spec.wr ? [[f.x, f.z], [t.x, t.z]] : w.route(f.x, f.z, t.x, t.z);
    }
    if (t) {
      const r = Math.max(1.6, (t.r || 3) * (t.veh ? 0.7 : 0.55)), gy = t.veh || t.roof ? t.y : w.groundAt(t.x, t.z) + w.curbAt(t.x, t.z);
      this.hoop.visible = !!t.ring;
      if (t.ring) { this.hoop.position.set(t.x, t.y, t.z); this.hoop.scale.setScalar(t.r * 0.85); this.hoop.rotation.y = Math.atan2(f.x - t.x, f.z - t.z); }
      this.beacon.visible = this.ring.visible = !t.quiet;   // no column of light on something nobody could miss
      this.beacon.position.set(t.x, gy + 45, t.z); this.beacon.scale.set(r, 90, r);
      const pulse = 1 + Math.sin(this.time * 4) * 0.08; this.ring.position.set(t.x, gy + 0.25, t.z); this.ring.scale.setScalar(r * pulse);
      this.beacon.material.opacity = clamp(Math.hypot(t.x - f.x, t.z - f.z) / 40, 0.1, 0.32);
    } else this.beacon.visible = this.ring.visible = this.hoop.visible = false;

    // sound
    snd.heli(!!pv && pv.spec.style === 'heli', pv ? pv.rotor || 0 : 0);
    if (pv && pv.spec.style === 'heli') { snd.engine(false, 0, 0); snd.horn(inp.horn); }
    else if (pv) {
      const sp = Math.abs(pv.speed), top = pv.spec.max, gear = (sp / top) * 4.2, rpm = 0.18 + 0.82 * (gear % 1) * (0.55 + 0.45 * Math.min(1, gear / 4)) + Math.min(0.2, gear * 0.05);
      snd.engine(true, clamp(rpm, 0, 1.3) * (pv.spec.mass > 2500 ? 0.75 : 1), Math.abs(inp.my));
      if (pv.type === 'police') { if (this.input.pressed('KeyH')) { pv.siren = !pv.siren; snd.siren(pv.siren); } }
      else if (pv.type === 'icecream') { if (this.input.pressed('KeyH')) snd.jingle(); }
      else snd.horn(inp.horn, pv.spec.mass > 2500);
    } else { snd.engine(false, 0, 0); snd.horn(false); }

    // HUD
    ui.objective(ms.objective());
    ui.stats(this.state.money, this.state.stars.length, this.starCount, this.state.done.length, MISSIONS.length);
    ui.speed(pv ? Math.round(Math.abs(pv.speed) * 2.237) : null, pv ? (pv.spec.style === 'heli' ? `${pv.spec.name} \u00b7 ${Math.round((pv.alt * 3.281) / 10) * 10} ft up` : pv.spec.name) : '', pv ? (pv.spec.style === 'heli' ? 'heli' : pv.spec.wr ? 'car' : 'boat') : null);
    const chip = this.gear.chip(!pv), hands = pv ? 0 : this.gear.hands.length;
    if (chip) chip.next = hands > 1;
    ui.gear(chip);
    ui.pads({ onFoot: !pv, fire: chip && chip.key ? chip : null, swap: hands > 1, fuel: !pv && this.gear.has('jetpack') ? this.gear.fuel : null, five: !!pv && !!chip });
    const w2s = ui.drawMinimap(this.mapState());
    if (t) {
      const [a, b] = w2s(t.x, t.z), d = Math.hypot(t.x - f.x, t.z - f.z), dy = t.ring || t.roof ? t.y - f.y : 0;
      ui.pointer(d > 14 || Math.abs(dy) > 8 ? Math.atan2(a - 196, -(b - 196)) : null, d, dy);
    } else ui.pointer(null);
  }

  // The radio plays in anything you drive; the island hums along underneath.
  updateSound(dt) {
    const snd = this.sound, play = this.mode === 'play', p = this.player, pv = play ? p.vehicle : null, f = this.focus(), w = this.world;
    snd.music(!!pv && !this.cine);
    this.ui.radio(pv ? snd.radio ? snd.radio.name : 'Radio' : null);
    if (dt <= 0 || !play) return snd.ambience(dt, QUIET);
    const night = this.sky.night, r = w.shapeR(f.x, f.z), up = f.y - Math.max(w.groundAt(f.x, f.z), WATER_Y), town = Math.abs(f.x) < 320 && Math.abs(f.z) < 320, inside = pv && pv.spec.wr ? 0.55 : 1;
    AMB.sea = clamp((r - 0.8) / 0.16, 0, 1) * clamp(1 - up / 120, 0.25, 1) * (pv && !pv.spec.wr && pv.spec.style !== 'heli' ? 1 : 0.8);
    AMB.wind = clamp(up / 110, 0, 1) * 0.9 + (pv ? clamp((Math.abs(pv.speed) - 22) / 40, 0, 0.5) : 0) + (f.y > 60 ? 0.3 : 0);
    AMB.birds = (1 - night) * (town ? 0.45 : 1) * clamp(1 - up / 40, 0, 1) * inside * (r > 0.97 ? 0.2 : 1);
    AMB.crickets = clamp((night - 0.5) * 2, 0, 1) * (town ? 0.6 : 1) * clamp(1 - up / 40, 0, 1) * inside * (r > 0.97 ? 0 : 1);
    snd.ambience(dt, AMB);
    // footsteps: one for every stride
    if (!pv && p.onGround && p.speed > 1) { if ((this.stride = (this.stride || 0) + p.speed * dt) > (p.speed > 5 ? 1.3 : 0.9)) { this.stride = 0; snd.footstep(w.surfaceAt(p.pos.x, p.pos.z) !== 0); } }
  }
  nextStation() {
    const snd = this.sound, n = STATIONS.length, i = snd.station + 1 >= n ? -1 : snd.station + 1;
    snd.tune(i); this.state.radio = i; this.save(); snd.click(); this.ui.toast(i < 0 ? 'Radio off' : `\u266a ${STATIONS[i].name}`, 1.6);
  }
  // People, birds, animals and Scout.
  updateLife(dt) {
    const play = this.mode === 'play', p = this.player, pv = play ? p.vehicle : null, f = play ? this.focus() : TITLE_LOOK, night = this.sky.night;
    const honk = play && !!pv && this.input.pressed('KeyH');
    this.crowd.update(dt, f.x, f.z, this.vlist, pv, p, night, honk, this.sound);
    this.birds.update(dt, this.time, f.x, f.z, 1 - night * 0.7, play ? this.sound : null);
    this.animals.update(dt, f.x, f.z, this.vlist, pv, honk, this.sound);
    if (this.animals.mooed) { this.animals.mooed = false; this.state.stats.moos++; }
    this.pet.on = play && !this.cine && this.state.done.includes('puppies');
    const found = this.pet.update(dt, p, !!pv, this.starList, this.sound);
    if (found && found !== this.petFound) { this.petFound = found; this.ui.toast('Scout has sniffed out a gold star!'); }
  }
  // Boost pads: cross the arrows the way they point and the car surges forward for a moment.
  turbo(v, dt) {
    v.turboT = Math.max(0, (v.turboT || 0) - dt);
    if (!v.onGround || v.speed < 4 || v.turboT > 1.3) return;
    const hx = Math.sin(v.heading), hz = Math.cos(v.heading);
    for (const b of this.world.boosts) {
      const dx = v.pos.x - b.x, dz = v.pos.z - b.z; if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue;
      const fx = Math.sin(b.h), fz = Math.cos(b.h);
      if (Math.abs(dx * fx + dz * fz) > 4.4 || Math.abs(dx * fz - dz * fx) > 2.9 || hx * fx + hz * fz < 0.5) continue;
      v.turboT = 2.1; v.vx += hx * 9; v.vz += hz * 9;
      this.sound.boost(); this.cam.shake = 0.16; this.state.stats.boosts++; this.input.rumble(0.3, 0.9, 420);
      return;
    }
  }
  dust(x, z) {
    const w = this.world, s = w.surfaceAt(x, z);
    return w.heightAt(x, z) > 56 ? SNOW : s === 0 ? GREY : s === 2 ? SAND : DIRT;
  }
  // Dust, tyre smoke and marks, spray and wakes, rotor wash, chimney smoke.
  updateFx(dt) {
    const fx = this.fx;
    if (dt > 0) {
      const w = this.world, f = this.focus(), R = Math.random, pv = this.mode === 'play' ? this.player.vehicle : null;
      let skid = 0, wash = 0;
      const cp = this.camera.position;
      for (const v of this.vlist) {
        v.lod((v.pos.x - cp.x) ** 2 + (v.pos.y - cp.y) ** 2 + (v.pos.z - cp.z) ** 2);
        const dx = v.pos.x - f.x, dz = v.pos.z - f.z;
        if (dx * dx + dz * dz > 25600) { v.mark = null; continue; }
        const s = v.spec, sp = Math.abs(v.speed), hx = Math.sin(v.heading), hz = Math.cos(v.heading);
        v.fxT = Math.min(0.2, (v.fxT || 0) + dt);
        if (s.style === 'heli') {
          // rotor wash: dust on land, spray over water
          const sup = v.support(), up = v.pos.y - sup;
          if (v.rotor > 0.4 && up < 15) {
            const wet = sup < WATER_Y + 0.6, n = Math.floor(v.fxT * 60 * (1 - up / 15) * v.rotor); if (n > 0) v.fxT = 0;
            const c = wet ? SNOW : this.dust(v.pos.x, v.pos.z);
            for (let i = 0; i < n; i++) { const a = R() * 6.283, d = 2.5 + R() * 3.5, q = 6 + R() * 5; fx.emit(v.pos.x + Math.cos(a) * d, sup + 0.25, v.pos.z + Math.sin(a) * d, Math.cos(a) * q, 0.4 + R() * 1.4, Math.sin(a) * q, 0.8 + R() * 0.5, 0.9, 3.4, c[0], c[1], c[2], wet ? 0.5 : 0.3); }
          }
          continue;
        }
        if (!s.wr) {
          // boats: spray off the bow, foam spreading out behind
          if (sp > 1.2) {
            const k = clamp(sp / s.max, 0, 1), bx = v.pos.x + hx * s.len * 0.42, bz = v.pos.z + hz * s.len * 0.42, tx = v.pos.x - hx * s.len * 0.5, tz = v.pos.z - hz * s.len * 0.5;
            const n = Math.floor(v.fxT * (10 + 46 * k)); if (n > 0) v.fxT = 0;
            for (let i = 0; i < n; i++) {
              const sd = R() < 0.5 ? 1 : -1, out = (2 + R() * 3.5) * k;
              if (k > 0.3) fx.emit(bx, WATER_Y + 0.35, bz, v.vx * 0.55 + hz * sd * out, 1.4 + R() * 2.6 * k, v.vz * 0.55 - hx * sd * out, 0.45 + R() * 0.3, 0.3, 0.95, 1, 1, 1, 0.7, 9);
              fx.emit(tx + hz * sd * R() * s.wid * 0.5, WATER_Y + 0.1, tz - hx * sd * R() * s.wid * 0.5, hz * sd * (0.5 + k), 0, -hx * sd * (0.5 + k), 1.8 + k * 1.6, 1.3, 3 + 4 * k, 1, 1, 1, 0.42, 0, true);
            }
            if (v === pv) wash = k;
          }
          continue;
        }
        if (!v.onGround) { v.mark = null; continue; }
        const hw = v.wb / 2, tw = v.tw, rx = v.pos.x - hx * hw, rz = v.pos.z - hz * hw, y = v.pos.y + v.curb;
        if (v.surface === 0 && sp > 5 && (v.slip > 3 || (v.braking && sp > 8))) {
          // sliding on tarmac: smoke and black marks from the back wheels
          const amt = clamp(Math.max(v.slip / 8, v.braking ? 0.55 : 0), 0.25, 1);
          if (v === pv) { skid = amt; this.state.stats.drift += dt; }
          const lx = rx + hz * tw, lz = rz - hx * tw, qx = rx - hz * tw, qz = rz + hx * tw, m = v.mark;
          if (!m) v.mark = [lx, lz, qx, qz];
          else if (Math.hypot(lx - m[0], lz - m[1]) > 0.55) { const a = 0.42 + 0.4 * amt; this.skids.add(m[0], m[1], lx, lz, y + 0.04, 0.26, a); this.skids.add(m[2], m[3], qx, qz, y + 0.04, 0.26, a); v.mark = [lx, lz, qx, qz]; }
          const n = Math.floor(v.fxT * 30 * amt); if (n > 0) v.fxT = 0;
          for (let i = 0; i < n; i++) { const sd = R() < 0.5 ? 1 : -1; fx.emit(rx + hz * tw * sd, y + 0.25, rz - hx * tw * sd, v.vx * 0.25 + R() - 0.5, 0.7 + R(), v.vz * 0.25 + R() - 0.5, 0.9 + R() * 0.6, 0.6, 2.9, 0.94, 0.94, 0.94, 0.32); }
        } else {
          v.mark = null;
          if (v.surface !== 0 && sp > 5) {
            // off the road: a trail of dust, sand or snow
            const c = this.dust(v.pos.x, v.pos.z), n = Math.floor(v.fxT * Math.min(24, sp * 1.2)); if (n > 0) v.fxT = 0;
            for (let i = 0; i < n; i++) fx.emit(rx + (R() - 0.5) * s.wid, y + 0.2, rz + (R() - 0.5) * s.wid, v.vx * 0.3 + (R() - 0.5) * 1.6, 0.5 + R() * 1.3, v.vz * 0.3 + (R() - 0.5) * 1.6, 0.9 + R() * 0.8, 0.8, 3.4, c[0], c[1], c[2], 0.42);
          }
        }
        if (v.turboT > 0) {
          // turbo: fire out of the back
          const ex = v.pos.x - hx * s.len * 0.5, ez = v.pos.z - hz * s.len * 0.5, n = 1 + (R() < 0.5 ? 1 : 0);
          for (let i = 0; i < n; i++) fx.emit(ex + (R() - 0.5) * 0.8, y + 0.45 + R() * 0.2, ez + (R() - 0.5) * 0.8, v.vx - hx * (5 + R() * 4), R(), v.vz - hz * (5 + R() * 4), 0.22 + R() * 0.16, 0.7, 0.25, 1, 0.45 + R() * 0.4, 0.1, 0.85);
        }
      }
      // smoke from every third chimney near the camera, and the campfire
      if ((this.ambT = (this.ambT || 0) + dt) > 0.32) {
        this.ambT = 0;
        const c = this.camera.position, ch = w.chimneys;
        for (let i = 0; i < ch.length; i += 3) { const h = ch[i]; if (Math.abs(h[0] - c.x) > 190 || Math.abs(h[2] - c.z) > 190) continue; fx.emit(h[0], h[1], h[2], 0.45 + R() * 0.3, 1 + R() * 0.5, 0.2, 4.6, 0.6, 3, 0.84, 0.84, 0.86, 0.22); }
        if (Math.abs(P.camp.x - c.x) < 260 && Math.abs(P.camp.z - c.z) < 260) {
          fx.emit(P.camp.x + (R() - 0.5) * 0.5, 1.1, P.camp.z + (R() - 0.5) * 0.5, 0.3, 1.2 + R() * 0.5, 0.1, 3.6, 0.5, 2.4, 0.62, 0.6, 0.58, 0.3);
          for (let i = 0; i < 2; i++) fx.emit(P.camp.x + (R() - 0.5) * 0.7, 0.9, P.camp.z + (R() - 0.5) * 0.7, (R() - 0.5) * 0.8, 1.6 + R() * 1.4, (R() - 0.5) * 0.8, 0.9 + R() * 0.5, 0.2, 0.08, 1, 0.55 + R() * 0.3, 0.12, 0.95);
        }
      }
      this.sound.skid(pv ? skid : 0); this.sound.water(pv ? wash : 0);
      const turbo = !!pv && pv.turboT > 0;
      if (turbo !== this.turboOn) { this.turboOn = turbo; document.body.classList.toggle('turbo', turbo); }
      this.ui.lines(pv && this.mode === 'play' ? clamp((Math.abs(pv.speed) - 30) / 22, 0, 0.55) + (turbo ? 0.4 : 0) : 0);
    }
    // smoke in the dark is dark
    fx.update(dt, 1 - this.sky.night * 0.62);
  }

  sleep() {
    this.ui.flash(); this.sky.t = 0.285; this.sky.apply(); this.state.stats.sleeps++; this.save();
    this.sound.star(); this.ui.toast('Good morning, Christian!');
  }
  paint(v) {
    if (this.state.money < 25) return this.ui.toast('Paint costs $25. Finish a mission first.');
    let c; do { c = PAINT_COLORS[Math.floor(Math.random() * PAINT_COLORS.length)]; } while (c === v.color);
    this.addMoney(-25); v.setColor(c); this.state.stats.paints++; this.save(); this.sound.spray(); this.ui.toast('Fresh paint!'); this.burst(v.pos.x, v.pos.y + 2, v.pos.z, 60, 5);
  }

  updateCamera(dt) {
    const cam = this.cam, c = this.camera, w = this.world;
    if (this.mode === 'title') {
      const a = this.time * 0.045 + 0.8;
      c.position.set(Math.cos(a) * 340 - 20, 120, Math.sin(a) * 340 - 10); c.lookAt(-10, 0, -20); c.fov = 55; c.updateProjectionMatrix();
      this.sky.update(this.skyDt, c, -10, 0, -20); return;
    }
    if (this.cine) {
      // the opening flight: a smooth curve through a handful of camera spots, easing in and out
      const k = this.cine.keys, n = k.length - 1, u = smoothstep(0, 1, this.cine.t / this.cine.dur) * n, i = Math.min(n - 1, Math.floor(u)), t = u - i;
      const at = (j, q) => k[clamp(j, 0, n)][q];
      const cr = (q) => { const a = at(i - 1, q), b = at(i, q), d = at(i + 1, q), e = at(i + 2, q); return 0.5 * (2 * b + (d - a) * t + (2 * a - 5 * b + 4 * d - e) * t * t + (3 * b - a - 3 * d + e) * t * t * t); };
      const x = cr(0), z = cr(2), y = Math.max(cr(1), w.groundAt(x, z) + 2.2), lx = cr(3), ly = cr(4), lz = cr(5);
      c.position.set(x, y, z); c.lookAt(lx, ly, lz);
      if (c.fov !== 58) { c.fov = 58; c.updateProjectionMatrix(); }
      cam.tx = lx; cam.ty = ly; cam.tz = lz;
      this.sky.update(this.skyDt, c, lx, ly, lz); return;
    }
    if (this.photo) {
      const ph = this.photo, f = this.focus(), cp = Math.cos(ph.pitch), ty = f.y + 1.4 + ph.up;
      let x = f.x - Math.sin(ph.yaw) * cp * ph.d, y = ty + Math.sin(ph.pitch) * ph.d, z = f.z - Math.cos(ph.yaw) * cp * ph.d;
      y = Math.max(y, w.groundAt(x, z) + 0.3, WATER_Y + 0.3);
      c.position.set(x, y, z); c.lookAt(f.x, ty, f.z); if (c.fov !== 55) { c.fov = 55; c.updateProjectionMatrix(); }
      this.sky.update(0, c, f.x, f.y, f.z); return;
    }
    const p = this.player, v = p.vehicle, inp = this.input, frozen = this.paused || this.ui.dialogOpen || this.ui.mapOpen || this.ui.bookOpen;
    if (!frozen && (inp.lookX || inp.lookY)) { cam.yaw -= inp.lookX * 0.006; cam.pitch = clamp(cam.pitch + inp.lookY * 0.004, -0.12, 1.25); cam.idle = 0; }
    else if (!frozen) cam.idle += dt;
    let tx, ty, tz, dist;
    if (v) {
      tx = v.pos.x; ty = v.pos.y + v.curb + 1.0 + v.spec.h * 0.55 + v.spec.clr; tz = v.pos.z;
      dist = (6 + v.spec.len * 0.9 + Math.abs(v.speed) * 0.07) * cam.zoom;
      if (cam.idle > 1 && !frozen) { cam.yaw += angDiff(v.heading, cam.yaw) * Math.min(1, dt * (2.2 + Math.min(Math.abs(v.speed), 30) * 0.09)); cam.pitch = damp(cam.pitch, 0.27 + (v.alt ? clamp(v.alt / 160, 0, 0.4) : 0), 1.6, dt); }
    } else {
      tx = p.pos.x; ty = p.pos.y + p.curb + 1.55; tz = p.pos.z; dist = 6.4 * cam.zoom;
      if (!frozen && cam.idle > 0.5) { const k = inp.virtual ? inp.virtual.mx || 0 : inp.read().mx; cam.yaw -= k * 1.5 * dt; }
      if (!frozen && cam.idle > 4) cam.pitch = damp(cam.pitch, 0.3, 1, dt);
    }
    if (this.snapCam || Math.hypot(tx - cam.tx, tz - cam.tz) > 40) { cam.tx = tx; cam.ty = ty; cam.tz = tz; cam.d = dist; this.snapCam = false; }
    cam.tx = damp(cam.tx, tx, 22, dt); cam.ty = damp(cam.ty, ty, 12, dt); cam.tz = damp(cam.tz, tz, 22, dt);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    let d = dist; const steps = 14;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * dist, x = cam.tx - fx * cp * t, z = cam.tz - fz * cp * t, y = cam.ty + sp * t;
      if (w.solidAt(x, z, 0.5, y) || y < w.groundAt(x, z) + 0.3) { d = Math.max(1.4, t - (dist / steps) * 1.3); break; }
    }
    cam.d = d < cam.d ? d : damp(cam.d, d, 4, dt);
    let cx = cam.tx - fx * cp * cam.d, cy = cam.ty + sp * cam.d, cz = cam.tz - fz * cp * cam.d;
    cy = Math.max(cy, w.groundAt(cx, cz) + 0.45, WATER_Y + 0.5);
    if (cam.shake > 0.001) { cx += (Math.random() - 0.5) * cam.shake; cy += (Math.random() - 0.5) * cam.shake; cam.shake *= Math.exp(-8 * dt); }
    c.position.set(cx, cy, cz); c.lookAt(cam.tx, cam.ty + 0.25, cam.tz);
    const fov = 60 + (v ? Math.min(14, Math.abs(v.speed) * 0.3) : 0);
    if (Math.abs(fov - c.fov) > 0.05) { c.fov = damp(c.fov, fov, 4, dt); c.updateProjectionMatrix(); }
    this.sky.update(this.skyDt, c, cam.tx, cam.ty, cam.tz);
  }

  // Drop detail when the machine cannot keep up.
  adapt(dt) {
    this.fps = damp(this.fps, 1 / Math.max(dt, 0.001), 1, dt);
    if (this.fps < 31 && this.time > 4) this.slowT += dt; else this.slowT = Math.max(0, this.slowT - dt);
    if (this.settings.quality === 'auto' && this.slowT > 3 && this.quality < 3) { this.slowT = 0; this.setQuality(this.quality + 1); }
  }
  // 0 is the full picture; each step up trades a little of it for speed.
  setQuality(q) {
    this.quality = q; const r = this.renderer, shadows = q < 2;
    r.setPixelRatio(q === 0 ? this.pixelRatio : q === 3 ? 0.7 : Math.min(1, this.pixelRatio));
    if (r.shadowMap.enabled !== shadows) { r.shadowMap.enabled = shadows; this.sky.sun.castShadow = shadows; this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
  }
  // ---- settings: kept apart from the save, so a new game does not reset them ----
  loadSettings() {
    const d = { music: 80, sfx: 55, quality: 'auto', time: 'auto' };
    try { Object.assign(d, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { /* defaults will do */ }
    return d;
  }
  applySettings(save = true) {
    const st = this.settings;
    this.sound.setVolume(st.sfx / 100); this.sound.setMusic(st.music / 100);
    if (st.quality !== 'auto') this.setQuality(+st.quality);
    if (!this.dusk && !this.photo && st.time !== this.timeSet) { this.timeSet = st.time; if (st.time === 'auto') this.sky.mode = 'auto'; else this.sky.setMode(st.time); }
    this.ui.settings(st);
    if (save) try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(st)); } catch (e) { /* not saved, still applied */ }
  }
  // ---- photo mode: the world stops, the dashboard goes away, the camera is yours ----
  photoMode(on) {
    if (on === !!this.photo || (on && (this.mode !== 'play' || this.cine || this.ui.dialogOpen))) return;
    if (on) {
      if (this.paused) this.pause(false);
      const c = this.cam; this.photo = { yaw: c.yaw, pitch: Math.max(0.08, c.pitch), d: Math.max(4, c.d * 1.2), up: 0, t: this.sky.t, mode: this.sky.mode };
      this.sky.mode = 'hold'; this.sound.engine(false, 0, 0); this.sound.horn(false);
    } else { this.sky.t = this.photo.t; this.sky.mode = this.photo.mode; this.sky.apply(); this.photo = null; this.snapCam = true; }
    this.ui.photo(on);
  }
  photoStep(dt) {
    const ph = this.photo, inp = this.input;
    if (inp.pressed('Escape', 'KeyT')) return this.photoMode(false);
    if (inp.pressed('Enter', 'KeyF', 'KeyH')) return this.takePhoto();
    ph.yaw -= inp.lookX * 0.006; ph.pitch = clamp(ph.pitch + inp.lookY * 0.004, -0.25, 1.45);
    const r = inp.read();
    ph.d = clamp(ph.d * (1 + inp.wheel * 0.12) * (1 - r.my * 1.2 * dt) * (1 + (this.zoomHeld || 0) * 1.2 * dt), 2, 90);
    ph.yaw -= r.mx * 1.4 * dt;
    ph.up = clamp(ph.up + ((inp.key('Space') ? 1 : 0) - (inp.key('ShiftLeft', 'ShiftRight') ? 1 : 0)) * 6 * dt, -1, 40);
    const turn = (inp.key('KeyE', 'BracketRight') ? 1 : 0) - (inp.key('KeyQ', 'BracketLeft') ? 1 : 0) + (this.timeHeld || 0);
    if (turn) { this.sky.t = (this.sky.t + turn * 0.06 * dt + 1) % 1; this.sky.apply(); }
  }
  // The picture, framed like a postcard, shown so it can be saved or shared.
  takePhoto() {
    this.render();
    const src = this.canvas, w = Math.min(1600, src.width), h = Math.round((w * src.height) / src.width), pad = Math.round(w * 0.025), foot = Math.round(w * 0.07);
    const cv = document.createElement('canvas'); cv.width = w + pad * 2; cv.height = h + pad + foot; const g = cv.getContext('2d');
    g.fillStyle = '#fffdf6'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(src, pad, pad, w, h);
    g.fillStyle = '#1d232b'; g.textBaseline = 'middle'; g.font = `${Math.round(foot * 0.42)}px Bungee, Impact, sans-serif`; g.textAlign = 'left'; g.fillText("Christian's World", pad, h + pad + foot / 2);
    g.font = `${Math.round(foot * 0.3)}px "Atkinson Hyperlegible", Verdana, sans-serif`; g.textAlign = 'right'; g.fillStyle = '#5a6470'; g.fillText(this.sky.clock(), cv.width - pad, h + pad + foot / 2);
    this.sound.shutter(); this.ui.flash(); this.photos = (this.photos || 0) + 1;
    // the same picture twice: as an address for the page to show, and as a file ready to hand over straight away
    const url = cv.toDataURL('image/jpeg', 0.9), bin = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    this.photoName = `christians-world-${this.photos}.jpg`; this.photoBlob = new Blob([bytes], { type: 'image/jpeg' });
    this.ui.showPhoto(url, !!this.saver);
  }
  // Hand the photo over: through the app around the page when there is one (inside claude.ai the page may not
  // download by itself), as an ordinary download when the game is its own page.
  savePhoto() {
    const blob = this.photoBlob, name = this.photoName, ui = this.ui; if (!blob || !this.saver) return;
    if (this.saver === 'link') {
      const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000); return ui.photoNote('Saved to your downloads.');
    }
    this.saver.save({ filename: name, data: blob }).then(() => ui.photoNote('Saved!'), (e) => { if (!e || e.code !== 'declined') ui.photoNote('It could not be saved from here. Press and hold the picture instead.'); });
  }
  render() { this.renderer.render(this.scene, this.camera); }
  run() {
    let last = performance.now();
    const loop = (now) => {
      const raw = (now - last) / 1000; last = now;
      const dt = clamp(raw, 0.001, 0.05);
      if (!this.manual) { this.tick(dt); this.adapt(raw); }
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  // State that survives the page being republished while someone is playing.
  snapshot() { const f = this.focus(); return { save: this.state, playing: this.mode === 'play', x: f.x, z: f.z, h: this.player.heading }; }
}

async function boot(data) {
  const canvas = $('view');
  try { await Promise.race([document.fonts.load('20px Bungee'), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* fall back to system fonts */ }
  let game;
  try { game = new Game(canvas); }
  catch (e) { console.error(e); $('loading').textContent = 'This game needs WebGL. Try a newer browser, or turn on hardware acceleration.'; return; }
  window.__cw = game;
  game.ui.ready();
  game.ui.title(true, !!game.loadSave());
  if (data && data.save && data.playing) {
    game.state = { ...game.state, ...data.save }; game.begin(false);
    if (Number.isFinite(data.x) && game.world.groundAt(data.x, data.z) > WATER_Y) game.player.teleport(data.x, data.z, game.world, data.h || 0);
  }
  window.claude?.hot?.snapshot?.(() => game.snapshot());
  game.run();
}

const hot = window.claude?.hot;
if (hot?.ready) hot.ready((d) => boot(d || {})); else boot(hot?.data ?? {});
