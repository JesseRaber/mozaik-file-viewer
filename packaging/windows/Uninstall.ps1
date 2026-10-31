# Removes this package's version from the per-user install folder and the shortcuts
# that point at it. Never touches browser data, preferences or job files.
param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Programs\MozaikFileViewer'),
  [string]$StartMenuDir = [Environment]::GetFolderPath('Programs'),
  [string]$DesktopDir = [Environment]::GetFolderPath('Desktop')
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
  Write-Host ('Uninstall failed: ' + $Message) -ForegroundColor Red
  exit 1
}

try {
  $version = (Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\site\version.json') -Raw | ConvertFrom-Json).version
  if ($version -notmatch '^[0-9A-Za-z][0-9A-Za-z.+-]*$') { Fail ('Unexpected version: ' + $version) }
  $dest = Join-Path $InstallRoot $version
  Write-Host ('Mozaik File Viewer ' + $version + ' - uninstall for this user')

  # Newest other installed version, if any, takes over the shortcuts.
  $next = $null
  if (Test-Path -LiteralPath $InstallRoot) {
    $next = Get-ChildItem -LiteralPath $InstallRoot -Directory |
      Where-Object { $_.Name -ne $version -and -not $_.Name.StartsWith('.') -and (Test-Path -LiteralPath (Join-Path $_.FullName 'Start-Viewer.cmd')) } |
      Sort-Object CreationTime -Descending | Select-Object -First 1
  }
  # Find our shortcuts while the folder still exists (paths may be long or 8.3 form).
  $shell = New-Object -ComObject WScript.Shell
  $ours = @()
  foreach ($dir in @($StartMenuDir, $DesktopDir)) {
    $path = Join-Path $dir $ShortcutName
    if (-not (Test-Path -LiteralPath $path)) { continue }
    $target = $shell.CreateShortcut($path).TargetPath
    if ($target.StartsWith($dest + '\', [System.StringComparison]::OrdinalIgnoreCase) -or (Test-SameFile $target (Join-Path $dest 'Start-Viewer.cmd'))) { $ours += $path }
  }

  # Move the folder aside first. If the viewer is running this fails, and nothing has changed yet.
  $old = $null
  if (Test-Path -LiteralPath $dest) {
    $old = Join-Path $InstallRoot ('.removing-' + [guid]::NewGuid().ToString('N'))
    try { Rename-Item -LiteralPath $dest -NewName (Split-Path -Leaf $old) } catch { Fail ('Could not remove ' + $dest + ' because it is in use. Close the Mozaik File Viewer window, then run Uninstall again. Nothing was changed.') }
  } else {
    Write-Host ('  Version ' + $version + ' was not installed in ' + $InstallRoot)
  }

  foreach ($path in $ours) {
    if ($next) {
      $link = $shell.CreateShortcut($path)
      $link.TargetPath = Join-Path $next.FullName 'Start-Viewer.cmd'
      $link.WorkingDirectory = $next.FullName
      $link.IconLocation = (Join-Path $next.FullName 'setup\viewer.ico') + ',0'
      $link.Description = 'Mozaik File Viewer ' + $next.Name + ' (read-only)'
      $link.Save()
      Write-Host ('  Shortcut now opens ' + $next.Name + ': ' + $path)
    } else {
      Remove-Item -LiteralPath $path -Force
      Write-Host ('  Removed shortcut: ' + $path)
    }
  }

  if ($old) {
    Remove-Item -LiteralPath $old -Recurse -Force
    Write-Host ('  Removed: ' + $dest)
  }
  if ((Test-Path -LiteralPath $InstallRoot) -and -not (Get-ChildItem -LiteralPath $InstallRoot -Force | Select-Object -First 1)) {
    Remove-Item -LiteralPath $InstallRoot -Force
  }
  Write-Host ''
  Write-Host 'Done. Browser preferences and job files were not touched.'
  exit 0
} catch {
  Fail $_.Exception.Message
}
