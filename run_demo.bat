@echo off
title OceanEmbed - Interactive Ocean Intelligence Platform

echo =====================================================================
echo           OCEANEMBED - OCEAN HEAT RISK INTELLIGENCE
echo    Ministry of Earth Sciences (MoES) - INCOIS Problem Statement 26066
echo =====================================================================
echo.

REM Switch to script's directory
cd /d "%~dp0"

echo [1/3] Synchronizing latest assets and build distribution...
where node >nul 2>&1
if not errorlevel 1 (
    call node build.js
) else (
    echo Note: Node.js build step skipped.
)
echo.

echo [2/3] Launching your default browser to OceanEmbed...
start "" "http://localhost:8080"

echo [3/3] Starting OceanEmbed Web Server on port 8080...
echo.
echo =====================================================================
echo   SERVER RUNNING: http://localhost:8080
echo.
echo   - Interactive Operations Deck : http://localhost:8080/#demo
echo   - Story Overview Landing      : http://localhost:8080/
echo   - Solution Showcase           : http://localhost:8080/view_demo/
echo.
echo   Press Ctrl+C in this window at any time to stop the server.
echo =====================================================================
echo.

where node >nul 2>&1
if not errorlevel 1 (
    node serve_local.js
) else (
    where python >nul 2>&1
    if not errorlevel 1 (
        python -m http.server 8080 --directory dist
    ) else (
        echo Neither Node.js nor Python was found on PATH.
        echo Opening local HTML file directly in your browser...
        start "" "%~dp0dist\index.html"
        pause
    )
)
