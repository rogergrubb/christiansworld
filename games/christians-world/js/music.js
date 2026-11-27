// The car radio. Nothing here is a recording: each station is a recipe (speed, key, chords, drum pattern,
// instruments) and the tunes are worked out note by note as they play.
import { rng } from './util.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const LOUD = 1.9;   // the recipes below are written quietly; this brings the mix up to sit just under the engine

// House music, built from the bottom up: a heavy kick on every beat, a sub bass that throbs on every sixteenth, crisp hats on top.
// Two things drive it. `level` (1 to 21) is how far through the missions Christian is: every mission he finishes adds to it,
// and each step adds a layer (clap, sixteenth hats, open hats, rolling bass, chord stabs, a top line, a lead) and turns
// everything up. The low throb beats 8 times a second (120 beats a minute) for the first third of the missions, 10 a second
// for the middle third and 12 a second for the last, so the final mission is played at full tilt. Finishing a mission also
// sets off a crescendo: a rising sweep, a roll and a crash. `rush` (0 to 1) is danger right now and adds an alarm.
export const PULSE = [8, 10, 12];
export const tierOf = (level) => (level >= 15 ? 2 : level >= 8 ? 1 : 0);
export const STATIONS = [
  { name: 'Deep House', key: 53, scale: MINOR, chords: [0, 5, 3, 4], roll: [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0], stab: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0], lead: 'square', busy: 0.6 },
  { name: 'Big Room', key: 50, scale: MINOR, chords: [0, 0, 5, 6], roll: [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1], stab: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], lead: 'sawtooth', busy: 0.75 },
  { name: 'Acid Garage', key: 57, scale: MINOR, chords: [0, 2, 5, 4], roll: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1], stab: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1], lead: 'sawtooth', busy: 0.7, acid: true },
];

export class Radio {
  // ctx: an AudioContext (or an offline one, for tests); out: the node to play into
  constructor(ctx, out, noise) {
    this.ctx = ctx; this.noise = noise;
    this.gain = ctx.createGain(); this.gain.gain.value = 0; this.gain.connect(out);
    this.level = 0.8; this.station = -1; this.on = false; this.t = 0; this.step = 0; this.notes = 0; this.shift = 0; this.phrases = new Map(); this.rush = 0; this.level = 1;
  }
  get name() { return this.station < 0 ? 'Radio off' : STATIONS[this.station].name; }
  // Some stations are busier than others; trim brings a loud one back under the others.
  get out() { const st = STATIONS[this.station]; return this.level * LOUD * ((st && st.trim) || 1); }
  tune(i) { this.station = i; this.step = 0; this.t = 0; this.phrases = new Map(); if (this.on) this.gain.gain.setTargetAtTime(i >= 0 ? this.out : 0, this.ctx.currentTime, 0.1); }
  // Fade in when Christian is driving, out when he is not.
  play(on) { if (on === this.on) return; this.on = on; this.gain.gain.setTargetAtTime(on && this.station >= 0 ? this.out : 0, this.ctx.currentTime, on ? 0.4 : 0.25); if (on) this.t = 0; }
  setLevel(v) { this.level = v; if (this.on) this.gain.gain.setTargetAtTime(this.station >= 0 ? this.out : 0, this.ctx.currentTime, 0.1); }
  // One note: an oscillator with a quick attack and a fade.
  note(freq, at, dur, vol, type, o = {}) {
    const c = this.ctx, osc = c.createOscillator(), g = c.createGain(); osc.type = type; osc.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + (o.slow ? 0.12 : 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let tail = g;
    if (o.cut) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.cut; g.connect(f); tail = f; }
    osc.connect(g); tail.connect(this.gain); osc.start(at); osc.stop(at + dur + 0.03); this.notes++;
    if (o.bell) { const o2 = c.createOscillator(), g2 = c.createGain(); o2.type = 'sine'; o2.frequency.setValueAtTime(freq * 4, at); g2.gain.setValueAtTime(vol * 0.3, at); g2.gain.exponentialRampToValueAtTime(0.0001, at + dur * 0.35); o2.connect(g2); g2.connect(this.gain); o2.start(at); o2.stop(at + dur * 0.4); }
  }
  hit(at, dur, vol, type, freq) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); s.connect(f); f.connect(g); g.connect(this.gain); s.start(at, Math.random() * 1.5, dur + 0.02); this.notes++;
  }
  // The kick: a sine that drops from a thump to a deep note, with a click on the front so it cuts through small speakers.
  kick(at, vol = 0.3) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(170, at); o.frequency.exponentialRampToValueAtTime(46, at + 0.09); o.frequency.exponentialRampToValueAtTime(38, at + 0.26); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3); o.connect(g); g.connect(this.gain); o.start(at); o.stop(at + 0.32); this.hit(at, 0.012, vol * 0.25, 'highpass', 3000); this.notes++; }
  // The tune for one bar of a phrase: made once from a seed, so it comes back the same each time round.
  phrase(st, id, deg) {
    const key = id + ':' + deg; let p = this.phrases.get(key); if (p) return p;
    const R = rng(1000 + STATIONS.indexOf(st) * 97 + id * 13), chord = [deg, deg + 2, deg + 4]; p = []; let last = chord[1 + ((R() * 2) | 0)] + 7;
    for (let k = 0; k < 8; k++) {
      if (R() > st.busy && k !== 0) { p.push(null); continue; }
      // mostly chord notes, sometimes the note next door; never far from the last note
      let n = R() < 0.62 ? chord[(R() * 3) | 0] + 7 : last + (R() < 0.5 ? 1 : -1);
      while (n - last > 3) n -= 7; while (last - n > 3) n += 7;
      n = Math.max(4, Math.min(15, n)); p.push(n); last = n;
    }
    this.phrases.set(key, p); return p;
  }
  pitch(st, degree, up = 0) { const n = st.scale.length, oct = Math.floor(degree / n); return hz(st.key + st.scale[((degree % n) + n) % n] + 12 * oct + up + this.shift); }
  // Schedule everything that starts before `until` (in the context's seconds). Call often, a little ahead.
  schedule(until) {
    if (this.station < 0) return;
    const st = STATIONS[this.station], rush = this.rush, L = this.level, I = Math.min(1, (L - 1) / 20), sixteenth = 1 / (PULSE[tierOf(L)] * (1 + 0.06 * rush));
    if (!this.t || this.t < this.ctx.currentTime - 0.5) this.t = this.ctx.currentTime + 0.06;
    while (this.t < until) {
      const s = this.step % 16, bar = (this.step / 16) | 0, sect = (bar / 8) | 0, deg = st.chords[bar % st.chords.length], at = this.t, root = this.pitch(st, deg, -24);
      const build = bar % 8 === 7, drop = rush < 0.5 && L >= 4 && sect % 4 === 3 && bar % 8 < 2;   // the last bar of eight builds; now and then the kick drops out, then slams back
      // low end: four on the floor, and a sub bass answering in the gaps
      if (s % 4 === 0 && !drop) this.kick(at, 0.28 + 0.1 * I);
      if (I > 0.5 && s === 14 && bar % 2 === 1 && !drop) this.kick(at, 0.2);
      this.note(root / (root > 70 ? 2 : 1), at, sixteenth * 0.85, s % 4 === 0 ? 0.05 : 0.13 + 0.05 * I, 'sine');   // the throb: 8, 10 or 12 beats a second, ducking under each kick
      if (s % 4 === 2) this.note(root, at, sixteenth * 1.7, 0.16, 'sine');
      if (L >= 5 && st.roll[s]) this.note(root * (s % 8 === 7 ? 2 : 1), at, sixteenth * 0.9, 0.07 + 0.03 * I, 'sawtooth', { cut: (st.acid ? 260 + 1400 * Math.abs(Math.sin(this.step * 0.11)) : 320 + 700 * I) });
      // high end: hats on the off-beat, then on every sixteenth, then open hats and a clap
      if (s % 4 === 2) this.hit(at, 0.04, 0.05, 'highpass', 9000);
      if (L >= 3 || rush > 0.5) this.hit(at, 0.02, s % 2 ? 0.016 : 0.028, 'highpass', 10000);
      if (L >= 4 && s % 4 === 2) this.hit(at, 0.13, 0.03 + 0.015 * I, 'highpass', 6500);
      if (L >= 2 && (s === 4 || s === 12)) { this.hit(at, 0.12, 0.085, 'bandpass', 1500); this.hit(at + 0.012, 0.09, 0.05, 'highpass', 2200); }
      if (build && L >= 3 && s >= 8) this.hit(at, 0.06, 0.03 + (s - 8) * 0.008, 'highpass', 1600 + (s - 8) * 300);   // the roll that winds the bar up
      // the middle: chord stabs, a top line, then a lead
      if (L >= 6 && st.stab[s]) for (const d of [deg, deg + 2, deg + 4, deg + 6]) this.note(this.pitch(st, d), at, sixteenth * 1.3, 0.02 + 0.008 * I, 'sawtooth', { cut: 1500 + 1800 * I });
      if (L >= 8 && !drop) this.note(this.pitch(st, deg + [0, 4, 7, 4, 2, 7, 4, 9][s & 7], 12), at, sixteenth * 0.8, 0.014 + 0.008 * I, 'triangle');
      if (L >= 10 && s % 2 === 0 && sect % 2 === 1 && !build) {
        const n = this.phrase(st, ((bar % 8) >> 1) % 2 * 2 + (bar % 2), deg)[s / 2];
        if (n !== null) this.note(this.pitch(st, n), at, sixteenth * 1.6, 0.036, st.lead, { cut: 2400 + 1200 * I });
      }
      if (rush > 0.4 && s % 8 === 0) this.note(this.pitch(st, s === 0 ? 7 : 6, 12), at, sixteenth * 3, 0.02 + rush * 0.025, 'square', { cut: 3200 });   // the alarm
      this.step++; this.t += sixteenth;
    }
  }
  // A mission is done: a sweep that climbs for a bar, a roll that tightens, then a crash and a chord an octave up.
  crescendo() {
    if (this.station < 0) return;
    const st = STATIONS[this.station], t0 = Math.max(this.t || 0, this.ctx.currentTime + 0.05), six = 1 / PULSE[tierOf(this.level)], deg = st.chords[0];
    for (let k = 0; k < 16; k++) { const at = t0 + k * six; this.hit(at, six * 0.9, 0.02 + k * 0.006, 'bandpass', 600 + k * 520); if (k >= 8 || k % 2 === 0) this.hit(at, 0.05, 0.03 + k * 0.004, 'highpass', 1800); this.note(this.pitch(st, deg + (k >> 1), 0), at, six * 0.8, 0.012 + k * 0.002, 'sawtooth', { cut: 900 + k * 260 }); }
    const end = t0 + 16 * six; this.hit(end, 1.1, 0.14, 'highpass', 5200); this.kick(end, 0.42);
    for (const d of [deg, deg + 2, deg + 4, deg + 7]) this.note(this.pitch(st, d, 12), end, 1.2, 0.035, 'sawtooth', { cut: 4200 });
  }
  update() { if (this.on && this.station >= 0) this.schedule(this.ctx.currentTime + 0.22); }
}
