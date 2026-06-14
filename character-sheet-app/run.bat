@echo off
REM Shadowdark Companion - start the Flask app under Waitress.
REM Listens on all interfaces so other devices on your LAN can reach it.

cd /d "%~dp0"

REM --- Pick the Python launcher (py preferred, falls back to python) ---
where py >nul 2>nul && (set "PY=py") || (set "PY=python")

REM --- Auto-install dependencies on first run ---
%PY% -c "import flask, waitress" 2>nul
if errorlevel 1 (
    echo Installing dependencies ^(flask, waitress^)...
    %PY% -m pip install --quiet flask waitress
    if errorlevel 1 (
        echo.
        echo Could not install dependencies. Make sure Python and pip are on PATH.
        pause
        exit /b 1
    )
)

REM --- Initialize / migrate the database ---
%PY% -c "from app import init_db; init_db()"
if errorlevel 1 (
    echo.
    echo Database init failed. See the Python error above.
    pause
    exit /b 1
)

REM --- Detect the Tailscale IPv4 (100.x.y.z) if Tailscale is installed ---
set "TS_IP="
for /f "delims=" %%I in ('where tailscale 2^>nul') do set "TS_FOUND=%%I"
if defined TS_FOUND (
    for /f "usebackq tokens=*" %%I in (`tailscale ip -4 2^>nul`) do (
        if not defined TS_IP set "TS_IP=%%I"
    )
)

REM --- Detect the first non-loopback IPv4 for LAN fallback ---
set "LAN_IP="
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    if not defined LAN_IP (
        for /f "tokens=* delims= " %%B in ("%%A") do set "LAN_IP=%%B"
    )
)

echo.
echo  ============================================================
echo   Shadowdark Companion is running ^(0.0.0.0:5000^)
echo.
echo   Local:     http://localhost:5000
if defined LAN_IP echo   LAN:       http://%LAN_IP%:5000
if defined TS_IP  echo   Tailscale: http://%TS_IP%:5000
echo.
echo   If a tailnet peer can't connect, allow port 5000 through
echo   Windows Firewall (Private network is enough for Tailscale).
echo  ============================================================
echo.
echo  Press Ctrl+C to stop.
echo.

%PY% -m waitress --host=0.0.0.0 --port=5000 app:app
if errorlevel 1 (
    echo.
    echo Waitress exited with an error - see above.
    pause
)
