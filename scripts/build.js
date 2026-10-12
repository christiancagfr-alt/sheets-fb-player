const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const files = [
  "manifest.json",
  "background.js",
  "player.html",
  "player.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "update.html",
  "update-page.js",
  "rules.json",
  "README.md",
  "使用说明.txt",
];
const dirs = ["icons", "src"];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of files) {
  const from = path.join(root, file);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dist, file));
}
for (const dir of dirs) {
  const from = path.join(root, dir);
  if (fs.existsSync(from)) copyDir(from, path.join(dist, dir));
}

if (!fs.existsSync(path.join(dist, "manifest.json"))) {
  throw new Error("dist/manifest.json missing");
}

console.log("built dist/");
