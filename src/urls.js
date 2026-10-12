/**
 * Facebook / Instagram / YouTube URL detection and embed helpers.
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
    igsh: 1,
    igshid: 1,
    img_index: 1,
    utm_source: 1,
    utm_medium: 1,
    utm_campaign: 1,
    utm_content: 1,
    utm_term: 1,
    si: 1,
    feature: 1,
    app: 1,
    pp: 1,
  };

  var KEEP_PARAMS = {
    v: 1,
    id: 1,
    story_fbid: 1,
    fbid: 1,
    video_id: 1,
    t: 1,
    start: 1,
  };

  var FB_HOST_RE =
    /^(?:www\.|m\.|web\.|mbasic\.|lm\.|l\.)?(?:facebook\.com|fb\.com|fb\.watch)$/i;

  var URL_RE =
    /https?:\/\/(?:www\.|m\.|web\.|mbasic\.|lm\.|l\.)?(?:facebook\.com|fb\.com|fb\.watch)\/[^\s<>"'）】\]]+/gi;

  var BARE_FB_RE =
    /(?:^|[\s"'=(（])((?:www\.)?facebook\.com\/[^\s<>"'）】\]]+)/gi;

  var FB_WATCH_RE = /(?:https?:\/\/)?fb\.watch\/[A-Za-z0-9_\-]+\/?/gi;

  var MEDIA_URL_RE =
    /https?:\/\/(?:www\.|m\.|web\.|mbasic\.|lm\.|l\.|music\.)?(?:facebook\.com|fb\.com|fb\.watch|instagram\.com|instagr\.am|youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s<>"'）】\]]+/gi;

  var BARE_MEDIA_RE =
    /(?:^|[\s"'=(（])((?:www\.)?(?:facebook\.com|instagram\.com|youtube\.com|youtu\.be)\/[^\s<>"'）】\]]+)/gi;

  var YT_BARE_RE = /(?:https?:\/\/)?(?:youtu\.be\/[A-Za-z0-9_-]{11}|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)[A-Za-z0-9_-]{11})[^\s<>"'）】\]]*/gi;

  var IG_BARE_RE =
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[A-Za-z0-9_-]+[^\s<>"'）】\]]*/gi;

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

  function isInstagramHost(hostname) {
    if (!hostname) return false;
    var host = String(hostname).toLowerCase().replace(/^www\./, "");
    return host === "instagram.com" || host === "instagr.am" || host.endsWith(".instagram.com");
  }

  function isYouTubeHost(hostname) {
    if (!hostname) return false;
    var host = String(hostname).toLowerCase().replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be" ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube.com") ||
      host.endsWith(".youtu.be") ||
      host.endsWith(".youtube-nocookie.com")
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
    if (
      /^(?:www\.)?(facebook\.com|fb\.com|fb\.watch|instagram\.com|instagr\.am|youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(
        text
      )
    ) {
      text = "https://" + text.replace(/^https?:\/\//i, "");
    }
    return text;
  }

  function unwrapRedirect(raw) {
    var text = normalizeCandidate(raw);
    if (!text) return "";
    try {
      var url = new URL(text);
      var host = url.hostname.toLowerCase().replace(/^www\./, "");

      if (isFacebookHost(url.hostname)) {
        if (url.pathname === "/l.php" || url.pathname === "/l.php/") {
          var nested = url.searchParams.get("u");
          if (nested) return unwrapRedirect(nested);
        }
        var next = url.searchParams.get("next");
        if (url.pathname.indexOf("login") !== -1 && next) {
          return unwrapRedirect(next);
        }
      }

      if (isInstagramHost(url.hostname) && (host === "l.instagram.com" || url.pathname === "/l.php")) {
        var igNested = url.searchParams.get("u");
        if (igNested) return unwrapRedirect(igNested);
      }

      if (
        (host === "google.com" || host.endsWith(".google.com")) &&
        (url.pathname === "/url" || url.pathname === "/url/")
      ) {
        var gq = url.searchParams.get("q") || url.searchParams.get("url");
        if (gq) return unwrapRedirect(gq);
      }

      return url.toString();
    } catch (err) {
      return text;
    }
  }

  function unwrapFacebookRedirect(raw) {
    return unwrapRedirect(raw);
  }

  function stripTracking(url) {
    url.hash = "";
    url.searchParams.forEach(function (_value, key) {
      var lower = key.toLowerCase();
      if (KEEP_PARAMS[lower]) return;
      if (TRACKING_PARAMS[lower] || lower.indexOf("_nc_") === 0 || lower.indexOf("__") === 0 || lower.indexOf("utm_") === 0) {
        url.searchParams.delete(key);
      }
    });
    var href = url.toString();
    if (href.endsWith("?")) href = href.slice(0, -1);
    return href;
  }

  function canonicalizeFacebookUrl(raw) {
    var unwrapped = unwrapRedirect(raw);
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

    if (
      host === "fb.com" ||
      host === "www.fb.com" ||
      host === "m.facebook.com" ||
      host === "web.facebook.com" ||
      host === "mbasic.facebook.com" ||
      host === "lm.facebook.com" ||
      host === "l.facebook.com"
    ) {
      url.hostname = "www.facebook.com";
    } else if (host === "facebook.com") {
      url.hostname = "www.facebook.com";
    }

    return stripTracking(url);
  }

  function fbInfo(urlStr, extra) {
    return Object.assign({ url: urlStr, platform: "facebook" }, extra);
  }

  function classifyFacebookUrl(raw) {
    var urlStr = canonicalizeFacebookUrl(raw);
    if (!urlStr) return null;
    var url = new URL(urlStr);
    var path = url.pathname.toLowerCase();
    var host = url.hostname.toLowerCase();

    if (host === "fb.watch" || host === "www.fb.watch") {
      return fbInfo(urlStr, { kind: "reel", label: "Reels", vertical: true, needsResolve: true });
    }
    if (/\/(?:reel|reels)\//.test(path) || /\/share\/r\//.test(path)) {
      return fbInfo(urlStr, { kind: "reel", label: "Reels", vertical: true });
    }
    if (/\/share\/v\//.test(path) || /\/videos?\//.test(path) || path.indexOf("/video.php") === 0) {
      return fbInfo(urlStr, { kind: "video", label: "视频", vertical: false });
    }
    if (path === "/watch" || path === "/watch/" || path.indexOf("/watch/") === 0) {
      return fbInfo(urlStr, { kind: "video", label: "视频", vertical: false });
    }
    if (/\/share\//.test(path)) {
      return fbInfo(urlStr, { kind: "reel", label: "分享", vertical: true, needsResolve: true });
    }
    var extracted = extractVideoId(urlStr);
    if (extracted && extracted.type === "compound") {
      return fbInfo(urlStr, {
        kind: "reel",
        label: "Reels",
        vertical: true,
        needsResolve: true,
      });
    }
    if (extracted && extracted.type === "reel") {
      return fbInfo(urlStr, { kind: "reel", label: "Reels", vertical: true });
    }
    if (extracted) {
      return fbInfo(urlStr, { kind: "video", label: "视频", vertical: false });
    }
    return fbInfo(urlStr, {
      kind: "video",
      label: "视频",
      vertical: /reel|share|watch/i.test(path),
      needsResolve: true,
    });
  }

  function isYouTubeId(id) {
    return /^[A-Za-z0-9_-]{11}$/.test(id || "");
  }

  function parseYouTubeStart(url) {
    var t = url.searchParams.get("t") || url.searchParams.get("start") || url.searchParams.get("time_continue");
    if (!t) {
      var hash = String(url.hash || "").replace(/^#/, "");
      var hm = hash.match(/(?:^|&)t=([^&]+)/);
      if (hm) t = hm[1];
    }
    if (!t) return 0;
    if (/^\d+$/.test(t)) return Number(t);
    var total = 0;
    var matched = false;
    var h = t.match(/(\d+)h/i);
    var m = t.match(/(\d+)m/i);
    var s = t.match(/(\d+)s/i);
    if (h) {
      total += Number(h[1]) * 3600;
      matched = true;
    }
    if (m) {
      total += Number(m[1]) * 60;
      matched = true;
    }
    if (s) {
      total += Number(s[1]);
      matched = true;
    }
    return matched ? total : 0;
  }

  function classifyYouTubeUrl(raw) {
    var text = unwrapRedirect(raw);
    if (!text) return null;
    var url;
    try {
      url = new URL(normalizeCandidate(text));
    } catch (err) {
      return null;
    }
    if (!isYouTubeHost(url.hostname)) return null;

    var host = url.hostname.toLowerCase().replace(/^www\./, "");
    var path = url.pathname;
    var id = "";
    var kind = "video";
    var label = "YouTube";
    var vertical = false;

    if (host === "youtu.be") {
      id = path.replace(/^\//, "").split("/")[0];
    } else {
      var shorts = path.match(/\/shorts\/([A-Za-z0-9_-]{11})/i);
      if (shorts) {
        id = shorts[1];
        kind = "short";
        label = "Shorts";
        vertical = true;
      }
      if (!id) {
        var embed = path.match(/\/(?:embed|v|live)\/([A-Za-z0-9_-]{11})/i);
        if (embed) id = embed[1];
      }
      if (!id) {
        var queryId = url.searchParams.get("v");
        if (isYouTubeId(queryId)) id = queryId;
      }
    }
    if (!isYouTubeId(id)) return null;

    var start = parseYouTubeStart(url);
    var canonical = "https://www.youtube.com/watch?v=" + id;
    if (kind === "short") canonical = "https://www.youtube.com/shorts/" + id;
    if (start) canonical += (canonical.indexOf("?") === -1 ? "?" : "&") + "t=" + start;

    return {
      url: canonical,
      originalUrl: text,
      platform: "youtube",
      kind: kind,
      label: label,
      vertical: vertical,
      videoId: id,
      start: start || 0,
    };
  }

  function classifyInstagramUrl(raw) {
    var text = unwrapRedirect(raw);
    if (!text) return null;
    var url;
    try {
      url = new URL(normalizeCandidate(text));
    } catch (err) {
      return null;
    }
    if (!isInstagramHost(url.hostname)) return null;

    var path = url.pathname;
    var shortcode = "";
    var kind = "post";
    var match = path.match(/\/(?:reel|reels)\/([A-Za-z0-9_-]{5,})/i);
    if (match) {
      shortcode = match[1];
      kind = "reel";
    }
    if (!shortcode) {
      match = path.match(/\/tv\/([A-Za-z0-9_-]{5,})/i);
      if (match) {
        shortcode = match[1];
        kind = "tv";
      }
    }
    if (!shortcode) {
      match = path.match(/\/p\/([A-Za-z0-9_-]{5,})/i);
      if (match) {
        shortcode = match[1];
        kind = "post";
      }
    }
    if (!shortcode) {
      match = path.match(/\/share\/(reel|p|tv)\/([A-Za-z0-9_-]{5,})/i);
      if (match) {
        shortcode = match[2];
        kind = match[1].toLowerCase() === "reel" ? "reel" : match[1].toLowerCase() === "tv" ? "tv" : "post";
      }
    }
    if (!shortcode) return null;

    var pathKind = kind === "reel" ? "reel" : kind === "tv" ? "tv" : "p";
    var canonical = "https://www.instagram.com/" + pathKind + "/" + shortcode + "/";
    return {
      url: canonical,
      originalUrl: text,
      platform: "instagram",
      kind: kind,
      label: kind === "reel" ? "IG Reels" : kind === "tv" ? "IGTV" : "Instagram",
      vertical: kind === "reel",
      shortcode: shortcode,
    };
  }

  function classifyUrl(raw) {
    var yt = classifyYouTubeUrl(raw);
    if (yt) return yt;
    var ig = classifyInstagramUrl(raw);
    if (ig) return ig;
    return classifyFacebookUrl(raw);
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
    var info = typeof raw === "object" && raw ? raw : classifyUrl(raw);
    if (!info) return false;
    if (info.platform && info.platform !== "facebook") return false;
    if (info.needsResolve) return true;
    if (/fb\.watch/i.test(info.url) || /\/share\//i.test(info.url)) return true;
    var extracted = extractVideoId(info.url);
    if (!extracted || extracted.type === "compound") return true;
    return false;
  }

  function embedHref(info) {
    if (!info || !info.url) return "";
    if (info.platform === "youtube") {
      if (info.videoId) {
        var href = "https://www.youtube.com/watch?v=" + info.videoId;
        if (info.start) href += "&t=" + info.start;
        return href;
      }
      return info.url;
    }
    if (info.platform === "instagram") {
      return info.url;
    }
    var extracted = extractVideoId(info.url);
    if (extracted && extracted.type === "compound") return "";
    if (extracted) return toCanonicalVideoUrl(extracted);
    if (/\/(?:reel|reels|videos?)\//i.test(info.url) || /\/watch/i.test(info.url)) {
      return info.url;
    }
    return "";
  }

  function pageHref(info) {
    return embedHref(info) || (info && info.url) || "";
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

  function pushUnique(list, seen, raw, classifier) {
    var info = (classifier || classifyFacebookUrl)(raw);
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

  function extractMediaLinks(text, extraUrls) {
    var source = String(text || "");
    var found = [];
    var seen = Object.create(null);
    var match;

    var hyper = source.match(HYPERLINK_RE);
    if (hyper && hyper[1]) pushUnique(found, seen, hyper[1], classifyUrl);

    MEDIA_URL_RE.lastIndex = 0;
    while ((match = MEDIA_URL_RE.exec(source))) {
      pushUnique(found, seen, match[0], classifyUrl);
    }

    BARE_MEDIA_RE.lastIndex = 0;
    while ((match = BARE_MEDIA_RE.exec(source))) {
      pushUnique(found, seen, match[1], classifyUrl);
    }

    FB_WATCH_RE.lastIndex = 0;
    while ((match = FB_WATCH_RE.exec(source))) {
      pushUnique(found, seen, match[0], classifyUrl);
    }

    YT_BARE_RE.lastIndex = 0;
    while ((match = YT_BARE_RE.exec(source))) {
      pushUnique(found, seen, match[0], classifyUrl);
    }

    IG_BARE_RE.lastIndex = 0;
    while ((match = IG_BARE_RE.exec(source))) {
      pushUnique(found, seen, match[0], classifyUrl);
    }

    if (extraUrls && extraUrls.length) {
      extraUrls.forEach(function (item) {
        pushUnique(found, seen, item, classifyUrl);
      });
    }

    return found;
  }

  function playerSize(info, verticalOverride) {
    var vertical = typeof verticalOverride === "boolean" ? verticalOverride : !!(info && info.vertical);
    var platform = info && info.platform;
    if (platform === "youtube" && !vertical) {
      return { width: 480, height: 360, iframeWidth: 480, iframeHeight: 270 };
    }
    if (platform === "instagram" && !vertical) {
      return { width: 380, height: 560, iframeWidth: 380, iframeHeight: 508 };
    }
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
    var size = playerSize({ kind: forceKind, vertical: vertical, platform: info.platform }, vertical);
    var width = options.width || size.iframeWidth;
    var height = options.height || size.iframeHeight;

    if (info.platform === "youtube" && info.videoId) {
      var qs = "autoplay=1&rel=0&modestbranding=1&playsinline=1";
      if (info.start) qs += "&start=" + info.start;
      return "https://www.youtube-nocookie.com/embed/" + info.videoId + "?" + qs;
    }
    if (info.platform === "instagram" && info.shortcode) {
      var igPath = info.kind === "reel" ? "reel" : info.kind === "tv" ? "tv" : "p";
      return "https://www.instagram.com/" + igPath + "/" + info.shortcode + "/embed/";
    }

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

  function parseHttpsUrl(value) {
    try {
      var url = new URL(String(value || ""));
      if (url.protocol !== "https:") return null;
      return url;
    } catch (err) {
      return null;
    }
  }

  function isAllowedPageUrl(value) {
    var url = parseHttpsUrl(value);
    if (!url) return false;
    return isFacebookHost(url.hostname) || isInstagramHost(url.hostname) || isYouTubeHost(url.hostname);
  }

  function isAllowedEmbedSrc(value) {
    var url = parseHttpsUrl(value);
    if (!url) return false;
    var host = url.hostname.toLowerCase();
    var path = url.pathname;
    if (isFacebookHost(host)) {
      if (/\/plugins\/(?:video|post)\.php$/i.test(path)) return true;
      if (/\/(?:reel|reels|watch|videos?)\//i.test(path) || path === "/watch" || path === "/watch/") return true;
      return false;
    }
    if (isInstagramHost(host)) {
      return /\/(?:reel|p|tv)\/[A-Za-z0-9_-]+\/embed\/?$/i.test(path);
    }
    if (host === "www.youtube-nocookie.com" || host === "youtube-nocookie.com" || host === "www.youtube.com" || host === "youtube.com") {
      return /^\/embed\/[A-Za-z0-9_-]{11}$/.test(path);
    }
    return false;
  }

  function isAllowedFetchUrl(value) {
    var url = parseHttpsUrl(canonicalizeFacebookUrl(value) || value);
    if (!url) return false;
    return isFacebookHost(url.hostname);
  }

  return {
    FB_HOST_RE: FB_HOST_RE,
    isFacebookUrl: isFacebookUrl,
    isFacebookHost: isFacebookHost,
    isInstagramHost: isInstagramHost,
    isYouTubeHost: isYouTubeHost,
    canonicalizeFacebookUrl: canonicalizeFacebookUrl,
    classifyFacebookUrl: classifyFacebookUrl,
    classifyInstagramUrl: classifyInstagramUrl,
    classifyYouTubeUrl: classifyYouTubeUrl,
    classifyUrl: classifyUrl,
    extractFacebookLinks: extractFacebookLinks,
    extractMediaLinks: extractMediaLinks,
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
    isAllowedPageUrl: isAllowedPageUrl,
    isAllowedEmbedSrc: isAllowedEmbedSrc,
    isAllowedFetchUrl: isAllowedFetchUrl,
  };
});
