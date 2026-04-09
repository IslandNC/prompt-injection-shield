# Changelog

All notable changes to Prompt Injection Shield are documented here.

---

## [1.2.0] — 2026-04-09

### Added

**Security**
- XSS protection in the extension popup — all API-sourced strings (matched text, AI analysis, URLs) are now HTML-escaped before rendering
- API token authentication — every `/scan` request requires a matching `X-Shield-Token` header; unauthenticated requests receive a `401` response
- `service/set-env-vars.py` — unified script to inject both `ANTHROPIC_API_KEY` and `SHIELD_TOKEN` into the macOS Launch Agent plist

**Chrome support**
- `extension/manifest.chrome.json` — Manifest V3 manifest for Chrome
- `extension/background.chrome.js` — Chrome service worker background script using `chrome.action` and `chrome.storage.session`
- `extension/compat.js` — tiny browser compatibility shim mapping `browser.*` → `chrome.*` for shared content/popup scripts
- PNG icons at 16×16, 48×48, and 128×128 for Chrome (which does not support SVG extension icons)

**Dashboard**
- Scan timeline — stacked area chart showing safe / suspicious / dangerous scans per day over the last 30 days (Chart.js)
- Risk donut chart — percentage breakdown of scan levels with centre total count
- Trend indicator — compares this week's scan count against last week with a ↑/↓ badge
- Scan detail modal — click any history row to open a full-detail overlay: URL, timestamp, score, all findings with full snippets, complete AI analysis
- CSV export — download full scan history as a spreadsheet
- Auto-refresh countdown — live "auto-refresh in Xs" timer in the controls row
- 🧪 Test Page link in the dashboard header

**Test page**
- `/demo` endpoint — a local page containing all 10 attack categories with labelled example payloads and plain-English explanations; visiting it with the extension active produces a Dangerous result with all categories firing
- Extension now scans `localhost` on ports other than `7777`, enabling the demo page to be detected

**Onboarding**
- `extension/onboarding.html` + `onboarding.js` — setup checklist page that opens automatically on first install, with a live API health check indicator

**Documentation**
- `README.md` — full install guide, architecture overview, troubleshooting table, signing instructions
- `USER_GUIDE.md` — how to read scores and findings, attack category reference, dashboard usage tips
- `PRIVACY.md` — plain-English data policy (required for Firefox AMO and Chrome Web Store listings)
- `STORE_SUBMISSION.md` — step-by-step submission guide for both stores, including ready-to-paste listing copy and screenshot guidance

### Changed

- Extension version bumped to `1.2.0`
- Firefox manifest (`manifest.json`) updated: version bump, `compat.js` added to content scripts, `web_accessible_resources` added for onboarding page
- AI analysis error messages are now human-readable (e.g. low credit balance, invalid key) instead of raw API error objects
- Dashboard "Attack Categories" and history rows now escape all dynamic content to prevent XSS

### Fixed

- Popup XSS — `matched_text` from page content was previously inserted into `innerHTML` without escaping
- AI analysis showing raw 400 error JSON when Anthropic API credits were exhausted — now shows a clear actionable message

---

## [1.1.0] — 2026-04-08

### Added

- Per-tab scan storage — popup always shows the result for the active tab, never bleed-over from other tabs
- MutationObserver re-scanning — detects significant DOM changes (SPAs, infinite scroll) and re-scans up to 3 times with a 4-second debounce
- In-page visual overlay — floating badge (bottom-right, auto-hides on safe pages) and red dismissable banner for dangerous pages
- Browser notifications — desktop alert when a dangerous page is detected, once per tab session; clicking opens the tab
- macOS Launch Agent — auto-starts the API server on login with `KeepAlive`, logs to `/tmp/prompt-injection-shield.*`
- Claude AI triage — optional plain-language explanation of findings using `claude-haiku-4-5-20251001`; silently skipped if no API key is set
- `analysis` column added to the SQLite knowledge base (auto-migrates existing databases)
- Firefox signing prep — `service/sign-extension.sh` for AMO self-distribution signing via `web-ext`

### Changed

- Background script is now the sole point of contact with the local API, bypassing browser mixed-content restrictions that blocked content scripts on HTTPS pages
- Storage uses Promise API (`.then()`) instead of callback style for Firefox compatibility
- Scan storage key changed from `latestScan` (shared) to `scan_<tabId>` (per-tab)
- Localhost and internal pages excluded from scanning to prevent false positives on the dashboard and API

### Fixed

- Popup permanently stuck on "Scanning…" — caused by Firefox CSP silently blocking all inline `<script>` tags in extension HTML; fixed by moving all JS to external files
- Mixed-content error on HTTPS pages — content script could not reach `http://localhost:7777`; fixed by routing all API calls through the background script
- Chrome callback-style storage API silently ignored by Firefox — replaced with Promise chain

---

## [1.0.0] — 2026-04-07

### Initial release

- Firefox Manifest V2 extension with persistent background script
- Local FastAPI detection server on `http://127.0.0.1:7777`
- SQLite knowledge base — every scan result persisted automatically
- Detection engine with 10 attack categories across 3 severity levels:
  - **High:** instruction override, role override, jailbreak, system prompt exfiltration
  - **Medium:** delimiter injection, hidden text (CSS), indirect injection, context hijack
  - **Low:** persona manipulation, instruction smuggling
- Risk scoring: 0–100 with Safe / Suspicious / Dangerous classification
- Toolbar popup showing score, level, and findings list
- Knowledge base dashboard at `http://localhost:7777/dashboard` with stats, attack categories, riskiest domains, and searchable scan history
- SVG shield icon with colour-coded badge (green OK / amber score / red score)
