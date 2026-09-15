(function () {
  "use strict";

  if (window.top !== window) return;
  if (window.__fbspLoaded) return;
  window.__fbspLoaded = true;

  var api = window.FbSheetsPreview;
  if (!api) return;

  var DEFAULTS = {
    enabled: true,
    playOnSelect: true,
    playOnHover: true,
    hoverDelayMs: 450,
    closeOnOtherCell: true,
    playerMode: "overlay",
  };

  var HOST_ID = "fbsp-host";
  var settings = Object.assign({}, DEFAULTS);
  var host = null;
  var shadow = null;
  var playerEl = null;
  var chipEl = null;
  var frameEl = null;
  var titleEl = null;
  var badgeEl = null;
  var urlEl = null;
  var pinBtn = null;
  var verticalBtn = null;
  var pageBtn = null;
  var loadingEl = null;

  var currentInfo = null;
  var currentKind = "video";
  var currentVertical = null;
  var watchMode = "plugin";
  var pinned = false;
  var lastCellText = "";
  var lastPlayedKey = "";
  var hoverTimer = null;
  var hoverUrl = "";
  var dragState = null;
  var resizeState = null;
  var lastRect = { left: 0, top: 0 };
  var cspBlocked = false;
  var loadingTimer = null;

  function loadSettings() {
    try {
      chrome.storage.sync.get(DEFAULTS, function (stored) {
        settings = Object.assign({}, DEFAULTS, stored || {});
        if (!settings.enabled) hideAll();
      });
    } catch (err) {
      settings = Object.assign({}, DEFAULTS);
    }
  }

  function onStorageChanged(changes, area) {
    if (area !== "sync") return;
    Object.keys(changes).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        settings[key] = changes[key].newValue;
      }
    });
    if (!settings.enabled) hideAll();
  }

  function ensureUi() {
    if (shadow && host && document.contains(host)) return;
    host = document.getElementById(HOST_ID);
    if (host && !document.contains(host)) host.remove();
    if (!host || !document.contains(host)) {
      host = document.createElement("div");
      host.id = HOST_ID;
      host.style.cssText =
        "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483646;pointer-events:none;";
      (document.documentElement || document.body).appendChild(host);
    }
    shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.innerHTML =
      '<button type="button" class="fbsp-chip fbsp-hidden" id="chip">▶ 播放 Facebook</button>' +
      '<div class="fbsp-player fbsp-hidden" id="player">' +
      '  <div class="fbsp-header" id="header">' +
      '    <span class="fbsp-badge" id="badge">Reels</span>' +
      '    <span class="fbsp-title" id="title">悬浮播放</span>' +
      '    <div class="fbsp-actions">' +
      '      <button type="button" class="fbsp-btn" id="pageBtn" title="切换嵌入方式">嵌入</button>' +
      '      <button type="button" class="fbsp-btn" id="verticalBtn" title="竖屏 / 横屏">▯</button>' +
      '      <button type="button" class="fbsp-btn" id="pinBtn" title="固定窗口">📌</button>' +
      '      <button type="button" class="fbsp-btn" id="copyBtn" title="复制链接">复制</button>' +
      '      <button type="button" class="fbsp-btn" id="openBtn" title="在 Facebook 打开">↗</button>' +
      '      <button type="button" class="fbsp-btn" id="popBtn" title="弹出独立窗口">窗</button>' +
      '      <button type="button" class="fbsp-btn fbsp-btn-close" id="closeBtn" title="关闭">✕</button>' +
      "    </div>" +
      "  </div>" +
      '  <div class="fbsp-body" id="body">' +
      '    <iframe class="fbsp-frame" id="frame" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe>' +
      '    <div class="fbsp-loading" id="loading">正在加载视频…</div>' +
      "  </div>" +
      '  <div class="fbsp-footer">' +
      '    <a class="fbsp-url" id="url" target="_blank" rel="noopener noreferrer"></a>' +
      "  </div>" +
      '  <div class="fbsp-resize" id="resize"></div>' +
      "</div>";
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("src/content.css");
    shadow.insertBefore(link, shadow.firstChild);

    playerEl = shadow.getElementById("player");
    chipEl = shadow.getElementById("chip");
    frameEl = shadow.getElementById("frame");
    titleEl = shadow.getElementById("title");
    badgeEl = shadow.getElementById("badge");
    urlEl = shadow.getElementById("url");
    pinBtn = shadow.getElementById("pinBtn");
    verticalBtn = shadow.getElementById("verticalBtn");
    pageBtn = shadow.getElementById("pageBtn");
    loadingEl = shadow.getElementById("loading");
    frameEl.addEventListener("load", function () {
      if (!frameEl.src || frameEl.src === "about:blank") return;
      if (frameEl.src.indexOf("plugins/video.php") === -1) return;
      clearTimeout(loadingTimer);
      loadingTimer = setTimeout(hideLoading, 1600);
    });

    shadow.getElementById("closeBtn").addEventListener("click", function () {
      pinned = false;
      hidePlayer();
      hideChip();
    });
    pinBtn.addEventListener("click", function () {
      pinned = !pinned;
      pinBtn.classList.toggle("is-on", pinned);
    });
    verticalBtn.addEventListener("click", function () {
      if (!currentInfo) return;
      currentVertical = !currentVertical;
      renderPlayer(currentInfo, lastRect, true);
    });
    pageBtn.addEventListener("click", function () {
      if (!currentInfo) return;
      watchMode = "plugin";
      lastPlayedKey = "";
      renderPlayer(currentInfo, lastRect, true);
    });
    shadow.getElementById("copyBtn").addEventListener("click", function () {
      if (!currentInfo) return;
      navigator.clipboard.writeText(currentInfo.url).catch(function () {});
    });
    shadow.getElementById("openBtn").addEventListener("click", function () {
      if (!currentInfo) return;
      window.open(api.pageHref(currentInfo) || currentInfo.url, "_blank", "noopener");
    });
    shadow.getElementById("popBtn").addEventListener("click", function () {
      if (!currentInfo) return;
      openPlayerWindow(currentInfo);
    });
    chipEl.addEventListener("click", function () {
      if (!currentInfo) return;
      playInfo(currentInfo, lastRect, "chip");
    });

    bindDrag(shadow.getElementById("header"));
    bindResize(shadow.getElementById("resize"));
    if (!window.__fbspCspBound) {
      window.__fbspCspBound = true;
      document.addEventListener("securitypolicyviolation", onCspViolation);
    }
  }

  function onCspViolation(event) {
    var dir = String(event.effectiveDirective || event.violatedDirective || "");
    if (dir.indexOf("frame") === -1) return;
    cspBlocked = true;
    if (currentInfo && settings.playerMode === "overlay") {
      watchMode = "plugin";
      renderPlayer(currentInfo, lastRect, true);
    }
  }

  function hideAll() {
    hidePlayer();
    hideChip();
  }

  function hidePlayer() {
    if (!playerEl) return;
    playerEl.classList.add("fbsp-hidden");
    if (frameEl) frameEl.src = "about:blank";
    hideLoading();
    lastPlayedKey = "";
    if (!pinned) currentInfo = null;
  }

  function hideChip() {
    if (chipEl) chipEl.classList.add("fbsp-hidden");
  }

  function showLoading() {
    clearTimeout(loadingTimer);
    if (loadingEl) loadingEl.classList.remove("fbsp-hidden");
  }

  function hideLoading() {
    clearTimeout(loadingTimer);
    if (loadingEl) loadingEl.classList.add("fbsp-hidden");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function placeNear(rect, width, height) {
    var margin = 12;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var left = rect ? rect.right + margin : vw - width - 24;
    var top = rect ? rect.top : 80;
    if (left + width > vw - 8) left = (rect ? rect.left - width - margin : 24);
    if (left < 8) left = vw - width - 16;
    if (top + height > vh - 8) top = vh - height - 16;
    if (top < 8) top = 8;
    return {
      left: clamp(left, 8, Math.max(8, vw - width - 8)),
      top: clamp(top, 8, Math.max(8, vh - height - 8)),
    };
  }

  function getSelectionRect() {
    var selectors = [
      ".active-cell-border",
      ".selection",
      ".cell-border",
      ".active-cell",
      ".waffle-selected-cell",
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (!el) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1) return rect;
    }
    return null;
  }

  function readFormulaBar() {
    var links = [];
    var texts = [];
    var container = document.querySelector("#t-formula-bar-input-container");
    if (container) {
      container.querySelectorAll("a").forEach(function (a) {
        var href = a.dataset.sheetsFormulaBarTextLink || a.getAttribute("href") || a.href;
        if (href) links.push(href);
      });
      var input = container.querySelector(".cell-input") || container;
      texts.push((input.innerText || input.textContent || "").trim());
    }
    document.querySelectorAll(".cell-input").forEach(function (node) {
      texts.push((node.innerText || node.textContent || "").trim());
      node.querySelectorAll("a").forEach(function (a) {
        var href = a.dataset.sheetsFormulaBarTextLink || a.getAttribute("href") || a.href;
        if (href) links.push(href);
      });
    });
    var labeled = document.querySelector(
      '[aria-label="Formula bar"], [aria-label="公式栏"], [aria-label="列公式列"]'
    );
    if (labeled) texts.push((labeled.innerText || labeled.value || labeled.textContent || "").trim());
    texts.sort(function (a, b) {
      return b.length - a.length;
    });
    return { text: texts[0] || "", links: links };
  }

  function firstLinkFromSnapshot(snapshot) {
    var found = api.extractFacebookLinks(snapshot.text, snapshot.links);
    return found[0] || null;
  }

  function playKey(info, kind, vertical, mode) {
    return [info.url, kind, vertical ? "v" : "h", mode || watchMode].join("|");
  }

  function frameSrcFor(info) {
    var href = api.embedHref(info);
    if (!href) return "";
    if (watchMode === "page") return href;
    return api.buildEmbedSrc(info, {
      kind: "video",
      vertical: currentVertical,
      width: api.playerSize(info, currentVertical).iframeWidth,
      height: api.playerSize(info, currentVertical).iframeHeight,
    });
  }

  function renderPlayer(info, rect, forceReload) {
    ensureUi();
    currentInfo = info;
    if (currentKind == null || currentKind === "post") currentKind = info.kind === "post" ? "video" : info.kind;
    if (currentVertical == null) currentVertical = info.vertical;
    var size = api.playerSize({ kind: currentKind, vertical: currentVertical }, currentVertical);
    var keepPos =
      playerEl &&
      !playerEl.classList.contains("fbsp-hidden") &&
      typeof lastRect.left === "number" &&
      lastRect.left + lastRect.top > 0;
    var pos = keepPos
      ? {
          left: clamp(lastRect.left, 8, Math.max(8, window.innerWidth - size.width - 8)),
          top: clamp(lastRect.top, 8, Math.max(8, window.innerHeight - size.height - 8)),
        }
      : placeNear(rect || getSelectionRect(), size.width, size.height);
    lastRect = pos;

    playerEl.style.width = size.width + "px";
    playerEl.style.height = size.height + "px";
    playerEl.style.left = pos.left + "px";
    playerEl.style.top = pos.top + "px";
    playerEl.classList.remove("fbsp-hidden");
    hideChip();

    badgeEl.textContent = info.label || "视频";
    titleEl.textContent = watchMode === "page" ? "Facebook 页面" : currentVertical ? "竖屏播放" : "横屏播放";
    var playing = api.embedHref(info) || info.url;
    urlEl.textContent = playing;
    urlEl.href = playing;
    pinBtn.classList.toggle("is-on", pinned);
    verticalBtn.classList.toggle("is-on", currentVertical);
    pageBtn.classList.toggle("is-on", watchMode === "page");

    var key = playKey(info, currentKind, currentVertical, watchMode);
    if (!forceReload && key === lastPlayedKey && frameEl.src && frameEl.src.indexOf("facebook.com") !== -1) {
      return;
    }
    lastPlayedKey = key;
    frameEl.style.height = size.iframeHeight + "px";
    var src = frameSrcFor(info);
    if (!src || src === "about:blank") {
      showLoading();
      frameEl.src = "about:blank";
      return;
    }
    if (frameEl.src !== src) {
      showLoading();
      frameEl.src = src;
    }
  }

  function showChip(info, rect) {
    ensureUi();
    currentInfo = info;
    var target = rect || getSelectionRect();
    if (!target) {
      chipEl.classList.add("fbsp-hidden");
      return;
    }
    lastRect = { left: target.right + 8, top: target.top };
    chipEl.textContent = "▶ 播放 " + (info.label || "Facebook");
    chipEl.style.left = Math.min(target.right + 8, window.innerWidth - 140) + "px";
    chipEl.style.top = Math.max(8, target.top - 2) + "px";
    chipEl.classList.remove("fbsp-hidden");
  }

  function openPlayerWindow(info) {
    var size = api.playerSize(
      { kind: currentKind || info.kind, vertical: currentVertical == null ? info.vertical : currentVertical },
      currentVertical == null ? info.vertical : currentVertical
    );
    chrome.runtime.sendMessage({
      type: "open-player-window",
      url: info.url,
      kind: currentKind || info.kind,
      vertical: currentVertical == null ? info.vertical : currentVertical,
      mode: watchMode,
      width: size.width + 32,
      height: size.height + 48,
    });
  }

  function playInfo(info, rect, source) {
    if (!info || !settings.enabled) return;
    currentKind = info.kind === "post" ? "video" : info.kind;
    currentVertical = info.vertical;
    watchMode = "plugin";
    currentInfo = info;
    if (settings.playerMode === "window") {
      openPlayerWindow(info);
      return;
    }
    renderPlayer(info, rect, true);
    chrome.runtime.sendMessage({ type: "resolve-facebook-url", url: info.url }, function (result) {
      if (chrome.runtime.lastError) return;
      if (!result || !result.url) return;
      if (!currentInfo || (currentInfo.originalUrl || currentInfo.url) !== info.url) return;
      var resolved = api.classifyFacebookUrl(result.url) || info;
      resolved.originalUrl = info.url;
      if (!api.embedHref(resolved)) {
        var guess = api.extractVideoId(info.url);
        if (guess && guess.id) {
          resolved = api.classifyFacebookUrl("https://www.facebook.com/reel/" + guess.id + "/") || resolved;
          resolved.originalUrl = info.url;
        }
      }
      currentInfo = resolved;
      if (api.embedHref(resolved)) {
        renderPlayer(resolved, rect, true);
      }
    });
  }

  function handleSnapshot(snapshot, source, rect) {
    if (!settings.enabled) return;
    var info = firstLinkFromSnapshot(snapshot);
    if (!info) {
      if (source === "select" && settings.closeOnOtherCell && !pinned) {
        hideAll();
        currentInfo = null;
        currentKind = null;
        currentVertical = null;
      }
      return;
    }
    if (source === "select") {
      if (settings.playOnSelect) playInfo(info, rect || getSelectionRect(), source);
      else showChip(info, rect || getSelectionRect());
      return;
    }
    if (source === "hover" && settings.playOnHover) {
      playInfo(info, rect, source);
    }
  }

  function pollSelection() {
    if (!settings.enabled) return;
    var snapshot = readFormulaBar();
    if (snapshot.text === lastCellText) return;
    lastCellText = snapshot.text;
    handleSnapshot(snapshot, "select", getSelectionRect());
  }

  function findFacebookUrlFromNode(node) {
    if (!node || node.nodeType !== 1) return null;
    if (host && (node === host || host.contains(node))) return null;
    var a = node.closest ? node.closest("a[href]") : null;
    if (a) {
      var href = a.dataset.sheetsFormulaBarTextLink || a.href;
      var info = api.classifyFacebookUrl(href);
      if (info) return info;
    }
    var attrs = ["href", "data-url", "data-href", "aria-label", "title"];
    for (var i = 0; i < attrs.length; i++) {
      var value = node.getAttribute && node.getAttribute(attrs[i]);
      var found = api.extractFacebookLinks(value || "");
      if (found[0]) return found[0];
    }
    var text = (node.innerText || node.textContent || "").trim();
    if (text && text.length < 500) {
      found = api.extractFacebookLinks(text);
      if (found[0]) return found[0];
    }
    return null;
  }

  function onPointerOver(event) {
    if (!settings.enabled || !settings.playOnHover) return;
    if (host && (event.target === host || host.contains(event.target))) return;
    var info = findFacebookUrlFromNode(event.target);
    if (!info) return;
    hoverUrl = info.url;
    clearTimeout(hoverTimer);
    var rect = event.target.getBoundingClientRect ? event.target.getBoundingClientRect() : null;
    hoverTimer = setTimeout(function () {
      handleSnapshot({ text: info.url, links: [info.url] }, "hover", rect);
    }, Number(settings.hoverDelayMs) || 450);
  }

  function onPointerOut(event) {
    if (!hoverTimer) return;
    var next = event.relatedTarget;
    if (next && findFacebookUrlFromNode(next)) return;
    if (host && next && (next === host || host.contains(next))) return;
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }

  function bindDrag(header) {
    header.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      if (event.target.closest("button")) return;
      var rect = playerEl.getBoundingClientRect();
      dragState = {
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
      };
      header.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    header.addEventListener("pointermove", function (event) {
      if (!dragState) return;
      var width = playerEl.offsetWidth;
      var height = playerEl.offsetHeight;
      var left = clamp(event.clientX - dragState.dx, 8, window.innerWidth - width - 8);
      var top = clamp(event.clientY - dragState.dy, 8, window.innerHeight - height - 8);
      playerEl.style.left = left + "px";
      playerEl.style.top = top + "px";
      lastRect = { left: left, top: top };
    });
    header.addEventListener("pointerup", function () {
      dragState = null;
    });
  }

  function bindResize(handle) {
    handle.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      var rect = playerEl.getBoundingClientRect();
      resizeState = {
        x: event.clientX,
        y: event.clientY,
        w: rect.width,
        h: rect.height,
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener("pointermove", function (event) {
      if (!resizeState) return;
      var width = clamp(resizeState.w + (event.clientX - resizeState.x), 240, Math.min(720, window.innerWidth - 16));
      var height = clamp(resizeState.h + (event.clientY - resizeState.y), 180, Math.min(900, window.innerHeight - 16));
      playerEl.style.width = width + "px";
      playerEl.style.height = height + "px";
      if (frameEl) frameEl.style.height = Math.max(120, height - 72) + "px";
    });
    handle.addEventListener("pointerup", function () {
      resizeState = null;
    });
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && playerEl && !playerEl.classList.contains("fbsp-hidden")) {
      pinned = false;
      hideAll();
    }
  }

  function onMessage(message) {
    if (!message) return;
    if (message.type === "play-current-cell") {
      var snapshot = readFormulaBar();
      lastCellText = snapshot.text;
      var info = firstLinkFromSnapshot(snapshot);
      if (info) playInfo(info, getSelectionRect(), "command");
    }
    if (message.type === "settings-updated") {
      loadSettings();
    }
  }

  loadSettings();
  try {
    chrome.storage.onChanged.addListener(onStorageChanged);
    chrome.runtime.onMessage.addListener(onMessage);
  } catch (err) {}

  document.addEventListener("pointerup", function () {
    setTimeout(pollSelection, 80);
    setTimeout(pollSelection, 220);
  });
  document.addEventListener("keyup", function (event) {
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === "Tab"
    ) {
      setTimeout(pollSelection, 80);
      setTimeout(pollSelection, 220);
    }
  });
  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("keydown", onKeyDown, true);

  var observer = new MutationObserver(function () {
    pollSelection();
  });
  function watchFormulaBar() {
    var node =
      document.querySelector("#t-formula-bar-input-container") ||
      document.querySelector(".cell-input") ||
      document.body;
    if (!node) return;
    observer.disconnect();
    observer.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
  watchFormulaBar();
  setInterval(function () {
    if (!document.querySelector("#t-formula-bar-input-container") && document.body) {
      watchFormulaBar();
    }
    pollSelection();
  }, 400);
})();
