// HUD, minimap, dialogs and menus. All DOM; the 3D view lives in main.js.
import { MAP_SCALE, POI } from './world.js';
import { fmtTime, fmtDist } from './util.js';
import { GEAR, useText } from './gear.js';
import { RELICS, Vault } from './relics.js';

const $ = (id) => document.getElementById(id);
const PLACES = [
  ['Home', -250, 252], ['Town Hall', -50, -88], ['Park', 60, -66], ['School', -150, -190], ['Garage', 150, -190], ['Pizza', -150, 190], ['Taxi', 128, 192],
  ['Maple Farm', 600, 136], ['Sunset Camp', POI.camp.x + 6, POI.camp.z + 34], ['Lake', POI.lake.x, POI.lake.z], ['Sandy Beach', 0, 670], ['Summit', POI.summit.x, POI.summit.z],
  ['Stunt Park', POI.stunt.x, POI.stunt.z], ['Soccer', POI.soccer.x, POI.soccer.z], ['Trailhead', 92, -604],
  ['Treasure Islet', POI.islet.x, POI.islet.z + 62], ['Pier', 34, 772],
];

function star(g, x, y, r, fill, stroke = '#1d232b') {
  g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = stroke; g.stroke();
}
// A parked boat or helicopter on the map.
function ride(g, x, y, kind, r = 9) {
  dot(g, x, y, r, kind === 'heli' ? '#8e44ad' : '#1fb7c9');
  g.save(); g.translate(x, y); g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.24; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
  if (kind === 'heli') { g.moveTo(-r * 0.55, -r * 0.55); g.lineTo(r * 0.55, r * 0.55); g.moveTo(r * 0.55, -r * 0.55); g.lineTo(-r * 0.55, r * 0.55); }
  else { g.moveTo(-r * 0.6, r * 0.12); g.lineTo(r * 0.6, r * 0.12); g.lineTo(r * 0.32, r * 0.52); g.lineTo(-r * 0.32, r * 0.52); g.closePath(); g.moveTo(0, r * 0.1); g.lineTo(0, -r * 0.62); g.lineTo(r * 0.42, -r * 0.08); }
  g.stroke(); g.restore();
}
function dot(g, x, y, r, fill, stroke = '#ffffff') { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fillStyle = fill; g.fill(); g.lineWidth = 2.5; g.strokeStyle = stroke; g.stroke(); }

export class UI {
  constructor(game) {
    this.g = game;
    this.mm = $('minimap').getContext('2d');
    this.dialogOpen = false; this.pauseOpen = false; this.mapOpen = false; this.bookOpen = false; this.toolsOpen = false; this.toolSel = 0; this.toolCards = [];
    this.toastT = 0; this.bannerT = 0; this.last = {};
    $('dlg-yes').addEventListener('click', () => this.answer(true));
    $('dlg-no').addEventListener('click', () => this.answer(false));
    $('dlg-alt').addEventListener('click', () => this.answer('alt'));
    $('book-close').addEventListener('click', () => this.book(false));
    $('tools-close').addEventListener('click', () => this.tools(false));
    this.vault = new Vault(); this.relicId = null; this.thumbRun = 0;
    $('relic-back').addEventListener('click', () => this.relic(null)); $('relic-act').addEventListener('click', () => this.relicAct());
    $('btn-tools').addEventListener('click', () => { if (this.g.mode === 'play' && !this.g.paused && !this.dialogOpen && !this.mapOpen && !this.bookOpen && !this.g.cine) this.tools(true); });
    $('photo-back').addEventListener('click', () => { $('photo-view').hidden = true; $('view').focus(); });
    $('btn-book').addEventListener('click', () => { if (this.g.mode === 'play' && !this.g.paused && !this.dialogOpen && !this.mapOpen && !this.toolsOpen && !this.g.cine) this.book(true); });
    $('map-close').addEventListener('click', () => this.map(false));
    $('btn-map').addEventListener('click', () => this.map(true));
    $('btn-pause').addEventListener('click', () => game.pause(true));
    if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
    window.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
  }
  set(id, text) { if (this.last[id] !== text) { this.last[id] = text; $(id).textContent = text; } }
  show(id, on) { const k = 'v:' + id; if (this.last[k] !== on) { this.last[k] = on; $(id).hidden = !on; } }

  title(on, hasSave) { $('title').hidden = !on; $('hud').hidden = on; if (on) { $('btn-continue').hidden = !hasSave; $('btn-new').classList.toggle('go', !hasSave); } }
  ready() { $('loading').hidden = true; $('btn-new').disabled = false; }

  stats(money, stars, starTotal, done, total) { this.set('st-money', '$' + money); this.set('st-stars', stars + '/' + starTotal); this.set('st-missions', done + '/' + total); }
  objective(o) {
    if (!o) { this.set('obj-name', 'Free roam'); this.set('obj-timer', ''); this.set('obj-text', this.g.freeText()); this.set('obj-hint', ''); $('obj-timer').classList.remove('low'); return; }
    this.set('obj-name', o.title + (o.meta ? '  ' + o.meta : ''));
    this.set('obj-timer', o.timer !== null && o.timer !== undefined ? fmtTime(o.timer) : '');
    $('obj-timer').classList.toggle('low', o.timer !== null && o.timer !== undefined && o.timer <= 15);
    this.set('obj-text', o.text); this.set('obj-hint', o.hint || '');
  }
  clock(text, night) { this.set('clock-time', text); const k = night ? 'n' : 'd'; if (this.last.clockIcon !== k) { this.last.clockIcon = k; $('clock-icon').textContent = night ? '\u263E' : '\u2600'; } }
  speed(mph, name, kind) {
    this.show('speed', mph !== null); this.set('pad-jump', kind === 'heli' ? 'Up' : mph !== null ? 'Brake' : 'Jump');
    if (this.kind !== kind) { this.kind = kind; document.body.classList.toggle('flying', kind === 'heli'); }
    if (mph !== null) { this.set('speed-num', String(mph)); this.set('veh-name', name); }
  }
  prompt(key, text) {
    const k = text ? key + '|' + text + (this.g.input.padUsed ? '|pad' : '') : '';
    if (this.last.prompt === k) return; this.last.prompt = k;
    const el = $('prompt'); el.hidden = !text; el.textContent = '';
    if (text) { const kb = document.createElement('kbd'); kb.textContent = document.body.classList.contains('touch') ? 'Use' : this.g.input.padUsed ? 'X' : key; el.append(kb, document.createTextNode(text)); }
  }
  toast(text, secs = 2.8) { const el = $('toast'); el.textContent = text; el.classList.add('on'); this.toastT = secs; }
  banner(titleText, sub) { $('banner-title').textContent = titleText; $('banner-sub').textContent = sub; $('banner').classList.add('on'); this.bannerT = 2.6; }
  // Streaks at the edge of the screen at very high speed. k runs from 0 to 1.
  lines(k) { k = Math.round(k * 20) / 20; if (k !== this.lineK) { this.lineK = k; $('lines').style.opacity = k; } }
  // The opening flyover: black bars, no dashboard.
  cine(on) { $('hud').classList.toggle('cine', on); $('bars').classList.toggle('on', on); }
  flash() { const el = $('flash'); el.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('on'))); }
  tick(dt) {
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) $('toast').classList.remove('on');
    if (this.stickT > 0 && (this.stickT -= dt) <= 0) $('newsticker').classList.remove('on');
    if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) $('banner').classList.remove('on');
  }

  dialog(o) {
    this.dlg = o; this.dialogOpen = true;
    $('dlg-name').textContent = o.name; $('dlg-text').textContent = o.text;
    $('dlg-reward').hidden = !o.reward; if (o.reward) $('dlg-reward').textContent = 'Reward: $' + o.reward + (o.gift ? `  and the ${o.gift.icon} ${o.gift.name}` : '');
    $('dlg-prize').hidden = !o.prize; if (o.prize) { $('dlg-prize-icon').textContent = o.prize.icon; $('dlg-prize-title').textContent = o.prize.title; $('dlg-prize-text').textContent = o.prize.text; }
    $('dlg-yes').textContent = o.yes || 'OK'; $('dlg-no').hidden = !o.no; if (o.no) $('dlg-no').textContent = o.no;
    $('dlg-alt').hidden = !o.alt; if (o.alt) $('dlg-alt').textContent = o.alt;
    $('dialog').hidden = false; this.g.sound.click();
  }
  answer(yes) {
    if (!this.dialogOpen) return;
    const o = this.dlg; this.dialogOpen = false; this.dlg = null; $('dialog').hidden = true;
    if (yes === 'alt') { if (o.onAlt) o.onAlt(); } else if (yes && o.onYes) o.onYes(); else if (!yes && o.onNo) o.onNo();
    $('view').focus();
  }
  pauseMenu(on, hasMission, soundOn) {
    this.pauseOpen = on; $('pause').hidden = !on;
    $('p-quit').hidden = !hasMission; $('p-sound').textContent = 'Sound: ' + (soundOn ? 'on' : 'off');
    if (!on) $('view').focus();
  }
  // Settings shown in the menu.
  settings(st) { $('s-music').value = st.music; $('s-sfx').value = st.sfx; $('s-quality').value = st.quality; $('s-time').value = st.time; }
  // Photo mode: no dashboard, a strip of camera buttons instead.
  photo(on) { $('hud').classList.toggle('cine', on); $('photobar').hidden = !on; if (!on) { $('photo-view').hidden = true; $('view').focus(); } }
  // The finished photo. canSave says whether this page has any way to hand the file over.
  showPhoto(url, canSave) {
    $('photo-img').src = url; $('photo-save').hidden = !canSave;
    this.photoNote(document.body.classList.contains('touch') ? 'Press and hold the picture to save or share it.' : 'Right-click the picture to save or copy it.');
    $('photo-view').hidden = false;
  }
  photoNote(text) { $('photo-how').textContent = text; }
  // The radio button: shown while driving, with the station's name on it.
  radio(name) { const on = name !== null; if (on !== this.radioOn) { this.radioOn = on; $('btn-radio').hidden = !on; } if (on) this.set('btn-radio', '\u266a ' + name); }
  // Big numbers in the middle of the screen: 3, 2, 1, GO!
  count(text) { const el = $('count'); el.textContent = text; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
  // "New sticker!" with the sticker itself.
  sticker(st, label = 'New sticker!') { $('ns-icon').textContent = st.icon; $('ns-label').textContent = label; $('ns-name').textContent = st.name; $('newsticker').classList.add('on'); this.stickT = 4; }
  // The sticker book: every sticker, earned or still to find.
  book(on) {
    this.bookOpen = on; $('book').hidden = !on; if (!on) { $('view').focus(); return; }
    const g = this.g, grid = $('book-grid'); let have = 0; grid.textContent = '';
    for (const st of g.stickerList) {
      const [, got, need] = g.progress.status(st), earned = g.state.stickers.includes(st.id); if (earned) have++;
      const d = document.createElement('div'); d.className = 'stk' + (earned ? ' got' : '');
      const i = document.createElement('i'); i.textContent = earned ? st.icon : '?';
      const b = document.createElement('b'); b.textContent = st.name;
      const s = document.createElement('span'); s.textContent = earned ? 'Earned!' : need > 1 ? `${st.how} (${got} of ${need})` : st.how;
      d.append(i, b, s); grid.append(d);
    }
    $('book-count').textContent = `${have} of ${g.stickerList.length}`;
    $('book-places').textContent = `Places discovered: ${g.state.places.length} of ${g.placeCount}`;
  }
  // The toolbox: every tool and blaster, earned or still to win. Anything that is held can be picked here.
  tools(on) {
    this.toolsOpen = on; $('tools').hidden = !on; if (!on) { this.relicId = null; $('relic').hidden = true; this.vault.hide(); $('view').focus(); return; }
    const g = this.g, grid = $('tools-grid'), how = g.words(); let have = 0; grid.textContent = ''; this.toolCards = [];
    for (const kind of ['tool', 'blaster']) {
      const h = document.createElement('h3'); h.textContent = kind === 'tool' ? 'Tools' : 'Blasters'; grid.append(h);
      for (const it of GEAR) {
        if (it.kind !== kind) continue;
        const got = g.gear.has(it.id), held = got && !it.worn, inHand = held && g.state.equip === it.id; if (got) have++;
        const d = document.createElement(held ? 'button' : 'div'); d.className = 'stk tool' + (got ? ' got' : '') + (inHand ? ' on' : '');
        const i = document.createElement('i'); i.textContent = it.icon;   // shown even before it is won, greyed out: something to want
        const b = document.createElement('b'); b.textContent = it.name;
        const s = document.createElement('span'); s.textContent = got ? useText(it, how) : `Win it in ${g.missions.byId(it.from).title}`;
        d.append(i, b, s);
        if (got) { const u = document.createElement('u'); u.textContent = it.worn ? 'Always on' : inHand ? 'In your hand' : 'Pick up'; d.append(u); }
        if (held) { d.type = 'button'; d.addEventListener('click', () => { g.gear.equip(it.id); this.tools(true); }); if (inHand) this.toolSel = this.toolCards.length; this.toolCards.push({ el: d, id: it.id }); }
        grid.append(d);
      }
    }
    // Legendary gear: bought with mission money. Every card opens the display stand, where it turns in full detail.
    const h = document.createElement('h3'); h.textContent = `Legendary gear · you have $${g.state.money}`; grid.append(h); const waiting = [];
    const pic = (i, src) => { const im = new Image(); im.alt = ''; im.src = src; i.textContent = ''; i.append(im); };
    for (const it of RELICS) {
      const got = g.gear.has(it.id), inHand = got && g.state.equip === it.id; if (got) have++;
      const d = document.createElement('button'); d.type = 'button'; d.className = 'stk tool relic' + (got ? ' got' : '') + (inHand ? ' on' : '');
      const i = document.createElement('i'); i.textContent = it.icon; if (this.vault.thumbs[it.id]) pic(i, this.vault.thumbs[it.id]); else waiting.push([i, it.id]);
      const b = document.createElement('b'); b.textContent = it.name;
      const s = document.createElement('span'); s.textContent = got ? useText(it, how) : it.tale;
      const u = document.createElement('u'); u.textContent = inHand ? 'In your hand' : got ? 'Pick up' : `$${it.price}`;
      d.append(i, b, s, u); d.addEventListener('click', () => this.relic(it.id));
      if (inHand) this.toolSel = this.toolCards.length; this.toolCards.push({ el: d, id: it.id, relic: true }); grid.append(d);
    }
    // the pictures are drawn one at a time so the toolbox opens straight away
    const run = ++this.thumbRun, next = () => { const job = waiting.shift(); if (!job || run !== this.thumbRun || !this.toolsOpen) return; const src = this.vault.thumb(job[1]); if (src) pic(job[0], src); setTimeout(next, 20); }; setTimeout(next, 40);
    $('tools-count').textContent = `${have} of ${GEAR.length}`;
    $('tools-help').textContent = !this.toolCards.length ? 'Finish missions to fill the toolbox.' : how === 'touch' ? 'Tap something to hold it. The round tool button uses it.' : how === 'pad' ? 'Move with the stick and press A to hold something. RB uses it, LB swaps.' : 'Click something to hold it. F uses it, Q swaps to the next one.';
    this.toolMark();
  }
  // The display stand for one piece of legendary gear: a turntable, what it does, and Buy or Hold.
  relic(id) {
    this.relicId = id; $('relic').hidden = !id;
    if (!id) { this.vault.hide(); if (this.toolsOpen) this.tools(true); return; }
    const it = RELICS.find((q) => q.id === id), st = $('relic-stats');
    $('relic-name').textContent = it.name; $('relic-tale').textContent = it.tale; $('relic-use').textContent = useText(it, this.g.words()); st.textContent = '';
    ['Power', 'Speed', 'Reach'].forEach((name, k) => { const row = document.createElement('div'), l = document.createElement('span'); l.textContent = name; row.append(l); for (let n = 1; n <= 5; n++) { const pip = document.createElement('i'); if (n <= it.stats[k]) pip.className = 'on'; row.append(pip); } st.append(row); });
    this.vault.show(id, $('relic-view')); this.relicPaint();
  }
  relicPaint() {
    const g = this.g, it = RELICS.find((q) => q.id === this.relicId), got = g.gear.owned.includes(it.id), inHand = got && g.state.equip === it.id, money = g.state.money, act = $('relic-act');
    act.textContent = inHand ? 'In your hand' : got ? 'Hold it' : `Buy for $${it.price}`; act.disabled = inHand || (!got && money < it.price);
    $('relic-note').textContent = got ? 'Yours for keeps.' : money >= it.price ? `You have $${money}.` : `You have $${money}. Earn $${it.price - money} more: missions, treasure and fish all pay.`;
  }
  relicAct() {
    const g = this.g, id = this.relicId; if (!id || $('relic-act').disabled) return;
    if (g.gear.owned.includes(id)) { g.gear.equip(id); this.tools(false); }
    else if (g.gear.buy(id)) { this.vault.flash(); this.relicPaint(); }
  }
  toolMark() { this.toolCards.forEach((c, k) => c.el.classList.toggle('sel', k === this.toolSel)); const c = this.toolCards[this.toolSel]; if (c) c.el.scrollIntoView({ block: 'nearest' }); }
  // Keys and controller on the toolbox screen.
  toolsKeys(inp) {
    if (this.relicId) { if (inp.pressed('KeyG', 'Escape', 'KeyB') || (inp.pad.on && inp.pressed('ShiftLeft'))) this.relic(null); else if (inp.pressed('Enter', 'KeyE', 'Space', 'KeyF')) this.relicAct(); return; }
    if (inp.pressed('KeyG', 'Escape', 'KeyB') || (inp.pad.on && inp.pressed('ShiftLeft'))) return this.tools(false);
    const n = this.toolCards.length; if (!n) return;
    const mv = inp.nav();
    if (mv) { this.toolSel = (this.toolSel + (mv[0] || mv[1]) + n) % n; this.toolMark(); this.g.sound.tick(); }
    else if (inp.pressed('Enter', 'KeyE', 'Space', 'KeyF')) { const c = this.toolCards[this.toolSel]; if (c.relic) this.relic(c.id); else { this.g.gear.equip(c.id); this.tools(false); } }
  }
  // What is in Christian's hand, bottom left: its name, a note, and a meter (fuel, or how soon it can be used again).
  gear(c) {
    this.show('gear', !!c); if (!c) return;
    this.set('gear-icon', c.icon); this.set('gear-name', c.name); this.set('gear-note', c.note || '');
    const m = c.meter === null || c.meter === undefined ? null : Math.round(Math.max(0, Math.min(1, c.meter)) * 25) / 25;
    this.show('gear-meter', m !== null); if (m !== null && this.last.gearM !== m) { this.last.gearM = m; $('gear-fill').style.width = m * 100 + '%'; }
    this.show('gear-key', !!c.key); this.show('gear-next', !!c.next);
  }
  // Touch buttons change with what Christian is doing. o: { onFoot, fire (a chip, or null), swap, fuel (0 to 1, or null) }.
  pads(o) {
    const k = (o.onFoot ? 'f' : 'c') + (o.fire ? o.fire.icon : '') + (o.swap ? 's' : '') + (o.fuel !== null ? 'j' : '') + (o.five ? '5' : '');
    if (this.last.pads !== k) {
      this.last.pads = k; const cl = document.body.classList;
      cl.toggle('onfoot', o.onFoot); cl.toggle('hasfire', !!o.fire); cl.toggle('hasswap', !!o.swap); cl.toggle('jet', o.fuel !== null); cl.toggle('pad5', !!o.five);
      if (o.fire) { $('pad-fire').textContent = o.fire.icon; $('pad-fire').setAttribute('aria-label', o.fire.label || o.fire.name); }
    }
    const fm = o.fire && o.fire.meter !== null && o.fire.meter !== undefined && o.fire.key ? Math.round(Math.max(0, Math.min(1, o.fire.meter)) * 20) / 20 : 1;
    if (this.last.padM !== fm) { this.last.padM = fm; $('pad-fire').style.setProperty('--m', fm); }
    const jm = o.fuel === null ? 1 : Math.round(o.fuel * 20) / 20;
    if (this.last.padJ !== jm) { this.last.padJ = jm; $('pad-jump').style.setProperty('--m', jm); }
  }
  map(on) { this.mapOpen = on; $('bigmap').hidden = !on; if (on) this.drawBigMap(); else $('view').focus(); }

  pointer(angle, dist, dy = 0) {
    this.show('pointer', angle !== null);
    if (angle === null) return;
    $('pointer-arrow').style.transform = `rotate(${angle}rad)`;
    this.set('pointer-dist', fmtDist(dist) + (dy > 8 ? ' \u25b2 higher' : dy < -8 ? ' \u25bc lower' : ''));
  }

  // Round map that turns with the camera, so "up" is always where you are looking.
  drawMinimap(s) {
    const g = this.mm, W = 392, R = W / 2, world = this.g.world;
    const th = s.yaw - Math.PI, c = Math.cos(th), sn = Math.sin(th), zoom = s.zoom * 2;
    const w2s = (x, z) => { const dx = (x - s.x) * zoom, dz = (z - s.z) * zoom; return [R + dx * c - dz * sn, R + dx * sn + dz * c]; };
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#56b2e8'; g.fillRect(0, 0, W, W);
    g.translate(R, R); g.rotate(th); g.scale(zoom / MAP_SCALE, zoom / MAP_SCALE);
    const [mx, my] = world.toMap(s.x, s.z); g.translate(-mx, -my);
    g.drawImage(world.mapCanvas, 0, 0);
    if (s.route && s.route.length > 1) {
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (const [col, wd] of [['#1d232b', 9], ['#ffd21f', 5.5]]) {
        g.strokeStyle = col; g.lineWidth = (wd * MAP_SCALE) / zoom * 1.6; g.beginPath();
        s.route.forEach(([x, z], k) => { const [a, b] = world.toMap(x, z); if (k) g.lineTo(a, b); else g.moveTo(a, b); });
        g.stroke();
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const edge = (x, z, pad = 18) => { let [a, b] = w2s(x, z); const dx = a - R, dy = b - R, d = Math.hypot(dx, dy), lim = R - pad; const out = d > lim; if (out) { a = R + (dx / d) * lim; b = R + (dy / d) * lim; } return [a, b, out]; };
    for (const m of s.givers) { const [a, b, out] = edge(m.x, m.z); if (out && m.done) continue; star(g, a, b, out ? 11 : 14, m.done ? '#8fd3a0' : m.locked ? '#c9c9c9' : '#ffd21f'); }
    for (const v of s.rides) { const [a, b, out] = edge(v.x, v.z); if (!out) ride(g, a, b, v.kind, 12); }
    for (const it of s.items) { const [a, b, out] = edge(it.x, it.z); if (!out) dot(g, a, b, 7, '#e23b2e'); }
    for (const q of s.bots) { const [a, b, out] = edge(q.x, q.z); if (!out) dot(g, a, b, q.big ? 10 : 5.5, '#8e44ad'); }
    if (s.target) { const [a, b] = edge(s.target.x, s.target.z, 16); dot(g, a, b, 11, '#e23b2e'); dot(g, a, b, 4, '#ffffff', '#e23b2e'); }
    // the player
    const ph = s.heading - s.yaw;
    g.save(); g.translate(R, R); g.rotate(-ph);
    g.beginPath(); g.moveTo(0, -17); g.lineTo(12, 13); g.lineTo(0, 6); g.lineTo(-12, 13); g.closePath();
    g.fillStyle = '#2d6cdf'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = '#ffffff'; g.stroke(); g.restore();
    // north marker
    const nx = R + Math.cos(Math.atan2(-c, sn)) * (R - 20), ny = R + Math.sin(Math.atan2(-c, sn)) * (R - 20);
    g.font = '26px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.strokeText('N', nx, ny); g.fillStyle = '#e23b2e'; g.fillText('N', nx, ny);
    return w2s;
  }

  drawBigMap() {
    const world = this.g.world, s = this.g.mapState(), cv = $('bigmap-canvas');
    // show the island, not the empty sea around it
    const crop = { x: 105, y: 20, w: 790, h: 1050 };
    const scale = Math.min((innerWidth - 48) / crop.w, (innerHeight - 170) / crop.h, 1.6);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(crop.w * scale * dpr); cv.height = Math.round(crop.h * scale * dpr);
    cv.style.width = Math.round(crop.w * scale) + 'px'; cv.style.height = Math.round(crop.h * scale) + 'px';
    const g = cv.getContext('2d'), k = scale * dpr, u = 1 / scale; // u: one screen pixel in map units
    g.setTransform(k, 0, 0, k, -crop.x * k, -crop.y * k); g.drawImage(world.mapCanvas, 0, 0);
    const P = (x, z) => world.toMap(x, z);
    if (s.route && s.route.length > 1) {
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (const [col, wd] of [['#1d232b', 7], ['#ffd21f', 4]]) { g.strokeStyle = col; g.lineWidth = wd * u; g.beginPath(); s.route.forEach(([x, z], i) => { const [a, b] = P(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); }
    }
    const at = (x, z, draw) => { const [a, b] = P(x, z); g.save(); g.translate(a, b); g.scale(u, u); draw(); g.restore(); };
    g.font = '700 13px "Atkinson Hyperlegible", Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [name, x, z] of PLACES) at(x, z, () => { g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.92)'; g.strokeText(name, 0, 0); g.fillStyle = '#1d232b'; g.fillText(name, 0, 0); });
    for (const m of s.givers) at(m.x, m.z, () => star(g, 0, 0, 11, m.done ? '#8fd3a0' : m.locked ? '#c9c9c9' : '#ffd21f'));
    for (const v of s.rides) at(v.x, v.z, () => ride(g, 0, 0, v.kind, 9));
    for (const it of s.items) at(it.x, it.z, () => dot(g, 0, 0, 5, '#e23b2e'));
    for (const q of s.bots) at(q.x, q.z, () => dot(g, 0, 0, q.big ? 7 : 4, '#8e44ad'));
    if (s.target) at(s.target.x, s.target.z, () => { dot(g, 0, 0, 9, '#e23b2e'); dot(g, 0, 0, 3.5, '#ffffff', '#e23b2e'); });
    at(s.x, s.z, () => { g.rotate(Math.PI - s.heading); g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fillStyle = '#2d6cdf'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); });
  }
}
