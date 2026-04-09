#!/usr/bin/env python3
"""
Inject ANTHROPIC_API_KEY and SHIELD_TOKEN into the Launch Agent plist,
then reload the agent so changes take effect immediately.

Usage:
    python3 service/set-env-vars.py
"""

import plistlib
import subprocess
import os
from pathlib import Path

PLIST_SRC  = Path(__file__).parent / "com.promptinjectionshield.api.plist"
PLIST_DEST = Path.home() / "Library/LaunchAgents/com.promptinjectionshield.api.plist"
LABEL      = "com.promptinjectionshield.api"

# ── Read API key from current environment ──────────────────────────────────────
api_key = os.environ.get("ANTHROPIC_API_KEY", "")
if not api_key:
    api_key = input("Paste your Anthropic API key (sk-ant-...): ").strip()
if not api_key:
    print("❌  No API key provided — aborting.")
    raise SystemExit(1)

# ── Load the installed plist (or fall back to source) ─────────────────────────
src = PLIST_DEST if PLIST_DEST.exists() else PLIST_SRC
with open(src, "rb") as f:
    data = plistlib.load(f)

# ── Inject environment variables ───────────────────────────────────────────────
env = data.setdefault("EnvironmentVariables", {})
env["ANTHROPIC_API_KEY"] = api_key
env["SHIELD_TOKEN"]      = "pis_73952795acdf3d80f209fdc98df92d00"

with open(PLIST_DEST, "wb") as f:
    plistlib.dump(data, f)

print(f"✅  Wrote env vars to {PLIST_DEST}")
print(f"   ANTHROPIC_API_KEY starts with: {api_key[:18]}…")
print( "   SHIELD_TOKEN: pis_73952795acdf3d80f209fdc98df92d00")

# ── Reload the Launch Agent ────────────────────────────────────────────────────
subprocess.run(["launchctl", "unload", str(PLIST_DEST)], capture_output=True)
subprocess.run(["launchctl", "load",   str(PLIST_DEST)], capture_output=True)
print("✅  Launch Agent reloaded — server restarting…")
print("   Check health: curl http://127.0.0.1:7777/health")
