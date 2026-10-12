const assert = require("assert");
const update = require("../src/update.js");

assert.deepStrictEqual(update.parseVersion("v1.2.1"), [1, 2, 1]);
assert.deepStrictEqual(update.parseVersion("1.3.0"), [1, 3, 0]);
assert.strictEqual(update.parseVersion("nope"), null);
assert.strictEqual(update.compareVersions("1.3.0", "1.2.1"), 1);
assert.strictEqual(update.compareVersions("1.2.1", "1.3.0"), -1);
assert.strictEqual(update.compareVersions("1.2.1", "1.2.1"), 0);
assert.strictEqual(update.isNewerVersion("1.3.0", "1.2.1"), true);
assert.strictEqual(update.isNewerVersion("1.2.1", "1.3.0"), false);

const tag = "v1.3.0";
const goodZip =
  "https://github.com/christiancagfr-alt/sheets-fb-player/releases/download/v1.3.0/sheets-fb-player-v1.3.0.zip";
assert.strictEqual(update.isAllowedZipUrl(goodZip, tag), true);
assert.strictEqual(update.isAllowedZipUrl("https://evil.example/sheets-fb-player-v1.3.0.zip", tag), false);
assert.strictEqual(
  update.isAllowedZipUrl(
    "https://github.com/other/sheets-fb-player/releases/download/v1.3.0/sheets-fb-player-v1.3.0.zip",
    tag
  ),
  false
);
assert.strictEqual(update.isAllowedZipUrl("javascript:alert(1)", tag), false);
assert.strictEqual(
  update.isAllowedReleasePage("https://github.com/christiancagfr-alt/sheets-fb-player/releases/tag/v1.3.0", tag),
  true
);

const picked = update.pickReleaseAsset({
  tag_name: "v1.3.0",
  draft: false,
  prerelease: false,
  html_url: "https://github.com/christiancagfr-alt/sheets-fb-player/releases/tag/v1.3.0",
  assets: [
    {
      name: "sheets-fb-player-v1.3.0.zip",
      browser_download_url: goodZip,
      uploader: { login: "github-actions[bot]" },
    },
  ],
});
assert.ok(picked);
assert.strictEqual(picked.version, "1.3.0");
assert.strictEqual(picked.zipUrl, goodZip);

assert.strictEqual(
  update.pickReleaseAsset({
    tag_name: "v1.3.0",
    assets: [
      {
        name: "sheets-fb-player-v1.3.0.zip",
        browser_download_url: goodZip,
        uploader: { login: "attacker" },
      },
    ],
  }),
  null
);

assert.strictEqual(
  update.pickReleaseAsset({
    tag_name: "v1.3.0",
    prerelease: true,
    assets: [
      {
        name: "sheets-fb-player-v1.3.0.zip",
        browser_download_url: goodZip,
        uploader: { login: "github-actions[bot]" },
      },
    ],
  }),
  null
);

console.log("ok — " + module.filename);
