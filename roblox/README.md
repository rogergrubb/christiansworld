# Christian's World: Evolve (Roblox)

A Roblox rebuild of the evolve ladder, the eight legendary items and the robot yards. The island game on the website
cannot be uploaded to Roblox; this is its own game, written in Luau.

- `ChristiansWorldEvolve.rbxlx` opens in Roblox Studio. It holds three scripts and nothing else: the world is built by `Server.lua` when the game starts.
- `Config.lua` → ReplicatedStorage/Config (forms, items, robots, numbers)
- `Server.lua` → ServerScriptService/Game
- `Client.lua` → StarterPlayer/StarterPlayerScripts/EvolveClient

Saving uses a DataStore. It only works once the place is published and "Enable Studio Access to API Services" is on
(Game Settings → Security). Until then progress lasts one play session.

Status (2026-11-26): runs clean in Studio (no Output errors; world, shop, HUD, robots and the dart blaster all work).
Published and now PUBLIC (ages 16+ only, rated Mild) as "Christian's World: Evolve" on account Playa_Surfer102, place id 90920311552905:
https://www.roblox.com/games/90920311552905
Not yet tried in play: buying items, evolving, saving.

Octoclank (2026-11-27): a fourth yard, Octoclank Beach, at the far end of the road. One boss with eight walking legs (loose parts moved every frame), a cable whip (eyes turn red, jump to dodge), a belly flop, two overheats (double damage), Clanker helpers, grunts and about 25 lines in a speech bubble. It comes back 40 seconds after it is stopped. Numbers and lines are in `Config.lua` (`Robots.Octo`, `OctoLines`). The scripts compile as Luau; NOT yet run in Studio or published.
