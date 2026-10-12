(function () {
  var summary = document.getElementById("summary");
  var downloadBtn = document.getElementById("downloadBtn");
  var reloadBtn = document.getElementById("reloadBtn");
  var releaseLink = document.getElementById("releaseLink");

  function apply(status) {
    if (!status) {
      summary.textContent = "暂时没有读取到更新信息。";
      return;
    }
    if (status.hasUpdate) {
      summary.textContent = "当前 " + status.currentVersion + " → 新版本 " + status.latestVersion;
    } else {
      summary.textContent = "当前已是最新版本 " + status.currentVersion;
    }
    var releasePrefix = "https://github.com/christiancagfr-alt/sheets-fb-player/releases/tag/";
    if (status.releaseUrl && status.releaseUrl.indexOf(releasePrefix) === 0) {
      releaseLink.href = status.releaseUrl;
      releaseLink.style.display = "";
    } else {
      releaseLink.removeAttribute("href");
      releaseLink.style.display = "none";
    }
  }

  chrome.runtime.sendMessage({ type: "get-update-status" }, function (result) {
    if (chrome.runtime.lastError) {
      summary.textContent = "无法连接扩展后台。";
      return;
    }
    apply(result && result.status);
  });

  downloadBtn.addEventListener("click", function () {
    chrome.runtime.sendMessage({ type: "download-update" }, function () {});
  });
  reloadBtn.addEventListener("click", function () {
    chrome.runtime.sendMessage({ type: "reload-extension" }, function () {});
  });
})();
