const DEFAULTS = {
  enabled: true,
  playOnSelect: true,
  playOnHover: true,
  hoverDelayMs: 450,
  closeOnOtherCell: true,
  playerMode: "overlay",
};

importScripts("src/urls.js");
const api = self.FbSheetsPreview;
const resolveCache = Object.create(null);

chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.sync.get(DEFAULTS, function (stored) {
    chrome.storage.sync.set(Object.assign({}, DEFAULTS, stored || {}));
  });
});

function fetchHtml(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, timeoutMs || 5000);
  return fetch(url, {
    redirect: "follow",
    credentials: "include",
    signal: controller.signal,
    headers: { Accept: "text/html,application/xhtml+xml" },
  }).finally(function () {
    clearTimeout(timer);
  });
}

async function resolveFacebookUrl(inputUrl) {
  const start = api.canonicalizeFacebookUrl(inputUrl) || inputUrl;
  if (resolveCache[start] && Date.now() - resolveCache[start].at < 10 * 60 * 1000) {
    return resolveCache[start].url;
  }

  const extracted = api.extractVideoId(start);
  if (
    extracted &&
    extracted.type !== "compound" &&
    !extracted.ownerId &&
    !/fb\.watch|\/share\//i.test(start)
  ) {
    const canonical = api.toCanonicalVideoUrl(extracted);
    resolveCache[start] = { url: canonical, at: Date.now() };
    return canonical;
  }

  let current = start;
  try {
    const response = await fetchHtml(current, 5000);
    current = api.unwrapLoginNext(response.url || current);
    const afterRedirect = api.extractVideoId(current);
    if (afterRedirect && !afterRedirect.ownerId) {
      current = api.toCanonicalVideoUrl(afterRedirect);
    } else {
      const html = await response.text();
      const fromHtml = api.parseFacebookMediaFromHtml(html, current);
      if (fromHtml) current = fromHtml;
    }
  } catch (err) {
    current = start;
  }

  const classified = api.classifyFacebookUrl(current) || api.classifyFacebookUrl(start);
  const resolved = classified ? classified.url : current || start;
  resolveCache[start] = { url: resolved, at: Date.now() };
  return resolved;
}

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (!message || !message.type) return;

  if (message.type === "open-player-window") {
    var params = new URLSearchParams();
    params.set("url", message.url || "");
    params.set("kind", message.kind || "video");
    params.set("vertical", message.vertical ? "1" : "0");
    params.set("mode", message.mode || "plugin");
    chrome.windows.create({
      url: chrome.runtime.getURL("player.html") + "?" + params.toString(),
      type: "popup",
      width: Math.max(320, Math.min(720, Number(message.width) || 420)),
      height: Math.max(360, Math.min(980, Number(message.height) || 780)),
      focused: true,
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "resolve-facebook-url") {
    resolveFacebookUrl(message.url)
      .then(function (url) {
        sendResponse({ ok: true, url: url });
      })
      .catch(function () {
        sendResponse({ ok: false, url: message.url });
      });
    return true;
  }

  if (message.type === "get-settings") {
    chrome.storage.sync.get(DEFAULTS, sendResponse);
    return true;
  }
});

chrome.commands.onCommand.addListener(function (command) {
  if (command !== "play-current-cell") return;
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    if (!tab || !tab.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "play-current-cell" });
  });
});
