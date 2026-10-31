# Per-user install of one Mozaik File Viewer version. No administrator rights.
# Writes only: the install folder, the Start Menu shortcut and the desktop shortcut
# (all inside the user profile). No registry, no Program Files, no system setting.
param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Programs\MozaikFileViewer'),
  [string]$StartMenuDir = [Environment]::GetFolderPath('Programs'),
  [string]$DesktopDir = [Environment]::GetFolderPath('Desktop'),
  [switch]$NoDesktop
)
$ErrorActionPreference = 'Stop'
$ShortcutName = 'Mozaik File Viewer.lnk'

# Paths can arrive in long or short (8.3) form; compare the files themselves.
function Test-SameFile([string]$A, [string]$B) {
  if (-not (Test-Path -LiteralPath $A) -or -not (Test-Path -LiteralPath $B)) { return $false }
  $fso = New-Object -ComObject Scripting.FileSystemObject
  $short = { param($p) if (Test-Path -LiteralPath $p -PathType Container) { $fso.GetFolder($p).ShortPath } else { $fso.GetFile($p).ShortPath } }
  return ((& $short $A) -eq (& $short $B))
}

function Fail([string]$Message) {
  Write-Host ''
  Write-Host ('Install failed: ' + $Message) -ForegroundColor Red
  exit 1
}

function Test-Package([string]$Folder) {
  & (Join-Path $Folder 'runtime\python.exe') -B (Join-Path $Folder 'Launch-Viewer.py') --check | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Set-ViewerShortcut([string]$Dir, [string]$Target, [string]$Version) {
  New-Item -ItemType Directory -Force -Path $Dir | Out-Null
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut((Join-Path $Dir $ShortcutName))
  $link.TargetPath = Join-Path $Target 'Start-Viewer.cmd'
  $link.WorkingDirectory = $Target
  $link.WindowStyle = 7
  $link.IconLocation = (Join-Path $Target 'setup\viewer.ico') + ',0'
  $link.Description = 'Mozaik File Viewer ' + $Version + ' (read-only)'
  $link.Save()
  Write-Host ('  Shortcut: ' + (Join-Path $Dir $ShortcutName))
}

try {
  $source = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
  $versionFile = Join-Path $source 'site\version.json'
  if (-not (Test-Path -LiteralPath $versionFile)) { Fail 'site\version.json is missing. Extract the whole ZIP, then run Install again.' }
  $version = (Get-Content -LiteralPath $versionFile -Raw | ConvertFrom-Json).version
  if ($version -notmatch '^[0-9A-Za-z][0-9A-Za-z.+-]*$') { Fail ('Unexpected version: ' + $version) }
  Write-Host ('Mozaik File Viewer ' + $version + ' - install for this user only (no administrator rights needed)')

  # A downloaded ZIP marks every extracted file as from the internet; clear that mark.
  try { Get-ChildItem -LiteralPath $source -Recurse -File | Unblock-File } catch { Write-Host ('  Note: could not unblock files: ' + $_.Exception.Message) }

  if (-not (Test-Package $source)) { Fail 'The package files did not pass the checksum check. Download and extract the ZIP again.' }

  $dest = Join-Path $InstallRoot $version
  $installed = $false
  if (Test-Path -LiteralPath $dest) {
    if (Test-SameFile $dest $source) {
      $installed = $true
    } elseif ((Test-Path -LiteralPath (Join-Path $dest 'SHA256SUMS.txt')) -and
              ((Get-FileHash -LiteralPath (Join-Path $dest 'SHA256SUMS.txt')).Hash -eq (Get-FileHash -LiteralPath (Join-Path $source 'SHA256SUMS.txt')).Hash) -and
              (Test-Package $dest)) {
      $installed = $true
      Write-Host ('  Already installed and intact: ' + $dest)
    } else {
      $old = Join-Path $InstallRoot ('.removing-' + [guid]::NewGuid().ToString('N'))
      try { Rename-Item -LiteralPath $dest -NewName (Split-Path -Leaf $old) } catch { Fail ('Could not replace ' + $dest + '. Close the Mozaik File Viewer window, then run Install again.') }
      Remove-Item -LiteralPath $old -Recurse -Force
    }
  }
  if (-not $installed) {
    New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
    $staging = Join-Path $InstallRoot ('.installing-' + [guid]::NewGuid().ToString('N'))
    Copy-Item -LiteralPath $source -Destination $staging -Recurse
    if (-not (Test-Package $staging)) { Remove-Item -LiteralPath $staging -Recurse -Force; Fail 'The copied files did not pass the checksum check.' }
    Rename-Item -LiteralPath $staging -NewName $version
    Write-Host ('  Installed to: ' + $dest)
  }

  Set-ViewerShortcut $StartMenuDir $dest $version
  if (-not $NoDesktop) { Set-ViewerShortcut $DesktopDir $dest $version }

  $others = @(Get-ChildItem -LiteralPath $InstallRoot -Directory | Where-Object { $_.Name -ne $version -and -not $_.Name.StartsWith('.') } | ForEach-Object { $_.Name })
  if ($others.Count -gt 0) { Write-Host ('  Other installed versions (kept for rollback): ' + ($others -join ', ')) }
  Write-Host ''
  Write-Host 'Done. Start it from Start Menu > Mozaik File Viewer (or the desktop shortcut).'
  exit 0
} catch {
  Fail $_.Exception.Message
}
