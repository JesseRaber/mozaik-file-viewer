@echo off
if not exist "%~dp0setup\Uninstall.ps1" (
  echo This folder is incomplete. Extract the whole ZIP first, then run Uninstall again.
  pause
  exit /b 1
)
rem Uninstall may remove the folder this file is in. Leave it, and end this batch
rem file's context with (goto) before running anything, so cmd never reads it again.
cd /d "%TEMP%"
(goto) 2>nul & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup\Uninstall.ps1" %* & echo. & pause
