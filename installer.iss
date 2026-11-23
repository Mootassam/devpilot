; DevPilot installer. Build: powershell -ExecutionPolicy Bypass -File build.ps1
;
; Windows Smart App Control blocks unsigned programs it does not know. So after installing, only
; programs Windows trusts ever run: the official Electron runtime (byte-for-byte as released, never
; modified or renamed) and Windows' own cmd.exe / reg.exe / powershell.exe.
; The DevPilot icon comes from the shortcuts + the window (same AppUserModelID), so the taskbar shows it.

#ifndef MyAppVersion
  #define MyAppVersion "1.0.0"
#endif
#define MyAppName "DevPilot"
#define MyAppGuid "4F2C8B6E-9A13-4D7E-B5C1-7D3A91E5C204"
#define MyAUMID "com.devpilot.app"
#define MyComment "Run your projects with one click"

[Setup]
AppId={{{#MyAppGuid}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher=DevPilot
VersionInfoVersion={#MyAppVersion}
VersionInfoProductName={#MyAppName}
VersionInfoDescription={#MyAppName} installer
; per-user install: no administrator prompt
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\{#MyAppName}
DisableDirPage=auto
DisableProgramGroupPage=yes
OutputDir=installer_output
OutputBaseFilename=DevPilot-Setup-{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
LZMANumBlockThreads=4
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
MinVersion=10.0
SetupIconFile=assets\icon.ico
UninstallDisplayIcon={app}\app\assets\icon.ico
UninstallDisplayName={#MyAppName}
CloseApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; Flags: checkedonce

[InstallDelete]
; an update replaces the program files completely (settings + backups live in %APPDATA%\DevPilot and are kept)
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\electron"

[Files]
Source: "build\electron\*"; DestDir: "{app}\electron"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "build\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\electron\electron.exe"; Parameters: """{app}\app"""; WorkingDir: "{app}"; IconFilename: "{app}\app\assets\icon.ico"; Comment: "{#MyComment}"; AppUserModelID: "{#MyAUMID}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\electron\electron.exe"; Parameters: """{app}\app"""; WorkingDir: "{app}"; IconFilename: "{app}\app\assets\icon.ico"; Comment: "{#MyComment}"; AppUserModelID: "{#MyAUMID}"; Tasks: desktopicon
Name: "{autoprograms}\Uninstall {#MyAppName}"; Filename: "{app}\electron\electron.exe"; Parameters: """{app}\app"" --uninstall"; WorkingDir: "{app}"; IconFilename: "{app}\app\assets\icon.ico"; Comment: "Uninstall {#MyAppName}"

[Run]
; load the program once now, so Windows' first security scan happens under the progress bar
Filename: "{app}\electron\electron.exe"; Parameters: "--version"; WorkingDir: "{app}"; StatusMsg: "Preparing {#MyAppName}..."; Flags: runhidden waituntilterminated
Filename: "{app}\electron\electron.exe"; Parameters: """{app}\app"""; WorkingDir: "{app}"; Description: "Open {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
{ Stop this app (only copies started from this install folder) so its files can be replaced. }
procedure StopApp();
var
  Rc: Integer;
  Cmd, AppDir: String;
begin
  AppDir := Lowercase(ExpandConstant('{app}'));
  Cmd := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "foreach ($i in 1..2) { Get-Process electron -ErrorAction SilentlyContinue | ' +
         'Where-Object { $_.Path -and $_.Path.ToLower().StartsWith(''' + AppDir + ''') } | ' +
         'Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 700 }"';
  Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Cmd, '', SW_HIDE, ewWaitUntilTerminated, Rc);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopApp();
  Result := '';
end;

{ After installing: point Windows "Apps > Uninstall" at electron.exe --uninstall, and leave a marker
  the uninstaller checks before deleting anything. }
procedure CurStepChanged(CurStep: TSetupStep);
var
  Key, Exe, AppPath: String;
begin
  if CurStep = ssPostInstall then
  begin
    Key := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{' + '{#MyAppGuid}' + '}_is1';
    Exe := ExpandConstant('{app}\electron\electron.exe');
    AppPath := ExpandConstant('{app}\app');
    RegWriteStringValue(HKCU, Key, 'UninstallString', '"' + Exe + '" "' + AppPath + '" --uninstall');
    RegWriteStringValue(HKCU, Key, 'QuietUninstallString', '"' + Exe + '" "' + AppPath + '" --uninstall --quiet');
    RegWriteDWordValue(HKCU, Key, 'NoModify', 1);
    RegWriteDWordValue(HKCU, Key, 'NoRepair', 1);
    SaveStringToFile(ExpandConstant('{app}\devpilot-install.json'),
      '{"app":"{#MyAppName}","version":"{#MyAppVersion}","uninstallKey":"{' + '{#MyAppGuid}' + '}_is1"}', False);
  end;
end;
