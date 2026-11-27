// Missions: who gives them, what the steps are, and the runner that tracks progress.
import { POI } from './world.js';
import { NPC } from './player.js';
import { fmtTime } from './util.js';
import { gearFrom, useText } from './gear.js';

const LOOK = {
  mayor: { shirt: 0x27323f, pants: 0x27323f, hat: 0x27323f, hatStyle: 'wide', stripe: 0xe23b2e, skin: 0xe9b98f },
  chef: { shirt: 0xffffff, pants: 0x39414c, hat: 0xffffff, hatStyle: 'chef', stripe: 0xe23b2e },
  dot: { shirt: 0xf5c518, pants: 0x27323f, hair: 0x8a3f1d, longHair: true, skin: 0xc98f66 },
  penny: { shirt: 0x8e44ad, pants: 0x39414c, hair: 0xc9c9c9, longHair: true },
  fern: { shirt: 0xd9342b, pants: 0x2b4f8f, hat: 0xe2c35a, hatStyle: 'wide', skin: 0xe9b98f },
  rosa: { shirt: 0x4f7a3a, pants: 0x6b5a3a, hat: 0x6b5a3a, hatStyle: 'wide', skin: 0xb9805a },
  ed: { shirt: 0xff7a1a, pants: 0x4a5058, hat: 0x1f8a70, skin: 0xf1c9a5 },
  rex: { shirt: 0xe23b2e, pants: 0x27323f, hat: 0xffd21f, stripe: 0xffffff, skin: 0x8d5a3c },
  pia: { shirt: 0x2d6cdf, pants: 0x27323f, hat: 0x27323f, stripe: 0xffd21f, skin: 0xc98f66 },
  vera: { shirt: 0xf7f9fb, pants: 0x1f8a70, hair: 0x1c1c1f, longHair: true, skin: 0x8d5a3c },
  coral: { shirt: 0x1d3f8f, pants: 0xf3f1e6, hat: 0xf7f9fb, stripe: 0xffd21f, skin: 0xe9b98f },
  lou: { shirt: 0xffd21f, pants: 0x39414c, hat: 0xffd21f, hatStyle: 'wide', skin: 0xf1c9a5 },
  scoop: { shirt: 0xff5fa2, pants: 0xf7f9fb, hat: 0xf7f9fb, stripe: 0xf7f9fb, skin: 0xc98f66 },
  olive: { shirt: 0x1d3f8f, pants: 0x1d232b, hat: 0x1d3f8f, stripe: 0xffd21f, skin: 0xe9b98f },
  stella: { shirt: 0x8e44ad, pants: 0x27323f, hair: 0xd9a441, longHair: true, stripe: 0xffd21f, skin: 0xf1c9a5 },
  kai: { shirt: 0x1f8a70, pants: 0x6b5a3a, hat: 0x6b4428, hatStyle: 'wide', stripe: 0xff7a1a, skin: 0xb9805a },
  prof: { shirt: 0xf7f9fb, pants: 0x39414c, hair: 0xc9c9c9, longHair: true, stripe: 0x1fb7c9, skin: 0xe9b98f },
  blaze: { shirt: 0xe23b2e, pants: 0x27323f, hat: 0xffd21f, stripe: 0xffd21f, skin: 0x8d5a3c },
  gus: { shirt: 0x2b4f8f, pants: 0x2b4f8f, hat: 0xe2c35a, hatStyle: 'wide', stripe: 0xd9342b, skin: 0xf1c9a5 },
  pat: { shirt: 0x2d6cdf, pants: 0x1d3f8f, hat: 0x1d3f8f, stripe: 0xf7f9fb, skin: 0xc98f66 },
  sam: { shirt: 0xf7f9fb, pants: 0x2b4f8f, hat: 0x27323f, hatStyle: 'wide', stripe: 0x1d3f8f, skin: 0xb9805a },
  rita: { shirt: 0xcfd6dc, pants: 0x39414c, hair: 0xe23b2e, longHair: true, stripe: 0xff7a1a, skin: 0xe9b98f },
  luna: { shirt: 0x8e44ad, pants: 0x27323f, hair: 0x1c1c1f, longHair: true, stripe: 0xffd98a, skin: 0xc98f66 },
  dee: { shirt: 0x1c1c2a, pants: 0x1c1c2a, hat: 0xffd21f, stripe: 0x1fb7c9, skin: 0xc98f66 },
  cruz: { shirt: 0x1f8a70, pants: 0x27323f, hat: 0xf7f9fb, stripe: 0xf7f9fb, skin: 0x8d5a3c },
};
const SHIRTS = [0x2d6cdf, 0xe23b2e, 0x1f8a70, 0xff7a1a, 0x8e44ad, 0xff5fa2, 0x1fb7c9, 0xffd21f];
const SKINS = [0xf1c9a5, 0xe9b98f, 0xc98f66, 0xb9805a, 0x8d5a3c];
const HAIRS = [0x4a3323, 0x1c1c1f, 0x8a3f1d, 0xd9a441, 0x6b4428];
let lookSeed = 0;
const anyone = (kid) => { const k = lookSeed++; return { shirt: SHIRTS[k % 8], pants: k % 2 ? 0x39414c : 0x2b4f8f, skin: SKINS[k % 5], hair: HAIRS[(k * 3) % 5], longHair: k % 3 === 0, scale: kid ? 0.72 : 1 }; };

const P = POI;
const trail = P.trail;

// Robots that belong to a mission: gone again when it ends, however it ends.
const band = (m) => { const g = m.g, grp = {}; m.temps.push({ update() {}, dispose: () => g.bots.clear(grp) }); return grp; };
const nearest = (g, grp) => { const f = g.focus(); let best = null, bd = 1e9; for (const b of g.bots.list) { if (b.dead || b.group !== grp) continue; const d = Math.hypot(b.x - f.x, b.z - f.z); if (d < bd) { bd = d; best = b; } } return best ? { x: best.x, z: best.z, r: 3 } : null; };
const zonkAll = (g, grp) => { for (const b of [...g.bots.list]) if (b.group === grp) g.bots.zonk(b); };

// Each step is checked every frame. Types: goto, enter, exit, collect.
export const MISSIONS = [
  {
    id: 'welcome', title: 'Welcome Home', reward: 100, auto: true,
    giver: { name: 'Mayor Maple', x: P.townHall.front.x, z: P.townHall.front.z, look: LOOK.mayor },
    intro: "Good morning, Christian! This whole island is yours to explore. Let's start by taking your car into town.",
    outro: "Welcome to town, Christian! People all over the island need a hand. Look for the gold stars on your map, and remember: any car you find, you can drive.",
    steps: () => [
      { type: 'goto', mode: 'foot', x: P.home.car.x - 2.6, z: P.home.car.z, r: 2.6, text: 'Walk to the red car in your driveway', hint: 'Move with W A S D or the arrow keys. Drag the mouse to look around.', touchHint: 'Move with the stick on the left. Drag the right side to look around.' },
      { type: 'enter', veh: 'home', text: 'Hop in the car', hint: 'Press E next to the car', touchHint: 'Tap Use next to the car' },
      { type: 'goto', mode: 'car', x: P.townHall.street.x, z: P.townHall.street.z, r: 10, text: 'Drive to Town Hall', hint: 'W to go, S to brake, A and D to steer. Follow the yellow line on the map.', touchHint: 'Push the stick up to go and down to brake. Follow the yellow line on the map.' },
      { type: 'exit', text: 'Park and hop out', hint: 'Slow down, then press E', touchHint: 'Slow down, then tap Use' },
      { type: 'goto', mode: 'foot', x: P.townHall.front.x, z: P.townHall.front.z + 2, r: 3.2, text: 'Say hello to Mayor Maple in front of Town Hall' },
    ],
  },
  {
    id: 'pizza', title: 'Pizza Dash', reward: 200, vehicle: 'pizza',
    giver: { name: 'Chef Tony', x: P.pizza.lot.x, z: P.pizza.lot.z, look: LOOK.chef },
    intro: 'Four hot pizzas and no driver! Take the pizza car and get them to my customers before they go cold.',
    outro: 'Still steaming! You are the fastest delivery driver this shack has ever had.',
    steps: (m) => {
      const stops = [[-150, 200, 1], [-250, 0, 1], [50, 300, -1], [250, 100, 1]];
      const steps = [{ type: 'enter', veh: 'pizza', text: 'Hop in the pizza car' }];
      stops.forEach(([x, z, side], k) => steps.push({
        type: 'goto', mode: 'car', veh: 'pizza', stop: true, x, z, r: 9, text: `Deliver pizza ${k + 1} of 4`, count: [k, 4],
        timer: k === 0 ? 210 : undefined,
        onStart: () => { m.customer = m.npc(x, z + side * 9.2, anyone(), true); },
        onDone: () => { m.g.sound.coin(); m.g.ui.toast('Delivered! Yum.'); },
      }));
      return steps;
    },
  },
  {
    id: 'taxi', title: 'Taxi Time', reward: 250, vehicle: 'taxi',
    giver: { name: 'Dispatcher Dot', x: P.taxi.lot.x, z: P.taxi.lot.z, look: LOOK.dot },
    intro: 'Three riders are waiting and all my drivers are at lunch. Take the taxi and get them where they are going.',
    outro: 'Three happy riders and not a scratch on my taxi. Well, hardly a scratch.',
    steps: (m) => {
      const fares = [
        { from: [-50, -9.4, P.townHall.street.x, 0], to: [0, 628, 'Sandy Beach'], who: 'a beach-goer' },
        { from: [9.4, 600, 0, 600], to: [P.farm.road.x, 0, 'Maple Farm'], who: 'a farmhand' },
        { from: [560, 9.4, 560, 0], to: [P.school.street.x, P.school.street.z, 'the school'], who: 'a teacher' },
      ];
      const steps = [{ type: 'enter', veh: 'taxi', text: 'Hop in the taxi' }];
      fares.forEach((f, k) => {
        let rider;
        steps.push({
          type: 'goto', mode: 'car', veh: 'taxi', stop: true, x: f.from[2], z: f.from[3], r: 9, text: `Pick up ${f.who}`, count: [k, 3],
          onStart: () => { rider = m.npc(f.from[0], f.from[1], anyone(), true); },
          onDone: () => { rider.show(false); m.g.sound.coin(); m.g.ui.toast(`"To ${f.to[2]}, please!"`); },
        });
        steps.push({
          type: 'goto', mode: 'car', veh: 'taxi', stop: true, x: f.to[0], z: f.to[1], r: 10, text: `Drive to ${f.to[2]}`, count: [k, 3],
          onDone: () => { const v = m.g.vehicles.get('taxi'); rider.place(v.pos.x + Math.cos(v.heading) * 3, v.pos.z - Math.sin(v.heading) * 3); rider.show(true); m.g.sound.coin(); m.g.ui.toast('"Thanks for the ride!"'); },
        });
      });
      return steps;
    },
  },
  {
    id: 'bus', title: 'School Bus Run', reward: 250, vehicle: 'bus',
    giver: { name: 'Principal Penny', x: P.school.yard.x, z: P.school.yard.z, look: LOOK.penny },
    intro: 'Our bus driver is home with a cold. Could you pick up the kids at four stops and bring them to school?',
    outro: 'Every seat full and right on time. The kids want you to drive every day!',
    steps: (m) => {
      const stops = [[-250, -200, -1], [-200, 250, 0], [150, 300, -1], [250, -100, 1]];
      const steps = [{ type: 'enter', veh: 'bus', text: 'Hop in the school bus' }];
      stops.forEach(([x, z, side], k) => {
        let kids = [];
        steps.push({
          type: 'goto', mode: 'car', veh: 'bus', stop: true, x, z, r: 11, text: `Pick up the kids at stop ${k + 1} of 4`, count: [k, 4],
          onStart: () => { kids = [0, 1, 2].map((i) => (side === 0 ? m.npc(x - 9.4, z - 2 + i * 1.6, anyone(true), true) : m.npc(x - 2 + i * 1.6, z + side * 9.4, anyone(true), true))); },
          onDone: () => { kids.forEach((n) => n.show(false)); m.g.sound.coin(); m.g.ui.toast('All aboard!'); },
        });
      });
      steps.push({ type: 'goto', mode: 'car', veh: 'bus', stop: true, x: P.school.street.x, z: P.school.street.z, r: 12, text: 'Drive the kids to school' });
      return steps;
    },
  },
  {
    id: 'farm', title: 'Farm Hands', reward: 200, vehicle: 'pickup',
    giver: { name: 'Farmer Fern', x: P.farm.giver.x, z: P.farm.giver.z, look: LOOK.fern },
    intro: 'My hay bales are scattered all over the field. Take the farm truck through the gate, scoop up six, and bring them back to the barn.',
    outro: 'Six bales, stacked and dry. You would make a fine farmer.',
    steps: (m) => {
      const items = [[560, 125], [625, 118], [590, 150], [556, 182], [628, 170], [598, 190]].map(([x, z]) => ({ x, z, kind: 'hay' }));
      return [
        { type: 'enter', veh: 'pickup', text: 'Hop in the farm truck' },
        { type: 'collect', mode: 'car', veh: 'pickup', items, r: 3.6, text: 'Drive over the hay bales in the field', hint: 'The gate is on the road side of the field' },
        { type: 'goto', mode: 'car', veh: 'pickup', stop: true, x: P.farm.drop.x, z: P.farm.drop.z, r: 8, text: 'Bring the hay to the barn doors' },
      ];
    },
  },
  {
    id: 'puppies', title: 'Lost Puppies', reward: 200,
    giver: { name: 'Ranger Rosa', x: P.park.ranger.x, z: P.park.ranger.z, look: LOOK.rosa },
    intro: 'Five puppies wriggled out of the park kennel! They are hiding around the park and Town Hall. Walk up to each one to scoop it up.',
    outro: 'All five, safe and wagging. Thank you, Christian! Look, Scout does not want to leave your side. Take him along. He has a nose for gold stars.',
    steps: () => [
      { type: 'collect', mode: 'foot', r: 2.2, text: 'Find the five puppies on foot', hint: 'Listen for barking. They are near the park and Town Hall.',
        items: [[76, -80], [58, -42], [-28, -24], [86, -30], [20, -84]].map(([x, z]) => ({ x, z, kind: 'puppy' })) },
      { type: 'goto', mode: 'foot', x: P.park.ranger.x, z: P.park.ranger.z + 2, r: 3.2, text: 'Bring the puppies back to Ranger Rosa' },
    ],
  },
  {
    id: 'mountain', title: 'Mountain Explorer', reward: 300, vehicle: 'monster',
    giver: { name: 'Explorer Ed', x: P.base.giver.x, z: P.base.giver.z, look: LOOK.ed },
    intro: 'Nobody has driven to the summit this year. The monster truck can make it. Follow the flags all the way to the top!',
    outro: 'You can see the whole island from up there. Not bad for a first climb!',
    steps: () => {
      const steps = [{ type: 'enter', veh: 'monster', text: 'Hop in the monster truck' }];
      trail.forEach((p, k) => steps.push({ type: 'goto', mode: 'car', veh: 'monster', x: p.x, z: p.z, r: 13, text: 'Follow the flags up the mountain', count: [k, 6] }));
      steps.push({ type: 'goto', mode: 'car', veh: 'monster', stop: true, x: P.summit.x, z: P.summit.z, r: 11, text: 'Park at the summit flag', count: [5, 6] });
      return steps;
    },
  },
  {
    id: 'rings', title: 'Sky Rings', reward: 350, vehicle: 'heli',
    giver: { name: 'Pilot Pia', x: P.airfield.giver.x, z: P.airfield.giver.z, look: LOOK.pia },
    intro: 'Ever flown a helicopter? The Sky Hopper almost flies itself. Take it up and thread my ten rings around the island.',
    outro: 'Ten for ten! You were born to fly.',
    steps: (m) => {
      const w = m.g.world, S = P.summit;
      // each ring sits a set height above whatever is underneath it
      const rings = [[300, 330, 30], [150, 150, 55], [0, 0, 112], [-50, -66, 58], [0, -330, 40], [S.x, S.z, 24], [-420, -420, 30], [-612, 55, 30], [90, 688, 50], [330, 500, 32]]
        .map(([x, z, up]) => [x, z, Math.max(w.groundAt(x, z), 0) + up]);
      const steps = [{ type: 'enter', veh: 'heli', text: 'Hop in the Sky Hopper', hint: 'It is parked on the yellow H' }];
      rings.forEach(([x, z, y], k) => steps.push({ type: 'goto', mode: 'car', veh: 'heli', x, z, y, r: 13, ry: 11, ring: true, text: 'Fly through the ring', hint: k === 0 ? 'Hold Space to climb and Shift to come down. Push forward to fly.' : '', touchHint: k === 0 ? 'Hold Up to climb and Down to come down. Push the stick forward to fly.' : '', count: [k, rings.length] }));
      steps.push({ type: 'goto', mode: 'car', veh: 'heli', stop: true, x: P.airfield.x, z: P.airfield.z, r: 8, text: 'Land back on the helipad' });
      return steps;
    },
  },
  {
    id: 'kittens', title: 'Rooftop Rescue', reward: 350, vehicle: 'heli',
    giver: { name: 'Vet Vera', x: -16, z: -16, look: LOOK.vera },
    intro: 'Three kittens climbed onto rooftops downtown and cannot get down. Fly the Sky Hopper from the airfield, land beside each one, and bring them back to the plaza.',
    outro: 'Three kittens, zero scratches. You are a hero, Christian.',
    steps: (m) => {
      const w = m.g.world, flat = w.roofs.filter((r) => r.block && r.kind === 'apt');
      const nearest = (x, z) => flat.reduce((a, b) => (Math.hypot(a.x - x, a.z - z) < Math.hypot(b.x - x, b.z - z) ? a : b));
      const roofs = [nearest(140, 60), nearest(-160, -40), { x: w.roofPad.x, z: w.roofPad.z, top: w.roofPad.y }];
      const steps = [{ type: 'enter', veh: 'heli', text: 'Hop in the Sky Hopper at the airfield' }];
      roofs.forEach((r, k) => {
        let cat;
        steps.push({
          type: 'goto', mode: 'car', veh: 'heli', stop: true, roof: true, x: r.x, z: r.z, y: r.top, r: 9, ry: 2.2, text: `Land on the roof beside kitten ${k + 1} of 3`, count: [k, 3],
          onStart: () => { cat = m.prop('kitten', r.x + 3.4, r.z + 2.6, r.top); },
          onDone: () => { cat.dispose(); m.g.sound.coin(); m.g.ui.toast('Meow! Kitten aboard.'); },
        });
      });
      steps.push({ type: 'goto', mode: 'car', veh: 'heli', stop: true, x: -70, z: -22, r: 9, text: 'Land on the Town Hall plaza' });
      return steps;
    },
  },
  {
    id: 'slalom', title: 'Harbor Slalom', reward: 300, vehicle: 'boat',
    giver: { name: 'Captain Coral', x: P.dock.giver.x, z: P.dock.giver.z, look: LOOK.coral },
    intro: 'Fancy a spin in my speedboat? Round every buoy, loop past Treasure Islet and get back before the tide turns.',
    outro: 'Smooth sailing! You handle her better than I do.',
    steps: (m) => {
      const I = P.islet, gates = [[120, 800], [280, 790], [440, 770], [570, 760], [I.x, I.z + 90], [I.x + 100, I.z], [I.x, I.z - 90], [I.x - 130, I.z - 20], [360, 790], [120, 812]].map(([x, z]) => m.sea(x, z));
      const steps = [{ type: 'enter', veh: 'boat', text: 'Hop in the speedboat', hint: 'It is tied up beside the pier', onDone: () => gates.forEach(([x, z]) => m.prop('buoy', x, z)) }];
      gates.forEach(([x, z], k) => steps.push({ type: 'goto', mode: 'car', veh: 'boat', x, z, r: 17, text: 'Round the next buoy', count: [k, gates.length], timer: k === 0 ? 180 : undefined, race: true }));
      steps.push({ type: 'goto', mode: 'car', veh: 'boat', x: P.dock.boat.x, z: P.dock.boat.z, r: 9, text: 'Bring her back to the pier' });
      return steps;
    },
  },
  {
    id: 'bottles', title: 'Message in a Bottle', reward: 400, vehicle: 'boat',
    giver: { name: 'Keeper Lou', x: 82, z: 678, look: LOOK.lou },
    intro: 'Six bottles with messages inside are drifting around the island. Take the speedboat from the pier, sail all the way around and scoop them up.',
    outro: 'Six messages from six far-off places. I will read them by the lamp tonight.',
    steps: (m) => [
      { type: 'enter', veh: 'boat', text: 'Hop in the speedboat at the pier' },
      { type: 'collect', mode: 'car', veh: 'boat', r: 7, text: 'Scoop up the six bottles around the island', hint: 'The red dots on the map show where they are',
        items: [[40, 860], [P.islet.x + 55, P.islet.z + 15], [800, 40], [600, -1000], [-800, -330], [-540, 610]].map(([x, z]) => { const p = m.sea(x, z); return { x: p[0], z: p[1], kind: 'bottle' }; }) },
      { type: 'goto', mode: 'car', veh: 'boat', stop: true, x: P.dock.boat.x, z: P.dock.boat.z, r: 9, text: 'Sail back to the pier' },
    ],
  },
  {
    id: 'icecream', title: 'Ice Cream Rush', reward: 300, vehicle: 'icecream',
    giver: { name: 'Scoop', x: -24, z: 627.5, look: LOOK.scoop },
    intro: 'It is the hottest day of the year and the whole island wants ice cream. Take my truck to four stops before it all melts!',
    outro: 'Not a single drip! You are the coolest driver in town.',
    steps: (m) => {
      const stops = [[0, 540, -1, 0], [100, -50, 0, 1], [-150, -100, -1, 0], [-250, 200, 1, 0]];   // x, z, then which side the kids wait on
      const steps = [{ type: 'enter', veh: 'icecream', text: 'Hop in the ice cream truck' }];
      stops.forEach(([x, z, sz, sx], k) => {
        let kids = [];
        steps.push({
          type: 'goto', mode: 'car', veh: 'icecream', stop: true, x, z, r: 10, text: `Drive to ice cream stop ${k + 1} of 4`, count: [k, 4], timer: k === 0 ? 230 : undefined,
          onStart: () => { kids = [0, 1, 2, 3].map((i) => m.npc(x + (sx ? sx * 9.4 : -2.4 + i * 1.6), z + (sz ? sz * 9.4 : -2.4 + i * 1.6), anyone(i > 0), true)); },
        });
        steps.push({ type: 'wait', dur: 3.2, veh: 'icecream', text: 'Scooping…', hint: 'Stay put while everyone gets a cone', onStart: () => m.g.sound.jingle(), onDone: () => { kids.forEach((n) => n.show(false)); m.g.sound.coin(); m.g.ui.toast(['"Strawberry, please!"', '"Two scoops!"', '"Sprinkles on mine!"', '"Thank you!"'][k]); } });
      });
      return steps;
    },
  },
  {
    id: 'bandit', title: 'The Cookie Bandit', reward: 400, vehicle: 'police',
    giver: { name: 'Officer Olive', x: 186, z: 152, look: LOOK.olive },
    intro: 'Somebody in a purple van has driven off with the bakery\'s whole tray of cookies! Take the police car, switch on the siren and stay right behind him until he pulls over.',
    outro: 'It was Rocky from the bakery all along. He only wanted to surprise the school with cookies! Case closed, and the cookies are delicious.',
    steps: (m) => {
      const g = m.g; let chase = null, caught = 0;
      return [
        { type: 'enter', veh: 'police', text: 'Hop in the police car' },
        {
          type: 'do', veh: 'police', text: 'Catch up with the purple van and stay close', hint: 'Follow the red dot on the map. Press H for the siren.', touchHint: 'Follow the red dot on the map. Tap Horn for the siren.',
          onStart: () => { chase = g.startChase(m, [[200, 200], [200, -200], [-200, -200], [-200, 200], [200, 200]]); const v = g.vehicles.get('police'); v.siren = true; g.sound.siren(true); },
          where: () => (chase ? { x: chase.v.pos.x, z: chase.v.pos.z, r: 6 } : null),
          meta: () => `${Math.round((caught / 4) * 100)}%`,
          check: (dt) => {
            const v = g.player.vehicle, b = chase.v, d = Math.hypot(v.pos.x - b.pos.x, v.pos.z - b.pos.z);
            caught = d < 16 ? caught + dt : Math.max(0, caught - dt * 0.4);
            // he eases off when he gets too far ahead, so the chase stays close
            chase.driver.pace = d > 140 ? 0.55 : d > 70 ? 0.8 : 1;
            return caught >= 4;
          },
          skip: () => { caught = 99; },
          onDone: () => { chase.driver.done = true; g.sound.siren(false); g.vehicles.get('police').siren = false; g.sound.coin(); g.ui.toast('He is pulling over!'); },
        },
        { type: 'goto', mode: 'car', veh: 'police', stop: true, x: P.police.car.x, z: P.police.car.z - 12, r: 12, text: 'Take the cookies back to the police station' },
      ];
    },
  },
  {
    id: 'stunts', title: 'Stunt Show', reward: 350, vehicle: 'stunter',
    giver: { name: 'Stunt Stella', x: P.stunt.x - 46, z: P.stunt.z - 44, look: LOOK.stella },
    intro: 'The crowd wants a show! Take the green Sunfire and give them four tricks: a boost, a big jump, a long slide and a flight through my hoop.',
    outro: 'They are on their feet! That was the best show this park has ever seen.',
    steps: (m) => {
      const g = m.g, st = () => g.state.stats; let from = {};
      const mark = () => { from = { ...st() }; };
      return [
        { type: 'enter', veh: 'stunter', text: 'Hop in the green Sunfire' },
        { type: 'do', veh: 'stunter', text: 'Trick 1: drive over a boost pad', hint: 'The orange arrows on the ground. Cross them the way they point.', count: [0, 4], onStart: mark, check: () => st().boosts > from.boosts, skip: () => { st().boosts++; }, onDone: () => g.sound.coin() },
        { type: 'do', veh: 'stunter', text: 'Trick 2: jump off a ramp', hint: 'Hit a yellow ramp fast and stay in the air for a moment', count: [1, 4], onStart: mark, check: () => st().jumps > from.jumps, skip: () => { st().jumps++; }, onDone: () => g.sound.coin() },
        { type: 'do', veh: 'stunter', text: 'Trick 3: slide sideways', hint: 'Go fast, turn hard and hold Space', touchHint: 'Go fast, turn hard and hold Brake', count: [2, 4], onStart: mark, check: () => st().drift - from.drift > 1.3, meta: () => `${Math.min(100, Math.round(((st().drift - from.drift) / 1.3) * 100))}%`, skip: () => { st().drift += 2; }, onDone: () => g.sound.coin() },
        { type: 'goto', mode: 'car', veh: 'stunter', x: g.world.bigRamp.x + 19, z: g.world.bigRamp.z, y: 7.4, r: 8, ry: 5.5, ring: true, text: 'Trick 4: fly through the hoop off the big ramp', hint: 'Line up with the tall ramp and go flat out', count: [3, 4] },
      ];
    },
  },
  {
    id: 'lanterns', title: 'Lantern Run', reward: 350, vehicle: 'camper',
    giver: { name: 'Camp Leader Kai', x: -590, z: 48, look: LOOK.kai },
    intro: 'It will be dark soon and three friends around the island have no light. Take the camper van and bring each of them a lantern.',
    outro: 'Three lanterns glowing across the island. I can see them from here! Thank you, Christian.',
    steps: (m) => {
      const g = m.g, stops = [[-520, -420, 9.6, 0, 'the fishing spot by the lake', '"Now I can see my hook!"'], [0, -584, 9.4, 4, 'the mountain base camp', '"Perfect for reading my map."'], [0, 632, -9.4, 0, 'the lighthouse keeper at the beach', '"A spare, just in case."']];
      const steps = [{ type: 'enter', veh: 'camper', text: 'Hop in the camper van', onDone: () => g.nightfall(m) }];
      stops.forEach(([x, z, ox, oz, who, thanks], k) => {
        steps.push({
          type: 'goto', mode: 'car', veh: 'camper', stop: true, x, z, r: 11, text: `Take a lantern to ${who}`, hint: k === 0 ? 'Your headlights come on by themselves' : '', count: [k, 3],
          onStart: () => { m.npc(x + ox, z + oz, anyone(), true); },
          onDone: () => { m.lantern(x + ox + 1, z + oz + 0.6); g.sound.coin(); g.ui.toast(thanks); },
        });
      });
      return steps;
    },
  },
  {
    id: 'race', title: 'Island Grand Prix', reward: 500, vehicle: 'sports', requires: 5,
    giver: { name: 'Racer Rex', x: P.garage.lot.x, z: P.garage.lot.z, look: LOOK.rex },
    intro: 'Think you are fast? Three of the island\'s best drivers are lined up outside. Take the Sunfire GT once around the island and beat them to the finish!',
    locked: 'The Grand Prix is for proven drivers. Finish more missions and come back.',
    outro: 'What a race!',
    pay: (m) => [500, 400, 300, 200][(m.place || 1) - 1],
    steps: (m) => {
      const g = m.g, cps = [[300, -100], [300, -300], [0, -300], [0, -520], [520, -520], [520, 0], [520, 520], [0, 520], [0, 300], [0, 100], [0, 0]];
      const steps = [{ type: 'enter', veh: 'sports', text: 'Hop in the Sunfire GT' }];
      let said = 4;
      steps.push({
        type: 'wait', dur: 4.4, freeze: true, veh: 'sports', text: 'On the grid. Wait for GO!',
        onStart: () => g.raceGrid(m, [[150, -100], ...cps]),
        onTick: (t) => { const n = 3 - Math.floor(t / 1.1); if (n < said && n >= 0) { said = n; if (n > 0) { g.ui.count(String(n)); g.sound.tick(); } } },
        onDone: () => { g.ui.count('GO!'); g.sound.go(); g.raceGo(); },
      });
      cps.forEach(([x, z], k) => steps.push({ type: 'goto', mode: 'car', veh: 'sports', x, z, r: 15, text: k === cps.length - 1 ? 'Sprint to the finish in the middle of town' : 'Race to the next checkpoint', count: [k, cps.length], meta: () => g.racePlace(m), timer: k === 0 ? 260 : undefined, race: true }));
      return steps;
    },
  },
  // ---- missions that need the toolbox -------------------------------------------
  {
    id: 'bots', title: 'Bot Trouble', reward: 250, lend: 'water',
    giver: { name: 'Professor Sprocket', x: 22, z: -78, look: LOOK.prof },
    intro: 'Oh dear, oh dear! My cleaning robots have run off, and they are bumping into everybody in the park. Robots cannot stand water. Take my Water Blaster and switch them off, would you?',
    outro: 'Every one of them dripping wet and fast asleep. Keep the Water Blaster, Christian. I have a feeling more of my inventions have wandered off around the island.',
    steps: (m) => {
      const g = m.g, grp = band(m); let total = 0;
      const wave = (kinds, text, hint, touchHint) => ({
        type: 'do', mode: 'foot', text, hint, touchHint,
        onStart: () => { total = kinds.length; kinds.forEach((kind, i) => g.bots.spawn(kind, P.park.x + Math.cos(i * 2.4) * (8 + i * 2.2), P.park.z + Math.sin(i * 2.4) * (8 + i * 2.2), { home: { x: P.park.x, z: P.park.z, r: 22 }, group: grp })); },
        where: () => nearest(g, grp), meta: () => `${total - g.bots.alive(grp)} / ${total}`,
        check: () => g.bots.alive(grp) === 0, skip: () => zonkAll(g, grp),
      });
      return [
        { type: 'goto', mode: 'foot', x: P.park.x - 16, z: P.park.z - 16, r: 8, text: 'Walk into the park', hint: 'The Water Blaster is in your hand. Hold F to spray.', touchHint: 'The Water Blaster is in your hand. Hold the tool button to spray.' },
        wave(['roller', 'roller', 'roller'], 'Spray the three little rollers', 'Hold F. The yellow arrow shows what you are aiming at.', 'Hold the tool button. The yellow arrow shows what you are aiming at.'),
        wave(['roller', 'roller', 'walker', 'walker', 'roller'], 'More robots! Switch them all off', 'The tall ones take a good soaking. If one bonks you, hop up and keep spraying.'),
        { type: 'goto', mode: 'foot', x: 22, z: -75, r: 3.4, text: 'Tell Professor Sprocket the park is safe' },
      ];
    },
  },
  {
    id: 'fires', title: 'Fire Patrol', reward: 300, lend: 'water', needs: 'bots',
    giver: { name: 'Fire Chief Blaze', x: -78, z: -34, look: LOOK.blaze },
    intro: 'Sparky robots have been setting the rubbish bins smoking all over town! You have a Water Blaster, and that makes you my newest firefighter. Six fires. Put them all out before they spread.',
    needsText: 'I need a firefighter with a Water Blaster. Professor Sprocket in the park is handing one out.',
    outro: 'Six fires, six puffs of steam. The town is safe. Take this Bubble Blaster: we use it for washing the fire engine, but it works wonders on robots.',
    steps: (m) => {
      const g = m.g, grp = band(m), spots = [[-109, -50], [-9, 50], [-150, 109], [109, 50], [50, -109], [209, -150]];
      const steps = spots.map(([x, z], k) => {
        let fire = null;
        return {
          type: 'do', text: `Put out fire ${k + 1} of 6`, hint: k === 0 ? 'Stand close and hold F. Any car will get you there faster.' : 'Hop out and spray it', touchHint: k === 0 ? 'Stand close and hold the tool button. Any car will get you there faster.' : 'Hop out and spray it',
          timer: k === 0 ? 330 : undefined, count: [k, 6],
          onStart: () => { fire = g.makeFire(m, x, z); if (k === 2 || k === 4) for (const s of [-1, 1]) g.bots.spawn('roller', x + s * 3, z + 3, { home: { x, z, r: 7 }, group: grp }); },
          where: () => ({ x, z, r: 4 }), check: () => fire.heat <= 0, skip: () => fire.douse(9),
          onDone: () => { g.sound.coin(); g.ui.toast(k === 5 ? 'That was the last one!' : 'Out! On to the next.'); },
        };
      });
      steps.push({ type: 'goto', mode: 'foot', x: -78, z: -31, r: 3.4, text: 'Report back to Chief Blaze by Town Hall' });
      return steps;
    },
  },
  {
    id: 'hay', title: 'Hay Bandits', reward: 300, needs: 'bots',
    giver: { name: 'Farmhand Gus', x: 566, z: -60, look: LOOK.gus },
    intro: 'Robots are making off with the hay! They march round and round the field with a bale each, and I cannot catch a single one. Stop them, and the hay is saved.',
    needsText: 'Those robots just laugh at my pitchfork. Come back when Professor Sprocket has given you something to stop them with.',
    outro: 'Every bale back in the barn! Here, I built this for scaring crows. It fires one enormous popcorn. Robots hate it.',
    steps: (m) => {
      const g = m.g, grp = band(m), F = P.farm.field, loop = [[F.x0 + 8, F.z0 + 8], [F.x1 - 8, F.z0 + 8], [F.x1 - 8, F.z1 - 8], [F.x0 + 8, F.z1 - 8]];
      let total = 0;
      const wave = (kinds, text) => ({
        type: 'do', mode: 'foot', text, hint: 'They speed up when you get close. Cut the corner.',
        onStart: () => { total = kinds.length; kinds.forEach((kind, i) => { const pi = i % 4, a = loop[pi], b = loop[(pi + 3) % 4], t = 0.2 + 0.15 * i; g.bots.spawn(kind, b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, { mode: 'flee', path: loop, pi, carry: 'hay', group: grp }); }); },
        where: () => nearest(g, grp), meta: () => `${total - g.bots.alive(grp)} / ${total}`,
        check: () => g.bots.alive(grp) === 0, skip: () => zonkAll(g, grp),
        onDone: () => { g.sound.coin(); },
      });
      return [
        { type: 'goto', x: (F.x0 + F.x1) / 2, z: F.z0 - 6, r: 12, text: 'Go to the hay field behind the barn' },
        wave(['walker', 'walker', 'walker', 'walker', 'walker'], 'Stop the five hay robots'),
        wave(['roller', 'roller', 'roller', 'brute'], 'Here come the fast ones, and a big one!'),
        { type: 'goto', mode: 'foot', x: 566, z: -57, r: 3.4, text: 'Tell Gus the hay is safe' },
      ];
    },
  },
  {
    id: 'drones', title: 'Drone Swarm', reward: 350, needs: 'fires',
    giver: { name: 'Postmaster Pat', x: -116, z: -116, look: LOOK.pat },
    intro: 'My delivery drones have gone silly! They are buzzing round the school yard and nobody dares go out to play. Knock them out of the sky, would you? Gently. Well, fairly gently.',
    needsText: 'Chief Blaze by Town Hall is looking for a firefighter. Help the Chief first, then come and see me.',
    outro: 'Peace and quiet at last. One of the drones dropped this. A Zap Pulse! Every robot near you goes to sleep at once.',
    steps: (m) => {
      const g = m.g, grp = band(m), Y = P.school.yard; let total = 0;
      const wave = (n, text, hint) => ({
        type: 'do', mode: 'foot', text, hint,
        onStart: () => { total = n; for (let i = 0; i < n; i++) g.bots.spawn('drone', Y.x + Math.cos(i * 1.3) * (6 + i), Y.z + Math.sin(i * 1.3) * (6 + i), { home: { x: Y.x, z: Y.z, r: 20 }, group: grp }); },
        where: () => nearest(g, grp), meta: () => `${total - g.bots.alive(grp)} / ${total}`,
        check: () => g.bots.alive(grp) === 0, skip: () => zonkAll(g, grp),
      });
      return [
        { type: 'goto', mode: 'foot', x: Y.x + 18, z: Y.z + 20, r: 9, text: 'Walk to the school yard' },
        wave(5, 'Knock down the five drones', 'Aim up: the yellow arrow follows them. They swoop when you are close.'),
        wave(8, 'A whole swarm! Get them all', 'Keep moving so they cannot bonk you'),
        { type: 'goto', mode: 'foot', x: -116, z: -113, r: 3.4, text: 'Tell Postmaster Pat the yard is clear' },
      ];
    },
  },
  {
    id: 'treasure', title: 'Treasure Hunt', reward: 350, lend: 'detector', needs: 'bottles',
    giver: { name: 'Old Salt Sam', x: -60, z: 640, look: LOOK.sam },
    intro: 'Those bottles you fished out for Lou had my grandfather\'s treasure map inside. Three crosses! My knees are no good for digging. Take the detector, follow the beeps, and dig where it says.',
    needsText: 'I am waiting on some bottles that washed out to sea. Keeper Lou at the lighthouse knows about them.',
    outro: 'Grandfather\'s boomerang! He always said it came back. It is yours now. Throw it at a row of robots and watch.',
    steps: (m) => {
      const g = m.g;
      // each dig: the real spot, and the middle of the circle shown on the map (a little way off, so the detector has work to do)
      const digs = [[-156, 648, -146, 654, 'Search the beach to the west'], [121, 664, 112, 660, 'Search the grass by the lighthouse'], [694, 706, 690, 700, 'The last cross is on Treasure Islet. Take the speedboat from the pier.']];
      const steps = digs.map(([x, z, ax, az, text], k) => {
        let spot = null;
        return {
          type: 'do', mode: 'foot', text, hint: 'The detector shows how far it is. Press F to dig when it says Dig here!', touchHint: 'The detector shows how far it is. Tap the tool button when it says Dig here!', count: [k, 3],
          onStart: () => { spot = { x, z, dug: false, quest: true, gold: k === 2 ? 150 : 60 }; g.spots.push(spot); m.temps.push({ update() {}, dispose: () => { const i = g.spots.indexOf(spot); if (i >= 0) g.spots.splice(i, 1); } }); },
          where: () => ({ x: ax, z: az, r: 26 }), check: () => spot.dug, skip: () => { spot.dug = true; },
        };
      });
      steps.push({ type: 'goto', mode: 'foot', x: -60, z: 643, r: 3.4, text: 'Take the treasure back to Old Salt Sam on the beach' });
      return steps;
    },
  },
  {
    id: 'jets', title: 'Jetpack Trials', reward: 400, needs: 'rings',
    giver: { name: 'Rocket Rita', x: 456, z: 366, look: LOOK.rita },
    intro: 'So Pia gave you a jetpack. Can you fly it? Eight hoops over the stunt park. Jump, hold the button, steer in the air, and land to fill up again.',
    needsText: 'No jetpack, no trials. Fly the Sky Rings for Pilot Pia at the airfield and she will give you one.',
    outro: 'Eight out of eight! You fly like a firework, so here is a Fireworks Launcher. Stand well back.',
    steps: () => {
      const S = P.stunt, rings = [[30, 6, -30], [10, 9, -14], [-14, 7, 0], [-30, 11, 20], [-10, 8, 42], [20, 12, 36], [42, 9, 14], [36, 13, -14]];
      return rings.map(([dx, y, dz], k) => ({
        type: 'goto', mode: 'foot', ring: true, x: S.x + dx, z: S.z + dz, y, ry: 3.6, r: 4.2, count: [k, 8], timer: k === 0 ? 200 : undefined,
        text: k === 0 ? 'Fly through the first hoop' : `Hoop ${k + 1} of 8`, hint: 'Jump, then keep Space held to fly. Land to fill the jetpack up.', touchHint: 'Jump, then keep Jump held to fly. Land to fill the jetpack up.',
      }));
    },
  },
  {
    id: 'lighthouse', title: 'Lighthouse Defense', reward: 500, needs: 'drones',
    giver: { name: 'Lamplighter Luna', x: 104, z: 672, look: LOOK.luna },
    intro: 'The robots want the great lamp from the top of the lighthouse! They will come up the beach as soon as it is dark. Stand by the door with me and do not let them reach it.',
    needsText: 'Not yet. Postmaster Pat by the school has trouble with drones. Sort that out and you will be ready for this.',
    outro: 'The lamp is still shining, and every ship can find its way home. This Laser Blaster was my mother\'s. She kept the gulls off the lamp with it.',
    steps: (m) => {
      const g = m.g, grp = band(m), L = P.beach.lighthouse, door = { x: L.x, z: L.z - 8, r: 2.6 };
      let lamp = 100, total = 0, warned = false;
      const from = [[30, 662], [70, 628], [150, 664], [112, 632]];
      const wave = (kinds, text) => ({
        type: 'do', mode: 'foot', text, hint: 'Do not let them stand at the door',
        onStart: () => { total = kinds.length; warned = false; kinds.forEach((kind, i) => { const [x, z] = from[i % from.length]; g.bots.spawn(kind, x + (i % 3) * 2.5, z + Math.floor(i / 4) * 3, { mode: 'goal', goal: door, group: grp }); }); g.ui.toast('Here they come!', 2); },
        where: () => nearest(g, grp), meta: () => `Lamp ${Math.max(0, Math.ceil(lamp))}%`,
        check: (dt) => {
          let at = 0; for (const b of g.bots.list) if (!b.dead && b.group === grp && b.atGoal && b.stun <= 0 && b.ice <= 0 && b.net <= 0 && b.bub <= 0) at++;
          lamp -= at * 0.6 * dt;
          if (at && !warned) { warned = true; g.ui.toast('A robot is at the door. Spray it!', 2.4); g.sound.fail(); }
          if (lamp <= 0) { m.fail('The robots unscrewed the great lamp!'); return false; }
          return g.bots.alive(grp) === 0;
        },
        skip: () => zonkAll(g, grp),
        onDone: () => { g.sound.coin(); },
      });
      return [
        { type: 'goto', mode: 'foot', x: door.x, z: door.z - 3, r: 5, text: 'Stand guard at the lighthouse door', onStart: () => g.nightfall(m) },
        wave(['roller', 'roller', 'roller', 'roller', 'roller', 'roller'], 'Wave 1 of 3: stop the rollers'),
        wave(['walker', 'walker', 'roller', 'walker', 'roller', 'walker', 'roller', 'walker'], 'Wave 2 of 3: here come the clankers'),
        wave(['brute', 'roller', 'drone', 'brute', 'roller', 'drone', 'drone', 'roller', 'drone', 'roller'], 'Wave 3 of 3: everything they have got!'),
        { type: 'goto', mode: 'foot', x: 104, z: 675, r: 3.4, text: 'Tell Luna the lamp is safe' },
      ];
    },
  },
  {
    id: 'mega', title: 'Mega Clanker', reward: 1000, needs: 'lighthouse', requires: 14,
    giver: { name: 'Coach Cruz', x: 372, z: -366, look: LOOK.cruz },
    intro: 'It is as tall as a house and it is standing on my soccer pitch! The Professor calls it Mega Clanker. Blast it with everything in your toolbox. Jump when it stamps. And when it overheats, do not stop!',
    needsText: 'Something enormous is on its way here. You are not ready for it yet. Luna at the lighthouse needs you first.',
    locked: 'This one is for an island hero. Finish more missions first.',
    outro: 'You beat it! The whole island saw. The Professor says the Thunder Hammer fell out of its hand, so it is yours. No robot will ever bother this town again. Well. Hardly ever.',
    steps: (m) => {
      const g = m.g, grp = band(m), S = P.soccer; let boss = null;
      return [
        { type: 'goto', x: S.x - 30, z: S.z, r: 10, text: 'Walk onto the soccer pitch' },
        {
          type: 'do', text: 'Stop Mega Clanker!', hint: 'Jump when it stamps. Blast it hardest while it is overheating.',
          onStart: () => { boss = g.bots.spawn('mega', S.x + 16, S.z, { mode: 'boss', home: { x: S.x, z: S.z, r: 40 }, group: grp, h: -Math.PI / 2 }); g.ui.banner('MEGA CLANKER', 'Jump when it stamps'); g.sound.zonk(true); },
          where: () => (boss && !boss.dead ? { x: boss.x, z: boss.z, r: 7, quiet: true } : null), meta: () => (boss ? `${Math.max(0, Math.ceil((boss.hp / boss.k.hp) * 100))}%` : ''),
          check: () => !!boss && boss.dead, skip: () => zonkAll(g, grp),
          onDone: () => { zonkAll(g, grp); g.fireworksT = 6; },
        },
        { type: 'goto', mode: 'foot', x: 372, z: -363, r: 3.4, text: 'Tell Coach Cruz the pitch is safe' },
      ];
    },
  },
  {
    id: 'octo', title: 'Octoclank', reward: 800, needs: 'treasure',
    giver: { name: 'Diver Dee', x: -112, z: 640, look: LOOK.dee },
    intro: 'I saw it from under the water. Eight legs. Eyes like lamps. It is walking up the sea bed towards this beach right now! When its eyes go red, JUMP, or its cable whip will drag you in. And when it rears up, jump again.',
    needsText: 'Something big is moving out in the bay. Help Old Salt Sam with his treasure map first. I am still counting its legs.',
    outro: 'You sent it back into the sea in pieces! This fell off it. An Ink Squirter. One blob and a whole gang of robots cannot see a thing.',
    steps: (m) => {
      const g = m.g, grp = band(m), A = { x: -170, z: 640 }; let boss = null;
      return [
        { type: 'goto', x: A.x, z: A.z, r: 10, text: 'Go down to the west beach' },
        {
          type: 'do', text: 'Stop Octoclank!', hint: 'Jump when its eyes turn red, and when it rears up. Blast it hardest while it is overheating.',
          onStart: () => { boss = g.bots.spawn('octo', A.x, A.z + 22, { mode: 'boss', home: { x: A.x, z: A.z, r: 40 }, group: grp, h: Math.PI }); g.ui.banner('OCTOCLANK', 'Eight legs. Jump when its eyes turn red.'); g.sound.zonk(true); g.bots.octoSay('hello', 1, true); g.fx.burst(A.x, 0.5, A.z + 22, 40, 9, 1.2, 0.5, 1.4, 1, 1, 1, 0.8, 10, 1.4); },
          where: () => (boss && !boss.dead ? { x: boss.x, z: boss.z, r: 6, quiet: true } : null), meta: () => (boss ? `${Math.max(0, Math.ceil((boss.hp / boss.k.hp) * 100))}%` : ''),
          check: () => !!boss && boss.dead, skip: () => zonkAll(g, grp),
          onDone: () => { zonkAll(g, grp); g.fireworksT = 5; },
        },
        { type: 'goto', mode: 'foot', x: -112, z: 643, r: 3.4, text: 'Tell Diver Dee the beach is safe' },
      ];
    },
  },
];

// Places a taxi fare or an ice cream stop can be: [name, x, z] with the spot on the road.
const DROPS = [['Sandy Beach', 0, 600], ['Maple Farm', 590, 0], ['the school', -150, -100], ['Town Hall', -50, 0], ['Sunset Camp', -600, 0], ['the mountain base camp', 0, -590], ['the garage', 150, -100],
  ['Slice Shack', -150, 100], ['Central Park', 50, 0], ['the stunt park', 520, 410], ['the soccer field', 520, -410], ['Maple Street', -250, 200], ['the lake road', -520, -420], ['the north road', 260, -520]];
const far = (m, list, min) => { const f = m.g.focus(), ok = list.filter((d) => Math.hypot(d[1] - f.x, d[2] - f.z) > min); return (ok.length ? ok : list)[Math.floor(Math.random() * (ok.length || list.length))]; };
const TOWNX = [-250, -150, -50, 50, 150, 250];

// Shifts never end and cannot be failed: each job pays as it is finished, and the shift is over when
// Christian walks away from the vehicle.
export const SHIFTS = {
  taxi: {
    title: 'Taxi shift', vehicle: 'taxi', unit: 'fare', intro: 'Riders are calling from all over the island. Want to drive a shift? You keep every fare, and you can stop whenever you like.',
    job: (m) => {
      const from = far(m, DROPS, 150), ends = DROPS.filter((d) => d !== from && Math.hypot(d[1] - from[1], d[2] - from[2]) > 260), to = ends[Math.floor(Math.random() * ends.length)];
      const dist = Math.hypot(to[1] - from[1], to[2] - from[2]), fare = 20 + Math.round(dist / 12 / 5) * 5; let rider, t0 = 0;
      const side = (d) => (Math.abs(d[2] % 100) < 1 || Math.abs(d[2]) === 520 ? [d[1], d[2] + 9.4] : [d[1] + 9.4, d[2]]);   // the pavement beside that bit of road
      return [
        { type: 'goto', mode: 'car', veh: 'taxi', stop: true, x: from[1], z: from[2], r: 10, text: `Pick up a rider at ${from[0]}`, onStart: () => { const p = side(from); rider = m.npc(p[0], p[1], anyone(), true); }, onDone: () => { rider.show(false); m.g.sound.coin(); m.g.ui.toast(`"To ${to[0]}, please!"`); t0 = m.elapsed; } },
        { type: 'goto', mode: 'car', veh: 'taxi', stop: true, x: to[1], z: to[2], r: 11, text: `Drive to ${to[0]}`, onDone: () => { const quick = m.elapsed - t0 < dist / 13 + 14; m.pay(fare + (quick ? 15 : 0), quick ? 'Quick ride! Fare and a tip' : 'Fare'); } },
      ];
    },
  },
  pizza: {
    title: 'Pizza shift', vehicle: 'pizza', unit: 'pizza', intro: 'The phone will not stop ringing! Want to deliver for a while? Three pizzas a run, and a bonus for every one that arrives hot.',
    job: (m) => {
      const steps = [{ type: 'goto', mode: 'car', veh: 'pizza', stop: true, x: P.pizza.lot.x, z: 100, r: 11, text: 'Pull up outside Slice Shack for three hot pizzas', onDone: () => { m.g.sound.coin(); m.g.ui.toast('Three pizzas loaded'); } }];
      for (let k = 0; k < 3; k++) {
        const x = TOWNX[Math.floor(Math.random() * 6)] + (Math.random() < 0.5 ? -27 : 27), z = [-300, -200, -100, 0, 100, 200, 300][Math.floor(Math.random() * 7)], sd = z === 300 ? -1 : z === -300 ? 1 : Math.random() < 0.5 ? 1 : -1;
        steps.push({ type: 'goto', mode: 'car', veh: 'pizza', stop: true, x, z, r: 9, text: `Deliver pizza ${k + 1} of 3`, count: [k, 3], onStart: () => { m.npc(x, z + sd * 9.2, anyone(), true); m.timer = 30 + Math.hypot(x - m.g.focus().x, z - m.g.focus().z) / 9; m.late = false; }, onDone: () => { const hot = !m.late; m.timer = null; m.pay(hot ? 40 : 20, hot ? 'Still hot!' : 'A bit cold, but delivered'); } });
      }
      return steps;
    },
  },
  icecream: {
    title: 'Ice cream round', vehicle: 'icecream', unit: 'stop', intro: 'Kids all over the island are listening for the jingle. Want to do a round? Park at a stop and they will come running.',
    job: (m) => {
      const d = far(m, DROPS, 200), n = 3 + Math.floor(Math.random() * 3), ew = Math.abs(d[2] % 100) < 1 || Math.abs(d[2]) === 520; let kids = [];
      return [
        { type: 'goto', mode: 'car', veh: 'icecream', stop: true, x: d[1], z: d[2], r: 10, text: `Drive to ${d[0]}`, onStart: () => { kids = Array.from({ length: n }, (_, i) => m.npc(d[1] + (ew ? -3 + i * 1.5 : 9.4), d[2] + (ew ? 9.4 : -3 + i * 1.5), anyone(i > 0), true)); } },
        { type: 'wait', dur: 3, veh: 'icecream', text: 'Scooping…', onStart: () => m.g.sound.jingle(), onDone: () => { kids.forEach((k) => k.show(false)); m.pay(n * 10, `${n} cones`); } },
      ];
    },
  },
};

export class Missions {
  constructor(game) {
    this.g = game;
    this.active = null; this.steps = []; this.idx = 0; this.timer = null; this.temps = []; this.items = [];
    this.givers = MISSIONS.map((def) => ({ def, npc: new NPC(game.scene, game.world, { ...def.giver, wave: true }) }));
  }
  byId(id) { return MISSIONS.find((m) => m.id === id); }
  get total() { return MISSIONS.length; }
  isDone(id) { return this.g.state.done.includes(id); }
  // Givers show up once the tutorial is finished.
  open(def) { return def.id !== 'welcome' && this.isDone('welcome'); }
  // Some missions need an earlier one done first (needs), some a number of missions (requires).
  unlocked(def) { return (!def.needs || this.isDone(def.needs)) && (!def.requires || this.g.state.done.length >= def.requires); }
  giverNear(x, z, r = 3.6) {
    if (this.active) return null;
    for (const g of this.givers) if (this.open(g.def) && Math.hypot(x - g.def.giver.x, z - g.def.giver.z) < r) return g.def;
    return null;
  }
  npc(x, z, look, wave) { const n = new NPC(this.g.scene, this.g.world, { x, z, look, wave }); this.temps.push(n); return n; }
  // A thing that only exists while a mission runs: a buoy, a kitten on a roof.
  prop(kind, x, z, y) {
    const g = this.g, mesh = g.makeProp(kind, x, z, y), base = mesh.position.y; let t = x;
    const o = { mesh, update(dt) { t += dt; if (kind === 'buoy') { mesh.position.y = base + Math.sin(t * 1.6) * 0.12; mesh.rotation.z = Math.sin(t * 1.1) * 0.08; } else { mesh.position.y = base + Math.max(0, Math.sin(t * 5)) * 0.18; mesh.rotation.y += dt * 0.8; } }, dispose() { g.scene.remove(mesh); }, show(v) { mesh.visible = v; } };
    this.temps.push(o); return o;
  }
  // The nearest point to (x, z) that is open water deep enough for a boat.
  sea(x, z) {
    const w = this.g.world; let dx = x, dz = z + 250; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    for (let k = 0; k < 60 && w.heightAt(x, z) > -5; k++) { x += dx * 8; z += dz * 8; }
    return [x, z];
  }

  start(def) {
    const g = this.g;
    this.active = def; this.idx = -1; this.timer = null; this.elapsed = 0; this.place = 0; this.shift = null;
    if (def.vehicle) {
      const v = g.vehicles.get(def.vehicle);
      if (v && g.player.vehicle !== v && Math.hypot(v.pos.x - v.home.x, v.pos.z - v.home.z) > 25) v.goHome();
    }
    if (def.lend) g.gear.lend(def.lend);
    this.steps = def.steps(this);
    g.sound.go();
    g.ui.toast(def.title);
    this.next();
  }
  // A shift: the same giver's vehicle, one job after another until Christian walks away.
  startShift(kind) {
    const sh = SHIFTS[kind], g = this.g, v = g.vehicles.get(sh.vehicle);
    this.active = { id: 'shift-' + kind, title: sh.title, shift: sh, kind, vehicle: sh.vehicle }; this.timer = null; this.elapsed = 0; this.place = 0;
    this.shift = { n: 0, earned: 0, away: 0 };
    if (g.player.vehicle !== v && Math.hypot(v.pos.x - v.home.x, v.pos.z - v.home.z) > 25) v.goHome();
    this.steps = [{ type: 'enter', veh: sh.vehicle, text: `Hop in the ${v.spec.name}` }]; this.idx = -1;
    g.sound.go(); g.ui.toast(sh.title); this.next();
  }
  pay(amount, why) { const g = this.g, sh = this.shift; sh.n++; sh.earned += amount; g.addMoney(amount); g.sound.coin(); g.ui.toast(`${why}  +$${amount}`); g.state.stats.jobs++; g.save(); }
  endShift() {
    const sh = this.shift, def = this.active; this.cleanup();
    if (sh.n) this.g.ui.banner('Shift over', `${sh.n} ${def.shift.unit}${sh.n === 1 ? '' : 's'}  +$${sh.earned}`); else this.g.ui.toast(`${def.title} over`);
  }
  // A lantern left glowing where it was delivered.
  lantern(x, z) { const g = this.g, o = g.makeLantern(x, z); this.temps.push(o); return o; }
  next() {
    const prev = this.steps[this.idx];
    if (prev && prev.onDone) prev.onDone();
    this.clearItems();
    this.idx++;
    if (this.idx >= this.steps.length) {
      if (!this.shift) return this.finish();
      for (const n of this.temps) n.dispose(); this.temps = [];      // the last job's people go home
      this.steps = this.active.shift.job(this); this.idx = 0;
    }
    const s = this.steps[this.idx]; s.t = 0;
    if (s.timer) this.timer = s.timer;
    if (s.onStart) s.onStart();
    if (s.type === 'collect') { s.left = s.items.length; this.items = s.items.map((it) => ({ ...it, got: false, mesh: this.g.makePickup(it.kind, it.x, it.z, it.y) })); }
    if (this.idx > 0) this.g.sound.step();
    this.g.routeDirty = true;
  }
  clearItems() { for (const it of this.items) if (it.mesh) this.g.scene.remove(it.mesh); this.items = []; }
  cleanup() {
    this.clearItems();
    for (const n of this.temps) n.dispose(); this.temps = [];
    this.active = null; this.steps = []; this.idx = 0; this.timer = null; this.shift = null; this.g.routeDirty = true;
    this.g.gear.giveBack();
    this.g.onMissionEnd?.();
  }
  cancel() { if (!this.active) return; if (this.shift) return this.endShift(); const t = this.active.title; this.cleanup(); this.g.ui.toast(`${t} stopped. Talk to them again to retry.`); }
  fail(why) {
    const def = this.active; this.cleanup();
    this.g.sound.fail();
    this.g.ui.dialog({ name: def.giver.name, text: `${why} Want another go?`, yes: 'Try again', no: 'Later', onYes: () => this.start(def) });
  }
  finish() {
    const g = this.g, def = this.active, first = !this.isDone(def.id);
    const time = this.elapsed, place = this.place || 1, pay = def.pay ? def.pay(this) : def.reward;
    this.cleanup();
    if (first) { g.state.done.push(def.id); g.evo.gain(100); }
    g.addMoney(pay);
    // the tool or blaster this mission pays out, the first time it is won
    const won = gearFrom(def.id) ? g.gear.grant(gearFrom(def.id).id) : null;
    let extra = '';
    if (def.id === 'race') {
      const best = g.state.best.race; if (!best || time < best) g.state.best.race = +time.toFixed(1);
      if (place === 1) g.state.stats.wins++;
      extra = ` You finished ${['1st', '2nd', '3rd', '4th'][place - 1]} of 4 in ${fmtTime(time)}. ${['That is the GOLD cup!', 'A SILVER medal!', 'A BRONZE medal!', 'Come back and try for the podium.'][place - 1]}`;
    }
    g.save();
    g.celebrate();
    g.ui.banner('Mission complete', `${def.title}  +$${pay}` + (won ? `  +  ${won.icon} ${won.name}` : ''));
    const prize = won ? { icon: won.icon, title: `${won.relic ? 'Legendary gear' : won.kind === 'blaster' ? 'New blaster' : 'New tool'}: ${won.name}`, text: useText(won, g.words()) } : null;
    setTimeout(() => {
      g.ui.dialog({ name: def.giver.name, text: def.outro + extra, prize, yes: 'OK', onYes: () => { if (first && g.state.done.length === MISSIONS.length) g.finale(); } });
    }, 1600);
  }

  // Where the player should head right now.
  target() {
    if (!this.active) return null;
    const s = this.steps[this.idx], g = this.g, pv = g.player.vehicle;
    if (!s) return null;
    if (s.type === 'enter' || (s.veh && (!pv || pv.id !== s.veh))) { const v = g.vehicles.get(s.veh); return v ? { x: v.pos.x, z: v.pos.z, y: v.pos.y, r: 3, veh: true } : null; }
    if (s.type === 'goto') return { x: s.x, z: s.z, r: s.r, race: s.race, y: s.y, ring: s.ring, roof: s.roof };
    if (s.type === 'do' && s.where) return s.where();
    if (s.type === 'collect') {
      let best = null, bd = 1e9; const p = g.focus();
      for (const it of this.items) { if (it.got) continue; const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < bd) { bd = d; best = it; } }
      return best ? { x: best.x, z: best.z, r: s.r, item: true } : null;
    }
    return null;
  }
  // The player may not drive off yet (the race countdown).
  get frozen() { const s = this.steps[this.idx]; return !!(this.active && s && s.freeze); }
  objective() {
    if (!this.active) return null;
    const s = this.steps[this.idx], g = this.g, pv = g.player.vehicle;
    if (!s) return null;
    const touch = document.body.classList.contains('touch'), hop = touch ? 'Hop out first (tap Use)' : 'Hop out first (E)';
    let text = s.text, hint = (touch && s.touchHint) || s.hint || '';
    if (s.veh && s.type !== 'enter' && (!pv || pv.id !== s.veh)) { text = `Get back in the ${g.vehicles.get(s.veh).spec.name}`; hint = ''; }
    else if ((s.type === 'goto' || s.type === 'collect' || s.type === 'do') && s.mode === 'foot' && pv) hint = hop;
    else if (s.stop && pv && Math.hypot(pv.pos.x - s.x, pv.pos.z - s.z) < s.r) hint = pv.spec.style === 'heli' ? 'Land here' : pv.spec.wr ? 'Stop the car here' : 'Stop here';
    let meta = '';
    if (s.type === 'collect') meta = `${s.items.length - s.left} / ${s.items.length}`;
    else if (s.meta) meta = s.meta();
    else if (s.count) meta = `${s.count[0]} / ${s.count[1]}`;
    else if (this.shift) meta = `$${this.shift.earned}`;
    return { title: this.active.title, text, hint, meta, timer: this.timer };
  }

  update(dt) {
    if (!this.active) return;
    const g = this.g, s = this.steps[this.idx], p = g.player, pv = p.vehicle;
    if (!s) return;
    this.elapsed += dt;
    if (this.timer !== null) {
      const before = this.timer; this.timer -= dt;
      if (this.timer <= 10 && Math.floor(before) !== Math.floor(this.timer)) g.sound.tick();
      if (this.timer <= 0) { if (this.shift) { this.timer = null; this.late = true; } else return this.fail('Out of time!'); }
    }
    // a shift ends when Christian has been out of the vehicle for a while
    if (this.shift && s.type !== 'enter') { this.shift.away = pv && pv.id === this.active.vehicle ? 0 : this.shift.away + dt; if (this.shift.away > 14) return this.endShift(); }
    const modeOK = (mode) => (mode === 'foot' ? !pv : mode === 'car' ? !!pv && (!s.veh || pv.id === s.veh) : true);
    const f = g.focus();
    if (s.type === 'enter') { if (pv && pv.id === s.veh) this.next(); }
    else if (s.type === 'exit') { if (!pv) this.next(); }
    else if (s.type === 'goto') {
      const near = Math.hypot(f.x - s.x, f.z - s.z) < s.r && (s.y === undefined || Math.abs(f.y - s.y) < (s.ry ?? 6));
      const still = !s.stop || !pv || (Math.abs(pv.speed) < 2.2 && (pv.spec.style !== 'heli' || pv.onGround));
      if (modeOK(s.mode) && near && still) this.next();
    } else if (s.type === 'wait') {
      // hold on for a moment: a countdown, or serving ice cream
      if (s.veh && (!pv || pv.id !== s.veh)) return;
      s.t += dt; if (s.onTick) s.onTick(s.t); if (s.t >= s.dur) this.next();
    } else if (s.type === 'do') {
      // something to pull off rather than somewhere to go
      if ((!s.veh || (pv && pv.id === s.veh)) && s.check(dt)) this.next();
    } else if (s.type === 'collect') {
      if (modeOK(s.mode)) {
        for (const it of this.items) {
          if (it.got || Math.hypot(f.x - it.x, f.z - it.z) > s.r) continue;
          it.got = true; s.left--; g.scene.remove(it.mesh); it.mesh = null;
          g.onCollect(it); g.routeDirty = true;
        }
        if (s.left <= 0) this.next();
      }
    }
  }
}
