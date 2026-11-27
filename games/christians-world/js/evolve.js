// Evolving: Christian levels up by stopping robots and finishing missions, and when he has the level and the wins
// he evolves into the next form. Every form is a suit of armour he wears from then on, and each one makes robot coins
// worth more and his hits land harder. All twelve forms are his own designs.
import * as THREE from './three.js';
import { KIT, EXTRA, POSE } from './relics.js';

const { M, std, put, lathe, ring, ball, tube, slab, halo, around, TAU } = KIT;

// level: the level needed.  wins: robots stopped.  coin: what a robot coin is worth, times.  dmg: how hard hits land, times.
// crest: what sits on his head.  wings: 0 none, 1 small, 2 big.
export const FORMS = [
  { name: 'Rookie', coin: 1, dmg: 1, tale: 'Just Christian. That was always plenty.' },
  { name: 'Spark', level: 2, wins: 5, coin: 2, dmg: 1.25, plate: 0xffd21f, trim: 'steel', glow: 0xfff27a, crest: 'spikes', tale: 'The first crackle of power.' },
  { name: 'Ember', level: 4, wins: 15, coin: 3, dmg: 1.5, plate: 0xd8401f, trim: 'dark', glow: 0xff8a2a, crest: 'horns', tale: 'Warm to the touch. Do not touch.' },
  { name: 'Frost', level: 6, wins: 30, coin: 4, dmg: 1.75, plate: 0x9fd8ff, trim: 'steel', glow: 0xd9f6ff, crest: 'fin', tale: 'Leaves icy footprints in July.' },
  { name: 'Thorn', level: 9, wins: 50, coin: 6, dmg: 2, plate: 0x2f9a4a, trim: 'gold', glow: 0xa6ff4d, crest: 'antlers', tale: 'The forest lent him its armour.' },
  { name: 'Storm', level: 12, wins: 80, coin: 8, dmg: 2.25, plate: 0x2f5fc0, trim: 'steel', glow: 0x7cc8ff, crest: 'fin', tale: 'Thunder asks him for permission.' },
  { name: 'Shadow', level: 15, wins: 120, coin: 10, dmg: 2.5, plate: 0x1a1426, trim: 'dark', glow: 0xb45cff, crest: 'horns', tale: 'Seen only when he wants to be.' },
  { name: 'Crystal', level: 18, wins: 170, coin: 13, dmg: 2.75, plate: 0x35c9d6, trim: 'gold', glow: 0x9dfcff, crest: 'crown', tale: 'Every edge catches the light.' },
  { name: 'Solar', level: 22, wins: 230, coin: 16, dmg: 3, plate: 0xfff1cf, trim: 'gold', glow: 0xffc53d, crest: 'halo', tale: 'Bright enough to read by.' },
  { name: 'Nebula', level: 26, wins: 300, coin: 20, dmg: 3.25, plate: 0x6a2fb8, trim: 'gold', glow: 0xff7ad9, crest: 'crown', wings: 1, tale: 'Stitched from the edge of space.' },
  { name: 'Titan', level: 30, wins: 380, coin: 25, dmg: 3.5, plate: 0x8a94a3, trim: 'dark', glow: 0xff3b30, crest: 'horns', wings: 1, tale: 'The ground notices when he lands.' },
  { name: 'Phoenix', level: 35, wins: 480, coin: 32, dmg: 3.75, plate: 0xe2351f, trim: 'gold', glow: 0xffb000, crest: 'fin', wings: 2, tale: 'Knocked down nine times. Up ten.' },
  { name: 'Legend', level: 40, wins: 600, coin: 40, dmg: 4, plate: 0xfdfdf8, trim: 'gold', glow: 0x7dfff0, crest: 'halo', wings: 2, tale: 'The one the island tells stories about.' },
];
// Level L starts at 25 x L x (L - 1) points: 50 for level 2, 500 for level 5, 2250 for level 10.
export const xpFor = (L) => 25 * L * (L - 1);
export const levelOf = (xp) => Math.floor((1 + Math.sqrt(1 + (4 * Math.max(0, xp)) / 25)) / 2);

// The armour for one form, in four pieces that hang on his head, his body and each arm. tick(t) keeps it alive.
export function buildForm(f, tier) {
  const head = new THREE.Group(), body = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group(), moving = [];
  const plate = M.plate(f.plate), trim = f.trim === 'gold' ? M.gold() : f.trim === 'steel' ? M.steel() : M.metal(0x2b2f37, 0.4), glow = M.glow(f.glow, 2.2), big = Math.min(1, tier / 12);
  // head: a band round the cap with a jewel, cheek guards, and the crest
  put(head, ring(0.37, 0.034, 64), trim, 0, 0.4, 0, Math.PI / 2); put(head, ring(0.37, 0.012, 64), glow, 0, 0.44, 0, Math.PI / 2);
  put(head, new THREE.OctahedronGeometry(0.06, 0), glow, 0, 0.42, 0.37).scale.set(1, 1.4, 0.6); halo(head, f.glow, 0.34, 0, 0.42, 0.42, 0.7);
  for (const s of [-1, 1]) put(head, slab([[0, 0], [0.2, 0.05], [0.3, 0.22], [0.1, 0.16], [0, 0.2]], 0.02, 0.012, 0.014), plate, s * 0.25, 0.14, 0.1, 0, s * Math.PI / 2 + Math.PI / 2, 0);
  if (f.crest === 'spikes') for (let i = 0; i < 5; i++) put(head, new THREE.ConeGeometry(0.045, 0.2 + (2 - Math.abs(i - 2)) * 0.07, 12), i % 2 ? trim : glow, 0, 0.72 + (2 - Math.abs(i - 2)) * 0.03, 0.2 - i * 0.1, -0.25);
  if (f.crest === 'horns') for (const s of [-1, 1]) { put(head, tube([[s * 0.22, 0.44, 0], [s * 0.4, 0.52, 0.02], [s * 0.5, 0.74, 0.06], [s * 0.42, 0.98, 0.1]], 0.06, { taper: (u) => 1.05 - u, rs: 12 }), trim); put(head, ring(0.066, 0.012, 24), glow, s * 0.3, 0.47, 0.01, 0, Math.PI / 2, s * 0.5); }
  if (f.crest === 'fin') { put(head, slab([[-0.26, 0], [0.24, 0], [0.3, 0.1], [0.12, 0.2], [-0.1, 0.5], [-0.34, 0.62], [-0.3, 0.3]], 0.03, 0.016, 0.02), plate, 0, 0.58, 0, 0, -Math.PI / 2); put(head, tube([[0, 0.6, 0.24], [0, 0.82, 0.08], [0, 1.1, -0.14], [0, 1.2, -0.33]], 0.014, { rs: 6 }), glow); }
  if (f.crest === 'antlers') for (const s of [-1, 1]) { put(head, tube([[s * 0.2, 0.46, 0], [s * 0.3, 0.7, 0], [s * 0.34, 0.95, 0.03], [s * 0.3, 1.12, 0.05]], 0.034, { taper: (u) => 1.05 - u * 0.9 }), trim); for (const [y, dx, dy] of [[0.66, 0.2, 0.16], [0.86, 0.17, 0.2]]) put(head, tube([[s * 0.3, y, 0.01], [s * (0.3 + dx * 0.7), y + dy * 0.4, 0.02], [s * (0.3 + dx), y + dy, 0.04]], 0.022, { taper: (u) => 1.05 - u, seg: 16 }), trim); put(head, ball(0.03, 12), glow, s * 0.3, 1.13, 0.05); }
  if (f.crest === 'crown') { put(head, lathe([[0.3, 0.6], [0.34, 0.63], [0.34, 0.7], [0.31, 0.72]], 48), trim); around(6, (c, s, a, i) => { put(head, new THREE.ConeGeometry(0.05, 0.22 + (i % 2) * 0.1, 4), trim, c * 0.31, 0.82 + (i % 2) * 0.05, s * 0.31, 0, -a); put(head, new THREE.OctahedronGeometry(0.035, 0), glow, c * 0.35, 0.665, s * 0.35); }); }
  if (f.crest === 'halo') { const h = new THREE.Group(); h.position.y = 0.95; head.add(h); put(h, ring(0.3, 0.02, 64), glow, 0, 0, 0, Math.PI / 2); around(8, (c, s) => put(h, new THREE.ConeGeometry(0.02, 0.1, 8), trim, c * 0.36, 0, s * 0.36, 0, 0, 0)); halo(h, f.glow, 0.9, 0, 0, 0, 0.45); moving.push((t) => { h.rotation.y = t * 0.9; h.position.y = 0.95 + Math.sin(t * 2) * 0.03; }); put(head, ring(0.3, 0.02, 48), trim, 0, 0.62, 0, Math.PI / 2); }
  // body: shoulder guards, a badge on the chest, wings for the highest forms, motes of light circling
  for (const s of [-1, 1]) {
    const pad = put(body, lathe([[0, 0.16], [0.1, 0.145], [0.18, 0.09], [0.215, 0.01], [0.2, -0.02], [0.17, 0]], 40), plate, s * 0.47, 1.5, 0); pad.scale.set(1, 1 + big * 0.3, 1.15); pad.rotation.z = -s * 0.35;
    put(body, ring(0.205, 0.016, 48), trim, s * 0.475, 1.5, 0, Math.PI / 2, -s * 0.35 * 0, 0).rotation.set(Math.PI / 2, -s * 0.35, 0);
    put(body, ball(0.035, 16), glow, s * 0.53, 1.66 + big * 0.04, 0);
    if (tier >= 3) put(body, new THREE.ConeGeometry(0.05, 0.16 + big * 0.2, 12), trim, s * 0.6, 1.7 + big * 0.1, 0, 0, 0, -s * 0.6);
    if (tier >= 6) for (const z of [-0.14, 0.14]) put(body, new THREE.ConeGeometry(0.035, 0.14, 10), trim, s * 0.62, 1.6, z, 0, 0, -s * 1.1);
  }
  put(body, ring(0.1, 0.02, 40), trim, 0, 1.24, 0.2); put(body, ball(0.075, 24), glow, 0, 1.24, 0.19).scale.set(1, 1, 0.45); halo(body, f.glow, 0.4, 0, 1.24, 0.26, 0.6);
  for (const s of [-1, 1]) put(body, slab([[0, 0], [0.24, 0.1], [0.26, 0.18], [0, 0.07]], 0.016, 0.01, 0.012), plate, s * 0.02, 1.17, 0.2, 0, 0, s > 0 ? 0 : Math.PI).scale.set(1, s, 1);
  put(body, lathe([[0.33, -0.03], [0.345, 0], [0.33, 0.03]], 4), trim, 0, 0.84, 0, 0, Math.PI / 4).scale.set(1, 1, 0.62);
  if (f.wings) for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.12, 1.36, -0.21); body.add(w); const n = f.wings > 1 ? 5 : 3, feather = M.glow(f.glow, 1.3); feather.transparent = true; feather.opacity = 0.85; feather.side = THREE.DoubleSide;
    for (let i = 0; i < n; i++) { const L = (f.wings > 1 ? 0.95 : 0.6) * (1 - i * 0.13), m = put(w, slab([[0, 0], [L * 0.45, 0.11], [L, 0.03], [L * 0.5, -0.07]], 0.006, 0.004, 0.006), i ? feather : plate, 0, -i * 0.11, -i * 0.012); m.rotation.z = 0.75 - i * 0.3; if (s < 0) m.scale.x = -1; }
    put(w, ball(0.05, 16), trim); moving.push((t) => { w.rotation.y = s * (-0.45 + Math.sin(t * 2.4) * 0.22); });
  }
  const motes = new THREE.Group(); motes.position.y = 1.0; body.add(motes); around(2 + Math.floor(tier / 2), (c, s, a, i) => { const m = put(motes, ball(0.022, 10), glow, c * 0.72, ((i * 37) % 10) / 10 - 0.3, s * 0.72); halo(m, f.glow, 0.2, 0, 0, 0, 0.8); });
  const aura = halo(body, f.glow, 1.6 + big, 0, 1.05, -0.1, 0.1 + big * 0.14);
  // arms: a bracer on each forearm, with a blade on it for the higher forms
  for (const [arm, s] of [[armL, 1], [armR, -1]]) {
    put(arm, lathe([[0.15, -0.6], [0.17, -0.57], [0.165, -0.45], [0.18, -0.36], [0.19, -0.33], [0.17, -0.31]], 4), plate, 0, 0, 0, 0, Math.PI / 4).scale.set(0.95, 1, 1.1);
    for (const y of [-0.58, -0.34]) put(arm, lathe([[0.17, -0.016], [0.19, 0], [0.17, 0.016]], 4), trim, 0, y, 0, 0, Math.PI / 4).scale.set(0.98, 1, 1.13);
    put(arm, ball(0.03, 12), glow, s * 0.13, -0.46, 0).scale.set(0.5, 1.8, 1);
    if (tier >= 5) put(arm, slab([[0, -0.14], [0.06, -0.1], [0.17, 0.2], [0.02, 0.1]], 0.014, 0.01, 0.01), trim, s * 0.12, -0.46, 0, 0, s > 0 ? 0 : Math.PI);
  }
  const tick = (t) => { glow.emissiveIntensity = 2 + Math.sin(t * 2.5) * 0.5; motes.rotation.y = t * 1.3; aura.material.opacity = 0.1 + big * 0.14 + Math.sin(t * 2.5) * 0.03; for (const m of moving) m(t); };
  return { head, body, armL, armR, tick };
}

// For the display stand: the armour on a plain grey figure, so the pictures show what he will look like.
FORMS.forEach((f, tier) => {
  POSE['form' + tier] = [0.55, 0];
  EXTRA['form' + tier] = () => {
    const g = new THREE.Group(), grey = std({ color: tier ? 0x39414c : 0x2d6cdf, roughness: 0.8, metalness: 0, envMapIntensity: 0.3 }), skin = std({ color: 0xf1c9a5, roughness: 0.8, metalness: 0, envMapIntensity: 0.2 }), box = (w, h, d, m, x, y, z) => put(g, new THREE.BoxGeometry(w, h, d), m, x, y, z);
    box(0.64, 0.68, 0.38, grey, 0, 1.14, 0); box(0.46, 0.46, 0.46, skin, 0, 1.73, 0); box(0.5, 0.16, 0.5, grey, 0, 2.02, 0); box(0.44, 0.05, 0.3, grey, 0, 1.96, 0.34);
    for (const x of [0.11, -0.11]) box(0.07, 0.08, 0.03, std({ color: 0x1c1c1f }), x, 1.77, 0.235);
    for (const s of [-1, 1]) { box(0.2, 0.62, 0.24, grey, s * 0.43, 1.15, 0); box(0.19, 0.14, 0.22, skin, s * 0.43, 0.77, 0); box(0.27, 0.8, 0.3, std({ color: 0x39414c, roughness: 0.9 }), s * 0.16, 0.42, 0); }
    g.userData.tick = () => {};
    if (tier) { const a = buildForm(f, tier); a.head.position.y = 1.5; a.armL.position.set(0.43, 1.46, 0); a.armR.position.set(-0.43, 1.46, 0); g.add(a.head, a.body, a.armL, a.armR); g.userData.tick = (t) => a.tick(t); }
    return g;
  };
});

export class Evo {
  constructor(game) { this.g = game; this.parts = null; this.told = false; this.worn = -1; }
  // Saves from before evolving existed get credit for every robot already stopped and every mission already done.
  get s() { const st = this.g.state; if (!st.evo) st.evo = { xp: (st.stats.bots || 0) * 10 + st.done.length * 100, tier: 0, wear: 0 }; return st.evo; }
  get level() { return levelOf(this.s.xp); }
  get wins() { return this.g.state.stats.bots || 0; }
  get form() { return FORMS[this.s.tier] || FORMS[0]; }
  get next() { return FORMS[this.s.tier + 1] || null; }
  get coin() { return this.form.coin; }
  get dmg() { return this.form.dmg; }
  ready() { const n = this.next; return !!n && this.level >= n.level && this.wins >= n.wins; }
  // Points for a robot or a mission. Higher forms learn faster.
  gain(xp) {
    const s = this.s, g = this.g, was = this.level; s.xp += Math.round(xp * (1 + s.tier * 0.5));
    if (this.level > was) { g.ui.toast(`Level ${this.level}!`, 2); g.sound.star(); }
    if (this.ready() && !this.told) { this.told = true; g.ui.toast(`You can evolve into ${this.next.name}!  ${g.words() === 'key' ? 'Press X' : 'Open Evolve'}`, 4); }
  }
  evolve() {
    if (!this.ready()) return false;
    const s = this.s, g = this.g, p = g.player.pos; s.tier++; s.wear = s.tier; this.told = false; this.dress();
    const f = this.form, c = new THREE.Color(f.glow);
    for (let k = 0; k < 3; k++) g.fx.burst(p.x, p.y + 1 + k * 0.4, p.z, 30, 9, 0.9, 0.5, 0.15, c.r, c.g, c.b, 1, 3, 0.8);
    g.fx.emit(p.x, p.y + 0.15, p.z, 0, 0, 0, 0.8, 1, 14, c.r, c.g, c.b, 0.7, 0, true);
    g.sound.win(); g.cam.shake = Math.max(g.cam.shake, 0.25); g.save();
    return true;
  }
  wear(i) { const s = this.s; if (i < 0 || i > s.tier || i === s.wear) return; s.wear = i; this.dress(); this.g.sound.click(); this.g.save(); }
  // Put the armour for the form he is wearing onto the player.
  dress() {
    const u = this.g.player.mesh.userData, i = Math.min(this.s.wear, this.s.tier);
    if (this.parts) for (const k of ['head', 'body', 'armL', 'armR']) u[k].remove(this.parts[k]);
    this.parts = null; this.worn = i; if (!i) return;
    this.parts = buildForm(FORMS[i], i); for (const k of ['head', 'body', 'armL', 'armR']) u[k].add(this.parts[k]);
  }
  update() { if (this.worn !== Math.min(this.s.wear, this.s.tier)) this.dress(); if (this.parts) this.parts.tick(this.g.time); }
}
