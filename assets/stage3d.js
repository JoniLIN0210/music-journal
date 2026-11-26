/* 主页的滚动动效，只用浏览器自带的 3D 变换，不引入外部库。
   参考 premotio 这类动效网站的做法：
   - 全局平滑滚动：滚轮的每一下都被缓动成连续的滚动（只在电脑上，触屏保留系统自带的惯性）。
   - 一屏一个场景：场景固定在屏幕上，用一长段滚动距离来“播放”它，画面里只放这一件事。
   1. 平滑滚动。
   2. mountReel：「On Repeat」场景。封面围成一个大圆筒，镜头从上往下落，滚动时圆筒慢慢转，正对你的那首歌写在下面。
   3. mountCrate：唱片箱场景。滚轮一格翻一张；停下来，黑胶自己从封套里滑出来转。也可以拖动、点、用 ← →。
   系统开了“减少动态效果”时，平滑滚动关闭，场景直接停在最终状态。 */
(() => {
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const inout = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const damp = (k, dt) => 1 - Math.pow(1 - k, dt / 16.67);       // 与帧率无关的缓动系数
  const docTop = el => el.getBoundingClientRect().top + scrollY;

  /* ---------- 1. 平滑滚动 ---------- */
  let goTo = y => scrollTo({ top: y, behavior: REDUCE ? 'auto' : 'smooth' });
  if (!REDUCE && FINE) {
    let target = scrollY, cur = scrollY, anim = false, last = 0;
    const max = () => document.documentElement.scrollHeight - innerHeight;
    const step = now => {
      const dt = Math.min(50, now - (last || now)); last = now;
      cur += (target - cur) * damp(.085, dt);
      if (Math.abs(target - cur) < .4) { cur = target; anim = false; }
      scrollTo(0, cur);
      if (anim) requestAnimationFrame(step); else last = 0;
    };
    const start = () => { if (!anim) { anim = true; cur = scrollY; requestAnimationFrame(step); } };
    addEventListener('wheel', e => {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (document.documentElement.classList.contains('ln-open') || e.target.closest('.ln, .cardv, [data-native-scroll]')) return;
      e.preventDefault();
      if (!anim) target = scrollY;
      target = clamp(target + (e.deltaMode === 1 ? e.deltaY * 36 : e.deltaY), 0, max()); start();
    }, { passive: false });
    // 拖滚动条、按键盘、点锚点时，以系统滚动为准
    addEventListener('scroll', () => { if (!anim) target = cur = scrollY; }, { passive: true });
    goTo = y => { target = clamp(y, 0, max()); start(); };
  }
  window.mjScrollTo = y => goTo(y);

  // 只在场景出现在屏幕上时才跑每帧的计算
  const loop = (el, frame) => {
    let on = false, ticking = false, last = 0;
    const tick = now => { const dt = Math.min(50, now - (last || now)); last = now; const busy = frame(dt);
      if (on && busy) requestAnimationFrame(tick); else { ticking = false; last = 0; } };
    const kick = () => { if (!ticking && on) { ticking = true; requestAnimationFrame(tick); } };
    new IntersectionObserver(es => { on = es[0].isIntersecting; kick(); }, { rootMargin: '100px 0px' }).observe(el);
    addEventListener('scroll', kick, { passive: true });
    return kick;
  };

  /* ---------- 2. On Repeat：封面圆筒 ---------- */
  window.mountReel = ({ el, songs, card, caption }) => {
    const narrow = innerWidth < 720, n = Math.min(songs.length, narrow ? 16 : 26);
    if (n < 8) { el.remove(); return; }
    const ring = el.querySelector('.reel-ring'), cap = el.querySelector('.reel-cap'), cnt = el.querySelector('.reel-n');
    ring.innerHTML = songs.slice(0, n).map((s, i) => card(s, i)).join('');
    const cards = [...ring.children];
    let cw = 200, R = 600, top = 0, len = 1;
    const measure = () => {
      cw = cards[0].offsetWidth; R = n * cw * 1.16 / TAU;        // 圆周刚好排下 n 张，留一点缝
      top = docTop(el); len = Math.max(1, el.offsetHeight - innerHeight);
    };
    const TURN = 1.15, P0 = .08;
    let p = REDUCE ? 1 : 0, front = -1;
    // 停下来时，对齐到最近的一张，让它正对你
    const scrollFor = k => top + len * (P0 + (1 - P0) * (k / n - .06) / TURN);   // 第 k 张正对你时的滚动位置
    let idle = null;
    addEventListener('scroll', () => { clearTimeout(idle); idle = setTimeout(() => {
      const q = (scrollY - top) / len; if (q < P0 + .02 || q > .985) return;
      const k = Math.round(((q - P0) / (1 - P0) * TURN + .06) * n), y = scrollFor(k);
      if (Math.abs(y - scrollY) > 2 && y < top + len) mjScrollTo(y); }, 200); }, { passive: true });
    const frame = dt => {
      const pt = REDUCE ? 1 : clamp((scrollY - top) / len, 0, 1);
      p += (pt - p) * (REDUCE ? 1 : damp(.16, dt)); if (Math.abs(pt - p) < .0004) p = pt;
      // 入场：镜头从正上方落下来，圆筒从中心张开；之后滚动让它转一圈多一点
      const intro = ease(clamp(p / .22, 0, 1));
      const r = lerp(R * .18, R, intro);
      const tilt = lerp(-62, -9, intro);
      const lift = lerp(-.06, 0, intro) * innerHeight;
      const rot = -TAU * TURN * clamp((p - P0) / (1 - P0), 0, 1) - TAU * .06;
      ring.style.transform = `translate3d(0,${lift.toFixed(1)}px,${(-r).toFixed(1)}px) rotateX(${tilt.toFixed(2)}deg) rotateY(${rot.toFixed(4)}rad)`;
      cards.forEach((c, i) => {
        const a = TAU * i / n, rel = Math.cos(a + rot);                // 1 = 正对你，-1 = 在背面
        c.style.transform = `rotateY(${a.toFixed(4)}rad) translateZ(${r.toFixed(1)}px)`;
        c.style.opacity = (lerp(.16, 1, (rel + 1) / 2) * lerp(.4, 1, intro)).toFixed(3);
      });
      // 正对你的那张，写在下面
      const f = ((Math.round(-rot / (TAU / n)) % n) + n) % n;
      if (f !== front) { front = f; cap.classList.remove('in'); void cap.offsetWidth; cap.innerHTML = caption(songs[f], f); cap.classList.add('in');
        cnt.textContent = `${String(f + 1).padStart(2, '0')} / ${n}`; cards.forEach((c, i) => c.classList.toggle('on', i === f)); }
      return p !== pt;
    };
    measure();
    const kick = loop(el, frame); frame(16);
    addEventListener('resize', () => { measure(); kick(); });
    addEventListener('load', () => { measure(); kick(); });
    new ResizeObserver(() => { measure(); kick(); }).observe(document.body);
  };

  /* ---------- 3. 唱片箱 ---------- */
  window.mountCrate = ({ el, songs, cover, info }) => {
    const n = songs.length; if (n < 3) { el.remove(); return; }
    const stage = el.querySelector('.crate-stage'), bar = el.querySelector('.crate-track i'), cnt = el.querySelector('.crate-n'), box = el.querySelector('.crate-info');
    stage.innerHTML = songs.map((s, i) => `<div class="rk" data-i="${i}"><div class="vin"><span class="spin vinyl-face"><span class="lbl" style="background-image:url('${cover(s, 160)}')"></span></span><span class="sheen"></span></div>
      <img class="slv" src="${cover(s, 600)}" alt="${(s.n || '').replace(/"/g, '')}" crossorigin="anonymous" draggable="false"></div>`).join('');
    const cards = [...stage.children], zs = [];
    // 每翻一张要滚动的距离；整段高度 = 一屏 + 翻完所有唱片的距离
    const STEP = innerWidth < 720 ? 90 : 120;
    el.style.height = `calc(100vh + ${(n - 1) * STEP}px)`;
    let top = 0, size = 300, pos = 0, active = -1, out = false, ov = 0, fan = REDUCE ? 1 : 0;
    const measure = () => { top = docTop(el); size = cards[0].getBoundingClientRect().width || 300; };
    const at = i => top + clamp(i, 0, n - 1) * STEP;
    const show = i => { active = i; cnt.textContent = `${String(i + 1).padStart(2, '0')} / ${n}`; bar.style.width = `${(i + 1) / n * 100}%`; box.innerHTML = info(songs[i], i); };
    const setOut = v => { if (v === out) return; out = v; cards.forEach((c, i) => c.classList.toggle('out', v && i === active)); el.classList.toggle('is-out', v);
      const pb = box.querySelector('[data-pull]'); if (pb) pb.textContent = v ? '收回黑胶 ◑' : '抽出黑胶 ◐'; kick(); };
    const go = i => mjScrollTo(at(Math.round(i)));

    const frame = dt => {
      const pt = clamp((scrollY - top) / STEP, 0, n - 1);
      pos += (pt - pos) * (REDUCE ? 1 : damp(.2, dt)); if (Math.abs(pt - pos) < .001) pos = pt;
      const vis = scrollY > top - innerHeight * .7;
      const ft = REDUCE || vis || fan > .5 ? 1 : 0; fan += (ft - fan) * damp(.055, dt); if (Math.abs(ft - fan) < .002) fan = ft;
      const ot = out ? 1 : 0; ov += (ot - ov) * (REDUCE ? 1 : damp(.1, dt)); if (Math.abs(ot - ov) < .002) ov = ot;
      const r = Math.round(pt); if (r !== active) { setOut(false); show(r); }   // 以滚动位置为准，不等动画追上
      const fe = inout(fan);
      cards.forEach((c, i) => {
        const d = i - pos, ad = Math.abs(d), sg = Math.sign(d), near = Math.min(ad, 1), far = Math.max(ad - 1, 0);
        if (ad > 9) { if (c.style.visibility !== 'hidden') c.style.visibility = 'hidden'; return; } if (c.style.visibility) c.style.visibility = '';
        let x = sg * (near * .62 + far * .16) * size, z = -(near * .48 + far * .035) * size, ry = -sg * near * 62;
        if (i === active) x -= size * .26 * ov;
        if (i > active) x += size * .5 * ov;
        const y = (1 - fe) * (ad * size * .02 - size * .08);           // 入场：先叠成一摞，再扇形展开
        x *= fe; ry *= fe; z = lerp(-ad * 6, z, fe);
        c.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg)`;
        const zi = out && i === active ? 200 : 100 - Math.round(ad * 4); if (zs[i] !== zi) { c.style.zIndex = zi; zs[i] = zi; }
        c.style.opacity = ad > 7 ? (9 - ad) / 2 : 1;
      });
      return pos !== pt || ov !== ot || fan !== ft;
    };

    // 停下来：先对齐到最近的一张，再过一会儿让黑胶自己滑出来
    let idle = null, rest = null;
    const settle = () => {
      clearTimeout(idle); clearTimeout(rest);
      if (out && Math.abs((scrollY - top) / STEP - active) > .2) setOut(false);
      if (scrollY < top - 2 || scrollY > top + (n - 1) * STEP + 2) return;
      idle = setTimeout(() => {
        const i = Math.round((scrollY - top) / STEP);
        if (Math.abs(scrollY - at(i)) > 2) go(i);
        rest = setTimeout(() => { const k = Math.round((scrollY - top) / STEP);
          if (Math.abs(scrollY - at(k)) < 3) { if (k !== active) show(clamp(k, 0, n - 1)); setOut(true); } }, 700);
      }, 160);
    };
    addEventListener('scroll', settle, { passive: true });

    // 鼠标拖动 = 滚动；点正中那张 = 抽出/收回；点别的 = 翻到那张
    const tap = e => { const c = document.elementsFromPoint(e.clientX, e.clientY).map(x => x.closest && x.closest('.rk')).find(Boolean);
      if (!c) return; const i = +c.dataset.i; if (i === active) setOut(!out); else go(i); };
    let sx = null, sy0 = 0, moved = false;
    stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; sx = e.clientX; sy0 = scrollY; moved = false; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', e => { if (sx === null) return; const dx = e.clientX - sx; if (Math.abs(dx) > 6) moved = true;
      if (moved) scrollTo(0, clamp(sy0 - dx / (size * .32) * STEP, top, top + (n - 1) * STEP)); });
    stage.addEventListener('pointerup', e => { if (sx === null) return; sx = null; if (moved) settle(); else tap(e); });
    // 触屏：手指横滑翻唱片，竖滑照常滚页面，轻点同鼠标
    let tx = null, ty = null;
    stage.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    stage.addEventListener('touchend', e => { if (tx === null) return; const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty; tx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(active + (dx < 0 ? 1 : -1) * Math.max(1, Math.round(Math.abs(dx) / 120)));
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) tap(t); }, { passive: true });
    // 触控板横向滑动也能翻
    let acc = 0, wt = null;
    stage.addEventListener('wheel', e => { if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; e.preventDefault(); acc += e.deltaX;
      clearTimeout(wt); wt = setTimeout(() => { if (Math.abs(acc) > 30) go(active + Math.sign(acc) * Math.max(1, Math.round(Math.abs(acc) / 160))); acc = 0; }, 60); }, { passive: false });
    stage.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOut(!out); } });
    el.querySelector('[data-prev]').onclick = () => go(active - 1);
    el.querySelector('[data-next]').onclick = () => go(active + 1);
    el.querySelector('.crate-track').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); go((e.clientX - r.left) / r.width * n - .5); };
    box.addEventListener('click', e => { if (e.target.closest('[data-pull]')) setOut(!out); });

    measure(); show(0);
    const kick = loop(el, frame); frame(16);
    addEventListener('resize', () => { measure(); kick(); });
    addEventListener('load', () => { measure(); kick(); });
    // 页面上方的内容（比如 Top 100 展开、图片加载）会改变唱片箱的位置
    new ResizeObserver(() => { measure(); kick(); }).observe(document.body);
  };
})();
