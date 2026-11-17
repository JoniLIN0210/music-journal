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
