@echo off
rem Double-click: opens the seasons stand through a tiny local server (Node.js comes with SillyTavern).
rem Another stand: stand.cmd tree-stand.html
cd /d "%~dp0"
if "%~1"=="" (node serve.mjs seasons-stand.html) else (node serve.mjs %1)
pause
