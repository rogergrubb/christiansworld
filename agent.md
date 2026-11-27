# Agent Memory – Christian's World (christiansworld.app)

## 1. Project Overview
- Static site of Christian's games. Main game: `games/christians-world/` — a 3D island (Three.js r170 from cdnjs, ES modules, no build step).
- Primary user: Christian (plays on a tablet and desktop). Built with his dad, Roger.
- Non-goals: no framework, no bundler, no accounts, no server.

## 2. Definition of Done
- Every change runs in a real browser with zero console errors and is playable by touch, keyboard and gamepad.
- Saves (`localStorage` key `christians-world-v1`) from older versions must keep loading.
- No copied characters, logos or named items from films, comics or other games. Christian's ideas get original designs and names.

## 3. Current State (2026-11-26)
- Evolving added (`js/evolve.js`): 12 armour forms, levels from points, wins = robots stopped. Robot coins and hit power multiply per form. Tested end to end in headless Chrome.
- Pushed to GitHub main; christiansworld.app serves it.
- Legendary gear added: 8 high-detail items in `js/relics.js`, bought with mission money in the Toolbox.
- Tested in headless Chrome: all 8 buy, equip, show in hand and affect robots. No console errors.
- Live play copy: claude.ai artifact "Christian's World" (slug 44e49ac2-23fc-4b27-bcfd-dc80b2840a7f), republished with this change.
- Repo is still PUBLIC. Roger wants it private (GitHub Pages on a private repo needs a paid plan; Vercel does not).

## 4. Architecture & Design Decisions
- `gear.js` owns every tool. `GEAR` = mission tools + blasters + `...RELICS`. Items with `relic: true` are bought (`Toolbox.buy`), never won.
- `relics.js` has no dependency on `gear.js` (avoids an import cycle). It exports `RELICS`, `buildRelic(id)`, `Vault`.
- Relic models: grip at the origin, business end along +Y, `userData.tick(t, hot)` animates. Mounted on the right arm at (0,-0.7,0.02) with `rotation.x = hold.r`.
- Reflections come from one painted equirect canvas set as `envMap` per material, so both renderers (game + display stand) convert it themselves. Do not use PMREM render targets: they cannot be shared between WebGL contexts.
- `Vault` is a second small WebGL renderer for the Toolbox turntable and card pictures. Pictures are drawn one per timer tick so the Toolbox opens at once.
- Cooldowns are per item (`Toolbox.cds`), so a 6 s wait on one item never blocks the next.

## 5. Known Issues & Landmines
- The Evolve screen borrows `ui.toolsOpen` so the world pauses and keys route through `toolsKeys`. `ui.tools(false)` closes Evolve too.
- `state.evo` is created lazily with credit for old saves (10 points a robot, 100 a mission). Never reset it on load.
- This cannot be "uploaded to Roblox": Roblox runs Luau in Roblox Studio, not web pages. A Roblox version is a separate rebuild.
- `progress.js` counts blasters by `kind === 'blaster'`. Never go back to `GEAR.length - TOOLS`, or relics break the "Full Toolbox" sticker.
- `ExtrudeGeometry` bevels fold over at needle-sharp tips: blunt a blade's outline before the last 4%.
- Held swords clip through scenery. Accepted.

## 6. Debug History
- Music "too relaxing" (Roger, 2026-11-26) → stations rewritten at 144–160 bpm, music now also plays on foot during missions and robot fights, and `Radio.rush` (0–1, set in `main.updateSound`) speeds the band up 14% and adds hats, snares and an alarm note. Do not bring back a slow station.
- Bow/trident/glove "did nothing" right after the Time Baton → one shared cooldown → made cooldowns per item.
- Display-stand models off-centre → `Box3.setFromObject` without `precise` → pass `true`.

## 7. Proven Patterns
- Local test: serve the repo, Playwright + system Chrome with swiftshader, route `cdnjs.cloudflare.com/**` to a local `three.module.min.js`. `window.__cw` is the game; set `game.manual = true` and call `game.tick(dt)` to step it.
- New relic = one entry in `RELICS` + one builder in `BUILD` + one sound in `audio.js blast()`.

## 8. Failed Approaches (Do Not Retry)
- GitHub connector file reads/writes from a claude.ai cloud session: fails with "missing Mcp-Param-owner header".

## 9. Open Questions
- Christian asked for a Venom sword, the Hadron Enforcer and the Time Stick by name. Those are Marvel's; the game has original stand-ins (Midnight Goo Blade, Atom Smasher, Time Baton). More of his ideas are welcome as originals.
- Roblox version: first build in `roblox/` (place file + three Luau scripts), syntax-checked only, never run in Studio. Items are built from Roblox parts, so they are simpler than the web models; real meshes need a GUI import in Studio.

## 10. Next Actions
1. Open `roblox/ChristiansWorldEvolve.rbxlx` in Studio, press Play, fix whatever the Output window reports, then Roger publishes.
2. Make the repo private and move hosting to Vercel if Pages stops serving.
3. More legendary gear, auras and titles if Christian wants them.
