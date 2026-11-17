/* 听歌手记 · 读取器
   通过书签在 music.163.com 页面里运行：用你自己已登录的网页版网易云读取听歌数据，
   读完后交给听歌手记页面，保存在你自己的浏览器里。不经过任何第三方服务器。 */
(() => {
  const BASE = window.__MJ_BASE || new URL('..', document.currentScript.src).href;   // 网站根目录
  const TARGET = new URL(BASE).origin;
  if (!/(^|\.)music\.163\.com$/.test(location.hostname)) {
    if (confirm('请在网易云音乐网页版（music.163.com）里点这个书签。\n\n现在打开 music.163.com 吗？')) location.href = 'https://music.163.com/';
    return;
  }
  if (document.getElementById('mj-panel')) return;

  /* ---------- 面板（Shadow DOM，不受网易云样式影响） ---------- */
  const host = document.createElement('div'); host.id = 'mj-panel';
  host.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    .p{width:340px;background:#0A0A0A;color:#fff;font:13px/1.5 -apple-system,"PingFang SC",sans-serif;padding:18px 18px 16px;box-shadow:0 20px 50px rgba(0,0,0,.35)}
    .h{display:flex;justify-content:space-between;align-items:center;font:600 11px/1 -apple-system,sans-serif;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #333;padding-bottom:12px}
    .x{background:none;border:0;color:#fff;opacity:.5;cursor:pointer;font-size:16px}
    .d{width:44px;height:44px;border-radius:50%;flex:none;background:radial-gradient(circle,#ddd 0 18%,#000 19% 21%,transparent 22%),repeating-radial-gradient(circle,#111 0 1px,#222 1px 2px);animation:s 1.8s linear infinite}
    .d.stop{animation:none}@keyframes s{to{transform:rotate(360deg)}}
    .row{display:flex;gap:14px;align-items:center;margin-top:16px}
    .t b{display:block;font-size:15px}.t span{opacity:.55;font-size:12px}
    ol{list-style:none;margin:14px 0 0;padding:0;font-size:12px}
    li{display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid #222;opacity:.35}
    li.on{opacity:1}li.ok{opacity:.7}li.err{opacity:.7;color:#f88}
    .bar{height:2px;background:#222;margin-top:14px}.bar i{display:block;height:100%;width:0;background:#fff;transition:width .3s}
    button.go{margin-top:16px;width:100%;padding:12px;border:0;background:#fff;color:#000;font:600 13px -apple-system,"PingFang SC",sans-serif;cursor:pointer}
    button.go:disabled{opacity:.3;cursor:default}
    .note{margin-top:10px;opacity:.45;font-size:11px}
  </style>
  <div class="p"><div class="h"><span>听歌手记 · Listening Journal</span><button class="x" title="关闭">×</button></div>
    <div class="row"><div class="d"></div><div class="t"><b id="who">正在读取…</b><span id="st">别关掉这个页面</span></div></div>
    <ol id="steps"></ol><div class="bar"><i id="pg"></i></div>
    <button class="go" id="go" disabled>打开我的听歌手记 →</button>
    <p class="note">数据只在你自己的浏览器里读取和保存，不会上传到任何服务器。</p></div>`;
  document.body.appendChild(host);
  const $ = s => root.querySelector(s);
  $('.x').onclick = () => host.remove();
  const STEPS = [['acc', '账号'], ['rank', '听歌排行'], ['pl', '歌单'], ['liked', '我喜欢的音乐'], ['listen', '听歌时长与月报']];
  $('#steps').innerHTML = STEPS.map(([k, t]) => `<li data-k="${k}"><span>${t}</span><span class="v">—</span></li>`).join('');
  const step = (k, state, v) => { const li = $(`li[data-k="${k}"]`); li.className = state; if (v != null) li.querySelector('.v').textContent = v;
    const done = root.querySelectorAll('li.ok,li.err').length; $('#pg').style.width = done / STEPS.length * 100 + '%'; };

  /* ---------- 接口 ---------- */
  const get = u => fetch(u, { credentials: 'include' }).then(r => r.json());
  const post = (u, b = {}) => fetch(u, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(b) }).then(r => r.json());
  const pic = u => (u || '').replace('http://', 'https://').split('?')[0];
  const song = s => ({ id: s.id, n: s.name, a: (s.ar || []).map(a => a.name), al: (s.al || {}).name || '', pic: pic((s.al || {}).picUrl),
    dt: Math.round((s.dt || 0) / 1000), y: s.publishTime ? new Date(s.publishTime).getUTCFullYear() : null });

  const pick = d => { const lt = d.listenTimeBlock || {}, ld = d.listenTimeDistributionBlock || {}, ts = d.topSongBlock || {}, ta = d.topArtistBlock || {},
      st = d.topStyleBlock || {}, ag = d.topAgeBlock || {}, lg = d.topLanguageBlock || {}, wp = d.wallpaperBlock || {};
    const daily = ld.durationDetails || [];
    return { start: d.startTime, end: d.endTime, min: ld.playDuration ?? lt.playDuration ?? 0, days: ld.listenDays, beat: lt.playDurationText,
      periods: (lt.circleTimePeriodDurations || []).map(x => [x.period, x.duration]),
      daily: daily.map(x => x.duration), d0: daily[0] ? daily[0].period : null,
      ach: ld.achievementTitle ? [ld.achievementTitle.mainTitle, ld.achievementTitle.subTitle] : null,
      secs: [...(lt.sections || []), ...(ld.sections || [])].map(x => [x.type, x.field || '', x.valueA || x.value || '', x.textB || '']),
      songs: wp.songCount,
      topSong: ts.songId ? { id: ts.songId, n: ts.songName, a: (ts.artists || []).map(a => a.artistName), pic: pic(ts.picUrl), pc: ts.playCount,
        items: (ts.items || []).map(i => [i.field, i.mainText, i.subText]), more: (ts.sections || []).map(s => [s.songName, pic(s.picUrl), s.text]) } : null,
      topArtist: ta.artistName ? { n: ta.artistName, pic: pic(ta.avatarUrl), pc: ta.playCount,
        items: (ta.items || []).map(i => [i.field, i.mainText, i.subText]), more: (ta.sections || []).map(s => [s.artistName, pic(s.picUrl), s.text]) } : null,
      genre: st.genreName ? { n: st.genreName, en: st.genreEnglishName, sub: st.secondGenreName, secs: (st.sections || []).map(s => [s.genreName, +s.percent]), song: st.songName, pic: pic(st.picUrl) } : null,
      age: ag.sections ? { secs: ag.sections.map(s => [s.age, s.playSongNum]), oldest: { n: ag.songName, y: ag.age, pic: pic(ag.picUrl) } } : null,
      lang: lg.sections ? lg.sections.map(s => [s.language, +s.percent, s.playSongNum, s.songName]) : null };
  };
  const emptyMonth = (y, m) => ({ start: new Date(y, m, 1).getTime(), end: new Date(y, m + 1, 0).getTime(), min: 0, periods: [], daily: [], d0: null, secs: [] });

  // 压缩成 gzip + base64url，放进网址的 # 后面（# 后面的内容不会发给任何服务器）
  const enc = async obj => { const st = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(st).arrayBuffer()); let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  let payload = null, packed = '';
  (async () => {
    // 1 账号
    step('acc', 'on');
    const acc = await get('/api/nuser/account/get').catch(() => ({}));
    const uid = acc.account && acc.account.id;
    if (!uid || !acc.profile) { step('acc', 'err', '未登录'); $('#who').textContent = '还没有登录'; $('#st').textContent = '请先登录网易云网页版，再点一次书签'; root.querySelector('.d').classList.add('stop'); return; }
    const det = await get(`/api/v1/user/detail/${uid}`);
    const p = det.profile || acc.profile;
    const profile = { uid, nick: p.nickname, avatar: pic(p.avatarUrl), created: p.createTime > 0 ? p.createTime : Date.now() - (det.createDays || 0) * 864e5,
      createDays: det.createDays, listenSongs: det.listenSongs, level: det.level };
    $('#who').textContent = profile.nick; step('acc', 'ok', 'Lv.' + profile.level);

    // 2 排行（登录状态下有精确播放次数）
    step('rank', 'on');
    const rec = async t => { const r = await get(`/api/v1/play/record?uid=${uid}&type=${t}`).catch(() => ({}));
      return ((t ? r.weekData : r.allData) || []).map(x => Object.assign(song(x.song), { score: x.score, pc: x.playCount })); };
    const [allTime, week] = await Promise.all([rec(0), rec(1)]);
    step('rank', 'ok', `${allTime.length} 首`);

    // 3 歌单
    step('pl', 'on');
    const pls = (await get(`/api/user/playlist?uid=${uid}&limit=1000&offset=0`)).playlist || [];
    const playlists = pls.map(x => ({ id: x.id, n: x.name, c: x.trackCount, pc: x.playCount, pic: pic(x.coverImgUrl), mine: x.creator && x.creator.userId === uid, ct: x.createTime }));
    step('pl', 'ok', `${playlists.length} 个`);

    // 4 我喜欢的音乐
    step('liked', 'on');
    let liked = [];
    const likedPl = pls.find(x => x.specialType === 5) || pls[0];
    if (likedPl) {
      const ids = ((await get(`/api/v6/playlist/detail?id=${likedPl.id}&n=100000`)).playlist || {}).trackIds || [];
      const map = {};
      for (let i = 0; i < ids.length; i += 400) {
        const r = await post('/api/v3/song/detail', { c: JSON.stringify(ids.slice(i, i + 400).map(t => ({ id: t.id }))) });
        (r.songs || []).forEach(s => map[s.id] = s);
        step('liked', 'on', `${Math.min(i + 400, ids.length)} / ${ids.length}`);
      }
      liked = ids.filter(t => map[t.id]).map(t => Object.assign(song(map[t.id]), { at: t.at }));
    }
    step('liked', 'ok', `${liked.length} 首`);

    // 5 听歌时长与月报（今年 1 月到上个月 + 本月实时）
    step('listen', 'on');
    let listen = null;
    try {
      const now = new Date(), Y = now.getFullYear(), months = [];
      for (let m = 0; m < now.getMonth(); m++) {
        const r = await post('/api/content/activity/listen/data/report', { type: 'month', endTime: new Date(Y, m + 1, 0, 23, 59, 59).getTime() }).catch(() => ({}));
        months.push(r.data ? pick(r.data) : emptyMonth(Y, m));
        step('listen', 'on', `${m + 1} 月`);
      }
      const rt = await post('/api/content/activity/listen/data/realtime/report', { type: 'month' }).catch(() => ({}));
      const yr = await post('/api/content/activity/listen/data/year/report', {}).catch(() => ({}));
      const tot = await post('/api/content/activity/listen/data/total', {}).catch(() => ({}));
      listen = { updatedAt: Date.now(), total: (tot.data || {}).totalDuration || 0,
        years: ((yr.data || {}).yearItems || []).map(y => [y.year, y.playNum, y.playDuration]),
        months, nov: rt.data ? pick(rt.data) : emptyMonth(Y, now.getMonth()) };
      step('listen', 'ok', `${Math.round(months.concat(listen.nov).reduce((s, m) => s + (m.min || 0), 0) / 60)} 小时`);
    } catch (e) { step('listen', 'err', '没读到'); }

    payload = { v: 1, music: { profile, allTime, week, playlists, liked, fetchedAt: Date.now() }, listen };
    try { if (window.CompressionStream) packed = await enc(payload); } catch (e) {}
    root.querySelector('.d').classList.add('stop');
    $('#st').textContent = '读完了';
    $('#go').disabled = false;
  })().catch(e => { $('#st').textContent = '读取出错：' + e.message; root.querySelector('.d').classList.add('stop'); });

  /* ---------- 交给听歌手记页面 ---------- */
  $('#go').onclick = () => {
    const url = BASE + 'make/receive.html';
    if (packed && packed.length < 1.5e6) {            // 常规：数据放在网址 # 后面，新标签页打开；弹窗被拦就在当前页打开
      const w = window.open(url + '#d=' + packed, '_blank');
      if (!w) location.href = url + '#d=' + packed; else $('#st').textContent = '已经在新标签页打开';
      return;
    }
    const w = window.open(url, '_blank');           // 数据特别大时：新窗口握手后用 postMessage 传
    if (!w) { $('#st').textContent = '弹窗被拦截了，请允许弹出窗口后再点一次'; return; }
    const onMsg = e => { if (e.source !== w || e.origin !== TARGET || !e.data || e.data.type !== 'mj-ready') return;
      w.postMessage({ type: 'mj-data', payload }, TARGET); removeEventListener('message', onMsg);
      $('#st').textContent = '已经在新标签页打开'; };
    addEventListener('message', onMsg);
  };
})();
