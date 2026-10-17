# 下一步 · PWA v0.2

一个低压力任务助手。无需服务器、账号或 Apple 开发者签名。

## 功能

- 首页一次只推荐一件事：开始、完成、换一件、暂时不做。
- 一次性任务和循环任务（每天、每周、每月、完成后隔三天）。循环任务完成后不会累积历史欠账。
- 紧迫程度、截止日期、精力与时间匹配、有限等待时间加权、防止任务无限沉底。
- 本地保存；可导出 JSON 备份并恢复。无提醒推送、无完成率和连续打卡。

## 免费部署到 GitHub Pages

1. 在 GitHub 新建**公开（Public）**仓库，例如 `NextStep-PWA`。不要上传任何个人任务备份文件。仓库公开的是代码，不是手机上的任务数据。
2. 解压 ZIP，把 `index.html`、`styles.css`、`app.js`、`sw.js`、`manifest.webmanifest`、三个 `icon-*.png`、`README.md` 全部上传到仓库根目录，提交更改。
3. 仓库 `Settings` → `Pages` → `Build and deployment` → `Source: Deploy from a branch` → `Branch: main`、`/(root)` → `Save`。
4. 等待 GitHub Pages 发布。地址通常是 `https://你的用户名.github.io/NextStep-PWA/`。
5. 用 iPhone 的 **Safari** 打开该 HTTPS 地址 → 分享 → **添加到主屏幕**。之后可像 App 一样启动。

如果已有私人 iOS 源码仓库，建议单独创建一个公开的 PWA 仓库，避免改变原仓库隐私设置。

## 本地测试

在此文件夹运行 `python3 -m http.server 8080`，然后在浏览器打开 `http://localhost:8080`。离线缓存功能需要 HTTPS（GitHub Pages 会提供）。

## 数据与限制

- 任务存在当前设备的浏览器本地存储 `localStorage` 中，不会上传到 GitHub 或任何后端。
- 清除网站数据、切换设备或浏览器，可能无法保留原任务。建议偶尔在“所有任务”页面点击“备份”。
- 不支持原生 iOS 系统通知、云同步或从原生 SwiftUI 版本自动迁移数据。
- 推荐算法是启发式权重，不是已经经过行为科学实验校准的模型。
- 如果后续更新页面代码，GitHub Pages 发布和 Service Worker 更新可能存在短暂缓存延迟。
