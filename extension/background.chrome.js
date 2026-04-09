/**
 * Chrome MV3 service worker background script.
 * Uses chrome.* API directly (no browser.* polyfill needed here).
 * Functionally identical to background.js but adapted for MV3 constraints:
 *   - chrome.action instead of chrome.browserAction
 *   - chrome.storage.session for tab-scoped ephemeral state (survives SW sleep)
 */

const API_URL      = "http://127.0.0.1:7777/scan";
const SHIELD_TOKEN = "pis_73952795acdf3d80f209fdc98df92d00";

// Open onboarding page on first install
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

chrome.runtime.onMessage.addListener(function(msg, sender) {
  const tabId = sender.tab && sender.tab.id;
  if (!tabId) return;
  if (msg.type === "SCAN_REQUEST") {
    scanPage(tabId, msg.text, msg.url);
  }
});

async function notifiedTabsHas(tabId) {
  const r = await chrome.storage.session.get("notified_" + tabId);
  return !!r["notified_" + tabId];
}
async function notifiedTabsAdd(tabId) {
  await chrome.storage.session.set({ ["notified_" + tabId]: true });
}

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

    await chrome.storage.local.set({ ["scan_" + tabId]: record });
    updateBadge(tabId, result.score, result.level);

    chrome.tabs.sendMessage(tabId, {
      type:     "SCAN_DONE",
      score:    result.score,
      level:    result.level,
      findings: result.findings || [],
    }).catch(() => {});

    if (result.level === "dangerous" && !(await notifiedTabsHas(tabId))) {
      await notifiedTabsAdd(tabId);
      fireNotification(tabId, result, url);
    }

  } catch (err) {
    updateBadgeOffline(tabId);
  }
}

function fireNotification(tabId, result, url) {
  let domain = url;
  try { domain = new URL(url).hostname; } catch(e) {}

  const count   = result.findings.length;
  const topType = result.findings[0]
    ? result.findings[0].type.replace(/_/g, " ")
    : "injection pattern";

  chrome.notifications.create("pis_" + tabId, {
    type:    "basic",
    title:   "⚠ Prompt Injection Detected",
    message: count + " finding" + (count !== 1 ? "s" : "") +
             " on " + domain + " — " + topType,
    iconUrl: "icons/icon48.svg",
  });

  chrome.notifications.onClicked.addListener(function handler(id) {
    if (id === "pis_" + tabId) {
      chrome.tabs.update(tabId, { active: true });
      chrome.notifications.onClicked.removeListener(handler);
    }
  });
}

chrome.tabs.onRemoved.addListener(function(tabId) {
  chrome.storage.local.remove("scan_" + tabId);
  chrome.storage.session.remove("notified_" + tabId);
});

function updateBadge(tabId, score, level) {
  const colors = { safe: "#22c55e", suspicious: "#f59e0b", dangerous: "#ef4444" };
  const text   = score === 0 ? "OK" : String(score);
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color: colors[level] || "#6b7280", tabId });
}

function updateBadgeOffline(tabId) {
  chrome.action.setBadgeText({ text: "–", tabId });
  chrome.action.setBadgeBackgroundColor({ color: "#4b5563", tabId });
}
