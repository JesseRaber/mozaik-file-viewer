@echo off
setlocal
rem Started from a PowerShell 7 window, cmd would pass PowerShell 7's module path to
rem Windows PowerShell, which then cannot load its own cmdlets. Use its defaults.
set "PSModulePath="
title Mozaik File Viewer - close this window to stop the viewer
if not exist "%~dp0runtime\python.exe" (
  echo This folder is incomplete. Extract the whole ZIP first ^(right-click the ZIP, Extract All^).
  pause
  exit /b 1
)
cd /d "%~dp0"
"%~dp0runtime\python.exe" -B "%~dp0Launch-Viewer.py" %*
if errorlevel 1 (
  powershell.exe -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show('The viewer could not start. Open the Mozaik File Viewer window on the taskbar to read why.', 'Mozaik File Viewer')"
  echo.
  echo The viewer could not start. Read the message above, then press any key to close.
  pause >nul
  exit /b 1
)
endlocal
