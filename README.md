# DevPilot

Run, switch and clean your projects with buttons: no terminal needed. Windows desktop app (Electron), no internet, no account, no AI.

## What it does
- **Reads your project** (no AI): `package.json` scripts and dependencies, lock files (npm / yarn / pnpm / bun), `.env`, `vite.config`, the server's own code (`process.env.PORT || 8086`), Python and Docker Compose. Commented-out lines are ignored. Finds parts like `server`, `admin`, `platform`, `web`, `apps/*`.
- **Buttons per part:** Start (dev) · Start (production) · Build · Install · Stop · Restart · Logs · any script. **Start all** starts the server first, waits until it answers, then the rest. Profiles ("Backend only"…). Your own command buttons.
- **Ports:** checks the port before starting and names the program using it (*Stop it & start* / *Start anyway*). A Ports page lists every listening port, and Windows system programs are never offered a Stop button.
- **Live logs:** colors kept, errors in red, search, errors only, copy, clear. Crash detection with a Windows notification and optional auto-restart (max 3 times a minute). CPU / RAM / uptime per part.
- **Prod ↔ Local:** finds the lines that set your server address. Your style (un-comment your `// baseURL: "http://localhost…"` line and comment the prod one) or a replacement with `http://localhost:<server port><same path>`. Outside services (Binance, CryptoCompare…) are never pre-selected. Every file is backed up first. **Back to Prod** restores exactly, even if you edited the file meanwhile. While LOCAL is on, a Git pre-commit guard blocks commits (only if you don't have your own hook).
- **Unused images:** image files *inside the project* the code never mentions (nothing on a server or cloud). Groups: Not used · Maybe used (names built in code like `flag-${c}.png`, never auto-selected) · Icons kept (favicon, app icons). Also duplicates, images over 500 KB (Shrink for PNG/JPG, original kept in Trash), and missing images (broken references). Uploads folders are skipped. **Move to Trash** with optional build check (if the build fails, everything comes back by itself). Restore any time.
- VS Code / folder / browser buttons, Git status · pull · switch branch, tray icon, dark & light themes.

## Run from source
```
npm install
npm start
npm test          # core tests: scanner, Prod<->Local, images + Trash, process manager
```

## Install
`powershell -ExecutionPolicy Bypass -File build.ps1` builds `installer_output\DevPilot-Setup-<version>.exe`.
If Windows Smart App Control blocks a new setup file: `node_modules\electron\dist\electron.exe tools\install-local.js` installs the built app directly (same result: `%LOCALAPPDATA%\Programs\DevPilot`, shortcuts, Apps > Uninstall entry).

Data: `%APPDATA%\DevPilot` (settings, Prod↔Local backups, image Trash).
