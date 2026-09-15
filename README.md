# 表格 FB 悬浮播放

Chrome 扩展：在 **Google 表格** 里用鼠标选中（或悬停）Facebook / Reels 链接时，弹出悬浮窗播放视频。

支持常见链接：

- `facebook.com/reel/...`、`facebook.com/reels/...`
- `facebook.com/watch?v=...`、`facebook.com/.../videos/...`
- `facebook.com/{主页ID}_{贴文ID}`
- `facebook.com/share/r/...`、`facebook.com/share/v/...`
- `fb.watch/...`、`m.facebook.com/...`
- 单元格里的 `=HYPERLINK("https://www.facebook.com/...")`

## 下载

从 [Releases](https://github.com/secure-artifacts/sheets-fb-player/releases) 页面下载最新版本的 zip。

## 安装（开发者模式）

1. 下载 Release 中的 `sheets-fb-player-vX.Y.Z.zip`
2. 解压到一个稳定目录（不要解压后删除或移动该文件夹）
3. 打开 Chrome，地址栏进入 `chrome://extensions`
4. 右上角打开 **开发者模式**
5. 点击 **加载已解压的扩展程序**
6. 选择解压后的文件夹（里面直接就是 `manifest.json`）
7. 打开任意 Google 表格，**刷新页面**后选中含 Facebook 链接的单元格

Chrome 顶部可能出现开发者模式提示条，这是「加载已解压扩展」的正常现象。

## 验证软件来源

下载后，可使用 GitHub CLI 验证文件来源：

```bash
gh attestation verify ./sheets-fb-player-v1.1.5.zip --repo secure-artifacts/sheets-fb-player
```

验证成功表示该软件确实由官方 CI 构建。

## 用法

| 操作 | 效果 |
| --- | --- |
| 单击含 FB 链接的单元格 | 右侧弹出悬浮播放器 |
| 悬停在可点击的 FB 链接 / 链接气泡上 | 延迟后播放 |
| 拖动播放器顶栏 | 移动窗口 |
| 右下角拖动 | 缩放 |
| `Alt + V` | 强制播放当前单元格 |
| `Esc` | 关闭悬浮窗 |
| 顶栏 📌 | 固定窗口，换单元格也不关 |
| 顶栏 ▯ | 竖屏 / 横屏 |
| 扩展图标 | 开关、悬停、独立窗口等设置 |

## 播放限制

悬浮窗使用 Facebook 官方嵌入播放器，**不会破解或下载视频**：

- 公开 Reels / 视频一般可以直接播
- 表格里的 `主页ID_贴文ID` 链接会先解析成真正的 Reels 地址再播放
- 非公开内容可能无法嵌入

## 如何发布新版本

本项目使用 GitHub Actions 自动构建和发布。每次发布新版本只需要创建一个 Git Tag 并推送即可。

### 发布步骤

#### 1. 确保代码已提交并推送

```bash
git status
git add .
git commit -m "你的改动说明"
git push origin main
```

#### 2. 创建版本 Tag

版本号格式为 `v主版本.次版本.修订版本`，例如 `v1.0.0`、`v1.1.0`、`v2.0.0`。

```bash
git tag -a v1.1.5 -m "Release version 1.1.5"
```

#### 3. 推送 Tag 触发自动构建

```bash
git push origin v1.1.5
```

推送后，GitHub Actions 会自动：

1. 构建项目
2. 生成安全签名（Attestation）
3. 创建 Release 并上传 zip 产物

#### 4. 查看构建结果

- 构建进度：访问项目的 **Actions** 页面
- 发布结果：访问项目的 **Releases** 页面

### 版本号说明

| 版本号格式 | 什么时候用 | 示例 |
|-----------|-----------|------|
| `vX.0.0` | 重大更新、不兼容改动 | `v2.0.0` |
| `vX.Y.0` | 新增功能 | `v1.1.0` |
| `vX.Y.Z` | 修复 bug | `v1.0.1` |

### 如果构建失败怎么办

1. 访问项目的 **Actions** 页面查看错误日志
2. 修复代码问题
3. 删除失败的 tag 并重新创建：

```bash
git tag -d v1.1.5
git push origin :refs/tags/v1.1.5
git tag -a v1.1.5 -m "Release version 1.1.5"
git push origin v1.1.5
```

## 本地开发

```bash
npm test
npm run build
```

构建产物在 `dist/`，解压后根目录即为 `manifest.json`。
