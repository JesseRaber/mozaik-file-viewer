# Scripted install / launch / upgrade / rollback / uninstall / reinstall test for a built
# Windows package. Uses only a temporary folder; never the real Start Menu, desktop or
# %LOCALAPPDATA%\Programs. Usage: powershell -File test_install.ps1 -Package <extracted package folder>
param([Parameter(Mandatory = $true)][string]$Package)
$ErrorActionPreference = 'Stop'
$script:failures = 0
function Check([bool]$Condition, [string]$Name) {
  if ($Condition) { Write-Host ('PASS  ' + $Name) } else { Write-Host ('FAIL  ' + $Name) -ForegroundColor Red; $script:failures++ }
}
function Free-Port { $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0); $l.Start(); $p = $l.LocalEndpoint.Port; $l.Stop(); return $p }
function Get-Link([string]$Path) { return (New-Object -ComObject WScript.Shell).CreateShortcut($Path) }
function Stop-Tree([int]$ProcessId) {
  Get-CimInstance Win32_Process -Filter ('ParentProcessId=' + $ProcessId) | ForEach-Object { Stop-Tree $_.ProcessId }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}
function Wait-Viewer([int]$Port) {
  for ($i = 0; $i -lt 40; $i++) {
    try { return (Invoke-RestMethod -UseBasicParsing ('http://127.0.0.1:' + $Port + '/version.json') -TimeoutSec 2) } catch { Start-Sleep -Milliseconds 250 }
  }
  return $null
}
function Has-Motw([string]$Folder) { return [bool](Get-ChildItem -LiteralPath $Folder -Recurse -File | Where-Object { Get-Item -LiteralPath $_.FullName -Stream Zone.Identifier -ErrorAction SilentlyContinue } | Select-Object -First 1) }
function Rehash([string]$Folder) {
  $lines = Get-ChildItem -LiteralPath $Folder -Recurse -File | Where-Object { $_.Name -ne 'SHA256SUMS.txt' -or $_.DirectoryName -ne $Folder } |
    ForEach-Object { $_.FullName.Substring($Folder.Length + 1).Replace('\', '/') } | Sort-Object -CaseSensitive |
    ForEach-Object { (Get-FileHash -LiteralPath (Join-Path $Folder $_)).Hash.ToLower() + '  ' + $_ }
  [IO.File]::WriteAllText((Join-Path $Folder 'SHA256SUMS.txt'), (($lines -join "`n") + "`n"))
}

function Invoke-Cmd([string]$Script) {
  # Run a package .cmd the way a double-click does, with its pause answered by NUL.
  $wrapper = Join-Path $T ('run-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.cmd')
  [IO.File]::WriteAllText($wrapper, '@call "' + $Script + '" -InstallRoot "' + $root + '" -StartMenuDir "' + $start + '" -DesktopDir "' + $desk + '" < nul' + "`r`n")
  $ErrorActionPreference = 'Continue'
  $result = & cmd.exe /c $wrapper 2>&1 | ForEach-Object { $_.ToString() }
  $result | Out-Host
  return $result
}
$Package = (Resolve-Path -LiteralPath $Package).Path
$version = (Get-Content -LiteralPath (Join-Path $Package 'site\version.json') -Raw | ConvertFrom-Json).version
$T = Join-Path ([IO.Path]::GetTempPath()) ('mfv-install-test-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$root = Join-Path $T 'LocalAppData\Programs\MozaikFileViewer'; $start = Join-Path $T 'StartMenu'; $desk = Join-Path $T 'Desktop'
$args_ = @('-InstallRoot', $root, '-StartMenuDir', $start, '-DesktopDir', $desk)
$realLinks = @((Join-Path ([Environment]::GetFolderPath('Programs')) 'Mozaik File Viewer.lnk'), (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Mozaik File Viewer.lnk'), (Join-Path $env:LOCALAPPDATA 'Programs\MozaikFileViewer'))
$realBefore = $realLinks | ForEach-Object { Test-Path -LiteralPath $_ }
Write-Host ('Package ' + $version + '; temp root ' + $T)

# Extracted copy carrying mark-of-the-web, as Explorer leaves it after extracting a downloaded ZIP.
$extract = Join-Path $T 'extract\pkg'
Copy-Item -LiteralPath $Package -Destination $extract -Recurse
Get-ChildItem -LiteralPath $extract -Recurse -File | ForEach-Object { Set-Content -LiteralPath $_.FullName -Stream Zone.Identifier -Value "[ZoneTransfer]`r`nZoneId=3" }
Check (Has-Motw $extract) 'extracted copy carries mark-of-the-web'

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $extract 'setup\Install.ps1') @args_ | Out-Host
Check ($LASTEXITCODE -eq 0) 'install exits 0'
$dest = Join-Path $root $version
Check (Test-Path -LiteralPath (Join-Path $dest 'runtime\python.exe')) 'installed to <root>\<version>'
Check (-not (Has-Motw $dest)) 'installed files carry no mark-of-the-web'
Check (-not (Has-Motw $extract)) 'extracted files unblocked'
foreach ($dir in @($start, $desk)) {
  $link = Get-Link (Join-Path $dir 'Mozaik File Viewer.lnk')
  Check ($link.TargetPath -eq (Join-Path $dest 'Start-Viewer.cmd') -and $link.WindowStyle -eq 7 -and $link.IconLocation -like ((Join-Path $dest 'setup\viewer.ico') + '*') -and $link.WorkingDirectory -eq $dest) ('shortcut ok: ' + $dir)
}

# Launch through Start-Viewer.cmd, like the shortcut.
$port = Free-Port
$proc = Start-Process cmd.exe -ArgumentList ('/c ""' + (Join-Path $dest 'Start-Viewer.cmd') + '" --no-browser --port ' + $port + '"') -PassThru -WindowStyle Hidden
$identity = Wait-Viewer $port
Check ($null -ne $identity -and $identity.version -eq $version) ('launch serves version.json ' + $version)
Check ((Invoke-WebRequest -UseBasicParsing ('http://127.0.0.1:' + $port + '/')).StatusCode -eq 200) 'launch serves index'
$ErrorActionPreference = 'Continue'
$second = & (Join-Path $dest 'runtime\python.exe') -B (Join-Path $dest 'Launch-Viewer.py') --no-browser --port $port 2>&1
Check ($LASTEXITCODE -eq 0 -and ($second -join ' ') -match 'already running') 'second start detects the running viewer'
$ErrorActionPreference = 'Stop'
Check (-not (Test-Path -LiteralPath (Join-Path $dest '__pycache__')) -and -not (Test-Path -LiteralPath (Join-Path $dest 'runtime\__pycache__'))) 'no bytecode written into the install'

# Reinstall over a running, damaged install must refuse and leave it in place.
Add-Content -LiteralPath (Join-Path $dest 'README.md') 'tamper'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $extract 'setup\Install.ps1') @args_ | Out-Host
Check ($LASTEXITCODE -eq 1 -and (Test-Path -LiteralPath (Join-Path $dest 'runtime\python.exe'))) 'reinstall while running refuses; install left in place'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $extract 'setup\Uninstall.ps1') @args_ | Out-Host
Check ($LASTEXITCODE -eq 1 -and (Test-Path -LiteralPath (Join-Path $dest 'runtime\python.exe')) -and (Test-Path -LiteralPath (Join-Path $start 'Mozaik File Viewer.lnk')) -and (Test-Path -LiteralPath (Join-Path $desk 'Mozaik File Viewer.lnk'))) 'uninstall while running refuses and changes nothing (folder and shortcuts kept)'
Stop-Tree $proc.Id; Start-Sleep -Milliseconds 500
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $extract 'setup\Install.ps1') @args_ | Out-Host
& (Join-Path $dest 'runtime\python.exe') -B (Join-Path $dest 'Launch-Viewer.py') --check | Out-Null
Check ($LASTEXITCODE -eq 0) 'reinstall after closing repairs the damaged install'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $extract 'setup\Install.ps1') @args_ | Out-Host
Check ($LASTEXITCODE -eq 0) 'reinstall of an intact install exits 0'
Check (@(Get-ChildItem -LiteralPath $root -Force | Where-Object { $_.Name.StartsWith('.') }).Count -eq 0) 'no staging folders left behind'

# Side-by-side and rollback with a synthetic older version.
$old = Join-Path $T 'extract\old'
Copy-Item -LiteralPath $Package -Destination $old -Recurse
[IO.File]::WriteAllText((Join-Path $old 'site\version.json'), '{"version": "0.3.9-test", "revision": "test", "dirty": false}' + "`n")
Rehash $old
Start-Sleep -Seconds 1
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $old 'setup\Install.ps1') @args_ | Out-Host
$oldDest = Join-Path $root '0.3.9-test'
Check ((Test-Path -LiteralPath $dest) -and (Test-Path -LiteralPath $oldDest)) 'versions install side by side'
Check ((Get-Link (Join-Path $start 'Mozaik File Viewer.lnk')).TargetPath -eq (Join-Path $oldDest 'Start-Viewer.cmd')) 'older Install rolls the shortcut back'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $extract 'setup\Install.ps1') @args_ | Out-Host
Check ((Get-Link (Join-Path $start 'Mozaik File Viewer.lnk')).TargetPath -eq (Join-Path $dest 'Start-Viewer.cmd')) 'newer Install moves the shortcut forward'

# Uninstall the current version from its installed folder: shortcuts fall back to the older one.
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest 'setup\Uninstall.ps1') @args_ | Out-Host
Check ($LASTEXITCODE -eq 0 -and -not (Test-Path -LiteralPath $dest)) 'uninstall removes its version folder (run from inside it)'
Check ((Get-Link (Join-Path $desk 'Mozaik File Viewer.lnk')).TargetPath -eq (Join-Path $oldDest 'Start-Viewer.cmd')) 'shortcuts fall back to remaining version'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $old 'setup\Uninstall.ps1') @args_ | Out-Host
Check (-not (Test-Path -LiteralPath (Join-Path $start 'Mozaik File Viewer.lnk')) -and -not (Test-Path -LiteralPath (Join-Path $desk 'Mozaik File Viewer.lnk'))) 'last uninstall removes shortcuts'
Check (-not (Test-Path -LiteralPath $root)) 'last uninstall removes the empty install root'

# Reinstall, then uninstall through Uninstall.cmd inside the installed folder.
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $extract 'setup\Install.ps1') @args_ | Out-Host
Check ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $dest)) 'reinstall after uninstall'
$out = Invoke-Cmd (Join-Path $dest 'Uninstall.cmd')
Check (-not (Test-Path -LiteralPath $dest) -and -not (Test-Path -LiteralPath (Join-Path $start 'Mozaik File Viewer.lnk'))) 'Uninstall.cmd removes the folder it runs from and its shortcuts'
Check (-not (($out -join ' ') -match 'cannot find')) 'Uninstall.cmd exits without cmd errors'

# Install.cmd end to end from the MOTW copy.
$out = Invoke-Cmd (Join-Path $extract 'Install.cmd')
Check ((Test-Path -LiteralPath (Join-Path $dest 'Start-Viewer.cmd')) -and (Test-Path -LiteralPath (Join-Path $start 'Mozaik File Viewer.lnk'))) 'Install.cmd installs'
# Uninstall using the short (8.3) form of the same install root.
$shortRoot = (New-Object -ComObject Scripting.FileSystemObject).GetFolder($root).ShortPath
Write-Host ('Short install root: ' + $shortRoot)
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest 'setup\Uninstall.ps1') -InstallRoot $shortRoot -StartMenuDir $start -DesktopDir $desk | Out-Host
Check (-not (Test-Path -LiteralPath $dest) -and -not (Test-Path -LiteralPath (Join-Path $start 'Mozaik File Viewer.lnk')) -and -not (Test-Path -LiteralPath (Join-Path $desk 'Mozaik File Viewer.lnk'))) 'uninstall with a short-path root still finds its shortcuts'

$realAfter = $realLinks | ForEach-Object { Test-Path -LiteralPath $_ }
Check ((Compare-Object $realBefore $realAfter) -eq $null) 'real Start Menu, desktop and LOCALAPPDATA\Programs untouched'
Remove-Item -LiteralPath $T -Recurse -Force
Write-Host ''
if ($script:failures -eq 0) { Write-Host 'ALL INSTALL CHECKS PASSED'; exit 0 } else { Write-Host ($script:failures.ToString() + ' CHECK(S) FAILED') -ForegroundColor Red; exit 1 }
