/* 使用统计：GoatCounter（免费、开源、不用 cookie，不记录任何听歌数据）。
   在 goatcounter.com 注册后，把站点代码填到 MJ_GC，例如 'jonilin-music'。留空则不统计。 */
window.MJ_GC = '';
(() => {
  const queue = [];
  window.mjCount = (path, title) => { const ev = { path, title: title || path, event: true };
    window.goatcounter && window.goatcounter.count ? window.goatcounter.count(ev) : queue.push(ev); };
  if (!window.MJ_GC || /^(localhost|127\.)/.test(location.hostname)) return;
  // 别人本地生成的页面单独记在 /me/... 下，和我自己的页面分开
  const local = new URLSearchParams(location.search).has('me');
  window.goatcounter = { path: p => (local ? '/me' : '') + location.pathname };
  const s = document.createElement('script');
  s.async = true; s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${window.MJ_GC}.goatcounter.com/count`;
  s.onload = () => queue.splice(0).forEach(ev => window.goatcounter.count(ev));
  document.head.appendChild(s);
})();
