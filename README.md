# PrismOS

A glass desktop for developers. The same code runs three ways.

## 1. In a browser

Open `index.html` through any local web server, for example:

```bash
python -m http.server 8765
```

Then visit `http://localhost:8765`. Files live in the browser's storage. Git is PrismOS's own small engine
(real commands, but not real `.git` folders), and Vibe (the AI) only works on the claude.ai page.

## 2. As a desktop app (Electron)

```bash
cd desktop
npm install
npm start
```

`npm run windowed` starts it in a normal window instead of full screen. F11 toggles full screen and the power
button in the top-right corner quits.

What changes in the desktop app:

- Your files are real files in `~/PrismOS` (set `PRISM_HOME` to use another folder).
- The Terminal sends anything it does not know to your real shell: `git`, `node`, `npm`, `python` and so on.
- Git in Studio uses the git installed on your computer, so `git push` and `git clone` work with your own login.
- Browser, YouTube, Spotify and GitHub open as real web windows with tabs. Add more with the star in the address bar
  or "Add a website as an app" in the palette.
- The Browser has a start page, address suggestions from your history and open tabs, find in page (Ctrl+F),
  zoom per site (Ctrl+ / Ctrl- / Ctrl+0), a right-click menu, downloads (progress shows in the Island, files go
  to your Downloads folder), camera/location/notification prompts, full-screen video, and the usual tab keys
  (Ctrl+T, Ctrl+W, Ctrl+Shift+T, Ctrl+Tab, Ctrl+1..9, Ctrl+L, Alt+Left/Right). Tabs come back after a restart.
- Known limit: Spotify's site opens, but it cannot play music. Standard Electron has no Widevine DRM module, and Spotify requires it.
- The Terminal runs one command at a time and cannot answer questions a command asks (no interactive prompts).

## 3. Booting straight into it (Linux)

`linux/install-kiosk.sh` turns a fresh Debian or Ubuntu install into a machine that starts in PrismOS.
It is untested: try it in a virtual machine first.

## Files

| File | What it holds |
|---|---|
| `os.js`, `os.css` | Core: windows, dock, Island, palette, file system, settings |
| `apps.js` | Terminal, Studio, Vibe, Files, Notes, Toolbox, Focus, Settings |
| `git.js` | Version control engine, `git` command, Studio's Git panel |
| `problems.js`, `arena.js` | Arena: the problem set and the adaptive practice app |
| `extras.js` | Dock apps, file history, workspaces, desktops, clipboard, snippets, widgets, lock screen, Vibe tools |
| `native.js` | Desktop-only bridge to real files, shell and git |
| `browser.js` | Desktop-only Browser and website apps (tabs, start page, downloads, permissions) |
| `desktop/` | Electron shell (`main.js`, `preload.js`) |
| `prismos.html` | The page fragment published to claude.ai |
