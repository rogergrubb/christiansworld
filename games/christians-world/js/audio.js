// Every sound is synthesised with Web Audio, so the game ships without audio files.
import { Radio } from './music.js';
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.hornOn = false; this.sirenOn = false; this.radio = null; this.station = 0; this.musicLevel = 0.8; this.volume = 0.55; }
  // Browsers only allow audio after a click, so this is called from the Start button.
  unlock() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.on ? this.volume : 0;
      // a limiter on the way out, so a horn over the music over the engine never crackles
      const lim = c.createDynamicsCompressor(); lim.threshold.value = -12; lim.knee.value = 8; lim.ratio.value = 8; lim.attack.value = 0.004; lim.release.value = 0.2; this.master.connect(lim); lim.connect(c.destination);
      this.eng = c.createOscillator(); this.eng.type = 'sawtooth'; this.eng2 = c.createOscillator(); this.eng2.type = 'square';
      this.engF = c.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 500;
      this.engG = c.createGain(); this.engG.gain.value = 0;
      this.eng.connect(this.engF); this.eng2.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.master);
      this.eng.start(); this.eng2.start();
      { const n = c.sampleRate * 2; this.nbuf = c.createBuffer(1, n, c.sampleRate); const d = this.nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
      this.radio = new Radio(c, this.master, this.nbuf); this.radio.setLevel(this.musicLevel); this.radio.tune(this.station);
    } catch (e) { this.ctx = null; }
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? this.volume : 0; }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.on ? v : 0; }
  shutter() { this.noise(0.05, 0.3, 5000); this.tone(1900, 0.02, 0.05, 'square', 0.05); }
  engine(active, rpm, throttle) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = 48 + rpm * 115;
    this.eng.frequency.setTargetAtTime(f, t, 0.05); this.eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engF.frequency.setTargetAtTime(300 + rpm * 900 + throttle * 500, t, 0.08);
    this.engG.gain.setTargetAtTime(active ? 0.035 + 0.03 * throttle : 0, t, 0.1);
  }
  tone(freq, at = 0, dur = 0.12, type = 'sine', vol = 0.16, slide) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.03);
  }
  noise(dur = 0.2, vol = 0.2, freq = 800) {
    if (!this.ctx) return;
    const c = this.ctx, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.master); s.start();
  }
  coin() { this.tone(988, 0, 0.08, 'square', 0.09); this.tone(1319, 0.07, 0.16, 'square', 0.09); }
  star() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, i * 0.06, 0.16, 'triangle', 0.16)); }
  step() { this.tone(660, 0, 0.09, 'triangle', 0.14); this.tone(880, 0.08, 0.14, 'triangle', 0.14); }
  go() { [523, 659, 784].forEach((f, i) => this.tone(f, i * 0.09, 0.14, 'square', 0.08)); }
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, i * 0.11, 0.2, 'square', 0.09)); [262, 330, 392].forEach((f) => this.tone(f, 0.77, 0.6, 'triangle', 0.12)); }
  fail() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, i * 0.14, 0.2, 'sawtooth', 0.08)); }
  tick() { this.tone(1200, 0, 0.05, 'square', 0.07); }
  click() { this.tone(520, 0, 0.05, 'triangle', 0.12); }
  jump() { this.tone(300, 0, 0.14, 'sine', 0.1, 620); }
  door() { this.noise(0.09, 0.22, 500); this.tone(140, 0, 0.08, 'sine', 0.2); }
  thud(v) { this.noise(0.16, Math.min(0.5, 0.08 + v * 0.03), 380); this.tone(70, 0, 0.14, 'sine', Math.min(0.4, 0.1 + v * 0.02)); }
  splash() { this.noise(0.5, 0.35, 1400); }
  bark() { this.tone(520, 0, 0.07, 'square', 0.08, 380); this.tone(560, 0.12, 0.08, 'square', 0.08, 400); }
  spray() { this.noise(0.5, 0.2, 5000); }
  horn(on, deep) {
    if (!this.ctx || on === this.hornOn) return;
    this.hornOn = on;
    if (on) {
      const c = this.ctx; this.hG = c.createGain(); this.hG.gain.value = 0.07; this.hG.connect(this.master);
      this.hO = [deep ? 180 : 392, deep ? 226 : 494].map((f) => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(this.hG); o.start(); return o; });
    } else { this.hO.forEach((o) => o.stop()); this.hG.disconnect(); }
  }
  siren(on) {
    if (!this.ctx || on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      const c = this.ctx; this.sG = c.createGain(); this.sG.gain.value = 0.045; this.sG.connect(this.master);
      this.sO = c.createOscillator(); this.sO.type = 'sawtooth'; this.sO.frequency.value = 760;
      this.sL = c.createOscillator(); this.sL.frequency.value = 0.9; const lg = c.createGain(); lg.gain.value = 240;
      this.sL.connect(lg); lg.connect(this.sO.frequency); this.sO.connect(this.sG); this.sO.start(); this.sL.start();
    } else { this.sO.stop(); this.sL.stop(); this.sG.disconnect(); }
  }
  // One endless hiss shared by the sliding-tyre and water sounds, each with its own filter.
  loop(name, type, freq, q = 1) {
    if (this[name]) return this[name];
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.nbuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(this.master); src.start();
    return (this[name] = { f, g });
  }
  skid(amount) { if (!this.ctx || (!amount && !this.sk)) return; const n = this.loop('sk', 'bandpass', 1500, 5), t = this.ctx.currentTime; n.g.gain.setTargetAtTime(amount * 0.1, t, 0.06); n.f.frequency.setTargetAtTime(1250 + amount * 650, t, 0.1); }
  water(amount) { if (!this.ctx || (!amount && !this.wt)) return; const n = this.loop('wt', 'lowpass', 950, 0.7); n.g.gain.setTargetAtTime(amount * 0.13, this.ctx.currentTime, 0.2); }
  boost() { this.noise(0.7, 0.28, 2400); this.tone(170, 0, 0.55, 'sawtooth', 0.1, 760); }
  // ---- the radio (see music.js) ----
  tune(i) { this.station = i; if (this.radio) { this.radio.tune(i); this.radio.setLevel(this.musicLevel); } }
  music(playing, rush = 0) { if (this.radio) { this.radio.rush += (rush - this.radio.rush) * 0.05; this.radio.play(playing); this.radio.update(); } }
  setMusic(level) { this.musicLevel = level; if (this.radio) this.radio.setLevel(level); }
  // ---- background sounds: where Christian is and what time it is. Each level runs from 0 to 1. ----
  ambience(dt, a) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, sea = this.loop('amSea', 'lowpass', 430, 0.6), wind = this.loop('amWind', 'bandpass', 520, 0.7);
    this.seaT = (this.seaT || 0) + dt;
    sea.g.gain.setTargetAtTime(a.sea * (0.05 + 0.03 * Math.sin(this.seaT * 0.8)), t, 0.3);   // the waves come and go
    wind.g.gain.setTargetAtTime(a.wind * 0.075, t, 0.4); wind.f.frequency.setTargetAtTime(380 + a.wind * 520, t, 0.5);
    if (a.birds > 0.05 && Math.random() < dt * 0.8 * a.birds) { const f = 2300 + Math.random() * 1900, n = 1 + ((Math.random() * 3) | 0); for (let i = 0; i < n; i++) this.tone(f * (1 + i * 0.05), i * 0.09, 0.07, 'sine', 0.03 * a.birds, f * 1.22); }
    if (a.crickets > 0.05 && (this.crT = (this.crT || 0) - dt) <= 0) { this.crT = 0.5 + Math.random() * 0.3; for (let i = 0; i < 4; i++) this.tone(4250 + Math.random() * 80, i * 0.045, 0.03, 'sine', 0.016 * a.crickets); }
    if (a.crickets > 0.6 && Math.random() < dt * 0.025) { this.tone(430, 0, 0.3, 'sine', 0.045, 390); this.tone(410, 0.45, 0.55, 'sine', 0.045, 345); }   // an owl
  }
  footstep(soft) { this.noise(0.045, soft ? 0.045 : 0.06, soft ? 520 : 1500); }
  hey() { this.tone(540, 0, 0.09, 'square', 0.06, 760); this.tone(720, 0.1, 0.13, 'square', 0.06, 560); }
  flutter() { for (let i = 0; i < 6; i++) setTimeout(() => this.noise(0.05, 0.09, 2600 + i * 300), i * 55); }
  moo() { this.tone(155, 0, 0.95, 'sawtooth', 0.1, 104); this.tone(310, 0.02, 0.9, 'sine', 0.05, 208); }
  baa() { for (let i = 0; i < 7; i++) this.tone(440 - i * 5, i * 0.075, 0.07, 'sawtooth', 0.06); }
  cluck() { this.tone(900, 0, 0.04, 'square', 0.05, 600); this.tone(1000, 0.1, 0.04, 'square', 0.05, 650); this.tone(1250, 0.22, 0.1, 'square', 0.05, 700); }
  // Helicopter: filtered noise chopped by the blades.
  heli(on, power = 0) {
    if (!this.ctx || (!on && !this.hl)) return;
    if (!this.hl) {
      const c = this.ctx, n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      const g = c.createGain(); g.gain.value = 0;
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 12; const lg = c.createGain(); lg.gain.value = 0;
      lfo.connect(lg); lg.connect(g.gain); src.connect(f); f.connect(g); g.connect(this.master); src.start(); lfo.start();
      this.hl = { g, lg, lfo };
    }
    const t = this.ctx.currentTime, v = on ? 0.05 + power * 0.07 : 0;
    this.hl.g.gain.setTargetAtTime(v, t, 0.15); this.hl.lg.gain.setTargetAtTime(v * 0.75, t, 0.15); this.hl.lfo.frequency.setTargetAtTime(5 + power * 9, t, 0.25);
  }
  jingle() { [659, 784, 880, 784, 659, 523, 587, 659].forEach((f, i) => this.tone(f, i * 0.16, 0.18, 'triangle', 0.13)); }
  // ---- Octoclank: every leg plays its own note, so its walk is a daft little tune, and it never stops talking
  octoStep(i) {
    const now = typeof performance !== 'undefined' ? performance.now() : 0; if (now - (this.octoAt || -99) < 45) return; this.octoAt = now; this.octoSteps = (this.octoSteps || 0) + 1;
    const f = [262, 294, 330, 392, 440, 523, 587, 659][i % 8];
    this.tone(f, 0, 0.09, 'triangle', 0.07, f * 0.94);                // a hollow pipe bonk
    this.tone(1300 + i * 90, 0.02, 0.07, 'sine', 0.03, 2300);         // a rubbery squeak
    this.noise(0.05, 0.05, 500);                                      // a squelch in the sand
  }
  // Gibberish in a tin-can voice. kind: 'ow', 'laugh', 'grump', 'yawn', 'boo', 'cry', 'talk'.
  octoSay(kind) {
    this.octoSaid = (this.octoSaid || 0) + 1;
    const v = (f, at, dur, to, vol = 0.1) => { this.tone(f, at, dur, 'sawtooth', vol, to); this.tone(f * 2.02, at, dur, 'square', vol * 0.3, to * 2.02); };
    if (kind === 'ow') { v(320, 0, 0.09, 760); v(700, 0.09, 0.22, 240); }
    else if (kind === 'laugh') for (let i = 0; i < 6; i++) v(420 - i * 34, i * 0.11, 0.07, 330 - i * 34);
    else if (kind === 'grump') { v(150, 0, 0.16, 120); v(135, 0.2, 0.14, 110); v(170, 0.38, 0.3, 90); }
    else if (kind === 'yawn') { v(260, 0, 0.5, 420, 0.08); v(420, 0.5, 0.7, 110, 0.08); }
    else if (kind === 'boo') { v(110, 0, 0.5, 90, 0.14); this.tone(880, 0.5, 0.12, 'sine', 0.06, 1500); }
    else if (kind === 'cry') for (let i = 0; i < 4; i++) v(520 - i * 60, i * 0.22, 0.18, 300 - i * 40, 0.08);
    else for (let i = 0, n = 4 + ((Math.random() * 4) | 0); i < n; i++) { const f = 170 + Math.random() * 230; v(f, i * 0.105, 0.085, f * (0.7 + Math.random() * 0.7)); }
  }
  // ---- tools, blasters and robots
  jet(on) { if (!this.ctx || (!on && !this.jt)) return; const n = this.loop('jt', 'bandpass', 950, 0.8); n.g.gain.setTargetAtTime(on ? 0.17 : 0, this.ctx.currentTime, 0.05); }
  blast(id) {
    const now = typeof performance !== 'undefined' ? performance.now() : 0; if (now - (this.blastAt || -99) < 40) return; this.blastAt = now; this.blasts = (this.blasts || 0) + 1;
    if (id === 'water') this.noise(0.06, 0.07, 2600);
    else if (id === 'darts') this.tone(900, 0, 0.06, 'square', 0.06, 300);
    else if (id === 'snow') { this.noise(0.08, 0.12, 900); this.tone(220, 0, 0.08, 'sine', 0.1, 140); }
    else if (id === 'net') { this.noise(0.18, 0.14, 1200); this.tone(300, 0, 0.16, 'triangle', 0.08, 120); }
    else if (id === 'freeze') this.tone(1800, 0, 0.07, 'sine', 0.05, 2600);
    else if (id === 'paint' || id === 'ink') { this.noise(0.07, 0.1, 700); this.tone(260, 0, 0.07, 'sine', 0.09, 180); }
    else if (id === 'popcorn') { this.tone(160, 0, 0.16, 'square', 0.1, 70); this.noise(0.14, 0.2, 500); }
    else if (id === 'bubble') this.tone(500, 0, 0.09, 'sine', 0.07, 900);
    else if (id === 'boomerang') this.noise(0.25, 0.08, 1800);
    else if (id === 'fireworks') { this.noise(0.4, 0.16, 3000); this.tone(400, 0, 0.35, 'sawtooth', 0.05, 1400); }
    else if (id === 'zap') { for (let i = 0; i < 4; i++) this.tone(1200 - i * 220, i * 0.04, 0.06, 'sawtooth', 0.08); this.noise(0.3, 0.14, 4000); }
    else if (id === 'laser') this.tone(1500, 0, 0.11, 'sawtooth', 0.06, 380);
    else if (id === 'goo') { this.noise(0.16, 0.14, 500); this.tone(180, 0, 0.14, 'sine', 0.12, 70); }
    else if (id === 'katana') { this.noise(0.09, 0.1, 5200); this.tone(2200, 0, 0.08, 'sine', 0.04, 3200); }
    else if (id === 'baton') { for (let i = 0; i < 5; i++) this.tone(1320 - i * 180, i * 0.09, 0.3, 'sine', 0.09); this.tone(110, 0, 0.9, 'sine', 0.2, 55); }
    else if (id === 'bow') { this.tone(520, 0, 0.12, 'triangle', 0.1, 180); this.noise(0.08, 0.06, 3000); }
    else if (id === 'trident') { this.tone(1700, 0, 0.07, 'sawtooth', 0.06, 300); this.noise(0.06, 0.08, 5000); }
    else if (id === 'glove') { this.tone(90, 0, 0.6, 'sine', 0.25, 260); this.tone(420, 0.05, 0.5, 'triangle', 0.06, 900); }
    else if (id === 'meteor') { this.noise(0.35, 0.18, 900); this.tone(140, 0, 0.3, 'sawtooth', 0.1, 60); }
    else if (id === 'smasher') { this.tone(60, 0, 0.5, 'sine', 0.4, 30); this.noise(0.5, 0.3, 1400); this.tone(900, 0, 0.25, 'sawtooth', 0.07, 120); }
    else if (id === 'hammer') { this.tone(70, 0, 0.3, 'sine', 0.35, 40); this.noise(0.3, 0.3, 300); }
  }
  splat() { this.noise(0.12, 0.14, 600); }
  clank() { const now = typeof performance !== 'undefined' ? performance.now() : 0; if (now - (this.clankAt || -99) < 70) return; this.clankAt = now; this.tone(820, 0, 0.05, 'square', 0.06); this.tone(1240, 0.02, 0.06, 'square', 0.04); }
  zonk(big) { this.tone(big ? 300 : 620, 0, big ? 0.7 : 0.3, 'sawtooth', 0.1, big ? 40 : 90); this.noise(0.2, 0.2, 1800); this.tone(1400, 0.03, 0.05, 'square', 0.05); this.tone(1100, 0.09, 0.05, 'square', 0.05); }
  bonk() { this.tone(240, 0, 0.12, 'square', 0.12, 120); this.tone(480, 0.1, 0.1, 'triangle', 0.1, 300); this.noise(0.06, 0.14, 900); }
  pop() { this.tone(900, 0, 0.05, 'sine', 0.1, 1800); }
  freeze() { [2000, 2600, 3200].forEach((f, i) => this.tone(f, i * 0.04, 0.12, 'sine', 0.05)); }
  hiss() { this.noise(0.6, 0.16, 6000); }
  beep(f = 880) { this.tone(f, 0, 0.06, 'square', 0.06); }
  plop() { this.tone(420, 0, 0.1, 'sine', 0.1, 180); this.noise(0.08, 0.08, 1500); }
}
