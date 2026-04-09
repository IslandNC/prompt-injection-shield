// Check whether the local API is reachable and update the status row

var dot   = document.getElementById("status-dot");
var title = document.getElementById("status-title");
var sub   = document.getElementById("status-sub");

fetch("http://127.0.0.1:7777/health")
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data && data.status === "ok") {
      dot.className   = "dot ok";
      title.textContent = "API server is running";
      sub.textContent   = "http://127.0.0.1:7777 — ready to scan";
    } else {
      showError();
    }
  })
  .catch(function() {
    showError();
  });

function showError() {
  dot.className   = "dot error";
  title.textContent = "API server not reachable";
  sub.textContent   = "Run: bash service/install.sh — then reload this page";
}
