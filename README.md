# 听歌手记 · Music Journal

- `index.html`：日常音乐数据记录页（常听 / 艺人 / 红心年轮 / 年代 / 本周 / 歌单）
- `2026/index.html`：2026 年度报告（主页的子页面，地址 /2026/）（A/B 面十轨 + 封底曲目表）
- `fetch_data.py`：刷新数据 → `data/music.js`
- `data/listen2026.js`：网易云月度听歌报告（时长、年历、时段、深夜、每月主打），需登录态，由 Claude 在已登录的浏览器里读取
- `data/playcounts.json`：登录态才拿得到的精确播放次数（可选，缺失时按 score 估算）

刷新：

    python3 fetch_data.py

设计方向（v2）：纯黑白 + 粗体窄无衬线（Archivo），颜色只来自你的专辑封面。
年度报告每一章的底色，从那一章主角的封面里自动取色。
参考：NTS、Warp、ECM、XL Recordings 官网，以及 Apple Music 的封面取色。

## v3 · 唱片元素
把整个网站当成一张唱片来做，只用黑白与封面原色：
- 回到顶部：小黑胶（`assets/record.js`），随滚动转动，外圈是阅读进度，中心标签是第一名 / 年度之歌的封面。
- 年度报告分 Side A / Side B（A1–A5、B1–B5），中间有一段"翻面"；封面写目录号 JL–2026 · 33⅓ RPM。
- 每月听歌的脉冲叠线图（参考 Joy Division《Unknown Pleasures》封面）。
- 年度之歌：唱片从封套里滑出，按 33⅓ 转旋转。
- 红心曲目单按 liner notes 写法给出每首时长和总时长；主页 Top 100 也加了时长。
- 主页歌单悬停时唱片从封套里抽出一截；顶栏的均衡器表示“正在听”。

## 给别人用：make/
分享链接：https://jonilin0210.github.io/music-journal/make/
1. 访客把页面上的“听歌手记”书签拖到书签栏；
2. 在已登录的 music.163.com 点书签 → `make/collect.js` 在他自己的浏览器里读取数据（排行、歌单、红心、月报）；
3. 数据 gzip 压缩后放在网址 `#` 后面打开 `make/receive.html`（`#` 后的内容不会发给服务器），存进 localStorage，跳转到 `/?me` 和 `/2026/?me`。
- `assets/source.js`：带 `?me` 时改读本地数据；转义字符串、只放行网易云图床；左下角提供下载单文件 / 重新生成 / 清除。
- 页面每个章节独立渲染，数据不全的章节自动隐藏。
- 统计：`assets/stats.js` 里填 GoatCounter 站点代码。记录页面访问（访客本地页面记在 `/me/...` 下）和事件：`event/generated`（生成次数）、`event/bookmark-drag`、`event/download`。不记录任何听歌数据。

## 唱片内页 Liner Notes
点开 Top 100 里的任意一首、榜上的艺人，或主页第 03 节的专题，从右边抽出一页“内页”。
- `data/credits.js`：`python3 fetch_credits.py` 生成。网易云公开接口里的署名（作词/作曲/编曲/制作，取自歌词开头的署名行，不保存歌词）、专辑发行时间与厂牌、艺人照片与作品数。
- `data/notes.js`：手写的背景笔记（5 位艺人、6 首歌、3 张专辑）。由公开资料整理、交叉核对后重写；只有单一来源或只见于搜索摘要的说法已删除或在 `caveat` 中注明；每条附资料来源。
- `assets/liner.js`：抽屉组件。任何带 `data-note="song:ID"` / `artist:名字` / `album:专辑名` 的元素都能点开；支持 `#notes/...` 直达、Esc 关闭、←/→ 翻页。访客本地版本不启用。
