/* 数据来源切换：
   - 默认：读我自己的 data/music.js、data/listen2026.js
   - 地址带 ?me：读这台电脑浏览器里保存的、访客自己生成的数据（localStorage，不上传任何地方） */
(() => {
  const ROOT = new URL('..', document.currentScript.src).href;
  window.MJ_ROOT = ROOT;
  window.MJ_LOCAL = new URLSearchParams(location.search).has('me');
  if (!window.MJ_LOCAL) return;
  let d = null;
  try { d = JSON.parse(localStorage.getItem('mj:data')); } catch (e) {}
  if (!d || !d.music) { location.replace(ROOT + 'make/'); throw new Error('no local data'); }
  // 页面用 innerHTML 拼接，访客数据里的字符串先转义
  const esc = v => typeof v === 'string' ? v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
    : Array.isArray(v) ? v.map(esc) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, esc(x)])) : v;
  const IMG = /^https:\/\/[\w.-]+\.(126|163)\.net\//;
  // 图片只接受网易云自己的图床地址
  const clean = v => typeof v === 'string' ? (/^\s*(javascript|data|vbscript|https?|file|blob):/i.test(v) && !IMG.test(v) ? '' : v) : Array.isArray(v) ? v.map(clean)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) : v;
  d.music = clean(d.music); if (d.listen) d.listen = clean(d.listen);
  window.MUSIC = esc(d.music);
  window.LISTEN = d.listen ? esc(d.listen) : null;
  window.MJ_RAW = d;
  window.MJ_NICK = d.music.profile.nick;   // 纯文本场景（标题等）用未转义的昵称

  document.addEventListener('DOMContentLoaded', () => {
    // 站内链接带上 ?me
    document.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href');
      if (/^(\.\.\/|\.\/|2026\/)$/.test(h)) a.setAttribute('href', h + '?me'); });
    const bar = document.createElement('div');
    bar.className = 'mj-bar cap';
    bar.innerHTML = `<span>本地版本 · 只存在这台电脑</span><button data-a="dl">下载这一页</button><button data-a="new">重新生成</button><button data-a="clear">清除数据</button>`;
    bar.onclick = e => { const a = e.target.dataset.a;
      if (a === 'dl') download();
      if (a === 'new') location.href = ROOT + 'make/';
      if (a === 'clear' && confirm('清除这台电脑上保存的听歌数据？')) { localStorage.removeItem('mj:data'); location.href = ROOT + 'make/'; } };
    document.body.appendChild(bar);
  });

  // 把当前页打包成一个独立的 HTML 文件（样式、脚本、数据都内联）
  async function download() {
    const get = u => fetch(u).then(r => r.text());
    const inline = s => s.replace(/<\/script/gi, '<\\/script');
    let html = await get(location.pathname);
    const css = await get(ROOT + 'assets/base.css');
    html = html.replace(/<link rel="stylesheet" href="[^"]*base\.css">/, `<style>${css}</style>`);
    for (const f of ['cjk.js', 'record.js']) {
      const js = await get(ROOT + 'assets/' + f);
      html = html.replace(new RegExp(`<script src="[^"]*${f.replace('.', '\\.')}"></script>`), `<script>${inline(js)}</script>`);
    }
    html = html.replace(/<script src="[^"]*(source|stats|liner|credits|notes)\.js"><\/script>\n?/g, '')
      .replace(/<script src="[^"]*music\.js"><\/script>/, `<script>window.MUSIC = ${inline(JSON.stringify(window.MUSIC))};</script>`)
      .replace(/<script src="[^"]*listen2026\.js"><\/script>/, `<script>window.LISTEN = ${inline(JSON.stringify(window.LISTEN))};</script>`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `听歌手记-${window.MJ_RAW.music.profile.nick}${/\/2026\//.test(location.pathname) ? '-2026' : ''}.html`;
    a.click();
    window.mjCount && window.mjCount('event/download', '下载页面');
  }
})();
