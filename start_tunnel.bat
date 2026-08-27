@echo off
title STAS API Tunnel (Ngrok)
chcp 65001 > nul
cls

echo ========================================================
echo   Запуск прокси-туннеля для Python API (FastAPI)...
echo ========================================================

call npx ngrok http 8000

pause