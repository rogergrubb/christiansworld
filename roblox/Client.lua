-- Christian's World: Evolve (what each player sees). A level bar, an Evolve button, the evolve screen and short messages.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage:WaitForChild("Config"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local player = Players.LocalPlayer

local rgb = Color3.fromRGB
local YELLOW, INK, NAVY = rgb(255, 210, 31), rgb(29, 35, 43), rgb(20, 22, 48)

local gui = Instance.new("ScreenGui")
gui.Name = "EvolveGui"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = false

local function make(class, parent, props)
	local o = Instance.new(class)
	for k, v in pairs(props) do o[k] = v end
	o.Parent = parent
	return o
end
local function round(o, px) make("UICorner", o, { CornerRadius = UDim.new(0, px) }) end
local function text(parent, props)
	local base = { BackgroundTransparency = 1, Font = Enum.Font.GothamBold, TextColor3 = rgb(255, 255, 255), TextScaled = true, Text = "" }
	for k, v in pairs(props) do base[k] = v end
	return make("TextLabel", parent, base)
end
local function bar(parent, pos, size, color)
	local back = make("Frame", parent, { Position = pos, Size = size, BackgroundColor3 = rgb(50, 54, 80), BorderSizePixel = 0 })
	round(back, 8)
	local fill = make("Frame", back, { Size = UDim2.new(0, 0, 1, 0), BackgroundColor3 = color, BorderSizePixel = 0 })
	round(fill, 8)
	local lbl = text(back, { Size = UDim2.new(1, -12, 0.8, 0), Position = UDim2.new(0, 6, 0.1, 0) })
	return fill, lbl
end

-- top of the screen: level and points
local hud = make("Frame", gui, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 8), Size = UDim2.new(0, 340, 0, 30), BackgroundTransparency = 1 })
local xpFill, xpText = bar(hud, UDim2.new(0, 0, 0, 0), UDim2.new(1, 0, 1, 0), rgb(124, 92, 255))

local openBtn = make("TextButton", gui, { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -12, 0.5, 0), Size = UDim2.new(0, 120, 0, 48), BackgroundColor3 = YELLOW, TextColor3 = INK, Font = Enum.Font.GothamBlack, TextScaled = true, Text = "EVOLVE" })
round(openBtn, 12)

local toast = text(gui, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 48), Size = UDim2.new(0, 520, 0, 36), BackgroundTransparency = 0.15, BackgroundColor3 = YELLOW, TextColor3 = INK, Visible = false })
round(toast, 10)

-- the evolve screen
local panel = make("Frame", gui, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0), Size = UDim2.new(0, 560, 0, 380), BackgroundColor3 = NAVY, BorderSizePixel = 0, Visible = false })
round(panel, 16)
make("UIStroke", panel, { Color = YELLOW, Thickness = 3 })
make("UISizeConstraint", panel, { MaxSize = Vector2.new(560, 380) })
local scale = make("UIScale", panel, { Scale = 1 })
text(panel, { Position = UDim2.new(0, 0, 0, 8), Size = UDim2.new(1, 0, 0, 34), Text = "EVOLVE", TextColor3 = YELLOW, Font = Enum.Font.GothamBlack })

local function card(x, tag)
	local c = make("Frame", panel, { Position = UDim2.new(x, 0, 0, 50), Size = UDim2.new(0.42, 0, 0, 150), BackgroundColor3 = rgb(40, 48, 100), BorderSizePixel = 0 })
	round(c, 12)
	text(c, { Position = UDim2.new(0, 0, 0, 6), Size = UDim2.new(1, 0, 0, 16), Text = tag, TextColor3 = rgb(207, 214, 255) })
	local swatch = make("Frame", c, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 28), Size = UDim2.new(0, 44, 0, 44), BorderSizePixel = 0 })
	round(swatch, 22)
	local name = text(c, { Position = UDim2.new(0, 0, 0, 76), Size = UDim2.new(1, 0, 0, 28), Font = Enum.Font.GothamBlack })
	local coin = text(c, { Position = UDim2.new(0, 0, 0, 106), Size = UDim2.new(1, 0, 0, 18), TextColor3 = rgb(157, 255, 138) })
	local pow = text(c, { Position = UDim2.new(0, 0, 0, 126), Size = UDim2.new(1, 0, 0, 18), TextColor3 = rgb(255, 179, 107) })
	return { swatch = swatch, name = name, coin = coin, pow = pow }
end
local nowCard, nextCard = card(0.04, "NOW"), card(0.54, "NEXT")
text(panel, { Position = UDim2.new(0.46, 0, 0, 100), Size = UDim2.new(0.08, 0, 0, 40), Text = ">" })

local lvFill, lvText = bar(panel, UDim2.new(0.04, 0, 0, 212), UDim2.new(0.44, 0, 0, 28), rgb(79, 168, 255))
local winFill, winText = bar(panel, UDim2.new(0.52, 0, 0, 212), UDim2.new(0.44, 0, 0, 28), rgb(240, 165, 31))

local goBtn = make("TextButton", panel, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.4, 0, 0, 252), Size = UDim2.new(0, 260, 0, 44), BackgroundColor3 = YELLOW, TextColor3 = INK, Font = Enum.Font.GothamBlack, TextScaled = true, Text = "" })
round(goBtn, 12)
local closeBtn = make("TextButton", panel, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.8, 0, 0, 252), Size = UDim2.new(0, 110, 0, 44), BackgroundColor3 = rgb(253, 253, 248), TextColor3 = INK, Font = Enum.Font.GothamBold, TextScaled = true, Text = "Close" })
round(closeBtn, 12)

local wearRow = make("ScrollingFrame", panel, { Position = UDim2.new(0.04, 0, 0, 308), Size = UDim2.new(0.92, 0, 0, 40), BackgroundTransparency = 1, BorderSizePixel = 0, ScrollBarThickness = 4, CanvasSize = UDim2.new(0, 0, 0, 0), AutomaticCanvasSize = Enum.AutomaticSize.X, ScrollingDirection = Enum.ScrollingDirection.X })
make("UIListLayout", wearRow, { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder })
text(panel, { Position = UDim2.new(0, 0, 0, 352), Size = UDim2.new(1, 0, 0, 16), Text = "Wear any form you have unlocked. Your multiplier stays.", TextColor3 = rgb(207, 214, 255) })

local function fill(frame, have, need)
	frame.Size = UDim2.new(math.clamp(need > 0 and have / need or 1, 0, 1), 0, 1, 0)
end

local function paintCard(c, f)
	if not f then
		c.swatch.BackgroundColor3 = rgb(80, 80, 90)
		c.name.Text = "Top form"
		c.coin.Text = ""
		c.pow.Text = ""
		return
	end
	c.swatch.BackgroundColor3 = f.color
	c.name.Text = f.name
	c.coin.Text = "Robot coins x" .. f.coin
	c.pow.Text = "Power x" .. f.dmg
end

local function refresh()
	local xp = player:GetAttribute("XP") or 0
	local wins = player:GetAttribute("Wins") or 0
	local tier = player:GetAttribute("Tier") or 0
	local wear = player:GetAttribute("Wear") or 0
	local level = Config.levelOf(xp)
	local into, span = xp - Config.xpFor(level), Config.xpFor(level + 1) - Config.xpFor(level)
	local cur, nxt = Config.Forms[tier + 1], Config.Forms[tier + 2]
	fill(xpFill, into, span)
	xpText.Text = "Level " .. level .. "   " .. cur.name .. "   " .. into .. " / " .. span
	paintCard(nowCard, cur)
	paintCard(nextCard, nxt)
	local ready = false
	if nxt then
		fill(lvFill, level, nxt.level)
		fill(winFill, wins, nxt.wins)
		lvText.Text = "Level " .. math.min(level, nxt.level) .. " / " .. nxt.level
		winText.Text = "Robots " .. math.min(wins, nxt.wins) .. " / " .. nxt.wins
		ready = level >= nxt.level and wins >= nxt.wins
		goBtn.Visible = true
		goBtn.Text = ready and ("Evolve into " .. nxt.name .. "!") or (level < nxt.level and ("Need level " .. nxt.level) or ("Need " .. nxt.wins .. " robots"))
	else
		fill(lvFill, 1, 1)
		fill(winFill, 1, 1)
		lvText.Text = "Level " .. level
		winText.Text = "Robots " .. wins
		goBtn.Visible = false
	end
	goBtn.BackgroundColor3 = ready and YELLOW or rgb(120, 120, 130)
	openBtn.BackgroundColor3 = ready and rgb(120, 255, 120) or YELLOW
	openBtn.Text = ready and "EVOLVE!" or "EVOLVE"
	for _, c in ipairs(wearRow:GetChildren()) do if c:IsA("TextButton") then c:Destroy() end end
	for i = 0, tier do
		local b = make("TextButton", wearRow, { LayoutOrder = i, Size = UDim2.new(0, 84, 0, 30), BackgroundColor3 = i == wear and YELLOW or rgb(60, 66, 110), TextColor3 = i == wear and INK or rgb(255, 255, 255), Font = Enum.Font.GothamBold, TextScaled = true, Text = Config.Forms[i + 1].name })
		round(b, 15)
		b.MouseButton1Click:Connect(function() Remotes.Wear:FireServer(i) end)
	end
end

local function fit()
	local cam = workspace.CurrentCamera
	if cam then scale.Scale = math.clamp(math.min(cam.ViewportSize.X / 600, cam.ViewportSize.Y / 420), 0.5, 1.4) end
end

openBtn.MouseButton1Click:Connect(function() panel.Visible = not panel.Visible; fit(); refresh() end)
closeBtn.MouseButton1Click:Connect(function() panel.Visible = false end)
goBtn.MouseButton1Click:Connect(function() Remotes.Evolve:FireServer() end)
Remotes.OpenEvolve.OnClientEvent:Connect(function() panel.Visible = true; fit(); refresh() end)

local toastId = 0
Remotes.Notify.OnClientEvent:Connect(function(message)
	toastId = toastId + 1
	local mine = toastId
	toast.Text = tostring(message)
	toast.Visible = true
	task.delay(3.5, function() if toastId == mine then toast.Visible = false end end)
end)

for _, name in ipairs({ "XP", "Wins", "Tier", "Wear", "Coins" }) do player:GetAttributeChangedSignal(name):Connect(refresh) end
-- Octoclank's whip and belly flop: the server says which way, and this throws the player
Remotes:WaitForChild("Yank").OnClientEvent:Connect(function(push)
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if root and typeof(push) == "Vector3" then root.AssemblyLinearVelocity = push end
end)

gui.Parent = player:WaitForChild("PlayerGui")
refresh()
