@echo off
setlocal
if not exist "%~dp0setup\Install.ps1" (
  echo This folder is incomplete. Extract the whole ZIP first ^(right-click the ZIP, Extract All^), then run Install again.
  pause
  exit /b 1
)
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup\Install.ps1" %*
set RC=%errorlevel%
echo.
pause
exit /b %RC%
