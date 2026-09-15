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

console.log("ok — " + module.filename);
