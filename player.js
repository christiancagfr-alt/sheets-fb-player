(function () {
  var api = window.FbSheetsPreview;
  var params = new URLSearchParams(location.search);
  var rawUrl = params.get("url") || "";
  var info = api.classifyUrl(rawUrl);
  if (!info) {
    document.getElementById("title").textContent = "没有识别到可播放链接";
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
    var platform = info.platform || "facebook";
    if (platform === "youtube") title.textContent = vertical ? "YouTube Shorts" : "YouTube";
    else if (platform === "instagram") title.textContent = vertical ? "Instagram 竖屏" : "Instagram";
    else title.textContent = watchMode === "page" ? "Facebook 页面" : vertical ? "竖屏播放" : "横屏播放";
    pageBtn.style.display = platform === "facebook" ? "" : "none";
    urlEl.textContent = info.url;
    if (api.isAllowedPageUrl(info.url)) urlEl.href = info.url;
    else urlEl.removeAttribute("href");
    pageBtn.classList.toggle("is-on", watchMode === "page");
    verticalBtn.classList.toggle("is-on", vertical);
    var src =
      watchMode === "page"
        ? api.pageHref(info) || info.url
        : api.buildEmbedSrc(info, {
            kind: "video",
            vertical: vertical,
            width: size.iframeWidth,
            height: size.iframeHeight,
          });
    if (api.isAllowedEmbedSrc(src)) frame.src = src;
    else frame.src = "about:blank";
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
    var openUrl = api.embedHref(info) || info.url;
    if (api.isAllowedPageUrl(openUrl)) window.open(openUrl, "_blank", "noopener");
  });

  apply();
})();
