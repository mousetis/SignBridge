@echo off
chcp 65001 >nul
title SignBridge
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Chua cai Node.js. Hay tai ban LTS tai https://nodejs.org roi chay lai tep nay.
  echo.
  start https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo  Lan dau chay: dang cai thu vien ^(can Internet, mat khoang 1-3 phut^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo  Cai thu vien that bai. Kiem tra ket noi mang roi chay lai.
    pause
    exit /b 1
  )
)

if not exist public\mediapipe\hands\hands.js call npm run setup:assets

echo.
echo  Dang mo SignBridge tai http://localhost:5173  ^(dong cua so nay de tat ung dung^)
echo.
call npm run dev
pause
