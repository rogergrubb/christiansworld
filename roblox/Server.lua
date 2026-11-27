-- Christian's World: Evolve (server). Builds the island, runs the robots, and keeps every player's level, coins and form.
-- The whole world is made here when the server starts, so the place file holds nothing but scripts.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local DataStoreService = game:GetService("DataStoreService")
local Lighting = game:GetService("Lighting")

local Config = require(ReplicatedStorage:WaitForChild("Config"))

local Remotes = Instance.new("Folder")
Remotes.Name = "Remotes"
local function remote(name)
	local r = Instance.new("RemoteEvent")
	r.Name = name
	r.Parent = Remotes
	return r
end
local EvolveEvent, WearEvent, NotifyEvent, OpenEvent = remote("Evolve"), remote("Wear"), remote("Notify"), remote("OpenEvolve")
Remotes.Parent = ReplicatedStorage

local rgb = Color3.fromRGB
local UP = CFrame.Angles(0, 0, math.pi / 2)   -- stands a cylinder on end (they are made lying along X)
local FWD = CFrame.Angles(0, math.pi / 2, 0)  -- lays a cylinder along Z, the way a tool points

local itemById = {}
for _, it in ipairs(Config.Items) do itemById[it.id] = it end

---------------------------------------------------------------- building blocks
local function newPart(size, cf, color, material, shape)
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	if shape then p.Shape = shape end
	return p
end

local function label(part, face, text, color)
	local g = Instance.new("SurfaceGui")
	g.Face = face
	g.Parent = part
	local t = Instance.new("TextLabel")
	t.Size = UDim2.new(1, 0, 1, 0)
	t.BackgroundTransparency = 1
	t.TextScaled = true
	t.Font = Enum.Font.GothamBold
	t.TextColor3 = color or rgb(255, 255, 255)
	t.Text = text
	t.Parent = g
	return t
end

local function billboard(adornee, text, studsUp, color)
	local g = Instance.new("BillboardGui")
	g.Size = UDim2.new(14, 0, 3, 0)
	g.StudsOffset = Vector3.new(0, studsUp, 0)
	g.Adornee = adornee
	g.MaxDistance = 120
	g.Parent = adornee
	local t = Instance.new("TextLabel")
	t.Size = UDim2.new(1, 0, 1, 0)
	t.BackgroundTransparency = 1
	t.TextScaled = true
	t.Font = Enum.Font.GothamBold
	t.TextColor3 = color or rgb(255, 255, 255)
	t.TextStrokeTransparency = 0.3
	t.Text = text
	t.Parent = g
	return t
end

local function fade(part, seconds, goal)
	TweenService:Create(part, TweenInfo.new(seconds, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), goal):Play()
	Debris:AddItem(part, seconds + 0.1)
end

local function fxPart(size, cf, color, shape)
	local p = newPart(size, cf, color, Enum.Material.Neon, shape)
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.Transparency = 0.25
	p.Parent = workspace
	return p
end

local function boom(pos, radius, color)
	local p = fxPart(Vector3.new(2, 2, 2), CFrame.new(pos), color, Enum.PartType.Ball)
	fade(p, 0.45, { Size = Vector3.new(radius * 2, radius * 2, radius * 2), Transparency = 1 })
	return p
end

local function ringFx(pos, radius, color)
	local p = fxPart(Vector3.new(0.4, 3, 3), CFrame.new(pos) * UP, color, Enum.PartType.Cylinder)
	fade(p, 0.6, { Size = Vector3.new(0.4, radius * 2, radius * 2), Transparency = 1 })
end

local function tracer(from, to, color, thick)
	local d = (to - from).Magnitude
	if d < 0.5 then return end
	local p = fxPart(Vector3.new(thick, thick, d), CFrame.lookAt((from + to) / 2, to), color)
	fade(p, 0.3, { Transparency = 1, Size = Vector3.new(thick * 0.2, thick * 0.2, d) })
end

local function sound(parent, id, pitch)
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = 0.6
	s.PlaybackSpeed = pitch or 1
	s.Parent = parent
	s:Play()
	Debris:AddItem(s, 3)
end

---------------------------------------------------------------- the items, built from parts
-- Each model has a part called Handle where the hand goes. Swords and staffs stand up along +Y; things that shoot point along -Z.
local function buildItem(id)
	local m = Instance.new("Model")
	m.Name = id
	local handle
	local function add(size, cf, color, material, shape, transparency)
		local p = newPart(size, cf, color, material, shape)
		p.Anchored = false
		p.CanCollide = false
		p.Massless = true
		p.Transparency = transparency or 0
		p.Parent = m
		if handle then
			local w = Instance.new("WeldConstraint")
			w.Part0 = handle
			w.Part1 = p
			w.Parent = p
		else
			handle = p
			p.Name = "Handle"
			m.PrimaryPart = p
		end
		return p
	end
	local V, C = Vector3.new, CFrame.new
	local Ball, Cyl = Enum.PartType.Ball, Enum.PartType.Cylinder
	local Neon, Metal, Glass, Wood = Enum.Material.Neon, Enum.Material.Metal, Enum.Material.Glass, Enum.Material.Wood
	local black, gold, steel = rgb(12, 10, 18), rgb(240, 178, 58), rgb(201, 210, 220)

	if id == "darts" then
		add(V(0.4, 1.0, 0.5), C(0, 0, 0), rgb(60, 66, 76))
		add(V(0.7, 0.8, 2.2), C(0, 0.75, -0.6), rgb(255, 122, 26))
		add(V(1.6, 0.5, 0.5), C(0, 0.75, -1.9) * FWD, rgb(255, 210, 31), nil, Cyl)
		add(V(0.3, 0.3, 0.3), C(0, 1.25, -0.2), rgb(255, 255, 255), Neon, Ball)
	elseif id == "goo" then
		add(V(1.5, 0.45, 0.45), C(0, 0, 0) * UP, rgb(36, 18, 56), nil, Cyl)
		add(V(0.7, 0.7, 0.7), C(0, -0.95, 0), black, nil, Ball).Reflectance = 0.3
		add(V(2.6, 0.38, 0.55), C(0, 0.9, 0), black).Reflectance = 0.3
		for _, s in ipairs({ -1, 1 }) do
			add(V(0.36, 1.0, 0.42), C(s * 1.35, 1.25, 0) * CFrame.Angles(0, 0, -s * 0.5), black).Reflectance = 0.3
			add(V(0.42, 0.42, 0.42), C(0, 0.9, s * 0.3), rgb(180, 92, 255), Neon, Ball)
		end
		local widths = { 1.15, 1.0, 0.8, 0.55, 0.3 }
		for i, w in ipairs(widths) do
			add(V(w, 1.05, 0.3 - i * 0.03), C(math.sin(i * 1.3) * 0.08, 0.6 + i * 1.0, 0), black).Reflectance = 0.35
		end
		add(V(0.14, 4.6, 0.36), C(0, 3.3, 0), rgb(180, 92, 255), Neon)
		add(V(0.5, 0.5, 0.5), C(0.5, 2.2, 0), black, nil, Ball).Reflectance = 0.3
		add(V(0.4, 0.4, 0.4), C(-0.45, 3.4, 0), black, nil, Ball).Reflectance = 0.3
	elseif id == "katana" then
		add(V(1.6, 0.4, 0.4), C(0, 0, 0) * UP, rgb(28, 50, 110), nil, Cyl)
		add(V(0.16, 1.4, 1.4), C(0, 0.9, 0) * UP, gold, Metal, Cyl)
		add(V(0.3, 0.5, 0.5), C(0, -0.9, 0) * UP, gold, Metal, Cyl)
		for k = 0, 3 do
			local cf = C(-0.07 * k * k, 1.75 + 1.4 * k, 0) * CFrame.Angles(0, 0, 0.09 * k)
			add(V(0.5 - k * 0.07, 1.5, 0.12), cf, rgb(79, 196, 255), Glass, nil, 0.2)
			add(V(0.1, 1.5, 0.16), cf, rgb(200, 245, 255), Neon)
		end
		add(V(0.25, 0.25, 0.25), C(0.2, -1.3, 0), rgb(127, 227, 255), Neon, Ball)
	elseif id == "baton" then
		add(V(2.8, 0.4, 0.4), C(0, 0, 0) * UP, rgb(70, 44, 26), Wood, Cyl)
		for _, y in ipairs({ -1.1, 0, 1.1 }) do add(V(0.14, 0.56, 0.56), C(0, y, 0) * UP, gold, Metal, Cyl) end
		add(V(0.85, 0.85, 0.85), C(0, 1.6, 0), gold, Metal, Ball)
		add(V(1.6, 1.6, 1.6), C(0, 2.7, 0), rgb(255, 240, 200), Glass, Ball, 0.55)
		add(V(0.8, 0.8, 0.8), C(0, 2.7, 0), rgb(255, 178, 62), Neon, Ball)
		add(V(0.12, 2.1, 2.1), C(0, 2.7, 0) * CFrame.Angles(0.5, 0, 0.3) * UP, gold, Metal, Cyl, 0.5)
		add(V(0.3, 0.6, 0.3), C(0, 3.7, 0), gold, Metal)
		add(V(0.32, 0.32, 0.32), C(0, -1.55, 0), rgb(61, 255, 176), Neon, Ball)
	elseif id == "bow" then
		add(V(0.4, 1.1, 0.5), C(0, 0, 0), rgb(42, 23, 80))
		for _, s in ipairs({ -1, 1 }) do
			add(V(0.26, 1.5, 0.34), C(0, s * 1.2, 0.2) * CFrame.Angles(s * 0.3, 0, 0), rgb(106, 47, 184))
			add(V(0.22, 1.4, 0.3), C(0, s * 2.4, 0.75) * CFrame.Angles(s * 0.55, 0, 0), rgb(60, 80, 200))
			add(V(0.18, 0.7, 0.24), C(0, s * 3.2, 1.0) * CFrame.Angles(-s * 0.4, 0, 0), gold, Metal)
			add(V(0.06, 3.3, 0.06), C(0, s * 1.65, 1.0), rgb(191, 168, 255), Neon)
		end
		add(V(3.6, 0.12, 0.12), C(0.3, 0, -0.7) * FWD, rgb(233, 226, 255), Neon, Cyl)
		add(V(0.5, 0.5, 0.2), C(0.3, 0, -2.6), gold, Metal)
		add(V(0.3, 0.3, 0.3), C(0, 0, -0.35), rgb(157, 123, 255), Neon, Ball)
	elseif id == "trident" then
		add(V(6.2, 0.36, 0.36), C(0, 0.6, 0) * UP, rgb(29, 44, 82), Metal, Cyl)
		for _, y in ipairs({ -2.2, -0.6, 1.0, 2.6 }) do add(V(0.16, 0.5, 0.5), C(0, y, 0) * UP, gold, Metal, Cyl) end
		add(V(0.85, 0.85, 0.85), C(0, 3.8, 0), gold, Metal, Ball)
		add(V(2.5, 0.32, 0.3), C(0, 4.2, 0), rgb(74, 143, 240), Metal)
		add(V(0.38, 2.5, 0.26), C(0, 5.4, 0), rgb(74, 143, 240), Metal)
		for _, s in ipairs({ -1, 1 }) do
			add(V(0.32, 1.8, 0.26), C(s * 1.1, 5.0, 0), rgb(74, 143, 240), Metal)
			add(V(0.34, 0.34, 0.34), C(s * 1.1, 6.0, 0), rgb(159, 220, 255), Neon, Ball)
		end
		add(V(0.4, 0.4, 0.4), C(0, 6.75, 0), rgb(159, 220, 255), Neon, Ball)
		add(V(0.4, 0.4, 0.4), C(0, 3.8, 0.4), rgb(88, 184, 255), Neon, Ball)
	elseif id == "glove" then
		add(V(1.5, 1.5, 1.5), C(0, 0, 0), rgb(59, 42, 120), Metal)
		add(V(1.4, 1.6, 1.6), C(0, 0, 1.4) * FWD, rgb(59, 42, 120), Metal, Cyl)
		add(V(0.2, 1.78, 1.78), C(0, 0, 0.75) * FWD, gold, Metal, Cyl)
		add(V(0.2, 1.9, 1.9), C(0, 0, 2.05) * FWD, gold, Metal, Cyl)
		add(V(0.75, 0.75, 0.75), C(0, 0.75, 0), rgb(199, 125, 255), Neon, Ball)
		for i = 0, 3 do add(V(0.3, 0.45, 0.4), C(-0.54 + i * 0.36, 0.5, -0.8), gold, Metal) end
		for i = 0, 2 do add(V(0.5, 0.4, 0.5), C(math.cos(i * 2.1) * 1.9, 0.3 + i * 0.3, math.sin(i * 2.1) * 1.9), rgb(107, 100, 116), Enum.Material.Slate, Ball) end
	elseif id == "meteor" then
		add(V(6.2, 0.4, 0.4), C(0, 0.6, 0) * UP, rgb(42, 26, 18), Wood, Cyl)
		for _, y in ipairs({ -2.0, 0.2, 3.0 }) do add(V(0.2, 0.55, 0.55), C(0, y, 0) * UP, rgb(58, 63, 71), Metal, Cyl) end
		for i = 0, 3 do
			local a = i * math.pi / 2 + 0.4
			add(V(0.26, 1.9, 0.26), C(math.cos(a) * 0.85, 4.5, math.sin(a) * 0.85) * CFrame.Angles(math.sin(a) * 0.35, 0, -math.cos(a) * 0.35), rgb(58, 63, 71), Metal)
		end
		local rock = add(V(1.7, 1.7, 1.7), C(0, 4.8, 0), rgb(255, 110, 20), Enum.Material.CrackedLava, Ball)
		local light = Instance.new("PointLight")
		light.Color = rgb(255, 122, 26)
		light.Range = 14
		light.Parent = rock
		add(V(0.3, 0.8, 0.3), C(0, -2.9, 0), rgb(58, 63, 71), Metal)
	elseif id == "smasher" then
		add(V(0.45, 1.1, 0.55), C(0, 0, 0), rgb(35, 39, 46))
		add(V(2.8, 1.5, 1.5), C(0, 1.25, -0.5) * FWD, rgb(242, 244, 247), Metal, Cyl)
		add(V(0.7, 1.66, 1.66), C(0, 1.25, -0.9) * FWD, rgb(255, 106, 26), Metal, Cyl)
		for i = 0, 3 do add(V(0.12, 1.6, 1.6), C(0, 1.25, 0.1 + i * 0.2) * FWD, rgb(217, 120, 58), Metal, Cyl) end
		for i = 0, 3 do
			local a = i * math.pi / 2 + math.pi / 4
			local x, y = math.cos(a) * 0.36, 1.25 + math.sin(a) * 0.36
			add(V(2.8, 0.42, 0.42), C(x, y, -3.2) * FWD, rgb(35, 39, 46), Metal, Cyl)
			add(V(0.12, 0.3, 0.3), C(x, y, -4.62) * FWD, rgb(57, 240, 255), Neon, Cyl)
		end
		add(V(0.3, 2.7, 2.7), C(0, 1.25, -1.6) * FWD, rgb(44, 51, 64), Metal, Cyl)
		add(V(0.36, 2.3, 2.3), C(0, 1.25, -1.6) * FWD, rgb(57, 240, 255), Neon, Cyl)
		add(V(0.75, 0.75, 0.75), C(0, 1.25, 1.35), rgb(255, 138, 42), Neon, Ball)
	end
	return m
end

-- One real Tool per item, kept in ServerStorage and copied to whoever earns it.
local ToolBox = Instance.new("Folder")
ToolBox.Name = "Items"
ToolBox.Parent = ServerStorage
for _, it in ipairs(Config.Items) do
	local m = buildItem(it.id)
	local tool = Instance.new("Tool")
	tool.Name = it.name
	tool.ToolTip = it.tip
	tool.CanBeDropped = false
	tool.RequiresHandle = true
	tool:SetAttribute("ItemId", it.id)
	for _, c in ipairs(m:GetChildren()) do c.Parent = tool end
	m:Destroy()
	tool.Parent = ToolBox
end

---------------------------------------------------------------- the world
Lighting.ClockTime = 14
Lighting.Brightness = 2.5

local World = Instance.new("Folder")
World.Name = "World"
World.Parent = workspace

local ground = newPart(Vector3.new(900, 4, 420), CFrame.new(270, -2, 0), rgb(86, 160, 84), Enum.Material.Grass)
ground.Name = "Ground"
ground.Parent = World
newPart(Vector3.new(110, 0.4, 110), CFrame.new(0, 0.2, 0), rgb(214, 208, 196), Enum.Material.Concrete).Parent = World
newPart(Vector3.new(560, 0.3, 18), CFrame.new(330, 0.15, 0), rgb(70, 74, 82), Enum.Material.Asphalt).Parent = World

local spawn = Instance.new("SpawnLocation")
spawn.Anchored = true
spawn.Neutral = true
spawn.Size = Vector3.new(12, 1, 12)
spawn.CFrame = CFrame.new(0, 0.9, 12)
spawn.Color = rgb(255, 210, 31)
spawn.TopSurface = Enum.SurfaceType.Smooth
spawn.Parent = World

local title = newPart(Vector3.new(60, 12, 1), CFrame.new(0, 14, 54), rgb(10, 122, 75))
title.Parent = World
label(title, Enum.NormalId.Front, "CHRISTIAN'S WORLD: EVOLVE")

-- the shop: one pedestal for each legendary item, with the real thing turning above it
local displays = {}
local shopItems = {}
for _, it in ipairs(Config.Items) do if it.price > 0 then table.insert(shopItems, it) end end
for i, it in ipairs(shopItems) do
	local x = (i - (#shopItems + 1) / 2) * 12
	local ped = newPart(Vector3.new(2, 7, 7), CFrame.new(x, 1.4, -42) * UP, rgb(36, 29, 74), Enum.Material.Metal, Enum.PartType.Cylinder)
	ped.Name = "Pedestal_" .. it.id
	ped.Parent = World
	local rim = newPart(Vector3.new(0.3, 7.4, 7.4), CFrame.new(x, 2.45, -42) * UP, it.color, Enum.Material.Neon, Enum.PartType.Cylinder)
	rim.Parent = World
	billboard(ped, it.name .. "\n" .. it.price .. " coins", 11, rgb(255, 210, 31))
	local show = buildItem(it.id)
	for _, p in ipairs(show:GetDescendants()) do if p:IsA("BasePart") then p.Anchored = true end end
	show.Parent = World
	table.insert(displays, { model = show, at = Vector3.new(x, 6, -42), id = it.id })
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Buy"
	prompt.ObjectText = it.name .. " (" .. it.price .. " coins)"
	prompt.HoldDuration = 0.4
	prompt.MaxActivationDistance = 14
	prompt.RequiresLineOfSight = false
	prompt:SetAttribute("ItemId", it.id)
	prompt.Parent = ped
end

-- the evolve altar
local altar = newPart(Vector3.new(1.2, 14, 14), CFrame.new(-36, 0.8, 22) * UP, rgb(36, 29, 74), Enum.Material.Metal, Enum.PartType.Cylinder)
altar.Parent = World
newPart(Vector3.new(0.4, 12, 12), CFrame.new(-36, 1.5, 22) * UP, rgb(255, 210, 31), Enum.Material.Neon, Enum.PartType.Cylinder).Parent = World
billboard(altar, "EVOLVE", 9, rgb(255, 210, 31))
local altarPrompt = Instance.new("ProximityPrompt")
altarPrompt.ActionText = "Evolve"
altarPrompt.ObjectText = "Evolution altar"
altarPrompt.HoldDuration = 0
altarPrompt.MaxActivationDistance = 16
altarPrompt.RequiresLineOfSight = false
altarPrompt.Parent = altar

-- the three yards
local ARENA = 140
for _, a in ipairs(Config.Arenas) do
	newPart(Vector3.new(ARENA, 0.4, ARENA), CFrame.new(a.x, 0.2, 0), a.floor, Enum.Material.Sand).Parent = World
	local sign = newPart(Vector3.new(1, 9, 30), CFrame.new(a.x - ARENA / 2 - 2, 12, -28), rgb(29, 35, 43))
	sign.Parent = World
	label(sign, Enum.NormalId.Left, a.name)
	for _, z in ipairs({ -28 - 14, -28 + 14 }) do newPart(Vector3.new(1, 8, 1), CFrame.new(a.x - ARENA / 2 - 2, 4, z), rgb(29, 35, 43)).Parent = World end
end

---------------------------------------------------------------- players: what each one has
local store = nil
pcall(function() store = DataStoreService:GetDataStore("ChristiansWorldEvolve_v1") end)
local data = {}

local function formOf(player) local d = data[player]; return Config.Forms[(d and d.tier or 0) + 1] end

local function sync(player)
	local d = data[player]
	if not d then return end
	local level = Config.levelOf(d.xp)
	player:SetAttribute("Coins", d.coins)
	player:SetAttribute("XP", d.xp)
	player:SetAttribute("Level", level)
	player:SetAttribute("Wins", d.wins)
	player:SetAttribute("Tier", d.tier)
	player:SetAttribute("Wear", d.wear)
	local ls = player:FindFirstChild("leaderstats")
	if ls then
		ls.Coins.Value = d.coins
		ls.Level.Value = level
		ls.Robots.Value = d.wins
	end
end

local function note(player, text) NotifyEvent:FireClient(player, text) end

local function canEvolve(d)
	local nextForm = Config.Forms[d.tier + 2]
	return nextForm ~= nil and Config.levelOf(d.xp) >= nextForm.level and d.wins >= nextForm.wins
end

-- The armour for the form a player is wearing: a band and crest on the head, shoulder guards, a chest light, wings at the top.
local function dress(player)
	local d, char = data[player], player.Character
	if not d or not char then return end
	local old = char:FindFirstChild("FormArmor")
	if old then old:Destroy() end
	local wear = math.min(d.wear, d.tier)
	if wear <= 0 then return end
	local f = Config.Forms[wear + 1]
	local head = char:FindFirstChild("Head")
	local torso = char:FindFirstChild("UpperTorso") or char:FindFirstChild("Torso")
	local root = char:FindFirstChild("HumanoidRootPart")
	if not head or not torso or not root then return end
	local folder = Instance.new("Folder")
	folder.Name = "FormArmor"
	folder.Parent = char
	local gold = rgb(240, 178, 58)
	local function wearPart(on, size, cf, color, material, shape, transparency)
		local p = newPart(size, on.CFrame * cf, color, material, shape)
		p.Anchored = false
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.Massless = true
		p.Transparency = transparency or 0
		p.Parent = folder
		local w = Instance.new("WeldConstraint")
		w.Part0 = on
		w.Part1 = p
		w.Parent = p
		return p
	end
	local V, C = Vector3.new, CFrame.new
	local Ball, Cyl, Neon, Metal = Enum.PartType.Ball, Enum.PartType.Cylinder, Enum.Material.Neon, Enum.Material.Metal
	wearPart(head, V(0.22, 1.5, 1.5), C(0, 0.42, 0) * UP, gold, Metal, Cyl)
	wearPart(head, V(0.3, 0.3, 0.3), C(0, 0.42, -0.75), f.glow, Neon, Ball)
	if f.crest == "spikes" then
		for i = -1, 1 do wearPart(head, V(0.2, 0.8 - math.abs(i) * 0.2, 0.2), C(0, 1.0, i * 0.35), f.glow, Neon) end
	elseif f.crest == "horns" then
		for _, s in ipairs({ -1, 1 }) do
			wearPart(head, V(0.26, 0.9, 0.26), C(s * 0.72, 0.95, 0) * CFrame.Angles(0, 0, -s * 0.5), gold, Metal)
			wearPart(head, V(0.2, 0.6, 0.2), C(s * 0.98, 1.55, 0) * CFrame.Angles(0, 0, s * 0.2), gold, Metal)
		end
	elseif f.crest == "fin" then
		wearPart(head, V(0.16, 1.2, 1.1), C(0, 1.2, 0.1) * CFrame.Angles(-0.3, 0, 0), f.color, Metal)
		wearPart(head, V(0.2, 0.12, 1.2), C(0, 1.75, 0.3) * CFrame.Angles(-0.3, 0, 0), f.glow, Neon)
	elseif f.crest == "crown" then
		for i = 0, 5 do
			local a = i * math.pi / 3
			wearPart(head, V(0.2, 0.55 + (i % 2) * 0.25, 0.2), C(math.cos(a) * 0.62, 0.95, math.sin(a) * 0.62), gold, Metal)
		end
		wearPart(head, V(0.25, 0.25, 0.25), C(0, 0.75, -0.72), f.glow, Neon, Ball)
	elseif f.crest == "halo" then
		wearPart(head, V(0.1, 1.7, 1.7), C(0, 1.6, 0) * UP, f.glow, Neon, Cyl, 0.35)
	end
	for _, s in ipairs({ -1, 1 }) do
		wearPart(torso, V(1.15, 1.15, 1.15), C(s * 1.3, 0.85, 0), f.color, Metal, Ball)
		wearPart(torso, V(0.3, 0.3, 0.3), C(s * 1.45, 1.4, 0), f.glow, Neon, Ball)
		if wear >= 3 then wearPart(torso, V(0.24, 0.8, 0.24), C(s * 1.75, 1.45, 0) * CFrame.Angles(0, 0, -s * 0.7), gold, Metal) end
		for i = 0, (f.wings == 2 and 3 or f.wings == 1 and 1 or -1) do
			wearPart(torso, V(0.14, 3.0 - i * 0.5, 0.8), C(s * (0.9 + i * 0.55), 0.9 + i * 0.25, 0.62) * CFrame.Angles(0, 0, -s * (0.75 + i * 0.28)), f.glow, Neon, nil, 0.25)
		end
	end
	wearPart(torso, V(0.5, 0.5, 0.3), C(0, 0.35, -0.55), f.glow, Neon, Ball)
	local aura = wearPart(root, V(0.2, 0.2, 0.2), C(0, 0, 0), f.glow, Neon, Ball, 1)
	local light = Instance.new("PointLight")
	light.Color = f.glow
	light.Range = 8 + wear
	light.Brightness = 1.5
	light.Parent = aura
	local sparks = Instance.new("ParticleEmitter")
	sparks.Color = ColorSequence.new(f.glow)
	sparks.LightEmission = 1
	sparks.Size = NumberSequence.new(0.35)
	sparks.Lifetime = NumberRange.new(0.8, 1.4)
	sparks.Speed = NumberRange.new(1, 3)
	sparks.SpreadAngle = Vector2.new(180, 180)
	sparks.Rate = 4 + wear * 2
	sparks.Parent = aura
end

local function give(player, id)
	local it = itemById[id]
	local template = it and ToolBox:FindFirstChild(it.name)
	if not template then return end
	for _, where in ipairs({ player:FindFirstChild("Backpack"), player:FindFirstChild("StarterGear") }) do
		if where and not where:FindFirstChild(it.name) then template:Clone().Parent = where end
	end
end

local function gainXP(player, xp)
	local d = data[player]
	if not d then return end
	local was, ready = Config.levelOf(d.xp), canEvolve(d)
	d.xp = d.xp + math.floor(xp * (1 + d.tier * 0.5) + 0.5)
	local now = Config.levelOf(d.xp)
	if now > was then note(player, "Level " .. now .. "!") end
	if not ready and canEvolve(d) then note(player, "You can evolve into " .. Config.Forms[d.tier + 2].name .. "!") end
end

local function load(player)
	local d = { coins = 0, xp = 0, wins = 0, tier = 0, wear = 0, items = {} }
	if store then
		local ok, saved = pcall(function() return store:GetAsync("p" .. player.UserId) end)
		if ok and type(saved) == "table" then
			d.coins = tonumber(saved.coins) or 0
			d.xp = tonumber(saved.xp) or 0
			d.wins = tonumber(saved.wins) or 0
			d.tier = math.clamp(tonumber(saved.tier) or 0, 0, #Config.Forms - 1)
			d.wear = math.clamp(tonumber(saved.wear) or 0, 0, d.tier)
			if type(saved.items) == "table" then for _, id in ipairs(saved.items) do if itemById[id] then d.items[id] = true end end end
		end
	end
	d.items.darts = true
	return d
end

local function save(player)
	local d = data[player]
	if not d or not store then return end
	local items = {}
	for id in pairs(d.items) do table.insert(items, id) end
	pcall(function() store:SetAsync("p" .. player.UserId, { coins = d.coins, xp = d.xp, wins = d.wins, tier = d.tier, wear = d.wear, items = items }) end)
end

---------------------------------------------------------------- robots
local robots = {}
local rand = Random.new()

local function buildRobot(kind, def)
	local s = def.size
	local m = Instance.new("Model")
	m.Name = kind
	local function add(size, at, color, material, shape)
		local p = newPart(size * s, CFrame.new(at * s), color, material, shape)
		p.CanCollide = false
		p.Parent = m
		return p
	end
	local V = Vector3.new
	local body = add(V(2.6, 2.6, 1.7), V(0, 2.5, 0), def.color, Enum.Material.Metal)
	body.PivotOffset = CFrame.new(0, -2.5 * s, 0)   -- the model turns and moves about its feet
	m.PrimaryPart = body
	add(V(1.7, 1.4, 1.5), V(0, 4.5, 0), def.color, Enum.Material.Metal)
	add(V(1.2, 0.35, 0.2), V(0, 4.6, -0.75), def.eye, Enum.Material.Neon)
	add(V(0.2, 0.9, 0.2), V(0, 5.6, 0), rgb(60, 60, 66), Enum.Material.Metal)
	add(V(0.4, 0.4, 0.4), V(0, 6.2, 0), def.eye, Enum.Material.Neon, Enum.PartType.Ball)
	for _, x in ipairs({ -1, 1 }) do
		add(V(0.6, 2.2, 0.6), V(x * 1.65, 2.6, 0), rgb(60, 60, 66), Enum.Material.Metal)
		add(V(0.8, 1.3, 0.9), V(x * 0.65, 0.65, 0), rgb(60, 60, 66), Enum.Material.Metal)
	end
	add(V(0.9, 0.9, 0.2), V(0, 2.6, -0.88), def.eye, Enum.Material.Neon)
	local bar = Instance.new("BillboardGui")
	bar.Size = UDim2.new(5 * s, 0, 0.5 * s, 0)
	bar.StudsOffset = Vector3.new(0, 4.6 * s, 0)
	bar.Adornee = body
	bar.MaxDistance = 90
	bar.Parent = body
	local back = Instance.new("Frame")
	back.Size = UDim2.new(1, 0, 1, 0)
	back.BackgroundColor3 = rgb(20, 20, 26)
	back.BorderSizePixel = 0
	back.Parent = bar
	local fill = Instance.new("Frame")
	fill.Name = "Fill"
	fill.Size = UDim2.new(1, 0, 1, 0)
	fill.BackgroundColor3 = rgb(120, 230, 90)
	fill.BorderSizePixel = 0
	fill.Parent = back
	return m, fill
end

local function spawnRobot(arena)
	local kind = arena.mix[rand:NextInteger(1, #arena.mix)]
	local def = Config.Robots[kind]
	local m, fill = buildRobot(kind, def)
	local half = ARENA / 2 - 10
	local r = {
		model = m, fill = fill, kind = kind, def = def, hp = def.hp, arena = arena,
		pos = Vector3.new(arena.x + rand:NextNumber(-half, half), 0.4, rand:NextNumber(-half, half)),
		heading = rand:NextNumber(0, math.pi * 2), vel = Vector3.new(0, 0, 0), stun = 0, lift = 0, bite = 0, turn = 0,
	}
	m:PivotTo(CFrame.new(r.pos) * CFrame.Angles(0, r.heading, 0))
	m.Parent = workspace
	table.insert(robots, r)
end

local function zonk(r, player)
	if r.dead then return end
	r.dead = true
	local mid = r.pos + Vector3.new(0, 3 * r.def.size, 0)
	sound(boom(mid, 5 * r.def.size, rgb(255, 215, 80)), "rbxasset://sounds/collide.wav", 0.8)
	Debris:AddItem(r.model, 0.05)
	local d = player and data[player]
	if d then
		local f = formOf(player)
		local coins = r.def.coins * f.coin
		d.coins = d.coins + coins
		d.wins = d.wins + 1
		gainXP(player, r.def.xp)
		sync(player)
		if r.kind == "Mega" then note(player, "Mega robot stopped!  +" .. coins .. " coins") end
	end
end

local function hit(r, dmg, fx, player, from, item)
	if r.dead then return end
	local f = player and formOf(player) or Config.Forms[1]
	if fx == "knock" and r.kind ~= "Mega" then
		local away = Vector3.new(r.pos.X - from.X, 0, r.pos.Z - from.Z)
		if away.Magnitude < 0.1 then away = Vector3.new(1, 0, 0) end
		r.vel = away.Unit * 70
	elseif fx == "stun" then
		r.stun = math.max(r.stun, r.kind == "Mega" and 1.4 or (item.stun or 3))
	elseif fx == "lift" and r.kind ~= "Mega" then
		r.lift = 3
	end
	r.hp = r.hp - dmg * f.dmg
	r.fill.Size = UDim2.new(math.clamp(r.hp / r.def.hp, 0, 1), 0, 1, 0)
	if r.hp <= 0 then zonk(r, player) end
end

-- the robot most nearly in front of a point, within reach
local function aimAt(from, look, reach)
	local best, score = nil, math.huge
	for _, r in ipairs(robots) do
		if not r.dead then
			local to = Vector3.new(r.pos.X - from.X, 0, r.pos.Z - from.Z)
			local dist = to.Magnitude
			if dist < reach and dist > 0.1 then
				local off = math.acos(math.clamp(to.Unit:Dot(look), -1, 1))
				if off < 0.9 or dist < 14 then
					local sc = off * 40 + dist
					if sc < score then best, score = r, sc end
				end
			end
		end
	end
	return best
end

local function around(center, radius, fn)
	for _, r in ipairs(robots) do
		if not r.dead and (Vector3.new(r.pos.X - center.X, 0, r.pos.Z - center.Z)).Magnitude <= radius + 2 * r.def.size then fn(r) end
	end
end

---------------------------------------------------------------- using an item
local lastUse = {}

local function use(player, tool)
	local it = itemById[tool:GetAttribute("ItemId")]
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not it or not root or not hum or hum.Health <= 0 then return end
	local key = player.UserId .. it.id
	local now = os.clock()
	if lastUse[key] and now - lastUse[key] < it.cool then return end
	lastUse[key] = now
	local look = Vector3.new(root.CFrame.LookVector.X, 0, root.CFrame.LookVector.Z)
	if look.Magnitude < 0.01 then look = Vector3.new(0, 0, -1) end
	look = look.Unit
	local from = root.Position
	if it.kind == "swing" then
		local mid = from + look * (it.reach * 0.55)
		boom(mid, it.reach * 0.6, it.color)
		sound(root, "rbxasset://sounds/swordslash.wav", it.id == "katana" and 1.4 or 0.9)
		around(mid, it.reach * 0.6, function(r) hit(r, it.dmg, it.fx, player, from, it) end)
	elseif it.kind == "ring" then
		ringFx(Vector3.new(from.X, 0.8, from.Z), it.radius, it.color)
		sound(root, "rbxasset://sounds/electronicpingshort.wav", 0.5)
		around(from, it.radius, function(r) hit(r, it.dmg, it.fx, player, from, it) end)
	else
		local target = aimAt(from, look, it.reach)
		local muzzle = from + look * 3 + Vector3.new(0, 1, 0)
		local to = target and (target.pos + Vector3.new(0, 3 * target.def.size, 0)) or (muzzle + look * math.min(it.reach, 90))
		tracer(muzzle, to, it.color, it.splash and 1.2 or 0.35)
		sound(root, "rbxasset://sounds/electronicpingshort.wav", it.splash and 0.6 or 1.5)
		if it.splash then
			boom(to, it.splash, it.color)
			around(to, it.splash, function(r) hit(r, it.dmg, it.fx, player, to, it) end)
		elseif target then
			hit(target, it.dmg, it.fx, player, from, it)
		end
	end
end

local function wireTool(player, tool)
	if not tool:IsA("Tool") or tool:GetAttribute("Wired") or not tool:GetAttribute("ItemId") then return end
	tool:SetAttribute("Wired", true)
	tool.Activated:Connect(function() use(player, tool) end)
end

---------------------------------------------------------------- joining, leaving, buying, evolving
local function onCharacter(player, char)
	local backpack = player:WaitForChild("Backpack", 5)
	if backpack then
		for _, t in ipairs(backpack:GetChildren()) do wireTool(player, t) end
		backpack.ChildAdded:Connect(function(t) wireTool(player, t) end)
	end
	char.ChildAdded:Connect(function(t) wireTool(player, t) end)
	char:WaitForChild("HumanoidRootPart", 5)
	task.wait(0.3)
	dress(player)
end

local function onPlayer(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	for _, name in ipairs({ "Coins", "Level", "Robots" }) do
		local v = Instance.new("IntValue")
		v.Name = name
		v.Parent = ls
	end
	ls.Parent = player
	data[player] = load(player)
	sync(player)
	player.CharacterAdded:Connect(function(char) onCharacter(player, char) end)
	for id in pairs(data[player].items) do give(player, id) end
	if player.Character then onCharacter(player, player.Character) end
	note(player, "Stop robots to level up. Then evolve!")
end

Players.PlayerAdded:Connect(onPlayer)
for _, p in ipairs(Players:GetPlayers()) do task.spawn(onPlayer, p) end
Players.PlayerRemoving:Connect(function(player)
	save(player)
	data[player] = nil
end)
game:BindToClose(function() for _, p in ipairs(Players:GetPlayers()) do save(p) end end)

for _, d in ipairs(World:GetDescendants()) do
	if d:IsA("ProximityPrompt") and d:GetAttribute("ItemId") then
		d.Triggered:Connect(function(player)
			local it, pd = itemById[d:GetAttribute("ItemId")], data[player]
			if not it or not pd then return end
			if pd.items[it.id] then
				note(player, it.name .. " is already yours.")
			elseif pd.coins < it.price then
				note(player, "You need " .. (it.price - pd.coins) .. " more coins for the " .. it.name .. ".")
			else
				pd.coins = pd.coins - it.price
				pd.items[it.id] = true
				give(player, it.id)
				sync(player)
				save(player)
				note(player, "Legendary gear: " .. it.name .. "!")
			end
		end)
	end
end

altarPrompt.Triggered:Connect(function(player) OpenEvent:FireClient(player) end)

EvolveEvent.OnServerEvent:Connect(function(player)
	local d = data[player]
	if not d or not canEvolve(d) then return end
	d.tier = d.tier + 1
	d.wear = d.tier
	local f = formOf(player)
	sync(player)
	dress(player)
	save(player)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if root then
		boom(root.Position, 16, f.glow)
		ringFx(Vector3.new(root.Position.X, 0.8, root.Position.Z), 30, f.glow)
	end
	NotifyEvent:FireAllClients(player.DisplayName .. " evolved into " .. f.name .. "!")
end)

WearEvent.OnServerEvent:Connect(function(player, index)
	local d = data[player]
	if not d or type(index) ~= "number" then return end
	index = math.floor(index)
	if index < 0 or index > d.tier then return end
	d.wear = index
	sync(player)
	dress(player)
end)

---------------------------------------------------------------- the loop: robots think 15 times a second
local acc, spin, saveT = 0, 0, 0
RunService.Heartbeat:Connect(function(dt)
	acc = acc + dt
	if acc < 1 / 15 then return end
	local step = acc
	acc = 0
	spin = spin + step
	saveT = saveT + step

	for _, show in ipairs(displays) do
		local tilt = (show.id == "bow" or show.id == "smasher" or show.id == "glove") and CFrame.Angles(0, 0, 0) or CFrame.Angles(0, 0, -0.35)
		show.model:PivotTo(CFrame.new(show.at + Vector3.new(0, math.sin(spin * 1.5) * 0.4, 0)) * CFrame.Angles(0, spin * 0.8, 0) * tilt)
	end

	local roots = {}
	for _, p in ipairs(Players:GetPlayers()) do
		local char = p.Character
		local root = char and char:FindFirstChild("HumanoidRootPart")
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		if root and hum and hum.Health > 0 then table.insert(roots, { root = root, hum = hum }) end
	end

	local count = {}
	for i = #robots, 1, -1 do
		local r = robots[i]
		if r.dead then
			table.remove(robots, i)
		else
			count[r.arena] = (count[r.arena] or 0) + 1
			local half = ARENA / 2 - 4
			local y = 0.4
			r.stun = math.max(0, r.stun - step)
			r.bite = math.max(0, r.bite - step)
			if r.lift > 0 then
				r.lift = r.lift - step
				y = 0.4 + 7 * math.sin(math.clamp(r.lift / 3, 0, 1) * math.pi)
				r.heading = r.heading + step * 4
			elseif r.stun <= 0 then
				local near, nd = nil, 85
				for _, pr in ipairs(roots) do
					local p = pr.root.Position
					if math.abs(p.X - r.arena.x) < ARENA / 2 + 6 and math.abs(p.Z) < ARENA / 2 + 6 then
						local dd = (Vector3.new(p.X - r.pos.X, 0, p.Z - r.pos.Z)).Magnitude
						if dd < nd then near, nd = pr, dd end
					end
				end
				if near then
					local p = near.root.Position
					r.heading = math.atan2(-(p.X - r.pos.X), -(p.Z - r.pos.Z))
					local reach = 3.2 * r.def.size + 1.5
					if nd > reach then
						r.pos = r.pos + Vector3.new(p.X - r.pos.X, 0, p.Z - r.pos.Z).Unit * r.def.speed * step
					elseif r.bite <= 0 then
						r.bite = 1.6
						near.hum:TakeDamage(r.kind == "Mega" and 12 or r.kind == "Brute" and 7 or 4)
					end
				else
					r.turn = r.turn - step
					if r.turn <= 0 then
						r.turn = rand:NextNumber(1.5, 4)
						r.heading = rand:NextNumber(0, math.pi * 2)
					end
					r.pos = r.pos + Vector3.new(-math.sin(r.heading), 0, -math.cos(r.heading)) * r.def.speed * 0.4 * step
				end
			end
			r.pos = r.pos + r.vel * step
			r.vel = r.vel * 0.8
			r.pos = Vector3.new(math.clamp(r.pos.X, r.arena.x - half, r.arena.x + half), 0.4, math.clamp(r.pos.Z, -half, half))
			local wobble = r.stun > 0 and CFrame.Angles(0, 0, math.sin(spin * 20) * 0.08) or CFrame.Angles(0, 0, 0)
			r.model:PivotTo(CFrame.new(r.pos.X, y, r.pos.Z) * CFrame.Angles(0, r.heading, 0) * wobble)
		end
	end

	for _, a in ipairs(Config.Arenas) do
		if (count[a] or 0) < a.max and rand:NextNumber() < step * 1.2 then spawnRobot(a) end
	end

	if saveT > 90 then
		saveT = 0
		for _, p in ipairs(Players:GetPlayers()) do task.spawn(save, p) end
	end
end)
