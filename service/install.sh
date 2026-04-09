#!/bin/bash
# Installs the Prompt Injection Shield API as a macOS login service.
# Run once: bash install.sh

PLIST_NAME="com.promptinjectionshield.api.plist"
PLIST_SRC="$(dirname "$0")/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "Installing Prompt Injection Shield auto-start service..."

cp "$PLIST_SRC" "$PLIST_DEST"

# Unload first in case it was previously installed
launchctl unload "$PLIST_DEST" 2>/dev/null

# Load and start now
launchctl load "$PLIST_DEST"

sleep 2

# Check it started
if curl -s http://127.0.0.1:7777/health | grep -q "ok"; then
    echo ""
    echo "✅  Service installed and running."
    echo "   The API will now start automatically every time you log in."
    echo "   Logs: /tmp/prompt-injection-shield.log"
else
    echo ""
    echo "⚠️  Service installed but API not responding yet."
    echo "   Wait a few seconds and try: curl http://127.0.0.1:7777/health"
    echo "   Check logs if needed: cat /tmp/prompt-injection-shield.err"
fi
