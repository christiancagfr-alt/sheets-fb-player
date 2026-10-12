/**
 * GitHub release update helpers. Works in the service worker and Node tests.
 */
(function (root, factory) {
  var exported = factory();
  root.FbSheetsUpdate = exported;
  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var REPO = "christiancagfr-alt/sheets-fb-player";
  var TAG_RE = /^v\d+\.\d+\.\d+$/;
  var BOT = "github-actions[bot]";

  function parseVersion(raw) {
    var text = String(raw || "")
      .trim()
      .replace(/^v/i, "");
    var parts = text.split(".");
    if (parts.length < 3) return null;
    var nums = [];
    var i;
    for (i = 0; i < 3; i++) {
      if (!/^\d+$/.test(parts[i])) return null;
      nums.push(Number(parts[i]));
    }
    return nums;
  }

  function compareVersions(a, b) {
    var pa = parseVersion(a);
    var pb = parseVersion(b);
    if (!pa || !pb) return 0;
    var i;
    for (i = 0; i < 3; i++) {
      if (pa[i] > pb[i]) return 1;
      if (pa[i] < pb[i]) return -1;
    }
    return 0;
  }

  function isNewerVersion(latest, current) {
    return compareVersions(latest, current) > 0;
  }

  function zipNameForTag(tag) {
    return "sheets-fb-player-" + tag + ".zip";
  }

  function isAllowedZipUrl(url, tag) {
    if (!TAG_RE.test(tag || "")) return false;
    try {
      var parsed = new URL(String(url || ""));
      if (parsed.protocol !== "https:") return false;
      if (parsed.hostname !== "github.com") return false;
      return parsed.pathname === "/" + REPO + "/releases/download/" + tag + "/" + zipNameForTag(tag);
    } catch (err) {
      return false;
    }
  }

  function isAllowedReleasePage(url, tag) {
    if (!TAG_RE.test(tag || "")) return false;
    try {
      var parsed = new URL(String(url || ""));
      if (parsed.protocol !== "https:") return false;
      if (parsed.hostname !== "github.com") return false;
      return parsed.pathname === "/" + REPO + "/releases/tag/" + tag;
    } catch (err) {
      return false;
    }
  }

  function latestApiUrl() {
    return "https://api.github.com/repos/" + REPO + "/releases/latest";
  }

  function pickReleaseAsset(release) {
    if (!release || release.draft || release.prerelease) return null;
    var tag = String(release.tag_name || "");
    if (!TAG_RE.test(tag)) return null;
    var expected = zipNameForTag(tag);
    var assets = release.assets || [];
    var i;
    for (i = 0; i < assets.length; i++) {
      var asset = assets[i];
      if (!asset || asset.name !== expected) continue;
      if (!asset.uploader || asset.uploader.login !== BOT) continue;
      if (!isAllowedZipUrl(asset.browser_download_url, tag)) continue;
      var page = String(release.html_url || "");
      if (page && !isAllowedReleasePage(page, tag)) page = "https://github.com/" + REPO + "/releases/tag/" + tag;
      if (!page) page = "https://github.com/" + REPO + "/releases/tag/" + tag;
      return {
        version: tag.slice(1),
        tag: tag,
        zipUrl: asset.browser_download_url,
        releaseUrl: page,
        zipName: expected,
      };
    }
    return null;
  }

  return {
    REPO: REPO,
    parseVersion: parseVersion,
    compareVersions: compareVersions,
    isNewerVersion: isNewerVersion,
    zipNameForTag: zipNameForTag,
    isAllowedZipUrl: isAllowedZipUrl,
    isAllowedReleasePage: isAllowedReleasePage,
    latestApiUrl: latestApiUrl,
    pickReleaseAsset: pickReleaseAsset,
  };
});
