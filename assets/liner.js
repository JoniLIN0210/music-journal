/* 唱片内页 Liner Notes
   点开一首歌、一位艺人或一张专辑，从右边抽出一页“内页”：署名、资料、背景、你和它的数字、资料来源。
   硬信息来自 data/credits.js（网易云），背景文字来自 data/notes.js（整理核对后重写）。
   访客的本地版本（?me）没有这些资料，不启用。 */
(() => {
  if (window.MJ_LOCAL || !window.CREDITS || !window.MUSIC) { window.Liner = null; return; }
  const D = window.MUSIC, C = window.CREDITS, LS = window.LISTEN;
  const N = Object.assign({ songs: {}, artists: {}, albums: {} }, window.NOTES);
  const pad2 = n => String(n).padStart(2, '0'), fmt = n => Math.round(n || 0).toLocaleString('en-US');
  const img = (u, s = 300) => u ? `${u}?param=${s}y${s}` : '';
  const ymd = ms => { const d = new Date(ms); return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`; };
  const mmss = s => s ? `${Math.floor(s / 60)}:${pad2(Math.round(s % 60))}` : '';
  const MZH = i => `${i + 1} 月`;
  const hrs = h => h >= 10 ? fmt(h) : h.toFixed(1);

  // 写了背景笔记的条目，按“艺人 → 歌 → 专辑”排成一本小册子，可以前后翻
  const rankOf = id => { const i = window.MUSIC.allTime.findIndex(s => s.id == id); return i < 0 ? 999 : i; };
  const SONGS = Object.keys(N.songs).map(Number).sort((a, b) => rankOf(a) - rankOf(b));   // 歌按你的播放排行排
  const playsOf = a => window.MUSIC.allTime.filter(s => s.a.includes(a)).reduce((t, s) => t + (s.pc || 0), 0);
  const ARTISTS = Object.keys(N.artists).sort((a, b) => playsOf(b) - playsOf(a));                // 艺人按播放次数排
  const INDEX = [...ARTISTS.map(k => ['artist', k]), ...SONGS.map(k => ['song', k]), ...Object.keys(N.albums).map(k => ['album', k])];
  const all = [...D.allTime, ...D.liked, ...D.week];
  const songById = id => all.find(s => s.id == id);
  const alOf = id => C.albums[(C.songs[id] || {}).al];
  const months = LS && LS.months || [];

  function build(kind, key) {
    if (kind === 'song') {
      const s = songById(key); if (!s) return null;
      const c = C.songs[key] || {}, al = alOf(key), n = N.songs[key] || {};
      const rank = D.allTime.indexOf(s) + 1, liked = D.liked.find(x => x.id == key);
      const first = months.map(m => m.topSong && m.topSong.id == key && (m.topSong.items || []).find(x => x[0] === '第一次听')).find(Boolean);
      const topIn = months.map((m, i) => m.topSong && m.topSong.id == key ? i : -1).filter(i => i >= 0);
      const facts = (n.facts || [['专辑', al ? al.n : s.al], ['发行', al && al.pub > 0 ? ymd(al.pub) : (s.y || '')], ['厂牌', al ? al.co : '']]).filter(f => f[1]);
      if (!facts.some(f => f[0] === '时长')) facts.push(['时长', mmss(s.dt)]);
      const lines = [];
      if (first) lines.push(`第一次听它是 ${first[1]}，${first[2]}。`);
      if (topIn.length) lines.push(`2026 年 ${topIn.map(MZH).join('、')}，它是你那个月循环最多的歌。`);
      if (liked) lines.push(`你在 ${ymd(liked.at)} 给它点了红心。`);
      const related = [...s.a.filter(a => N.artists[a] || C.artists[a]).map(a => ({ kind: 'artist', key: a, pic: (C.artists[a] || {}).pic, t: a, sub: 'Artist', round: true }))];
      const alKey = Object.keys(N.albums).find(k => al && k === al.n);
      if (alKey) related.push({ kind: 'album', key: alKey, pic: s.pic, t: `《${alKey}》`, sub: 'Album' });
      return { kind, key, cover: s.pic, disc: true, kicker: rank ? `Song · No. ${pad2(rank)}` : 'Song', title: s.n, sub: `${s.a.join(' / ')} — ${al ? al.n : s.al}`,
        tag: n.tagline, you: s.pc ? [[fmt(s.pc), '次播放'], [hrs(s.pc * s.dt / 3600), '小时'], [rank ? 'No.' + rank : '—', '所有时间排行']] : null,
        lines, credits: c.cr || [], facts, story: n.story, next: null, related, sources: n.sources, caveat: n.caveat };
    }
    if (kind === 'artist') {
      if (!C.artists[key] && !N.artists[key]) return null;   // 没有资料的艺人不开空页
      const a = C.artists[key] || {}, n = N.artists[key] || {};
      const songs = D.allTime.filter(s => s.a.includes(key)), plays = songs.reduce((t, s) => t + (s.pc || 0), 0);
      const liked = D.liked.filter(s => s.a.includes(key)).length;
      const tops = months.map((m, i) => m.topArtist && m.topArtist.n === key ? i : -1).filter(i => i >= 0);
      const lines = [];
      if (tops.length) lines.push(`2026 年有 ${tops.length} 个月的月度歌手是${key}：${tops.map(MZH).join('、')}。`);
      if (songs[0]) lines.push(`你听得最多的是《${songs[0].n}》，${fmt(songs[0].pc)} 次。`);
      const facts = [...(n.facts || [])];
      if (a.albums) facts.push(['网易云收录', `${a.albums} 张专辑 · ${fmt(a.songs)} 首歌`]);
      return { kind, key, cover: a.pic || (songs[0] || {}).pic, round: true, kicker: 'Artist', title: key, sub: n.en || (a.alias || [])[0] || '',
        tag: n.tagline, you: [[fmt(plays), '次播放'], [songs.length, '首进了 Top 100'], [liked, '首点了红心']], lines, credits: [], facts, story: n.story, next: n.next,
        related: songs.slice(0, 5).map(s => ({ kind: 'song', key: s.id, pic: s.pic, t: s.n, sub: `${fmt(s.pc)} 次` })), sources: n.sources, caveat: n.caveat };
    }
    if (kind === 'album') {
      const n = N.albums[key]; if (!n) return null;
      const al = alOf(n.song) || {}, lead = songById(n.song) || {};
      const songs = D.allTime.filter(s => s.al === key && s.a.includes(n.artist)), plays = songs.reduce((t, s) => t + (s.pc || 0), 0);
      const liked = D.liked.filter(s => s.al === key && s.a.includes(n.artist)).length;
      const facts = [...n.facts]; if (al.size && !facts.some(f => f[0] === '曲目')) facts.push(['网易云曲目', `${al.size} 首`]);
      return { kind, key, cover: lead.pic, disc: true, kicker: 'Album', title: `《${key}》`, sub: `${n.artist}${al.pub > 0 ? ' — ' + new Date(al.pub).getFullYear() : ''}`,
        tag: n.tagline, you: [[fmt(plays), '次播放'], [songs.length, '首进了 Top 100'], [liked, '首点了红心']], lines: [], credits: [], facts, story: n.story, next: n.tracks,
        related: [{ kind: 'artist', key: n.artist, pic: (C.artists[n.artist] || {}).pic, t: n.artist, sub: 'Artist', round: true }, ...songs.map(s => ({ kind: 'song', key: s.id, pic: s.pic, t: s.n, sub: `${fmt(s.pc)} 次` }))],
        sources: n.sources, caveat: n.caveat };
    }
    return null;
  }

  /* ---------- 抽屉 ---------- */
  const back = document.createElement('div'); back.className = 'ln-back';
  const el = document.createElement('aside'); el.className = 'ln'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '唱片内页');
  document.body.append(back, el);
  let cur = null, lastFocus = null;
  const dl = rows => `<dl>${rows.map(([k, v]) => `<div><dt class="cap">${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const sec = (t, body) => body ? `<section><h4 class="cap">${t}</h4>${body}</section>` : '';

  function render(e) {
    const pos = INDEX.findIndex(([k, v]) => k === e.kind && v == e.key);
    const prev = pos > 0 ? INDEX[pos - 1] : null, next = pos >= 0 && pos < INDEX.length - 1 ? INDEX[pos + 1] : null;
    const label = ([k, v]) => k === 'album' ? `《${v}》` : k === 'song' ? (songById(v) || {}).n : v;
    el.innerHTML = `<header class="ln-top cap"><span>Liner Notes · 唱片内页</span><span class="g">${pos >= 0 ? `${pad2(pos + 1)} / ${pad2(INDEX.length)}` : ''}</span><button class="ln-x" data-x>Close ×</button></header>
      <div class="ln-body">
        <div class="ln-hero"><div class="ln-cv ${e.round ? 'round' : ''}">${e.disc ? `<span class="ln-disc"><span class="spin vinyl-face"><span class="lbl" style="background-image:url('${img(e.cover, 120)}')"></span></span><span class="sheen"></span></span>` : ''}
          <img class="art" src="${img(e.cover, 400)}" alt=""></div>
          <div class="ln-ttl"><span class="cap">${e.kicker}</span><h2>${e.title}</h2><p class="cap g">${e.sub}</p></div></div>
        ${e.tag ? `<p class="ln-tag">${e.tag}</p>` : ''}
        ${e.you ? `<div class="ln-you">${e.you.map(([v, k]) => `<div><b class="xl tnum">${v}</b><span>${k}</span></div>`).join('')}</div>` : ''}
        ${e.lines.length ? `<p class="ln-line">${e.lines.join('')}</p>` : ''}
        ${sec('Credits · 署名', e.credits.length ? dl(e.credits) : '')}
        ${sec('Facts · 资料', e.facts.length ? dl(e.facts) : '')}
        ${sec('Notes · 背景', e.story ? e.story.map(p => `<p>${p}</p>`).join('') : '')}
        ${!e.story && e.kind === 'song' ? `<p class="ln-none">背景笔记只写了听得最多的几首。上面的署名和资料来自网易云。</p>` : ''}
        ${sec(e.kind === 'album' ? 'Tracks to note · 值得听' : 'Listen next · 接着听', e.next ? `<ul class="ln-chips">${e.next.map(x => `<li>${x}</li>`).join('')}</ul>` : '')}
        ${sec('Related · 相关', e.related.length ? `<ul class="ln-rel">${e.related.map(r => `<li><button data-k="${r.kind}" data-v="${r.key}"><img class="art ${r.round ? 'round' : ''}" src="${img(r.pic, 96)}" alt=""><span><b>${r.t}</b><small class="cap g">${r.sub}</small></span><i>→</i></button></li>`).join('')}</ul>` : '')}
        ${sec('Sources · 资料来源', e.sources ? `<ol class="ln-src">${e.sources.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${t} ↗</a></li>`).join('')}</ol>${e.caveat ? `<p class="ln-none">${e.caveat}</p>` : ''}` : '')}
        <p class="ln-foot cap g">署名、发行与厂牌来自网易云音乐；背景由公开资料整理核对后重写，不含歌词。</p>
      </div>
      <footer class="ln-nav cap">${prev ? `<button data-k="${prev[0]}" data-v="${prev[1]}">← ${label(prev)}</button>` : '<span></span>'}${next ? `<button data-k="${next[0]}" data-v="${next[1]}">${label(next)} →</button>` : '<span></span>'}</footer>`;
    el.querySelector('.ln-body').scrollTop = 0;
  }

  function open(kind, key) {
    const e = build(kind, key); if (!e) return;
    if (!cur) lastFocus = document.activeElement;
    cur = e; render(e);
    document.documentElement.classList.add('ln-open');
    requestAnimationFrame(() => el.classList.add('on'));
    history.replaceState(null, '', `#notes/${kind}/${encodeURIComponent(key)}`);
    el.querySelector('[data-x]').focus({ preventScroll: true });
    window.mjCount && window.mjCount(`event/notes/${kind}`, '打开唱片内页');
  }
  function close() {
    if (!cur) return; cur = null;
    el.classList.remove('on'); document.documentElement.classList.remove('ln-open');
    history.replaceState(null, '', location.pathname + location.search);
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  back.onclick = close;
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.x !== undefined) return close();
    if (b.dataset.k) open(b.dataset.k, b.dataset.k === 'song' ? +b.dataset.v : b.dataset.v); };
  addEventListener('keydown', e => { if (!cur) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const b = [...el.querySelectorAll('.ln-nav button')].find(x => e.key === 'ArrowLeft' ? x.textContent.startsWith('←') : x.textContent.trim().endsWith('→'));
      if (b) b.click(); } });

  // 页面上任何带 data-note="kind:key" 的元素都能点开
  document.addEventListener('click', e => { const t = e.target.closest('[data-note]'); if (!t || el.contains(t)) return;
    e.preventDefault(); const [k, ...v] = t.dataset.note.split(':'); open(k, k === 'song' ? +v.join(':') : v.join(':')); });
  addEventListener('load', () => { const m = location.hash.match(/^#notes\/(song|artist|album)\/(.+)$/);
    if (m) open(m[1], m[1] === 'song' ? +m[2] : decodeURIComponent(m[2])); });

  window.Liner = { open, close, has: (k, v) => !!build(k, v), noted: (k, v) => !!(N[k + 's'] || {})[v], index: INDEX, songs: SONGS, artists: ARTISTS, build };
})();
