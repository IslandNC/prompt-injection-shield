#!/bin/bash
# Removes the auto-start service (does not delete any data).

PLIST_NAME="com.promptinjectionshield.api.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

launchctl unload "$PLIST_DEST" 2>/dev/null
rm -f "$PLIST_DEST"
echo "✅  Service removed. API will no longer start automatically."
