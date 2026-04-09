# Prompt Injection Shield

A browser extension that automatically scans every web page for prompt injection attacks — malicious instructions hidden in content designed to hijack AI assistants.

---

## What it does

When you visit a page, the extension:
1. Extracts the page text in the background
2. Sends it to a local detection API running on your machine
3. Scores the page (0–100) and classifies it as **Safe**, **Suspicious**, or **Dangerous**
4. Shows results in the toolbar popup, a floating badge, and (for dangerous pages) a red banner and desktop notification
5. Optionally uses Claude AI to explain detected patterns in plain language

All processing happens locally — no data is sent anywhere except optionally to the Claude API for AI analysis.

---

## Requirements

- macOS (Linux supported with minor path adjustments; Windows not tested)
- Python 3.10+ (`python3 --version`)
- Firefox 109+ **or** Chrome 102+
- Homebrew Python at `/opt/homebrew/bin/python3` (or update the plist path)

---

## Installation

### 1. Install Python dependencies

```bash
cd prompt-injection-shield/api
pip3 install -r requirements.txt
```

### 2. Start the detection API (auto-start via macOS Launch Agent)

```bash
# Install and start the background service
bash service/install.sh

# Inject your API key and the security token
python3 service/set-env-vars.py
```

The server starts automatically on login and restarts if it crashes.

Verify it's running:
```bash
curl http://127.0.0.1:7777/health
# → {"status":"ok"}
```

### 3. Install the browser extension

**Firefox (temporary, for development):**
1. Open `about:debugging` → "This Firefox" → "Load Temporary Add-on"
2. Select `extension/manifest.json`

**Firefox (permanent, signed):**
See [Signing for permanent install](#signing-for-permanent-install) below.

**Chrome:**
1. Open `chrome://extensions` → enable "Developer mode"
2. Click "Load unpacked" → select the `extension/` folder
3. Make sure Chrome loads `manifest.chrome.json` — rename it to `manifest.json` and rename the Firefox one temporarily, or use a build step

---

## Optional: Claude AI analysis

Set your Anthropic API key to enable plain-language explanations of detected patterns:

```bash
python3 service/set-env-vars.py
# Prompts for your API key and injects it into the Launch Agent
```

Get an API key at: https://console.anthropic.com

---

## Dashboard

Open the knowledge base dashboard at:
```
http://localhost:7777/dashboard
```

Shows total scans, risk breakdown, attack categories, riskiest domains, and full scan history with search and filtering.

---

## Architecture

```
Browser Extension
├── content.js          Extracts page text, sends to background
├── background.js       Calls local API (avoids mixed-content restrictions)
├── popup.js/html       Shows scan results per-tab
├── compat.js           Firefox/Chrome API normalisation shim
└── onboarding.html     First-install setup guide

Local API (FastAPI + Python)
├── main.py             HTTP endpoints: /scan, /health, /stats, /history, /dashboard
├── detector.py         Regex pattern engine — 10 attack categories
├── triage.py           Claude AI plain-language analysis (optional)
└── database.py         SQLite knowledge base — persists all scan results

macOS Launch Agent
└── com.promptinjectionshield.api.plist   Auto-starts API on login
```

---

## Signing for permanent install

Firefox requires extensions to be signed for permanent (non-developer) installation.

1. Create a free account at https://addons.mozilla.org
2. Get JWT credentials at https://addons.mozilla.org/en-US/developers/addon/api/key/
3. Install web-ext: `npm install -g web-ext`
4. Run: `bash service/sign-extension.sh YOUR_JWT_ISSUER YOUR_JWT_SECRET`

The signed `.xpi` file can be installed via `about:addons` → ⚙ → "Install Add-on From File".

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Popup shows "Scanning…" indefinitely | API not running — check `curl http://127.0.0.1:7777/health` |
| Badge shows `–` | API unreachable — run `python3 service/set-env-vars.py` to reload agent |
| No AI analysis | `ANTHROPIC_API_KEY` not set — run `set-env-vars.py` |
| False positives on a trusted site | The detector uses conservative patterns; review findings in the popup |
| Port 7777 in use | Another process occupies it — `lsof -i :7777` to investigate |

---

## Privacy

See [PRIVACY.md](PRIVACY.md) for full details. Short version: everything stays local unless you enable Claude AI analysis.
