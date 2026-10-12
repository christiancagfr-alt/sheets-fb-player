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

function senderIsTrusted(sender) {
  if (!sender) return false;
  if (sender.id && sender.id !== chrome.runtime.id) return false;
  function allowed(raw) {
    if (!raw) return false;
    if (raw.indexOf(chrome.runtime.getURL("")) === 0) return true;
    try {
      var parsed = new URL(raw);
      return (
        parsed.protocol === "https:" &&
        parsed.hostname === "docs.google.com" &&
        parsed.pathname.indexOf("/spreadsheets/") === 0
      );
    } catch (err) {
      return false;
    }
  }
  return allowed(sender.url) || allowed(sender.tab && sender.tab.url);
}

function cacheResolved(key, url) {
  var keys = Object.keys(resolveCache);
  if (keys.length > 80) {
    keys
      .sort(function (a, b) {
        return resolveCache[a].at - resolveCache[b].at;
      })
      .slice(0, 40)
      .forEach(function (oldKey) {
        delete resolveCache[oldKey];
      });
  }
  resolveCache[key] = { url: url, at: Date.now() };
}

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

function facebookHttps(raw) {
  var canon = api.canonicalizeFacebookUrl(raw) || "";
  if (!api.isAllowedFetchUrl(canon)) return "";
  return canon;
}

async function resolveFacebookUrl(inputUrl) {
  const start = facebookHttps(inputUrl);
  if (!start) return "";
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
    cacheResolved(start, canonical);
    return canonical;
  }

  let current = start;
  try {
    const response = await fetchHtml(current, 5000);
    const landed = facebookHttps(api.unwrapLoginNext(response.url || current));
    if (!landed) {
      cacheResolved(start, start);
      return start;
    }
    current = landed;
    const afterRedirect = api.extractVideoId(current);
    if (afterRedirect && !afterRedirect.ownerId) {
      current = api.toCanonicalVideoUrl(afterRedirect) || current;
    } else {
      const html = await response.text();
      const fromHtml = api.parseFacebookMediaFromHtml(html, current);
      if (fromHtml && facebookHttps(fromHtml)) current = facebookHttps(fromHtml);
    }
  } catch (err) {
    current = start;
  }

  const classified = api.classifyFacebookUrl(current) || api.classifyFacebookUrl(start);
  const resolved = facebookHttps(classified ? classified.url : current) || start;
  cacheResolved(start, resolved);
  return resolved;
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || !message.type) return;
  if (!senderIsTrusted(sender)) {
    sendResponse({ ok: false, error: "untrusted-sender" });
    return;
  }

  if (message.type === "open-player-window") {
    var info = api.classifyUrl(message.url || "");
    if (!info || !api.isAllowedPageUrl(info.url)) {
      sendResponse({ ok: false, error: "invalid-url" });
      return;
    }
    var params = new URLSearchParams();
    params.set("url", info.url);
    params.set("kind", info.kind || "video");
    params.set("vertical", message.vertical ? "1" : "0");
    params.set("mode", message.mode === "page" ? "page" : "plugin");
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
        sendResponse({ ok: false, url: "" });
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
    if (!tab || !tab.id || !tab.url) return;
    try {
      var parsed = new URL(tab.url);
      if (parsed.hostname !== "docs.google.com" || parsed.pathname.indexOf("/spreadsheets/") !== 0) return;
    } catch (err) {
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: "play-current-cell" });
  });
});
