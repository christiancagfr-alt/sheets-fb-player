(function () {
  var api = window.FbSheetsPreview;
  var params = new URLSearchParams(location.search);
  var rawUrl = params.get("url") || "";
  var info = api.classifyFacebookUrl(rawUrl);
  if (!info) {
    document.getElementById("title").textContent = "没有识别到 Facebook 链接";
    return;
  }

  var watchMode = params.get("mode") === "page" ? "page" : "plugin";
  var vertical = params.get("vertical") === "1" || info.vertical;
  var frame = document.getElementById("frame");
  var badge = document.getElementById("badge");
  var title = document.getElementById("title");
  var urlEl = document.getElementById("url");
  var pageBtn = document.getElementById("kindBtn");
  var verticalBtn = document.getElementById("verticalBtn");

  pageBtn.textContent = "页面";

  function apply() {
    var size = api.playerSize(info, vertical);
    badge.textContent = info.label || "视频";
    title.textContent = watchMode === "page" ? "Facebook 页面" : vertical ? "竖屏播放" : "横屏播放";
    urlEl.textContent = info.url;
    urlEl.href = info.url;
    pageBtn.classList.toggle("is-on", watchMode === "page");
    verticalBtn.classList.toggle("is-on", vertical);
    if (watchMode === "page") {
      frame.src = api.pageHref(info) || info.url;
    } else {
      frame.src = api.buildEmbedSrc(info, {
        kind: "video",
        vertical: vertical,
        width: size.iframeWidth,
        height: size.iframeHeight,
      });
    }
  }

  pageBtn.addEventListener("click", function () {
    watchMode = watchMode === "page" ? "plugin" : "page";
    apply();
  });
  verticalBtn.addEventListener("click", function () {
    vertical = !vertical;
    apply();
  });
  document.getElementById("openBtn").addEventListener("click", function () {
    window.open(api.embedHref(info) || info.url, "_blank", "noopener");
  });

  apply();
})();
