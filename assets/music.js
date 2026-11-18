/* 背景音乐：勃拉姆斯《第三交响曲》第三乐章（你红心里的那一首），接着第二乐章，循环。
   录音：Musopen Symphony Orchestra，CC0 公有领域，来自 Wikimedia Commons。
   浏览器不允许有声音的自动播放，所以第一次点击或按键时淡入；暂停后会记住，不再自动响起；
   在主页和年度报告之间切换时从原来的位置接着放。 */
(() => {
  const C = 'https://upload.wikimedia.org/wikipedia/commons/';
  // Wikimedia 文件名里的空格要写成下划线
  const T = (path, name) => { const f = encodeURIComponent(name.replace(/ /g, '_')); return { ogg: `${C}${path}/${f}`, mp3: `${C}transcoded/${path}/${f}/${f}.mp3` }; };
  const LIST = [
    { t: 'Symphony No. 3 · III. Poco allegretto', zh: '勃拉姆斯 · 第三交响曲 · 第三乐章', note: '在你的红心里', ...T('b/b9', 'Brahms, Symphony No. 3 in F Major, Op. 90 - III. Poco allegretto.ogg'),
      page: 'https://commons.wikimedia.org/wiki/File:Brahms,_Symphony_No._3_in_F_Major,_Op._90_-_III._Poco_allegretto.ogg' },
    { t: 'Symphony No. 3 · II. Andante', zh: '勃拉姆斯 · 第三交响曲 · 第二乐章', note: '同一部交响曲的慢板', ...T('2/2a', 'Brahms, Symphony No. 3 in F Major, Op. 90 - II. Andante.ogg'),
      page: 'https://commons.wikimedia.org/wiki/File:Brahms,_Symphony_No._3_in_F_Major,_Op._90_-_II._Andante.ogg' }
  ];
  const VOL = .32, KEY = 'mj:music', POS = 'mj:music-pos';
  const a = new Audio(); a.preload = 'none'; a.volume = 0;
  const canMp3 = !!a.canPlayType('audio/mpeg');
  let i = 0, fade = null, wanted = localStorage.getItem(KEY) !== 'off';
  try { const p = JSON.parse(sessionStorage.getItem(POS)); if (p && LIST[p.i]) { i = p.i; a.dataset.start = p.t || 0; } } catch (e) {}

  /* ---------- 控件 ---------- */
  const el = document.createElement('div'); el.className = 'bgm'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', '背景音乐');
  el.innerHTML = `<button class="bgm-btn" aria-label="播放背景音乐"><span class="bgm-arm"></span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></button>
    <div class="bgm-info"><span class="bgm-hint">点一下页面任意处，音乐会轻轻响起</span>
      <b class="bgm-t"></b><span class="bgm-zh"></span><span class="bgm-meta"><button class="bgm-next">下一首 →</button><a class="bgm-src" target="_blank" rel="noopener">Musopen · CC0 ↗</a></span></div>`;
  document.body.appendChild(el);
  const btn = el.querySelector('.bgm-btn');
  const show = () => { const s = LIST[i]; el.querySelector('.bgm-t').textContent = `Brahms — ${s.t}`; el.querySelector('.bgm-zh').textContent = `${s.zh} · ${s.note}`; el.querySelector('.bgm-src').href = s.page; };
  const state = on => { el.classList.toggle('on', on); btn.setAttribute('aria-label', on ? '暂停背景音乐' : '播放背景音乐'); };
  show();

  const ramp = (to, ms, done) => { clearInterval(fade); const from = a.volume, t0 = performance.now();
    fade = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = from + (to - from) * k * k * (3 - 2 * k); if (k >= 1) { clearInterval(fade); done && done(); } }, 40); };
  const load = () => { const s = LIST[i]; if (a.dataset.idx != i) { a.src = canMp3 ? s.mp3 : s.ogg; a.dataset.idx = i; } };
  const play = async () => {
    load();
    if (a.dataset.start) { const t = +a.dataset.start; delete a.dataset.start; a.addEventListener('loadedmetadata', () => { a.currentTime = t; }, { once: true }); }
    try { await a.play(); state(true); el.classList.add('heard'); ramp(VOL, 4000); return true; } catch (e) { return false; }
  };
  const pause = () => { state(false); ramp(0, 900, () => a.pause()); };

  btn.onclick = e => { e.stopPropagation();
    if (el.classList.contains('on')) { wanted = false; localStorage.setItem(KEY, 'off'); pause(); }
    else { wanted = true; localStorage.removeItem(KEY); play(); } };
  el.querySelector('.bgm-next').onclick = e => { e.stopPropagation(); i = (i + 1) % LIST.length; show(); a.dataset.idx = ''; if (el.classList.contains('on')) { a.volume = 0; play(); } };
  a.addEventListener('ended', () => { i = (i + 1) % LIST.length; show(); a.volume = 0; play(); });
  a.addEventListener('error', () => { if (a.src.endsWith('.mp3')) { a.src = LIST[i].ogg; play(); } });
  addEventListener('pagehide', () => sessionStorage.setItem(POS, JSON.stringify({ i, t: a.currentTime || +a.dataset.start || 0 })));

  // 先试着直接播放；被浏览器拦下就等第一次点击或按键
  if (wanted) play().then(ok => { if (ok) return;
    el.classList.add('wait');
    const go = e => { if (el.contains(e.target)) return; ['pointerdown', 'keydown'].forEach(t => removeEventListener(t, go, true));
      el.classList.remove('wait'); if (wanted) play(); };
    ['pointerdown', 'keydown'].forEach(t => addEventListener(t, go, true)); });
})();
