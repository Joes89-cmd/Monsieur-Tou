@echo off
title Hollowmere
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
) else if exist "C:\.LittleVillage\.tools\node\node.exe" (
  "C:\.LittleVillage\.tools\node\node.exe" server.js
) else (
  echo Node.js was not found. Install it from https://nodejs.org and run this file again.
)
pause
