const DEFAULTS = {
  enabled: true,
  playOnSelect: true,
  playOnHover: true,
  hoverDelayMs: 450,
  closeOnOtherCell: true,
  playerMode: "overlay",
  autoUpdateCheck: true,
  autoDownloadUpdate: true,
};

const fields = [
  { id: "enabled", type: "bool" },
  { id: "playOnSelect", type: "bool" },
  { id: "playOnHover", type: "bool" },
  { id: "closeOnOtherCell", type: "bool" },
  { id: "playerMode", type: "select" },
  { id: "hoverDelayMs", type: "number" },
  { id: "autoUpdateCheck", type: "bool" },
  { id: "autoDownloadUpdate", type: "bool" },
];

function readForm() {
  const data = {};
  fields.forEach(function (field) {
    const el = document.getElementById(field.id);
    if (field.type === "bool") data[field.id] = el.checked;
    else if (field.type === "number") {
      data[field.id] = Math.max(0, Math.min(2000, Number(el.value) || 0));
    } else if (field.id === "playerMode") {
      data[field.id] = el.value === "window" ? "window" : "overlay";
    } else data[field.id] = el.value;
  });
  return data;
}

function fillForm(stored) {
  const data = Object.assign({}, DEFAULTS, stored || {});
  fields.forEach(function (field) {
    const el = document.getElementById(field.id);
    if (field.type === "bool") el.checked = !!data[field.id];
    else el.value = data[field.id];
  });
}

chrome.storage.sync.get(DEFAULTS, fillForm);

fields.forEach(function (field) {
  document.getElementById(field.id).addEventListener("change", function () {
    chrome.storage.sync.set(readForm());
  });
});

function showUpdateStatus(status, hint) {
  var banner = document.getElementById("updateBanner");
  var installed = document.getElementById("installedVersion");
  var hintEl = document.getElementById("updateHint");
  installed.textContent = (status && status.currentVersion) || "";
  hintEl.textContent = hint || "";
  if (status && status.hasUpdate) {
    document.getElementById("latestVersionLabel").textContent = status.latestVersion;
    document.getElementById("currentVersionLabel").textContent = status.currentVersion;
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

function requestStatus() {
  chrome.runtime.sendMessage({ type: "get-update-status" }, function (result) {
    if (chrome.runtime.lastError) return;
    showUpdateStatus(result && result.status);
  });
}

document.getElementById("checkUpdate").addEventListener("click", function () {
  document.getElementById("updateHint").textContent = "正在检查…";
  chrome.runtime.sendMessage({ type: "check-for-update" }, function (result) {
    if (chrome.runtime.lastError || !result || !result.ok) {
      showUpdateStatus(null, "检查失败，请稍后再试");
      return;
    }
    var status = result.status;
    if (status && status.hasUpdate) showUpdateStatus(status, "发现新版本 " + status.latestVersion);
    else showUpdateStatus(status, "已是最新版本");
  });
});

document.getElementById("downloadUpdate").addEventListener("click", function () {
  chrome.runtime.sendMessage({ type: "download-update" }, function () {});
});

requestStatus();
