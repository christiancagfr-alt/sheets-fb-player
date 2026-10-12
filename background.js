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

importScripts("src/urls.js");
importScripts("src/update.js");
const api = self.FbSheetsPreview;
const updater = self.FbSheetsUpdate;
const resolveCache = Object.create(null);
const UPDATE_ALARM = "check-update";
const checkingUpdate = { running: false };

chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.sync.get(DEFAULTS, function (stored) {
    chrome.storage.sync.set(Object.assign({}, DEFAULTS, stored || {}));
  });
  ensureUpdateAlarm();
  setTimeout(function () {
    checkForUpdate(false);
  }, 2500);
});

chrome.runtime.onStartup.addListener(function () {
  ensureUpdateAlarm();
  checkForUpdate(false);
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

  if (message.type === "get-update-status") {
    getUpdateStatus().then(function (status) {
      sendResponse({ ok: true, status: status });
    });
    return true;
  }

  if (message.type === "check-for-update") {
    checkForUpdate(true)
      .then(function (status) {
        sendResponse({ ok: true, status: status });
      })
      .catch(function () {
        sendResponse({ ok: false, status: null });
      });
    return true;
  }

  if (message.type === "download-update") {
    downloadStoredUpdate(true)
      .then(function (result) {
        sendResponse(result);
      })
      .catch(function () {
        sendResponse({ ok: false });
      });
    return true;
  }

  if (message.type === "reload-extension") {
    sendResponse({ ok: true });
    setTimeout(function () {
      chrome.runtime.reload();
    }, 50);
    return true;
  }
});

function ensureUpdateAlarm() {
  chrome.alarms.get(UPDATE_ALARM, function (alarm) {
    if (!alarm) {
      chrome.alarms.create(UPDATE_ALARM, { delayInMinutes: 1, periodInMinutes: 180 });
    }
  });
}

function currentVersion() {
  return chrome.runtime.getManifest().version;
}

function emptyStatus() {
  return {
    currentVersion: currentVersion(),
    latestVersion: "",
    tag: "",
    zipUrl: "",
    releaseUrl: "",
    hasUpdate: false,
    checkedAt: 0,
  };
}

function getUpdateStatus() {
  return chrome.storage.local.get({ updateStatus: emptyStatus() }).then(function (stored) {
    var status = Object.assign(emptyStatus(), stored.updateStatus || {});
    status.currentVersion = currentVersion();
    status.hasUpdate = !!(status.latestVersion && updater.isNewerVersion(status.latestVersion, status.currentVersion));
    if (!status.hasUpdate) {
      chrome.action.setBadgeText({ text: "" });
    }
    return status;
  });
}

function setBadge(hasUpdate) {
  chrome.action.setBadgeBackgroundColor({ color: "#e41e3f" });
  chrome.action.setBadgeText({ text: hasUpdate ? "新" : "" });
}

function notifyUpdate(status) {
  chrome.notifications.create("sheets-fb-update-" + status.tag, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "表格视频悬浮播放 有新版本",
    message: "已发现 " + status.tag + "。点此查看安装步骤，或打开扩展图标下载。",
    priority: 1,
  });
}

function downloadStoredUpdate(openGuide) {
  return getUpdateStatus().then(function (status) {
    if (!status.hasUpdate || !updater.isAllowedZipUrl(status.zipUrl, status.tag)) {
      return { ok: false, error: "no-update" };
    }
    return chrome.downloads
      .download({
        url: status.zipUrl,
        filename: updater.zipNameForTag(status.tag),
        conflictAction: "uniquify",
        saveAs: false,
      })
      .then(function () {
        chrome.storage.local.set({ downloadedVersion: status.latestVersion });
        if (openGuide) chrome.tabs.create({ url: chrome.runtime.getURL("update.html") });
        return { ok: true, status: status };
      });
  });
}

async function checkForUpdate(force) {
  if (checkingUpdate.running) return getUpdateStatus();
  checkingUpdate.running = true;
  try {
    var settings = await chrome.storage.sync.get(DEFAULTS);
    if (!force && settings.autoUpdateCheck === false) {
      return getUpdateStatus();
    }
    var current = currentVersion();
    var response = await fetch(updater.latestApiUrl(), {
      credentials: "omit",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) return getUpdateStatus();
    var release = await response.json();
    var picked = updater.pickReleaseAsset(release);
    var status = emptyStatus();
    status.checkedAt = Date.now();
    if (picked && updater.isNewerVersion(picked.version, current)) {
      status.latestVersion = picked.version;
      status.tag = picked.tag;
      status.zipUrl = picked.zipUrl;
      status.releaseUrl = picked.releaseUrl;
      status.hasUpdate = true;
    }
    await chrome.storage.local.set({ updateStatus: status });
    setBadge(status.hasUpdate);
    if (status.hasUpdate) {
      var flags = await chrome.storage.local.get({ notifiedVersion: "", downloadedVersion: "" });
      if (flags.notifiedVersion !== status.latestVersion) {
        notifyUpdate(status);
        await chrome.storage.local.set({ notifiedVersion: status.latestVersion });
      }
      if (settings.autoDownloadUpdate !== false && flags.downloadedVersion !== status.latestVersion) {
        await downloadStoredUpdate(false);
      }
    }
    return status;
  } catch (err) {
    return getUpdateStatus();
  } finally {
    checkingUpdate.running = false;
  }
}

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm && alarm.name === UPDATE_ALARM) checkForUpdate(false);
});

chrome.notifications.onClicked.addListener(function (id) {
  if (String(id).indexOf("sheets-fb-update-") !== 0) return;
  chrome.tabs.create({ url: chrome.runtime.getURL("update.html") });
});

ensureUpdateAlarm();

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
