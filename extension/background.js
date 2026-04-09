/**
 * Background script — privileged context, no mixed-content restrictions.
 * Receives text from content scripts, calls the local API, stores results
 * per-tab, updates badges, sends findings back for page highlighting,
 * and fires browser notifications for dangerous pages.
 */

const API_URL     = "http://127.0.0.1:7777/scan";
const SHIELD_TOKEN = "pis_73952795acdf3d80f209fdc98df92d00";

// Track which tabs have already been notified (avoid repeat alerts per session)
const notifiedTabs = new Set();

// Open onboarding page on first install
browser.runtime.onInstalled.addListener(function(details) {
  if (details.reason === "install") {
    browser.tabs.create({ url: browser.runtime.getURL("onboarding.html") });
  }
});

browser.runtime.onMessage.addListener(function(msg, sender) {
  const tabId = sender.tab && sender.tab.id;
  if (!tabId) return;

  if (msg.type === "SCAN_REQUEST") {
    scanPage(tabId, msg.text, msg.url);
  }
});

async function scanPage(tabId, text, url) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shield-Token": SHIELD_TOKEN,
      },
      body: JSON.stringify({ text, url }),
    });

    if (!response.ok) { updateBadgeOffline(tabId); return; }

    const result = await response.json();

    const record = {
      score:    result.score,
      level:    result.level,
      findings: result.findings || [],
      analysis: result.analysis || "",
      url:      url,
      ts:       Date.now(),
    };

    // Store per-tab so popup always shows the right page
    await browser.storage.local.set({ ["scan_" + tabId]: record });

    updateBadge(tabId, result.score, result.level);

    // Send findings to content script for in-page overlay
    browser.tabs.sendMessage(tabId, {
      type:     "SCAN_DONE",
      score:    result.score,
      level:    result.level,
      findings: result.findings || [],
    }).catch(() => {}); // tab may have navigated away

    // Fire notification for dangerous pages (once per tab)
    if (result.level === "dangerous" && !notifiedTabs.has(tabId)) {
      notifiedTabs.add(tabId);
      fireNotification(tabId, result, url);
    }

  } catch (err) {
    updateBadgeOffline(tabId);
  }
}

function fireNotification(tabId, result, url) {
  let domain = url;
  try { domain = new URL(url).hostname; } catch(e) {}

  const count = result.findings.length;
  const topType = result.findings[0]
    ? result.findings[0].type.replace(/_/g, " ")
    : "injection pattern";

  browser.notifications.create("pis_" + tabId, {
    type:    "basic",
    title:   "⚠ Prompt Injection Detected",
    message: count + " finding" + (count !== 1 ? "s" : "") +
             " on " + domain + " — " + topType,
    iconUrl: "icons/icon48.svg",
  });

  // Click notification → focus the tab
  browser.notifications.onClicked.addListener(function handler(id) {
    if (id === "pis_" + tabId) {
      browser.tabs.update(tabId, { active: true });
      browser.notifications.onClicked.removeListener(handler);
    }
  });
}

// Clean up per-tab storage when tab closes
browser.tabs.onRemoved.addListener(function(tabId) {
  browser.storage.local.remove("scan_" + tabId);
  notifiedTabs.delete(tabId);
});

function updateBadge(tabId, score, level) {
  const colors = { safe: "#22c55e", suspicious: "#f59e0b", dangerous: "#ef4444" };
  const text   = score === 0 ? "OK" : String(score);
  browser.browserAction.setBadgeText({ text, tabId });
  browser.browserAction.setBadgeBackgroundColor({ color: colors[level] || "#6b7280", tabId });
}

function updateBadgeOffline(tabId) {
  browser.browserAction.setBadgeText({ text: "–", tabId });
  browser.browserAction.setBadgeBackgroundColor({ color: "#4b5563", tabId });
}
