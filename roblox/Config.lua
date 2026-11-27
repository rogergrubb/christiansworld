-- Christian's World: Evolve. Everything that is a number or a name lives here, so the game can be tuned in one place.
-- All of it is Christian's own: the forms, the items and the robots are original designs.
local Config = {}

local function rgb(r, g, b) return Color3.fromRGB(r, g, b) end

-- level: the level needed.  wins: robots stopped.  coin: what a robot's coins are worth, times.  dmg: how hard hits land, times.
Config.Forms = {
	{ name = "Rookie", level = 0, wins = 0, coin = 1, dmg = 1, color = rgb(45, 108, 223), glow = rgb(255, 255, 255), crest = "none", wings = 0 },
	{ name = "Spark", level = 2, wins = 5, coin = 2, dmg = 1.25, color = rgb(255, 210, 31), glow = rgb(255, 242, 122), crest = "spikes", wings = 0 },
	{ name = "Ember", level = 4, wins = 15, coin = 3, dmg = 1.5, color = rgb(216, 64, 31), glow = rgb(255, 138, 42), crest = "horns", wings = 0 },
	{ name = "Frost", level = 6, wins = 30, coin = 4, dmg = 1.75, color = rgb(159, 216, 255), glow = rgb(217, 246, 255), crest = "fin", wings = 0 },
	{ name = "Thorn", level = 9, wins = 50, coin = 6, dmg = 2, color = rgb(47, 154, 74), glow = rgb(166, 255, 77), crest = "horns", wings = 0 },
	{ name = "Storm", level = 12, wins = 80, coin = 8, dmg = 2.25, color = rgb(47, 95, 192), glow = rgb(124, 200, 255), crest = "fin", wings = 0 },
	{ name = "Shadow", level = 15, wins = 120, coin = 10, dmg = 2.5, color = rgb(26, 20, 38), glow = rgb(180, 92, 255), crest = "horns", wings = 0 },
	{ name = "Crystal", level = 18, wins = 170, coin = 13, dmg = 2.75, color = rgb(53, 201, 214), glow = rgb(157, 252, 255), crest = "crown", wings = 0 },
	{ name = "Solar", level = 22, wins = 230, coin = 16, dmg = 3, color = rgb(255, 241, 207), glow = rgb(255, 197, 61), crest = "halo", wings = 0 },
	{ name = "Nebula", level = 26, wins = 300, coin = 20, dmg = 3.25, color = rgb(106, 47, 184), glow = rgb(255, 122, 217), crest = "crown", wings = 1 },
	{ name = "Titan", level = 30, wins = 380, coin = 25, dmg = 3.5, color = rgb(138, 148, 163), glow = rgb(255, 59, 48), crest = "horns", wings = 1 },
	{ name = "Phoenix", level = 35, wins = 480, coin = 32, dmg = 3.75, color = rgb(226, 53, 31), glow = rgb(255, 176, 0), crest = "fin", wings = 2 },
	{ name = "Legend", level = 40, wins = 600, coin = 40, dmg = 4, color = rgb(253, 253, 248), glow = rgb(125, 255, 240), crest = "halo", wings = 2 },
}

-- kind: swing (an arc in front), ring (all round you), shot (flies to what you face).
-- reach and radius are in studs.  cool: seconds between uses.  fx: knock, stun, lift or hit.
Config.Items = {
	{ id = "darts", name = "Foam Dart Blaster", price = 0, kind = "shot", reach = 110, dmg = 1, cool = 0.32, fx = "hit", color = rgb(255, 122, 26), tip = "Everyone starts with this one." },
	{ id = "goo", name = "Midnight Goo Blade", price = 150, kind = "swing", reach = 11, dmg = 3, cool = 0.42, fx = "knock", color = rgb(180, 92, 255), tip = "A living sword of black goo. Robots go flying." },
	{ id = "katana", name = "Crystal Katana", price = 300, kind = "swing", reach = 9, dmg = 1.5, cool = 0.2, fx = "hit", color = rgb(127, 227, 255), tip = "The fastest blade on the island." },
	{ id = "baton", name = "Time Baton", price = 500, kind = "ring", radius = 45, dmg = 0, cool = 6, fx = "stun", stun = 7, color = rgb(255, 178, 62), tip = "Every robot around you stands still for seven seconds." },
	{ id = "bow", name = "Galaxy Bow", price = 650, kind = "shot", reach = 220, dmg = 3, cool = 0.38, fx = "hit", color = rgb(157, 123, 255), tip = "Star arrows that fly far and dead straight." },
	{ id = "trident", name = "Storm Trident", price = 800, kind = "shot", reach = 170, dmg = 2, cool = 0.2, fx = "stun", stun = 3, color = rgb(88, 184, 255), tip = "Throws lightning. Every bolt stuns." },
	{ id = "glove", name = "Gravity Glove", price = 1000, kind = "ring", radius = 30, dmg = 1, cool = 3.2, fx = "lift", color = rgb(199, 125, 255), tip = "Every robot nearby floats off the ground." },
	{ id = "meteor", name = "Meteor Staff", price = 1400, kind = "shot", reach = 120, dmg = 5, cool = 0.9, splash = 18, fx = "knock", color = rgb(255, 122, 26), tip = "A burning rock that blows everything away." },
	{ id = "smasher", name = "Atom Smasher", price = 2000, kind = "shot", reach = 200, dmg = 9, cool = 1.8, splash = 26, fx = "knock", color = rgb(57, 240, 255), tip = "Four barrels. The biggest boom on the island." },
}

-- hp: hits to stop it.  coins and xp: what it pays.  speed: studs a second.  size: how big it is built.
Config.Robots = {
	Clanker = { hp = 4, coins = 5, xp = 10, speed = 11, size = 1, color = rgb(160, 168, 178), eye = rgb(255, 60, 60) },
	Brute = { hp = 12, coins = 15, xp = 25, speed = 8, size = 1.5, color = rgb(120, 96, 70), eye = rgb(255, 150, 40) },
	Mega = { hp = 60, coins = 100, xp = 200, speed = 6, size = 2.6, color = rgb(70, 60, 110), eye = rgb(200, 80, 255) },
}

-- Three yards to fight in. x: how far east of the plaza each one is.  max: how many robots it keeps alive.
Config.Arenas = {
	{ name = "Clanker Yard", x = 150, max = 8, mix = { "Clanker" }, floor = rgb(120, 190, 120) },
	{ name = "Brute Pit", x = 330, max = 8, mix = { "Clanker", "Brute", "Brute" }, floor = rgb(200, 170, 110) },
	{ name = "Mega Zone", x = 510, max = 7, mix = { "Brute", "Brute", "Clanker", "Mega" }, floor = rgb(160, 130, 200) },
}

-- Level L starts at 25 x L x (L - 1) points: 50 for level 2, 500 for level 5, 2250 for level 10.
function Config.xpFor(level) return 25 * level * (level - 1) end
function Config.levelOf(xp) return math.floor((1 + math.sqrt(1 + 4 * math.max(0, xp) / 25)) / 2) end

return Config
