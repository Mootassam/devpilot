'use strict';
// Installs the built app (build\) on THIS PC without running the unsigned Setup.exe, for when
// Windows Smart App Control blocks it. Does exactly what installer.iss does:
//   %LOCALAPPDATA%\Programs\DevPilot\{electron,app}, Start menu + desktop shortcuts (icon + app id),
//   Windows "Apps > Uninstall" entry, install marker.
// Run with the trusted official runtime:  node_modules\electron\dist\electron.exe tools\install-local.js
const { app, shell } = require('electron');
process.noAsar = true; // copy Electron's .asar files as plain files
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const NAME = 'DevPilot';
const GUID = '{4F2C8B6E-9A13-4D7E-B5C1-7D3A91E5C204}_is1';
const AUMID = 'com.devpilot.app';
app.setPath('userData', path.join(app.getPath('temp'), `devpilot-install-${process.pid}`));

const root = path.join(__dirname, '..');
const build = path.join(root, 'build');
const dest = path.join(process.env.LOCALAPPDATA, 'Programs', NAME);
const reg = (args) => execFileSync(path.join(process.env.SystemRoot, 'System32', 'reg.exe'), args, { windowsHide: true, stdio: 'ignore' });

function stopInstalledCopies() {
  const ps = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const dir = dest.toLowerCase().replace(/'/g, "''");
  try { execFileSync(ps, ['-NoProfile', '-NonInteractive', '-Command', `Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ${process.pid} -and $_.Path -and $_.Path.ToLower().StartsWith('${dir}') } | Stop-Process -Force -ErrorAction SilentlyContinue`], { windowsHide: true, timeout: 20000 }); } catch (_) {}
}

app.whenReady().then(() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(build, 'app', 'package.json'), 'utf8'));
    if (!fs.existsSync(path.join(build, 'electron', 'electron.exe'))) throw new Error('Run build.ps1 first.');
    stopInstalledCopies();
    for (const d of ['app', 'electron']) fs.rmSync(path.join(dest, d), { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(path.join(build, 'electron'), path.join(dest, 'electron'), { recursive: true });
    fs.cpSync(path.join(build, 'app'), path.join(dest, 'app'), { recursive: true });

    const exe = path.join(dest, 'electron', 'electron.exe');
    const appDir = path.join(dest, 'app');
    const icon = path.join(appDir, 'assets', 'icon.ico');
    const link = { target: exe, args: `"${appDir}"`, cwd: dest, icon, iconIndex: 0, appUserModelId: AUMID, description: 'Run your projects with one click' };
    const mk = (file, opts) => shell.writeShortcutLink(file, fs.existsSync(file) ? 'replace' : 'create', opts);
    const programs = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    const ok1 = mk(path.join(programs, `${NAME}.lnk`), link);
    const ok2 = mk(path.join(app.getPath('desktop'), `${NAME}.lnk`), link);
    const { appUserModelId, ...plain } = link;
    const ok3 = mk(path.join(programs, `Uninstall ${NAME}.lnk`), { ...plain, args: `"${appDir}" --uninstall`, description: `Uninstall ${NAME}` });

    const key = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${GUID}`;
    const set = (name, value, type = 'REG_SZ') => reg(['add', key, '/v', name, '/t', type, '/d', String(value), '/f']);
    set('DisplayName', NAME);
    set('DisplayVersion', pkg.version);
    set('Publisher', NAME);
    set('DisplayIcon', icon);
    set('InstallLocation', dest);
    set('UninstallString', `"${exe}" "${appDir}" --uninstall`);
    set('QuietUninstallString', `"${exe}" "${appDir}" --uninstall --quiet`);
    set('NoModify', 1, 'REG_DWORD');
    set('NoRepair', 1, 'REG_DWORD');
    fs.writeFileSync(path.join(dest, 'devpilot-install.json'), JSON.stringify({ app: NAME, version: pkg.version, uninstallKey: GUID }));

    console.log(JSON.stringify({ installed: dest, version: pkg.version, shortcuts: [ok1, ok2, ok3] }));
    try { fs.rmSync(app.getPath('userData'), { recursive: true, force: true }); } catch (_) {}
    app.exit(0);
  } catch (e) {
    console.error('INSTALL FAILED:', e.message);
    app.exit(1);
  }
});
