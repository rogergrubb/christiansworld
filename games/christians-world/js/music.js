// The car radio. Nothing here is a recording: each station is a recipe (speed, key, chords, drum pattern,
// instruments) and the tunes are worked out note by note as they play.
import { rng } from './util.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const LOUD = 2.9;   // the recipes below are written quietly; this brings the mix up to sit just under the engine

// Every station is written to push: quick tempos, a kick on every beat, basslines that never sit still.
// On top of that the game sets `rush` (0 to 1) when robots are close or a clock is running out, and the band speeds up,
// the hats double and an alarm note starts to pulse.
export const STATIONS = [
  {
    name: 'Rush Hour', bpm: 144, key: 62, scale: MAJOR, chords: [0, 5, 3, 4], swing: 0,
    lead: { type: 'square', vol: 0.05, len: 0.6, oct: 12, cut: 3000 }, arp: { type: 'square', vol: 0.03, every: 1, oct: 12 }, bass: { type: 'sawtooth', vol: 0.09, cut: 600, pat: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1] },
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0], hat: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1], busy: 0.85,
  },
  {
    name: 'Red Alert', bpm: 160, key: 52, scale: MINOR, chords: [0, 0, 5, 6], swing: 0,
    lead: { type: 'sawtooth', vol: 0.045, len: 0.55, oct: 12, cut: 2400 }, arp: { type: 'square', vol: 0.032, every: 1, oct: 12 }, bass: { type: 'sawtooth', vol: 0.1, cut: 480, pat: [1, 1, 5, 1, 1, 1, 5, 1, 1, 1, 5, 1, 1, 5, 1, 5] },
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0], snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1], hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], busy: 0.9, alarm: true,
  },
  {
    name: 'Turbo Beats', bpm: 152, key: 57, scale: MINOR, chords: [0, 5, 2, 6], swing: 0,
    lead: { type: 'sawtooth', vol: 0.04, len: 0.7, oct: 12, cut: 2100 }, arp: { type: 'square', vol: 0.03, every: 1, oct: 12 }, bass: { type: 'sawtooth', vol: 0.09, cut: 540, pat: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1] },
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1], hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1], busy: 0.78,
  },
];

export class Radio {
  // ctx: an AudioContext (or an offline one, for tests); out: the node to play into
  constructor(ctx, out, noise) {
    this.ctx = ctx; this.noise = noise;
    this.gain = ctx.createGain(); this.gain.gain.value = 0; this.gain.connect(out);
    this.level = 0.8; this.station = -1; this.on = false; this.t = 0; this.step = 0; this.notes = 0; this.shift = 0; this.phrases = new Map(); this.rush = 0;
  }
  get name() { return this.station < 0 ? 'Radio off' : STATIONS[this.station].name; }
  tune(i) { this.station = i; this.step = 0; this.t = 0; this.phrases = new Map(); }
  // Fade in when Christian is driving, out when he is not.
  play(on) { if (on === this.on) return; this.on = on; this.gain.gain.setTargetAtTime(on && this.station >= 0 ? this.level * LOUD : 0, this.ctx.currentTime, on ? 0.4 : 0.25); if (on) this.t = 0; }
  setLevel(v) { this.level = v; if (this.on) this.gain.gain.setTargetAtTime(this.station >= 0 ? v * LOUD : 0, this.ctx.currentTime, 0.1); }
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
  kick(at) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.11); g.gain.setValueAtTime(0.22, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16); o.connect(g); g.connect(this.gain); o.start(at); o.stop(at + 0.18); this.notes++; }
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
    const st = STATIONS[this.station], rush = this.rush, sixteenth = 60 / (st.bpm * (1 + 0.14 * rush)) / 4;
    if (!this.t || this.t < this.ctx.currentTime - 0.5) this.t = this.ctx.currentTime + 0.06;
    while (this.t < until) {
      const s = this.step % 16, bar = (this.step / 16) | 0, sect = (bar / 8) | 0, deg = st.chords[bar % st.chords.length];
      this.shift = (sect % 6) === 4 ? 2 : 0;                       // now and then the whole tune steps up, then comes home
      const quiet = rush < 0.3 && sect % 4 === 3 && bar % 8 < 2;   // a short breather, never while things are tense
      const at = this.t + (s % 2 ? st.swing * sixteenth : 0);
      if (st.kick[s]) this.kick(at);
      if (st.snare[s]) this.hit(at, 0.11, 0.1, 'highpass', 1600);
      if (st.hat[s] || rush > 0.5) this.hit(at, 0.03, 0.026 + rush * 0.012, 'highpass', 7000);
      if (rush > 0.6 && s % 4 === 2) this.hit(at, 0.09, 0.05, 'highpass', 1900);                                  // danger: a snare between every beat
      if ((st.alarm || rush > 0.4) && s % 8 === 0) this.note(this.pitch(st, s === 0 ? 7 : 6, 12), at, sixteenth * 3, 0.022 + rush * 0.03, 'square', { cut: 3200 });   // the alarm
      if (s === 12 && bar % 4 === 3) for (let k = 0; k < 4; k++) this.hit(at + k * sixteenth, 0.07, 0.035 + k * 0.012, 'highpass', 1500);   // a drum roll into every fourth bar
      if (st.bass.pat[s]) this.note(this.pitch(st, deg, -24) * (st.bass.pat[s] === 5 ? 1.5 : 1), at, sixteenth * 1.9, st.bass.vol, st.bass.type, { cut: st.bass.cut });
      if (st.pad && s === 0) for (const d of [deg, deg + 2, deg + 4]) this.note(this.pitch(st, d), at, sixteenth * 15.5, st.pad, 'triangle', { slow: true });
      if (!quiet && s % st.arp.every === 0 && (st.arp.every > 1 || s % 4 !== 0)) this.note(this.pitch(st, deg + [0, 2, 4, 2, 7, 4, 2, 4][(s / st.arp.every) & 7], st.arp.oct), at, sixteenth * 1.4, st.arp.vol, st.arp.type, { bell: st.arp.bell });
      if (!quiet && s % 2 === 0 && (sect % 4 !== 0 || bar % 8 >= 4)) {
        // the tune: phrase A twice, B once, A again
        const id = [0, 0, 1, 0][((bar % 8) / 2) | 0] + (sect % 2) * 2, n = this.phrase(st, id * 2 + (bar % 2), deg)[s / 2];
        if (n !== null) this.note(this.pitch(st, n, st.lead.oct - 12), at, sixteenth * 2 * st.lead.len + 0.05, st.lead.vol, st.lead.type, { cut: st.lead.cut, bell: st.lead.bell });
      }
      this.step++; this.t += sixteenth;
    }
  }
  update() { if (this.on && this.station >= 0) this.schedule(this.ctx.currentTime + 0.22); }
}
