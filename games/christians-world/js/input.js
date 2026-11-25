// Keyboard, mouse-drag camera and touch controls, folded into one snapshot per frame.
const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

// Controller buttons and the keys they stand for (standard layout: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 7 RT, 8 back, 9 start, 10-11 stick clicks, 12-15 d-pad).
// LB is the radio in a car and "next tool" on foot; RB uses the tool in hand; the stick clicks open the toolbox and move the camera.
const PAD_KEYS = [[0, 'Space'], [1, 'ShiftLeft'], [2, 'KeyE'], [3, 'KeyH'], [4, 'KeyN'], [4, 'KeyQ'], [5, 'KeyF'], [7, 'PadRT'], [8, 'KeyM'], [9, 'Escape'], [10, 'KeyG'], [11, 'KeyC'], [12, 'KeyB'], [13, 'KeyV'], [14, 'KeyR'], [15, 'KeyT']];

export class Input {
  constructor() {
    this.down = new Set(); this.hit = new Set();
    this.lookX = 0; this.lookY = 0; this.dragging = false;
    this.touch = { mx: 0, my: 0, jump: false, used: false };
    this.virtual = null; // tests drive the game through this
    this.pad = { on: false, mx: 0, my: 0, gas: 0, was: [] }; this.padUsed = false; this.wheel = 0;
  }
  attach(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (BLOCK.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code); this.hit.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.dragging = false; });
    canvas.addEventListener('mousedown', (e) => { this.dragging = true; this.px = e.clientX; this.py = e.clientY; });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.lookX += e.clientX - this.px; this.lookY += e.clientY - this.py; this.px = e.clientX; this.py = e.clientY;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    this.touchSetup();
  }
  touchSetup() {
    const stick = document.getElementById('stick'), knob = document.getElementById('knob'), look = document.getElementById('look');
    if (!stick) return;
    let sid = null, ox = 0, oy = 0, lid = null, lx = 0, ly = 0;
    const end = (e) => {
      if (e.pointerId === sid) { sid = null; this.touch.mx = this.touch.my = 0; knob.style.transform = 'translate(-50%,-50%)'; }
      if (e.pointerId === lid) lid = null;
    };
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; stick.setPointerCapture(sid); this.touch.used = true; move(e); });
    const move = (e) => {
      if (e.pointerId === sid) {
        let dx = e.clientX - ox, dy = e.clientY - oy; const m = Math.hypot(dx, dy), max = 46;
        if (m > max) { dx *= max / m; dy *= max / m; }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.touch.mx = dx / max; this.touch.my = -dy / max;
      } else if (e.pointerId === lid) { this.lookX += (e.clientX - lx) * 1.6; this.lookY += (e.clientY - ly) * 1.6; lx = e.clientX; ly = e.clientY; }
    };
    stick.addEventListener('pointermove', move); stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    look.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; lid = e.pointerId; lx = e.clientX; ly = e.clientY; look.setPointerCapture(lid); });
    look.addEventListener('pointermove', move); look.addEventListener('pointerup', end); look.addEventListener('pointercancel', end);
    for (const b of document.querySelectorAll('[data-key]')) {
      const code = b.dataset.key;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.down.add(code); this.hit.add(code); this.touch.used = true; });
      const up = () => this.down.delete(code);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    }
  }
  // A game controller, read once a frame. Buttons act as the keys they stand for, so the rest of the game
  // needs to know nothing about controllers. Sticks: left moves and steers, right looks around.
  // Triggers: right is the accelerator, left is brake and reverse.
  poll(dt) {
    const p = this.pad; let pads = [];
    // inside some frames the browser refuses controller access outright; ask once and then leave it alone
    if (!this.noPads) try { pads = (typeof navigator !== 'undefined' && navigator.getGamepads && navigator.getGamepads()) || []; } catch (e) { this.noPads = true; }
    let g = null; for (const q of pads) if (q && q.connected && q.buttons.length >= 10) { g = q; break; }
    if (!g) { if (p.on) { p.on = false; p.mx = p.my = p.gas = 0; PAD_KEYS.forEach(([, code], i) => { if (p.was[i]) this.down.delete(code); }); p.was = []; } return; }
    p.on = true; this.device = g;
    const dead = (v) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
    p.mx = dead(g.axes[0] || 0); p.my = -dead(g.axes[1] || 0);
    const lx = dead(g.axes[2] || 0), ly = dead(g.axes[3] || 0);
    if (lx || ly) { this.lookX += lx * 520 * dt; this.lookY += ly * 300 * dt; }
    p.gas = (g.buttons[7] ? g.buttons[7].value : 0) - (g.buttons[6] ? g.buttons[6].value : 0);
    PAD_KEYS.forEach(([k, code], i) => {
      const q = g.buttons[k], on = !!q && (k === 7 ? q.value > 0.5 : q.pressed);
      if (on && !p.was[i]) { this.down.add(code); this.hit.add(code); this.padUsed = true; } else if (!on && p.was[i]) this.down.delete(code);
      p.was[i] = on;
    });
    if (p.mx || p.my || p.gas) this.padUsed = true;
  }
  // A short buzz in the controller, where it has one. strong and weak run from 0 to 1.
  rumble(strong, weak, ms = 160) {
    const a = this.pad.on && this.device && this.device.vibrationActuator; if (!a || !a.playEffect) return;
    try { a.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) })?.catch?.(() => {}); } catch (e) { /* no rumble on this controller */ }
  }
  // One step round a menu: arrow keys, W A S D, or a flick of the controller's stick. Returns [dx, dy] or null.
  nav() {
    const p = this.pad, sx = p.on ? Math.round(p.mx * 0.72) : 0, sy = p.on ? Math.round(-p.my * 0.72) : 0;
    let dx = (this.pressed('ArrowRight', 'KeyD') ? 1 : 0) - (this.pressed('ArrowLeft', 'KeyA') ? 1 : 0), dy = (this.pressed('ArrowDown', 'KeyS') ? 1 : 0) - (this.pressed('ArrowUp', 'KeyW') ? 1 : 0);
    if (!dx && !dy && (sx !== this.navX || sy !== this.navY)) { dx = sx; dy = sy; }
    this.navX = sx; this.navY = sy;
    return dx || dy ? [dx, dy] : null;
  }
  key(...codes) { for (const c of codes) if (this.down.has(c)) return true; return false; }
  pressed(...codes) { for (const c of codes) if (this.hit.has(c)) return true; return false; }
  // One snapshot of everything the game reads this frame.
  read() {
    if (this.virtual) return { mx: 0, my: 0, run: false, jump: false, action: false, horn: false, handbrake: false, fire: false, rt: false, jumpHeld: false, ...this.virtual };
    let mx = (this.key('KeyD', 'ArrowRight') ? 1 : 0) - (this.key('KeyA', 'ArrowLeft') ? 1 : 0);
    let my = (this.key('KeyW', 'ArrowUp') ? 1 : 0) - (this.key('KeyS', 'ArrowDown') ? 1 : 0);
    if (Math.abs(this.touch.mx) > 0.12 || Math.abs(this.touch.my) > 0.12) { mx = this.touch.mx; my = this.touch.my; }
    const p = this.pad; let gas;
    if (p.on && (p.mx || p.my || p.gas)) { mx = p.mx; my = p.my; if (p.gas) gas = p.gas; }
    return {
      mx, my, gas,
      run: this.key('ShiftLeft', 'ShiftRight') || Math.hypot(this.touch.mx, this.touch.my) > 0.92 || (p.on && Math.hypot(p.mx, p.my) > 0.9),
      jump: this.pressed('Space'), jumpHeld: this.key('Space'), handbrake: this.key('Space'), up: this.key('Space'), down: this.key('ShiftLeft', 'ShiftRight'),
      action: this.pressed('KeyE', 'Enter'),
      // the tool in hand: F, the touch button, RB; the right trigger too, but only on foot (in a car it is the accelerator)
      fire: this.key('KeyF'), rt: this.key('PadRT'),
      horn: this.key('KeyH'),
    };
  }
  endFrame() { this.hit.clear(); this.lookX = 0; this.lookY = 0; this.wheel = 0; if (this.virtual) this.virtual.action = this.virtual.jump = false; }
}
