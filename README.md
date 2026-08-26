# christiansworld.app

Christian's games. A plain static site — no build step, no framework, nothing
to install. Every game is a self-contained folder.

```
index.html                       the arcade front page
CNAME                            christiansworld.app  (GitHub Pages)
vercel.json                      config if you host on Vercel instead
assets/                          screenshots used on the front page
games/
  zombie-gunsmith/index.html     one file, the whole game
```

## Adding a game

1. Drop the built HTML at `games/<name>/index.html`
2. Put a screenshot in `assets/`
3. Copy the `<article class="game">` block in `index.html` and edit it
4. Commit and push — the site updates itself

That's the whole process. It stays this simple on purpose: Christian should be
able to ship a game without asking anyone for help.

## Putting it on GitHub

One command, from this folder:

```bash
bash tools/publish.sh                                    # Git Bash / WSL / macOS
powershell -ExecutionPolicy Bypass -File tools\publish.ps1   # Windows
```

It creates the public repo, pushes, turns on Pages, sets the custom domain and
forces HTTPS. Then point DNS at GitHub using the records it prints.

Needs the GitHub CLI (`winget install GitHub.cli`) and `gh auth login` first.

## Connecting the domain

`.app` is on the HSTS preload list, so **it will not load over plain http** —
HTTPS is mandatory. Both options below give you a free certificate.

### GitHub Pages

1. Push this repo to GitHub
2. Settings → Pages → Source: deploy from branch `main`, folder `/ (root)`
3. Settings → Pages → Custom domain: `christiansworld.app`
4. Tick **Enforce HTTPS** once the certificate is issued (a few minutes)
5. At your domain registrar, point DNS at GitHub:

   | Type | Name | Value |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | `<your-github-username>.github.io` |

The `CNAME` file in this repo is what tells Pages the domain. Leave it there.

### Vercel

1. Import the repo at vercel.com — no build command, output directory `.`
2. Project → Settings → Domains → add `christiansworld.app`
3. Follow the DNS records Vercel shows you

If you go the Vercel route the `CNAME` file is harmless; ignore it.

## Checking it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 — the links are absolute (`/games/...`), so a
real server is needed rather than opening the file directly.

---

Built by Christian with Claude · Number One Son Software Development
