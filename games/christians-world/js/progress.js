// Things to find and things to earn: the places on the island, and the sticker book.
import { POI } from './world.js';
import { GEAR, TREASURE } from './gear.js';

// A place is discovered the first time Christian comes within r metres of it.
export const PLACES = [
  ['home', 'Home', POI.home.x, POI.home.z - 10, 30],
  ['hall', 'Town Hall', POI.townHall.front.x, POI.townHall.front.z, 34],
  ['park', 'Central Park', POI.park.x, POI.park.z, 36],
  ['school', 'Sunny Side School', POI.school.yard.x, POI.school.yard.z, 36],
  ['garage', "Speedy's Garage", POI.garage.lot.x, POI.garage.lot.z, 36],
  ['pizza', 'Slice Shack', POI.pizza.lot.x, POI.pizza.lot.z, 34],
  ['taxi', 'Taxi Depot', POI.taxi.lot.x, POI.taxi.lot.z, 26],
  ['police', 'Police Station', POI.police.car.x + 10, POI.police.car.z, 22],
  ['farm', 'Maple Farm', POI.farm.barn.x, POI.farm.barn.z - 20, 50],
  ['windmill', 'The Windmill', POI.farm.windmill.x, POI.farm.windmill.z, 30],
  ['camp', 'Sunset Camp', POI.camp.x, POI.camp.z, 45],
  ['lake', 'Mirror Lake', POI.lake.x, POI.lake.z, 80],
  ['beach', 'Sandy Beach', POI.beach.x, POI.beach.z, 45],
  ['pier', 'The Pier', POI.beach.pierEnd.x, POI.beach.pierEnd.z - 12, 22],
  ['lighthouse', 'The Lighthouse', POI.beach.lighthouse.x, POI.beach.lighthouse.z, 22],
  ['base', 'Base Camp', POI.base.x, POI.base.z - 20, 45],
  ['summit', 'The Summit', POI.summit.x, POI.summit.z, 30],
  ['stunt', 'Stunt Park', POI.stunt.x, POI.stunt.z, 50],
  ['soccer', 'Soccer Field', POI.soccer.x, POI.soccer.z, 50],
  ['airfield', 'The Airfield', POI.airfield.x, POI.airfield.z, 16],
  ['islet', 'Treasure Islet', POI.islet.x, POI.islet.z, 32],
].map(([id, name, x, z, r]) => ({ id, name, x, z, r }));

const done = (id) => (g) => g.state.done.includes(id);
const TOOLS = GEAR.filter((q) => q.kind === 'tool').length, BLASTERS = GEAR.length - TOOLS;
const owned = (kind) => (g) => g.state.gear.filter((id) => GEAR.some((q) => q.id === id && q.kind === kind)).length;
const upTo = (n, get) => (g) => [Math.min(n, Math.floor(get(g))), n];
// icon, name, how to earn it, and a test that says whether it has been earned (some also report progress)
export const STICKERS = [
  ['welcome', '🚗', 'First Drive', 'Finish Welcome Home', done('welcome')],
  ['pizza', '🍕', 'Pizza Dash', 'Deliver the pizzas', done('pizza')],
  ['taxi', '🚕', 'Taxi Time', 'Drive the taxi riders', done('taxi')],
  ['bus', '🚌', 'School Bus Run', 'Take the kids to school', done('bus')],
  ['farm', '🚜', 'Farm Hands', 'Bring in the hay', done('farm')],
  ['puppies', '🐶', 'Lost Puppies', 'Find all five puppies', done('puppies')],
  ['mountain', '🏔️', 'Mountain Explorer', 'Drive to the summit', done('mountain')],
  ['rings', '🚁', 'Sky Rings', 'Fly through the rings', done('rings')],
  ['kittens', '🐱', 'Rooftop Rescue', 'Rescue the kittens', done('kittens')],
  ['slalom', '🚤', 'Harbor Slalom', 'Sail the buoy course', done('slalom')],
  ['bottles', '✉️', 'Message in a Bottle', 'Collect the bottles', done('bottles')],
  ['icecream', '🍦', 'Ice Cream Rush', 'Serve the ice cream', done('icecream')],
  ['bandit', '🍪', 'Cookie Bandit', 'Catch the purple van', done('bandit')],
  ['stunts', '🎪', 'Stunt Show', 'Do all four tricks', done('stunts')],
  ['lanterns', '🏮', 'Lantern Run', 'Deliver the lanterns', done('lanterns')],
  ['race', '🏁', 'Grand Prix', 'Finish the Grand Prix', done('race')],
  ['gold', '🏆', 'Gold Cup', 'Win the Grand Prix', (g) => g.state.stats.wins > 0],
  ['rocket', '🚀', 'Island Hero', 'Finish every mission', (g) => g.state.rocket],
  ['explorer', '🧭', 'Explorer', 'Discover every place', (g) => [g.state.places.length, PLACES.length]],
  ['stars', '⭐', 'Star Hunter', 'Find 10 gold stars', (g) => [Math.min(10, g.state.stars.length), 10]],
  ['allstars', '🌟', 'Star Master', 'Find every gold star', (g) => [g.state.stars.length, g.starCount]],
  ['keys', '🔑', 'Key Collector', 'Drive 12 kinds of vehicle', (g) => [Math.min(12, g.state.driven.length), 12]],
  ['air', '🪂', 'Big Air', 'Stay in the air for 1.5 seconds', (g) => g.state.stats.air >= 1.5],
  ['speed', '💨', 'Speed Demon', 'Reach 100 mph', (g) => g.state.stats.speed >= 100],
  ['drift', '🌀', 'Drift King', 'Slide for 10 seconds in all', (g) => [Math.min(10, Math.floor(g.state.stats.drift)), 10]],
  ['moo', '🐮', 'Moo!', 'Honk at a cow', (g) => g.state.stats.moos > 0],
  ['owl', '🦉', 'Night Owl', 'Be out at midnight', (g) => g.state.stats.night > 0],
  ['splash', '💦', 'Splash!', 'Fall in the water', (g) => g.state.stats.splashes > 0],
  ['goal', '⚽', 'Goal!', 'Score at the soccer field', (g) => g.state.stats.goals > 0],
  ['roof', '🏙️', 'Top of the Town', 'Land on the tower roof', (g) => g.state.stats.roof > 0],
  ['work', '💼', 'Hard Worker', 'Finish 10 shift jobs', (g) => [Math.min(10, g.state.stats.jobs), 10]],
  ['paint', '🎨', 'New Paint', 'Paint a car', (g) => g.state.stats.paints > 0],
  ['bots', '🤖', 'Bot Trouble', 'Catch the runaway robots', done('bots')],
  ['fires', '🚒', 'Fire Patrol', 'Put out every fire', done('fires')],
  ['hay', '🌾', 'Hay Bandits', 'Save the hay', done('hay')],
  ['drones', '🛸', 'Drone Swarm', 'Clear the school yard', done('drones')],
  ['treasure', '🗺️', 'Treasure Hunt', 'Dig up all three crosses', done('treasure')],
  ['jets', '☁️', 'Jetpack Trials', 'Fly through the eight hoops', done('jets')],
  ['lighthouse', '💡', 'Lighthouse Defense', 'Keep the lamp lit', done('lighthouse')],
  ['mega', '👾', 'Mega Clanker', 'Beat the giant robot', done('mega')],
  ['tools5', '🧰', 'Handy', 'Earn 5 tools', upTo(5, owned('tool'))],
  ['tools', '🛠️', 'Tool Master', 'Earn every tool', (g) => [owned('tool')(g), TOOLS]],
  ['blaster', '🔫', 'Ready, Aim, Splash', 'Earn your first blaster', (g) => owned('blaster')(g) > 0],
  ['blasters', '🎇', 'Full Toolbox', 'Earn every blaster', (g) => [owned('blaster')(g), BLASTERS]],
  ['bots25', '🔩', 'Bot Buster', 'Stop 25 robots', upTo(25, (g) => g.state.stats.bots)],
  ['bots100', '⚙️', 'Scrap Collector', 'Stop 100 robots', upTo(100, (g) => g.state.stats.bots)],
  ['camp', '🚩', 'Camp Crasher', 'Clear a robot camp', (g) => g.state.stats.camps > 0],
  ['coins', '🪙', 'Pocket Money', 'Pick up 50 robot coins', upTo(50, (g) => g.state.stats.coins)],
  ['bonk', '💫', 'Bonk!', 'Get bonked by a robot', (g) => g.state.stats.bonks > 0],
  ['dig', '⛏️', 'Treasure Digger', 'Dig up 5 buried treasures', upTo(5, (g) => g.state.dug.length)],
  ['digall', '💰', 'Treasure Master', 'Dig up every buried treasure', (g) => [g.state.dug.length, TREASURE.length]],
  ['fish', '🐟', 'Gone Fishing', 'Catch 5 fish', upTo(5, (g) => g.state.stats.fish)],
  ['jet', '🛫', 'Lift Off', 'Fly for 30 seconds with the jetpack', upTo(30, (g) => g.state.stats.jet)],
  ['nitro', '🧨', 'Nitro!', 'Fire the nitro 5 times', upTo(5, (g) => g.state.stats.nitros)],
  ['splat', '🖌️', 'Splat!', 'Repaint a car with the Paint Blaster', (g) => g.state.stats.splats > 0],
].map(([id, icon, name, how, test]) => ({ id, icon, name, how, test }));

// A brand-new save: everything the game remembers between visits.
export const freshState = (sound = true) => ({
  money: 0, done: [], stars: [], rocket: false, sound, places: [], driven: [], stickers: [], best: {},
  gear: [], equip: null, dug: [],   // the toolbox, what is in hand, and which buried treasures are already dug up
  stats: { boosts: 0, jumps: 0, air: 0, drift: 0, speed: 0, moos: 0, jobs: 0, wins: 0, splashes: 0, paints: 0, goals: 0, sleeps: 0, night: 0, roof: 0,
    bots: 0, coins: 0, camps: 0, bonks: 0, dug: 0, fish: 0, jet: 0, nitros: 0, splats: 0 },
});
// An older save may be missing newer fields.
export const mergeState = (s) => { const f = freshState(); return { ...f, ...s, stats: { ...f.stats, ...(s.stats || {}) }, best: { ...(s.best || {}) }, places: s.places || [], driven: s.driven || [], stickers: s.stickers || [], gear: Array.isArray(s.gear) ? s.gear.filter((id) => GEAR.some((q) => q.id === id)) : [], dug: Array.isArray(s.dug) ? s.dug : [], equip: typeof s.equip === 'string' ? s.equip : null }; };

// Watches for new discoveries and newly earned stickers.
export class Progress {
  constructor(game) { this.g = game; this.t = 0; }
  // [earned, have, need]
  status(st) { const r = st.test(this.g); return Array.isArray(r) ? [r[0] >= r[1], r[0], r[1]] : [!!r, r ? 1 : 0, 1]; }
  update(dt) {
    const g = this.g; if (g.mode !== 'play' || g.cine || (this.t -= dt) > 0) return;
    this.t = 0.5;
    const f = g.focus(), s = g.state;
    for (const p of PLACES) {
      if (s.places.includes(p.id) || Math.hypot(f.x - p.x, f.z - p.z) > p.r) continue;
      s.places.push(p.id); g.addMoney(10); g.sound.step(); g.ui.toast(`Discovered ${p.name}!  ${s.places.length} of ${PLACES.length}  +$10`, 3.2); g.save();
      return;   // one at a time
    }
    if (g.ui.dialogOpen || g.missions.active || g.ui.stickT > 2.4) return;   // stickers wait for a quiet moment, and each gets a second or two on screen
    for (const st of STICKERS) {
      if (s.stickers.includes(st.id) || !this.status(st)[0]) continue;
      s.stickers.push(st.id); g.sound.star(); g.ui.sticker(st); g.save();
      return;
    }
  }
}
