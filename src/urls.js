/**
 * Facebook / Reels URL detection and embed helpers.
 * Works in Chrome content scripts and in Node tests.
 */
(function (root, factory) {
  var exported = factory();
  root.FbSheetsPreview = exported;
  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TRACKING_PARAMS = {
    fbclid: 1,
    ref: 1,
    refsrc: 1,
    refid: 1,
    _rdc: 1,
    _rdr: 1,
    mibextid: 1,
    __tn__: 1,
    __cft__: 1,
    rdr: 1,
    hr: 1,
    sfnsn: 1,
    fs: 1,
    eav: 1,
    paipv: 1,
    locale: 1,
    ufi: 1,
    rdid: 1,
    share_url: 1,
    rd_p: 1,
    gidzl: 1,
    comment_id: 1,
    commenting_disabled: 1,
    notif_id: 1,
    notif_t: 1,
    ref_component: 1,
    ref_page: 1,
    _ft_: 1,
    dti: 1,
  };

  var KEEP_PARAMS = {
    v: 1,
    id: 1,
    story_fbid: 1,
    fbid: 1,
    video_id: 1,
  };

  var FB_HOST_RE =
    /^(?:www\.|m\.|web\.|mbasic\.|lm\.|l\.)?(?:facebook\.com|fb\.com|fb\.watch)$/i;

  var URL_RE =
    /https?:\/\/(?:www\.|m\.|web\.|mbasic\.|lm\.|l\.)?(?:facebook\.com|fb\.com|fb\.watch)\/[^\s<>"'）】\]]+/gi;

  var BARE_FB_RE =
    /(?:^|[\s"'=(（])((?:www\.)?facebook\.com\/[^\s<>"'）】\]]+)/gi;

  var FB_WATCH_RE = /(?:https?:\/\/)?fb\.watch\/[A-Za-z0-9_\-]+\/?/gi;

  var HYPERLINK_RE = /HYPERLINK\s*\(\s*["']([^"']+)["']/i;

  var TRAILING_PUNCT_RE = /[.,;:!?，。；：、)\]}）】」』>》]+$/;

  function decodeSafe(value) {
    if (!value) return value;
    var current = String(value);
    for (var i = 0; i < 3; i++) {
      try {
        var next = decodeURIComponent(current);
        if (next === current) break;
        current = next;
      } catch (err) {
        break;
      }
    }
    return current;
  }

  function stripTrailingPunct(raw) {
    var text = String(raw || "").trim();
    text = text.replace(/&amp;/g, "&");
    text = text.replace(TRAILING_PUNCT_RE, "");
    text = text.replace(/\/+$/, function (match, offset, whole) {
      if (/fb\.watch\//i.test(whole)) return "/";
      return match;
    });
    return text;
  }

  function isFacebookHost(hostname) {
    if (!hostname) return false;
    var host = String(hostname).toLowerCase().replace(/^www\./, "");
    return (
      host === "facebook.com" ||
      host === "fb.com" ||
      host === "fb.watch" ||
      host.endsWith(".facebook.com") ||
      host.endsWith(".fb.com")
    );
  }

  function isFacebookUrl(value) {
    try {
      var url = new URL(normalizeCandidate(value));
      return isFacebookHost(url.hostname);
    } catch (err) {
      return false;
    }
  }

  function normalizeCandidate(raw) {
    var text = stripTrailingPunct(decodeSafe(raw));
    if (!text) return "";
    if (text.startsWith("//")) text = "https:" + text;
    if (/^(?:www\.)?(facebook\.com|fb\.com|fb\.watch)\//i.test(text)) {
      text = "https://" + text.replace(/^https?:\/\//i, "");
    }
    return text;
  }

  function unwrapFacebookRedirect(raw) {
    var text = normalizeCandidate(raw);
    if (!text) return "";
    try {
      var url = new URL(text);
      if (!isFacebookHost(url.hostname)) return text;

      if (url.pathname === "/l.php" || url.pathname === "/l.php/") {
        var nested = url.searchParams.get("u");
        if (nested) return unwrapFacebookRedirect(nested);
      }

      var next = url.searchParams.get("next");
      if (url.pathname.indexOf("login") !== -1 && next && /facebook\.com|fb\.watch/i.test(next)) {
        return unwrapFacebookRedirect(next);
      }
      return url.toString();
    } catch (err) {
      return text;
    }
  }

  function canonicalizeFacebookUrl(raw) {
    var unwrapped = unwrapFacebookRedirect(raw);
    if (!unwrapped) return "";
    var url;
    try {
      url = new URL(unwrapped);
    } catch (err) {
      return "";
    }
    if (!isFacebookHost(url.hostname)) return "";

    var host = url.hostname.toLowerCase();
    if (host === "fb.watch" || host === "www.fb.watch") {
      var code = url.pathname.replace(/\//g, "");
      if (!code) return "";
      return "https://fb.watch/" + code + "/";
    }

    if (host === "fb.com" || host === "www.fb.com" || host === "m.facebook.com" ||
        host === "web.facebook.com" || host === "mbasic.facebook.com" ||
        host === "lm.facebook.com" || host === "l.facebook.com") {
      url.hostname = "www.facebook.com";
    } else if (host === "facebook.com") {
      url.hostname = "www.facebook.com";
    }

    url.hash = "";
    url.searchParams.forEach(function (_value, key) {
      var lower = key.toLowerCase();
      if (KEEP_PARAMS[lower]) return;
      if (TRACKING_PARAMS[lower] || lower.indexOf("_nc_") === 0 || lower.indexOf("__") === 0) {
        url.searchParams.delete(key);
      }
    });

    var href = url.toString();
    if (href.endsWith("?")) href = href.slice(0, -1);
    return href;
  }

  function classifyFacebookUrl(raw) {
    var urlStr = canonicalizeFacebookUrl(raw);
    if (!urlStr) return null;
    var url = new URL(urlStr);
    var path = url.pathname.toLowerCase();
    var host = url.hostname.toLowerCase();

    if (host === "fb.watch" || host === "www.fb.watch") {
      return { url: urlStr, kind: "reel", label: "Reels", vertical: true, needsResolve: true };
    }
    if (/\/(?:reel|reels)\//.test(path) || /\/share\/r\//.test(path)) {
      return { url: urlStr, kind: "reel", label: "Reels", vertical: true };
    }
    if (/\/share\/v\//.test(path) || /\/videos?\//.test(path) || path.indexOf("/video.php") === 0) {
      return { url: urlStr, kind: "video", label: "视频", vertical: false };
    }
    if (path === "/watch" || path === "/watch/" || path.indexOf("/watch/") === 0) {
      return { url: urlStr, kind: "video", label: "视频", vertical: false };
    }
    if (/\/share\//.test(path)) {
      return { url: urlStr, kind: "reel", label: "分享", vertical: true, needsResolve: true };
    }
    var extracted = extractVideoId(urlStr);
    if (extracted && extracted.type === "compound") {
      return {
        url: urlStr,
        kind: "reel",
        label: "Reels",
        vertical: true,
        needsResolve: true,
      };
    }
    if (extracted && extracted.type === "reel") {
      return { url: urlStr, kind: "reel", label: "Reels", vertical: true };
    }
    if (extracted) {
      return { url: urlStr, kind: "video", label: "视频", vertical: false };
    }
    return {
      url: urlStr,
      kind: "video",
      label: "视频",
      vertical: /reel|share|watch/i.test(path),
      needsResolve: true,
    };
  }

  function extractVideoId(raw) {
    var urlStr = canonicalizeFacebookUrl(raw) || String(raw || "");
    var url;
    try {
      url = new URL(urlStr);
    } catch (err) {
      return null;
    }
    var path = url.pathname;
    var match = path.match(/\/(?:reel|reels)\/(\d{5,})/i);
    if (match) return { id: match[1], type: "reel" };
    match = path.match(/\/videos?\/(?:vb\.\d+\/)?(\d{5,})/i);
    if (match) return { id: match[1], type: "video" };
    match = path.match(/\/watch\/(\d{5,})/i);
    if (match) return { id: match[1], type: "video" };
    match = path.match(/^\/(\d{5,})_(\d{5,})\/?$/);
    if (match) return { id: match[2], type: "compound", ownerId: match[1] };
    var queryId =
      url.searchParams.get("v") ||
      url.searchParams.get("video_id") ||
      url.searchParams.get("id");
    if (queryId && /^\d{5,}$/.test(queryId)) {
      return { id: queryId, type: path.indexOf("/reel") !== -1 ? "reel" : "video" };
    }
    var story = url.searchParams.get("story_fbid") || url.searchParams.get("fbid");
    if (story && /^\d{5,}$/.test(story) && /video|watch|reel|story|permalink/i.test(path + url.search)) {
      return { id: story, type: "video" };
    }
    return null;
  }

  function toCanonicalVideoUrl(extracted) {
    if (!extracted || !extracted.id) return "";
    if (extracted.type === "compound") return "";
    if (extracted.type === "reel") {
      return "https://www.facebook.com/reel/" + extracted.id + "/";
    }
    return "https://www.facebook.com/watch/?v=" + extracted.id;
  }

  function needsResolve(raw) {
    var info = typeof raw === "object" && raw ? raw : classifyFacebookUrl(raw);
    if (!info) return false;
    if (info.needsResolve) return true;
    if (/fb\.watch/i.test(info.url) || /\/share\//i.test(info.url)) return true;
    var extracted = extractVideoId(info.url);
    if (!extracted || extracted.type === "compound") return true;
    return false;
  }

  function embedHref(info) {
    if (!info || !info.url) return "";
    var extracted = extractVideoId(info.url);
    if (extracted && extracted.type === "compound") return "";
    if (extracted) return toCanonicalVideoUrl(extracted);
    if (/\/(?:reel|reels|videos?)\//i.test(info.url) || /\/watch/i.test(info.url)) {
      return info.url;
    }
    return "";
  }

  function pageHref(info) {
    return embedHref(info);
  }

  function matchMeta(html, property) {
    var pattern =
      "<meta[^>]+(?:property|name)=[\"']" +
      property.replace(".", "\\.") +
      "[\"'][^>]+content=[\"']([^\"']+)";
    var alt =
      "<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']" +
      property.replace(".", "\\.") +
      "[\"']";
    var match = html.match(new RegExp(pattern, "i")) || html.match(new RegExp(alt, "i"));
    return match ? decodeSafe(match[1]) : "";
  }

  function parseFacebookMediaFromHtml(html, pageUrl) {
    if (!html) return "";
    var ogUrl = matchMeta(html, "og:url");
    var canonical = "";
    var linkMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i);
    if (linkMatch) canonical = decodeSafe(linkMatch[1]);
    var refreshMatch = html.match(/http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'>\s]+)/i);
    var candidates = [pageUrl, ogUrl, canonical, refreshMatch && refreshMatch[1]];
    var i;
    for (i = 0; i < candidates.length; i++) {
      if (!candidates[i]) continue;
      var extracted = extractVideoId(candidates[i]);
      if (extracted) return toCanonicalVideoUrl(extracted);
    }
    var reel = html.match(/\/reel\/(\d{8,})/);
    if (reel) return "https://www.facebook.com/reel/" + reel[1] + "/";
    var video =
      html.match(/\/videos\/(\d{8,})/) ||
      html.match(/"video_id"\s*:\s*"(\d{8,})"/) ||
      html.match(/watch\/?\?v=(\d{8,})/);
    if (video) return "https://www.facebook.com/watch/?v=" + video[1];
    if (ogUrl && isFacebookUrl(ogUrl)) return canonicalizeFacebookUrl(ogUrl);
    return "";
  }

  function decodeFbEscaped(str) {
    if (!str) return "";
    var cleaned = String(str)
      .replace(/\\\//g, "/")
      .replace(/\\u0025/gi, "%")
      .replace(/\\u0026/gi, "&")
      .replace(/\\u003d/gi, "=")
      .replace(/\\u002f/gi, "/")
      .replace(/&amp;/g, "&");
    try {
      return JSON.parse('"' + cleaned.replace(/"/g, '\\"') + '"');
    } catch (err) {
      return cleaned.replace(/\\/g, "");
    }
  }

  function extractPlayableFromHtml(html) {
    if (!html) return "";
    var patterns = [
      /"browser_native_hd_url"\s*:\s*"([^"]+)"/,
      /"playable_url_quality_hd"\s*:\s*"([^"]+)"/,
      /"browser_native_sd_url"\s*:\s*"([^"]+)"/,
      /"playable_url"\s*:\s*"([^"]+)"/,
      /"hd_src_no_ratelimit"\s*:\s*"([^"]+)"/,
      /"sd_src_no_ratelimit"\s*:\s*"([^"]+)"/,
      /"hd_src"\s*:\s*"([^"]+)"/,
      /"sd_src"\s*:\s*"([^"]+)"/,
      /property="og:video(?::url|:secure_url)?"[^>]+content="([^"]+)"/,
      /content="([^"]+)"[^>]+property="og:video(?::url|:secure_url)?"/,
    ];
    var i;
    for (i = 0; i < patterns.length; i++) {
      var match = html.match(patterns[i]);
      if (!match) continue;
      var url = decodeFbEscaped(match[1]);
      if (/^https?:\/\//i.test(url) && /fbcdn\.net|\.mp4|\.m3u8/i.test(url)) {
        return url;
      }
    }
    return "";
  }

  function candidateUrls(raw) {
    var info = typeof raw === "object" && raw ? raw : classifyFacebookUrl(raw);
    var list = [];
    var seen = Object.create(null);
    function push(url) {
      if (!url || seen[url]) return;
      seen[url] = true;
      list.push(url);
    }
    if (!info) return list;
    var extracted = extractVideoId(info.url);
    if (extracted) {
      push(toCanonicalVideoUrl(extracted));
      if (extracted.type === "video") push("https://www.facebook.com/reel/" + extracted.id + "/");
      if (extracted.type === "reel") push("https://www.facebook.com/watch/?v=" + extracted.id);
      if (extracted.ownerId) {
        push("https://www.facebook.com/" + extracted.ownerId + "/videos/" + extracted.id);
        push("https://www.facebook.com/" + extracted.ownerId + "/posts/" + extracted.id);
        push("https://www.facebook.com/" + extracted.ownerId + "_" + extracted.id);
      }
    }
    push(info.url);
    if (info.originalUrl) push(info.originalUrl);
    return list;
  }

  function unwrapLoginNext(raw) {
    try {
      var url = new URL(raw);
      if (url.pathname.toLowerCase().indexOf("login") === -1) return raw;
      var next = url.searchParams.get("next");
      if (!next) return raw;
      return new URL(next, "https://www.facebook.com").toString();
    } catch (err) {
      return raw;
    }
  }

  function pushUnique(list, seen, raw) {
    var info = classifyFacebookUrl(raw);
    if (!info || seen[info.url]) return;
    seen[info.url] = true;
    list.push(info);
  }

  function extractFacebookLinks(text, extraUrls) {
    var source = String(text || "");
    var found = [];
    var seen = Object.create(null);
    var match;

    var hyper = source.match(HYPERLINK_RE);
    if (hyper && hyper[1]) pushUnique(found, seen, hyper[1]);

    URL_RE.lastIndex = 0;
    while ((match = URL_RE.exec(source))) {
      pushUnique(found, seen, match[0]);
    }

    BARE_FB_RE.lastIndex = 0;
    while ((match = BARE_FB_RE.exec(source))) {
      pushUnique(found, seen, match[1]);
    }

    FB_WATCH_RE.lastIndex = 0;
    while ((match = FB_WATCH_RE.exec(source))) {
      pushUnique(found, seen, match[0]);
    }

    if (extraUrls && extraUrls.length) {
      extraUrls.forEach(function (item) {
        pushUnique(found, seen, item);
      });
    }

    return found;
  }

  function playerSize(info, verticalOverride) {
    var vertical = typeof verticalOverride === "boolean" ? verticalOverride : !!(info && info.vertical);
    if (info && info.kind === "post" && !vertical) {
      return { width: 380, height: 520, iframeWidth: 380, iframeHeight: 480 };
    }
    if (vertical) {
      return { width: 320, height: 620, iframeWidth: 320, iframeHeight: 568 };
    }
    return { width: 480, height: 360, iframeWidth: 480, iframeHeight: 270 };
  }

  function buildEmbedSrc(info, options) {
    options = options || {};
    if (!info || !info.url) return "";
    var vertical = typeof options.vertical === "boolean" ? options.vertical : info.vertical;
    var forceKind = options.kind || info.kind;
    var size = playerSize({ kind: forceKind, vertical: vertical }, vertical);
    var width = options.width || size.iframeWidth;
    var height = options.height || size.iframeHeight;
    var href = encodeURIComponent(embedHref(info));
    if (forceKind === "post") {
      return (
        "https://www.facebook.com/plugins/post.php?href=" +
        href +
        "&show_text=true&width=" +
        width
      );
    }
    return (
      "https://www.facebook.com/plugins/video.php?href=" +
      href +
      "&show_text=false&width=" +
      width +
      "&height=" +
      height +
      "&t=0"
    );
  }

  return {
    FB_HOST_RE: FB_HOST_RE,
    isFacebookUrl: isFacebookUrl,
    isFacebookHost: isFacebookHost,
    canonicalizeFacebookUrl: canonicalizeFacebookUrl,
    classifyFacebookUrl: classifyFacebookUrl,
    extractFacebookLinks: extractFacebookLinks,
    extractVideoId: extractVideoId,
    toCanonicalVideoUrl: toCanonicalVideoUrl,
    needsResolve: needsResolve,
    embedHref: embedHref,
    pageHref: pageHref,
    parseFacebookMediaFromHtml: parseFacebookMediaFromHtml,
    unwrapLoginNext: unwrapLoginNext,
    extractPlayableFromHtml: extractPlayableFromHtml,
    candidateUrls: candidateUrls,
    playerSize: playerSize,
    buildEmbedSrc: buildEmbedSrc,
  };
});
