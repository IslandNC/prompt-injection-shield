#!/bin/bash
# Signs the extension for permanent Firefox installation (self-distribution).
# Requires: npm install -g web-ext
# Requires: Mozilla account + API key from https://addons.mozilla.org/developers/addon/api/key/

# ── Fill these in from addons.mozilla.org/developers/addon/api/key/ ──────────
AMO_JWT_ISSUER="your_jwt_issuer_here"
AMO_JWT_SECRET="your_jwt_secret_here"
# ─────────────────────────────────────────────────────────────────────────────

EXTENSION_DIR="$(dirname "$0")/../extension"
OUTPUT_DIR="$(dirname "$0")/signed"

mkdir -p "$OUTPUT_DIR"

echo "Building and signing Prompt Injection Shield..."

web-ext sign \
  --source-dir "$EXTENSION_DIR" \
  --artifacts-dir "$OUTPUT_DIR" \
  --api-key "$AMO_JWT_ISSUER" \
  --api-secret "$AMO_JWT_SECRET" \
  --channel unlisted

echo ""
echo "Done. Install the .xpi file in $OUTPUT_DIR by:"
echo "  1. Open Firefox"
echo "  2. Go to about:addons"
echo "  3. Click the gear icon → Install Add-on From File"
echo "  4. Select the .xpi file"
echo "  5. The extension is now permanently installed — survives restarts."
