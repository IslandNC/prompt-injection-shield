var LABEL = { safe: "Safe", suspicious: "Suspicious", dangerous: "Dangerous" };
var DESC  = {
  safe:       "No injection patterns detected.",
  suspicious: "Some patterns found — review findings.",
  dangerous:  "High-risk content — verify before AI use.",
};

// Escape all user-supplied / API-sourced strings before inserting into innerHTML
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showResult(data) {
  var content = document.getElementById("content");
  var note    = document.getElementById("note");

  if (!data) {
    content.innerHTML =
      '<div style="padding:1.2rem 1rem;font-size:0.8rem;color:#6b7280;text-align:center">' +
        '<p>Page not scanned yet.<br>' +
        'Navigate to a page and wait a few seconds.</p>' +
      '</div>';
    note.textContent = "no data";
    return;
  }

  var findings = data.findings || [];

  var age = data.ts ? Math.round((Date.now() - data.ts) / 1000) : null;
  var ageStr = age !== null
    ? (age < 60 ? age + "s ago" : Math.round(age / 60) + "m ago")
    : "";

  var urlLine = data.url
    ? '<div class="scanned-url">' +
        esc(data.url.slice(0, 55)) + (data.url.length > 55 ? "&hellip;" : "") +
        (ageStr ? ' <span style="color:#374151">&middot; ' + esc(ageStr) + '</span>' : '') +
      '</div>'
    : "";

  // AI analysis block — analysis comes from Claude API; still escape for defence-in-depth
  var aiHTML = "";
  if (data.analysis) {
    aiHTML =
      '<div class="ai-analysis">' +
        '<div class="ai-label">🤖 AI Analysis</div>' +
        '<div class="ai-text">' + esc(data.analysis) + '</div>' +
      '</div>';
  }

  var fHTML = "";
  if (findings.length) {
    fHTML = '<div class="findings">' +
      findings.map(function(f) {
        var snip = f.matched_text
          ? '<div class="fsnip">&ldquo;' +
              esc(f.matched_text.slice(0, 90)) + (f.matched_text.length > 90 ? "&hellip;" : "") +
            '&rdquo;</div>'
          : "";
        return '<div class="finding">' +
          '<div class="ftype ' + esc(f.severity) + '">' +
            esc(f.type.replace(/_/g, " ")) + " &middot; " + esc(f.severity) +
          '</div>' +
          '<div class="fdesc">' + esc(f.description) + '</div>' +
          snip +
        '</div>';
      }).join("") +
    '</div>';
  }

  var level = esc(data.level);
  var score = esc(String(data.score));
  var label = esc(LABEL[data.level] || data.level);
  var desc  = esc(DESC[data.level] || "");

  content.innerHTML =
    '<div class="score-section ' + level + '">' +
      '<div class="circle">' + score + '</div>' +
      '<div class="info">' +
        '<h2>' + label + '</h2>' +
        '<p>' + desc + '</p>' +
      '</div>' +
    '</div>' + urlLine + aiHTML + fHTML;

  note.textContent = findings.length + " finding" + (findings.length !== 1 ? "s" : "");
}

function showDebug(scan, err) {
  var el = document.getElementById("debug");
  el.style.display = "block";
  var lines = ["── DEBUG ──"];
  if (err) {
    lines.push("storage ERROR: " + err);
  } else {
    lines.push("storage.local: OK");
    lines.push("scan for this tab: " + (scan ? "found" : "NOT FOUND"));
    if (!scan) {
      lines.push("→ Navigate to a new page (not localhost)");
      lines.push("  then wait ~5s and click the shield.");
    }
  }
  el.textContent = lines.join("\n");

  fetch("http://127.0.0.1:7777/health")
    .then(function() {
      document.getElementById("debug").textContent += "\nAPI server: running OK";
    })
    .catch(function() {
      document.getElementById("debug").textContent +=
        "\nAPI server: NOT REACHABLE\nRun: uvicorn main:app --port 7777";
    });
}

// ── Poll per-tab storage ──────────────────────────────────────────────────────

var MAX_WAIT = 12000;
var INTERVAL = 500;
var elapsed  = 0;

browser.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
  var tabId = tabs && tabs[0] && tabs[0].id;
  if (!tabId) { showResult(null); return; }

  var key = "scan_" + tabId;

  function poll() {
    browser.storage.local.get(key)
      .then(function(data) {
        var scan = data && data[key];
        if (scan) {
          showResult(scan);
        } else if (elapsed >= MAX_WAIT) {
          showDebug(null, null);
          showResult(null);
        } else {
          elapsed += INTERVAL;
          setTimeout(poll, INTERVAL);
        }
      })
      .catch(function(err) {
        showDebug(null, String(err));
        showResult(null);
      });
  }

  poll();
}).catch(function() { showResult(null); });
