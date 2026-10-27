@echo off
rem Inicia Banva (API + web) y lo abre en el navegador.
cd /d "%~dp0"
title Banva

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org y volve a ejecutar este archivo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias, la primera vez tarda unos minutos...
  call npm install
  if errorlevel 1 (
    echo Fallo la instalacion de dependencias.
    pause
    exit /b 1
  )
)

echo Iniciando Banva. Se abrira el navegador en http://localhost:5173
echo Para detenerlo, cerra esta ventana o presiona Ctrl+C.

rem Abre el navegador cuando el servidor web ya esta escuchando.
start "" /b powershell -NoProfile -Command "for ($i=0; $i -lt 60; $i++) { try { Invoke-WebRequest -UseBasicParsing http://localhost:5173 -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Seconds 1 } }; Start-Process 'http://localhost:5173'"

call npm run dev
pause
