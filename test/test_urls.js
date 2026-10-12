const assert = require("assert");
const {
  extractFacebookLinks,
  classifyFacebookUrl,
  canonicalizeFacebookUrl,
  buildEmbedSrc,
} = require("../src/urls.js");

function urls(text, extra) {
  return extractFacebookLinks(text, extra).map((item) => item.url);
}

function kinds(text) {
  return extractFacebookLinks(text).map((item) => item.kind);
}

assert.deepStrictEqual(
  urls("https://www.facebook.com/reel/1234567890123456"),
  ["https://www.facebook.com/reel/1234567890123456"]
);

assert.strictEqual(
  classifyFacebookUrl("https://www.facebook.com/reel/1234567890123456").kind,
  "reel"
);
assert.strictEqual(
  classifyFacebookUrl("https://www.facebook.com/reel/1234567890123456").vertical,
  true
);

assert.strictEqual(
  classifyFacebookUrl("https://www.facebook.com/watch/?v=111&fbclid=abc").kind,
  "video"
);
assert.ok(
  canonicalizeFacebookUrl("https://www.facebook.com/watch/?v=111&fbclid=abc").indexOf("fbclid") === -1
);
assert.ok(
  canonicalizeFacebookUrl("https://www.facebook.com/watch/?v=111&fbclid=abc").indexOf("v=111") !== -1
);

assert.strictEqual(
  classifyFacebookUrl("https://www.facebook.com/foo/videos/222/").kind,
  "video"
);

assert.strictEqual(
  classifyFacebookUrl("https://fb.watch/abcDE12/").kind,
  "reel"
);
assert.strictEqual(
  canonicalizeFacebookUrl("https://fb.watch/abcDE12"),
  "https://fb.watch/abcDE12/"
);

assert.strictEqual(
  classifyFacebookUrl("https://www.facebook.com/share/r/1AbCDefG/").kind,
  "reel"
);
assert.strictEqual(
  classifyFacebookUrl("https://www.facebook.com/share/v/1AbCDefG/").kind,
  "video"
);

assert.deepStrictEqual(
  urls('=HYPERLINK("https://www.facebook.com/reel/999","看这个")'),
  ["https://www.facebook.com/reel/999"]
);
assert.deepStrictEqual(
  urls("=HYPERLINK(\"https://www.facebook.com/reel/999\";\"看这个\")"),
  ["https://www.facebook.com/reel/999"]
);

assert.deepStrictEqual(
  urls("请看 https://m.facebook.com/reel/555/?refsrc=deprecated。"),
  ["https://www.facebook.com/reel/555/"]
);

assert.deepStrictEqual(
  urls("www.facebook.com/reel/321"),
  ["https://www.facebook.com/reel/321"]
);

assert.strictEqual(
  canonicalizeFacebookUrl(
    "https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.facebook.com%2Freel%2F777"
  ),
  "https://www.facebook.com/reel/777"
);

assert.strictEqual(
  classifyFacebookUrl("https://www.facebook.com/groups/123/posts/456/").kind,
  "video"
);
assert.strictEqual(
  require("../src/urls.js").needsResolve("https://fb.watch/abcDE12/"),
  true
);
assert.strictEqual(
  require("../src/urls.js").needsResolve("https://www.facebook.com/share/r/1AbCDefG/"),
  true
);
assert.strictEqual(
  require("../src/urls.js").extractVideoId("https://www.facebook.com/reel/1234567890123456").id,
  "1234567890123456"
);
assert.strictEqual(
  require("../src/urls.js").embedHref(
    classifyFacebookUrl("https://www.facebook.com/reel/1234567890123456")
  ),
  "https://www.facebook.com/reel/1234567890123456/"
);
assert.ok(
  require("../src/urls.js").parseFacebookMediaFromHtml(
    '<meta property="og:url" content="https://www.facebook.com/reel/555666777/" />',
    "https://fb.watch/abc/"
  ).indexOf("reel/555666777") !== -1
);

assert.deepStrictEqual(urls("https://youtube.com/watch?v=abc"), []);
assert.deepStrictEqual(kinds("no links here"), []);

const {
  extractMediaLinks,
  classifyUrl,
  classifyYouTubeUrl,
  classifyInstagramUrl,
  buildEmbedSrc: buildSrc,
} = require("../src/urls.js");

function mediaUrls(text, extra) {
  return extractMediaLinks(text, extra).map((item) => item.url);
}

assert.strictEqual(classifyYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ").platform, "youtube");
assert.strictEqual(classifyYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ");
assert.strictEqual(classifyYouTubeUrl("https://youtu.be/dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ");
assert.strictEqual(classifyYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ").kind, "short");
assert.strictEqual(classifyYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ").vertical, true);
assert.strictEqual(classifyYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=90").start, 90);
assert.strictEqual(classifyYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=1m30s").start, 90);
assert.ok(
  buildSrc(classifyYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), {}).indexOf(
    "youtube-nocookie.com/embed/dQw4w9WgXcQ"
  ) !== -1
);
assert.ok(
  buildSrc(classifyYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=15"), {}).indexOf("start=15") !== -1
);
assert.strictEqual(classifyUrl("https://youtu.be/dQw4w9WgXcQ?si=abc").platform, "youtube");
assert.strictEqual(
  classifyUrl("https://www.google.com/url?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ").videoId,
  "dQw4w9WgXcQ"
);

assert.strictEqual(classifyInstagramUrl("https://www.instagram.com/reel/AbC123_-xy/").platform, "instagram");
assert.strictEqual(classifyInstagramUrl("https://www.instagram.com/reel/AbC123_-xy/").shortcode, "AbC123_-xy");
assert.strictEqual(classifyInstagramUrl("https://www.instagram.com/reel/AbC123_-xy/").kind, "reel");
assert.strictEqual(classifyInstagramUrl("https://www.instagram.com/p/AbC123_-xy/").kind, "post");
assert.strictEqual(classifyInstagramUrl("https://www.instagram.com/tv/AbC123_-xy/").kind, "tv");
assert.strictEqual(
  classifyInstagramUrl("https://www.instagram.com/reel/AbC123_-xy/?igsh=xyz").url,
  "https://www.instagram.com/reel/AbC123_-xy/"
);
assert.ok(
  buildSrc(classifyInstagramUrl("https://www.instagram.com/reel/AbC123_-xy/"), {}).indexOf(
    "instagram.com/reel/AbC123_-xy/embed/"
  ) !== -1
);
assert.ok(
  buildSrc(classifyInstagramUrl("https://www.instagram.com/p/AbC123_-xy/"), {}).indexOf(
    "instagram.com/p/AbC123_-xy/embed/"
  ) !== -1
);
assert.strictEqual(classifyInstagramUrl("https://www.instagram.com/someone/"), null);
assert.deepStrictEqual(mediaUrls("https://www.instagram.com/reel/AbC123_-xy/"), [
  "https://www.instagram.com/reel/AbC123_-xy/",
]);
assert.deepStrictEqual(mediaUrls("看这个 https://youtu.be/dQw4w9WgXcQ"), [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
]);
assert.deepStrictEqual(
  mediaUrls('=HYPERLINK("https://www.instagram.com/p/AbC123_-xy/","图")'),
  ["https://www.instagram.com/p/AbC123_-xy/"]
);
assert.strictEqual(classifyUrl("https://www.facebook.com/reel/1234567890123456").platform, "facebook");
assert.strictEqual(
  require("../src/urls.js").needsResolve("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
  false
);
assert.strictEqual(
  require("../src/urls.js").needsResolve("https://www.instagram.com/reel/AbC123_-xy/"),
  false
);

const embed = buildEmbedSrc(
  classifyFacebookUrl("https://www.facebook.com/reel/123"),
  {}
);
assert.ok(embed.indexOf("plugins/video.php") !== -1);
assert.ok(embed.indexOf(encodeURIComponent("https://www.facebook.com/reel/123")) !== -1);

const postEmbed = buildEmbedSrc(
  classifyFacebookUrl("https://www.facebook.com/someone/posts/1"),
  { kind: "post" }
);
assert.ok(postEmbed.indexOf("plugins/post.php") !== -1);

const videoEmbed = buildEmbedSrc(
  classifyFacebookUrl("https://www.facebook.com/someone/posts/1"),
  {}
);
assert.ok(videoEmbed.indexOf("plugins/video.php") !== -1);

assert.strictEqual(
  require("../src/urls.js").embedHref(
    classifyFacebookUrl("https://www.facebook.com/1071281142731171_122119632170812452")
  ),
  ""
);
assert.strictEqual(
  require("../src/urls.js").needsResolve(
    "https://www.facebook.com/1071281142731171_122119632170812452"
  ),
  true
);
assert.strictEqual(
  classifyFacebookUrl("https://www.facebook.com/1138901695966446_122101798796345877").kind,
  "reel"
);
assert.ok(
  require("../src/urls.js")
    .extractPlayableFromHtml(
      '"browser_native_hd_url":"https:\\/\\/video.xx.fbcdn.net\\/v\\/t.mp4?abc=1"'
    )
    .indexOf("fbcdn.net") !== -1
);

const urlsApi = require("../src/urls.js");
assert.strictEqual(urlsApi.isAllowedPageUrl("javascript:alert(1)"), false);
assert.strictEqual(urlsApi.isAllowedPageUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ"), false);
assert.strictEqual(urlsApi.isAllowedPageUrl("https://evil.example/watch?v=dQw4w9WgXcQ"), false);
assert.strictEqual(urlsApi.isAllowedPageUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), true);
assert.strictEqual(urlsApi.isAllowedEmbedSrc("javascript:alert(1)"), false);
assert.strictEqual(
  urlsApi.isAllowedEmbedSrc("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"),
  true
);
assert.strictEqual(
  urlsApi.isAllowedEmbedSrc("https://www.instagram.com/reel/AbC123_-xy/embed/"),
  true
);
assert.strictEqual(
  urlsApi.isAllowedEmbedSrc("https://www.instagram.com/reel/AbC123_-xy/"),
  false
);
assert.strictEqual(
  urlsApi.isAllowedEmbedSrc(
    urlsApi.buildEmbedSrc(urlsApi.classifyFacebookUrl("https://www.facebook.com/reel/1234567890123456"), {})
  ),
  true
);
assert.strictEqual(urlsApi.isAllowedFetchUrl("https://evil.example/"), false);
assert.strictEqual(urlsApi.isAllowedFetchUrl("https://www.facebook.com/reel/1234567890123456"), true);

console.log("ok — " + module.filename);
