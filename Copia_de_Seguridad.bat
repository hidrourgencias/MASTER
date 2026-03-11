@echo off
title Hidrourgencias - Copia de Seguridad
echo.
echo ============================================
echo   HIDROURGENCIAS SpA - Copia de Seguridad
echo ============================================
echo.
echo Conectando a la base de datos y creando respaldo...
echo Esto puede tardar unos minutos si hay muchas fotos.
echo.
cd /d "%~dp0server"
node backup.js
echo.
pause