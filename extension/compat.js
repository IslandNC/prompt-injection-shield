/**
 * Browser compatibility shim.
 * Firefox exposes the native `browser.*` Promise API.
 * Chrome (MV3) only has `chrome.*` with callbacks — this shim maps browser.* → chrome.*
 * and normalises browserAction → action (renamed in MV3).
 *
 * Load this as the FIRST script in every HTML page and list it first
 * in background service_worker imports for the Chrome build.
 */

if (typeof browser === "undefined") {
  /* global chrome */
  self.browser = {
    runtime:       chrome.runtime,
    tabs:          chrome.tabs,
    storage:       chrome.storage,
    notifications: chrome.notifications,
    // MV3 renamed browserAction → action
    browserAction: chrome.action,
  };
}
