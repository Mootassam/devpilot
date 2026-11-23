# Builds the Windows installer: installer_output\DevPilot-Setup-<version>.exe
# Run: powershell -ExecutionPolicy Bypass -File build.ps1   (needs: npm install done, Inno Setup 6)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root
$pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$ver = $pkg.version
$build = Join-Path $root 'build'
Write-Host "Building DevPilot $ver"

if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory $build | Out-Null

# 1. Electron runtime: the official files exactly as npm downloaded them (never changed, so Windows trusts electron.exe)
$dist = Join-Path $root 'node_modules\electron\dist'
if (-not (Test-Path (Join-Path $dist 'electron.exe'))) { throw 'Run npm install first (node_modules\electron\dist is missing).' }
Copy-Item $dist (Join-Path $build 'electron') -Recurse
if ((Get-FileHash (Join-Path $dist 'electron.exe')).Hash -ne (Get-FileHash (Join-Path $build 'electron\electron.exe')).Hash) { throw 'electron.exe changed while copying' }

# 2. The app: our JavaScript only (no libraries)
$dest = Join-Path $build 'app'
New-Item -ItemType Directory $dest | Out-Null
foreach ($f in 'main.js', 'preload.js', 'uninstall.js') { Copy-Item (Join-Path $root $f) $dest }
foreach ($d in 'ui', 'assets', 'lib') { Copy-Item (Join-Path $root $d) (Join-Path $dest $d) -Recurse }
# package.json without dev tools; productName keeps the data folder %APPDATA%\DevPilot (your logins stay)
$p = [ordered]@{ name = $pkg.name; productName = $pkg.productName; version = $ver; description = $pkg.description; main = 'main.js'; private = $true; dependencies = $pkg.dependencies }
($p | ConvertTo-Json -Depth 5) | Set-Content (Join-Path $dest 'package.json') -Encoding ascii
# no runtime libraries to copy: DevPilot uses only Node's built-in modules

# 3. Installer
$iscc = Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'
if (-not (Test-Path $iscc)) { $iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" }
if (-not (Test-Path $iscc)) { throw 'Inno Setup 6 is not installed.' }
& $iscc /Q "/DMyAppVersion=$ver" (Join-Path $root 'installer.iss')
if ($LASTEXITCODE -ne 0) { throw 'ISCC failed' }

Get-ChildItem (Join-Path $root 'installer_output') -Filter "DevPilot-Setup-$ver.exe" | ForEach-Object {
  '{0}  {1:N1} MB  sha256 {2}' -f $_.Name, ($_.Length / 1MB), (Get-FileHash $_.FullName).Hash
}
