# Store Submission Guide

Step-by-step instructions for publishing Prompt Injection Shield to the Firefox Add-ons (AMO) and Chrome Web Store.

---

## Before you submit

- [ ] Run through the full [User Guide](USER_GUIDE.md) on a clean browser profile
- [ ] Confirm the extension works on at least 5 different sites (news, social, docs, e-commerce, AI tools)
- [ ] Host your Privacy Policy publicly (e.g. GitHub Pages, Notion, any URL)
- [ ] Have 3–5 screenshots ready (see [Screenshots](#screenshots) below)

---

## Firefox Add-ons (AMO)

### 1. Prepare the signed XPI

```bash
npm install -g web-ext
bash service/sign-extension.sh YOUR_JWT_ISSUER YOUR_JWT_SECRET
```

Get JWT credentials at: https://addons.mozilla.org/en-US/developers/addon/api/key/

This produces a signed `.xpi` in `web-ext-artifacts/`.

### 2. Create a developer account

Go to: https://addons.mozilla.org/en-US/developers/

### 3. Submit

1. Go to "Submit a New Add-on" → "On this site" (for public listing)
2. Upload the `.xpi` from step 1
3. Fill in the listing details (see [Listing Copy](#listing-copy) below)
4. Upload screenshots
5. Add your Privacy Policy URL
6. Submit for review — AMO reviews manually; expect 1–7 days

### Notes

- AMO **requires** source code for review if the extension is minified. Since ours is plain JS, just upload the `extension/` folder as a zip.
- AMO will email you if reviewers have questions.

---

## Chrome Web Store

### 1. Prepare the Chrome build

The Chrome version uses a different manifest. Before packaging:

```bash
cd extension
cp manifest.json manifest.firefox.json   # save Firefox manifest
cp manifest.chrome.json manifest.json    # use Chrome manifest for packaging
```

### 2. Package

```bash
cd ..
zip -r prompt-injection-shield-chrome.zip extension/ \
  --exclude "*.firefox.json" \
  --exclude "__MACOSX/*" \
  --exclude "*.DS_Store"
```

Restore after packaging:
```bash
cd extension
cp manifest.firefox.json manifest.json
```

### 3. Create a developer account

Go to: https://chrome.google.com/webstore/devconsole
One-time $5 registration fee required.

### 4. Submit

1. Click "New Item" → upload the zip
2. Fill in listing details (see below)
3. Add Privacy Policy URL (required)
4. Upload screenshots
5. Submit for review — Chrome reviews take 1–3 days for new extensions

---

## Listing Copy

### Short description (≤132 characters)
```
Automatically scans web pages for prompt injection attacks before you copy content into AI assistants.
```

### Full description

```
Prompt Injection Shield protects you from hidden instructions embedded in web pages that are designed to manipulate AI assistants like ChatGPT, Claude, or Gemini.

When you browse the web and later paste content into an AI tool, you may unknowingly include malicious text that overrides the AI's behaviour, leaks your conversations, or bypasses safety measures. Prompt Injection Shield detects these patterns automatically.

FEATURES
• Automatic scanning — every page is scanned as you browse, no manual action required
• Risk scoring — pages are rated Safe (0), Suspicious, or Dangerous with a score 0–100
• 10 attack categories detected: instruction override, role override, jailbreak attempts, system prompt exfiltration, hidden text, context hijacking, and more
• In-page overlay — floating badge shows your risk status at a glance; red banner alerts you to dangerous content
• Desktop notifications — alerts for dangerous pages, once per tab
• AI analysis — optional plain-language explanation of detected patterns powered by Claude AI
• Knowledge base dashboard — full history of scans with search, filtering, and statistics at http://localhost:7777/dashboard
• Per-tab accuracy — each browser tab shows its own scan result, never bleed-over from other tabs
• Dynamic content support — re-scans when pages load new content (SPAs, infinite scroll)

PRIVACY
Everything runs locally on your machine. No browsing data is sent to any remote server. The optional AI analysis feature sends only short matched snippets to the Anthropic Claude API — never full page text. See the full privacy policy for details.

REQUIREMENTS
• A local Python API server must be running (one-time setup, auto-starts on login)
• Python 3.10+ with fastapi and uvicorn (free, open-source)
• Optionally: an Anthropic API key for AI-powered analysis

This extension is designed for security-conscious users, developers, researchers, and anyone who regularly uses AI assistants with content from the web.
```

---

## Screenshots

Take screenshots at **1280×800** (Firefox) or **1280×800** / **640×400** (Chrome).

Suggested shots:
1. Popup showing a **Safe** page (green score 0, OK badge)
2. Popup showing a **Dangerous** page (red score, findings list, AI analysis)
3. The red **danger banner** on a page
4. The **dashboard** with stats and scan history
5. The floating **badge** on a page (bottom-right corner)

---

## After submission

- Monitor your developer dashboard for reviewer feedback
- Respond to reviewer questions within 5 business days to avoid rejection
- After approval, share your listing URL in the README
