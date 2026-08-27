@echo off
title STAS Engine Watchdog
chcp 65001 > nul
cls

echo ========================================================
echo   Перезапуск инфраструктуры СТАС...
echo ========================================================

taskkill /F /IM python.exe 2>nul
taskkill /F /IM ngrok.exe 2>nul

echo [%TIME%] 1/2 Запуск FastAPI бэкенда...
start "STAS PYTHON SERVER" cmd /k "cd /d C:\STAS && python main.py"

timeout /t 3 /nobreak > nul

echo [%TIME%] 2/2 Запуск Туннеля Ngrok...
start "STAS TUNNEL" cmd /k "cd /d C:\STAS && start_tunnel.bat"

echo ========================================================
echo   Система СТАС готова к работе!
echo ==============================================================================================