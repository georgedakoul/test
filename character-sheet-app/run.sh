#!/usr/bin/env bash
# Shadowdark Companion - start the Flask app under Waitress.
# Listens on all interfaces so other devices on your LAN can reach it.

set -euo pipefail

# Move to the directory of this script.
cd "$(dirname "$0")"

# --- Pick the Python interpreter (python3 preferred, falls back to python) ---
if command -v python3 >/dev/null 2>&1; then
    PY=python3
elif command -v python >/dev/null 2>&1; then
    PY=python
else
    echo "Could not find Python. Make sure python3 is on PATH." >&2
    exit 1
fi

# --- Auto-install dependencies on first run ---
if ! "$PY" -c "import flask, waitress" 2>/dev/null; then
    echo "Installing dependencies (flask, waitress)..."
    if ! "$PY" -m pip install --quiet flask waitress; then
        echo
        echo "Could not install dependencies. Make sure Python and pip are on PATH." >&2
        exit 1
    fi
fi

# --- Initialize / migrate the database ---
if ! "$PY" -c "from app import init_db; init_db()"; then
    echo
    echo "Database init failed. See the Python error above." >&2
    exit 1
fi

# --- Detect the Tailscale IPv4 (100.x.y.z) if Tailscale is installed ---
TS_IP=""
if command -v tailscale >/dev/null 2>&1; then
    TS_IP="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
fi

# --- Detect the first non-loopback IPv4 for LAN fallback ---
LAN_IP=""
if command -v hostname >/dev/null 2>&1; then
    LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
fi
if [ -z "$LAN_IP" ] && command -v ip >/dev/null 2>&1; then
    LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}')"
fi

echo
echo " ============================================================"
echo "  Shadowdark Companion is running (0.0.0.0:5000)"
echo
echo "  Local:     http://localhost:5000"
[ -n "$LAN_IP" ] && echo "  LAN:       http://$LAN_IP:5000"
[ -n "$TS_IP" ]  && echo "  Tailscale: http://$TS_IP:5000"
echo
echo "  If a tailnet peer can't connect, allow port 5000 through"
echo "  your firewall (Private network is enough for Tailscale)."
echo " ============================================================"
echo
echo " Press Ctrl+C to stop."
echo

exec "$PY" -m waitress --host=0.0.0.0 --port=5000 app:app
