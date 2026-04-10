/**
 * Content script — runs on every page.
 * 1. Extracts text and requests a scan via the background script
 * 2. Receives scan results and renders an in-page overlay badge
 * 3. Watches for dynamic content changes and re-scans as needed
 */

const url = window.location.href;

// Skip the local API/dashboard but allow /demo test page
const _apiBase = ["http://127.0.0.1:7777", "http://localhost:7777"];
const _skip = _apiBase.some(base => url.startsWith(base)) &&
              !url.includes("/demo");

if (_skip || url.startsWith("moz-extension://") || url.startsWith("about:")) {
  // do nothing
} else {
  init();
}

function init() {
  requestScan();
  setupMutationObserver();

  // Listen for scan results sent back from background
  try {
    browser.runtime.onMessage.addListener(function(msg) {
      if (msg.type === "SCAN_DONE") {
        renderOverlay(msg.score, msg.level, msg.findings || []);
      }
    });
  } catch (e) {
    // Chrome MV3: context already invalidated on load, nothing to do
  }
}

// ── Text extraction ───────────────────────────────────────────────────────────

function extractPageText() {
  const parts = [];

  const walker = document.createTreeWalker(
    document.body, NodeFilter.SHOW_TEXT, null, false
  );
  let node;
  while ((node = walker.nextNode())) {
    const t = node.textContent.trim();
    if (t.length > 3) parts.push(t);
  }

  document.querySelectorAll("meta[content]").forEach(el => {
    const c = el.getAttribute("content");
    if (c && c.length > 3) parts.push(c);
  });

  document.querySelectorAll("[alt],[title],[placeholder]").forEach(el => {
    ["alt","title","placeholder"].forEach(attr => {
      const v = el.getAttribute(attr);
      if (v && v.length > 3) parts.push(v);
    });
  });

  document.querySelectorAll("[style]").forEach(el => {
    const s = el.getAttribute("style");
    if (s) parts.push("STYLE:" + s);
  });

  return parts.join("\n").slice(0, 50000);
}

function requestScan() {
  const text = extractPageText();
  try {
    browser.runtime.sendMessage({ type: "SCAN_REQUEST", text, url });
  } catch (e) {
    // Chrome MV3: service worker was restarted — context is stale, ignore
  }
}

// ── MutationObserver — re-scan on significant DOM changes ────────────────────

const MAX_RESCANS    = 3;
const MIN_INTERVAL   = 15000;  // minimum 15s between rescans
const DEBOUNCE_MS    = 4000;   // wait 4s of quiet before triggering
const MIN_NEW_CHARS  = 300;    // only rescan if at least 300 chars added

let rescanCount = 0;
let lastScanAt  = Date.now();
let debounceTimer = null;
let charsAdded  = 0;

function setupMutationObserver() {
  const observer = new MutationObserver(function(mutations) {
    if (rescanCount >= MAX_RESCANS) return;

    let newText = 0;
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(n) {
        if (n.nodeType === Node.TEXT_NODE) {
          newText += n.textContent.length;
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          newText += (n.textContent || "").length;
        }
      });
    });

    charsAdded += newText;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      const timeSinceLast = Date.now() - lastScanAt;
      if (charsAdded >= MIN_NEW_CHARS && timeSinceLast >= MIN_INTERVAL) {
        rescanCount++;
        lastScanAt = Date.now();
        charsAdded = 0;
        requestScan();
      }
    }, DEBOUNCE_MS);
  });

  observer.observe(document.body, {
    childList: true,
    subtree:   true,
  });
}

// ── In-page overlay ───────────────────────────────────────────────────────────

let overlayEl    = null;
let bannerEl     = null;

const LEVEL_COLOR = { safe: "#22c55e", suspicious: "#f59e0b", dangerous: "#ef4444" };
const LEVEL_BG    = { safe: "#14532d", suspicious: "#451a03", dangerous: "#450a0a" };

function renderOverlay(score, level, findings) {
  removeOverlay();

  // ── Floating badge (bottom-right corner) ─────────────────────────────────
  overlayEl = document.createElement("div");
  overlayEl.id = "__pis_badge__";
  overlayEl.title = "Prompt Injection Shield — click for details";
  Object.assign(overlayEl.style, {
    position:     "fixed",
    bottom:       "18px",
    right:        "18px",
    zIndex:       "2147483647",
    background:   LEVEL_BG[level] || "#1a1d27",
    border:       "2px solid " + (LEVEL_COLOR[level] || "#6b7280"),
    borderRadius: "50px",
    padding:      "6px 14px 6px 10px",
    display:      "flex",
    alignItems:   "center",
    gap:          "7px",
    cursor:       "pointer",
    fontFamily:   "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize:     "13px",
    fontWeight:   "700",
    color:        LEVEL_COLOR[level] || "#e2e8f0",
    boxShadow:    "0 4px 20px rgba(0,0,0,0.5)",
    userSelect:   "none",
    transition:   "opacity 0.2s",
  });

  const icon = score === 0 ? "🛡" : (level === "dangerous" ? "⚠️" : "🔶");
  overlayEl.innerHTML =
    '<span style="font-size:15px">' + icon + '</span>' +
    '<span>' + (score === 0 ? "Safe" : score + " — " + level) + '</span>';

  // Click badge → open the popup (best we can do from content script)
  overlayEl.addEventListener("click", function() {
    overlayEl.style.opacity = "0.5";
    setTimeout(function() { overlayEl.style.opacity = "1"; }, 300);
  });

  // Auto-hide safe badge after 4 seconds
  if (level === "safe") {
    setTimeout(function() {
      if (overlayEl) overlayEl.style.opacity = "0";
      setTimeout(removeOverlay, 400);
    }, 4000);
  }

  document.body.appendChild(overlayEl);

  // ── Danger banner (top of page) ──────────────────────────────────────────
  if (level === "dangerous") {
    bannerEl = document.createElement("div");
    bannerEl.id = "__pis_banner__";
    Object.assign(bannerEl.style, {
      position:   "fixed",
      top:        "0",
      left:       "0",
      right:      "0",
      zIndex:     "2147483647",
      background: "#450a0a",
      borderBottom: "2px solid #ef4444",
      padding:    "10px 16px",
      display:    "flex",
      alignItems: "center",
      gap:        "12px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize:   "13px",
      color:      "#fecaca",
    });

    const topType = findings[0]
      ? findings[0].type.replace(/_/g, " ")
      : "injection pattern";

    bannerEl.innerHTML =
      '<span style="font-size:16px;flex-shrink:0">⚠️</span>' +
      '<span><strong style="color:#f87171">Prompt injection detected</strong> — ' +
        findings.length + ' finding' + (findings.length !== 1 ? "s" : "") +
        ' including <em>' + topType + '</em>. Click the shield icon for details.' +
      '</span>' +
      '<button id="__pis_close__" style="margin-left:auto;background:none;border:1px solid #7f1d1d;' +
        'color:#fca5a5;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:12px">Dismiss</button>';

    document.body.appendChild(bannerEl);

    document.getElementById("__pis_close__").addEventListener("click", function() {
      if (bannerEl) bannerEl.remove();
      bannerEl = null;
    });
  }
}

function removeOverlay() {
  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  if (bannerEl)  { bannerEl.remove();  bannerEl  = null; }
}
