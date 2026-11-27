# Christian's World: Evolve (Roblox)

A Roblox rebuild of the evolve ladder, the eight legendary items and the robot yards. The island game on the website
cannot be uploaded to Roblox; this is its own game, written in Luau.

- `ChristiansWorldEvolve.rbxlx` opens in Roblox Studio. It holds three scripts and nothing else: the world is built by `Server.lua` when the game starts.
- `Config.lua` → ReplicatedStorage/Config (forms, items, robots, numbers)
- `Server.lua` → ServerScriptService/Game
- `Client.lua` → StarterPlayer/StarterPlayerScripts/EvolveClient

Saving uses a DataStore. It only works once the place is published and "Enable Studio Access to API Services" is on
(Game Settings → Security). Until then progress lasts one play session.

Status: syntax-checked only. Not yet run in Studio.
