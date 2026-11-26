/* 主页的两处 3D 动效，只用浏览器自带的 3D 变换，不引入外部库。
   1. mountOrbit：首屏，Top 封面在大数字后面排成一个倾斜的圆环慢慢转；往下滚，圆环展开，落成下面那面封面墙。
   2. mountCrate：唱片箱，前 20 首像唱片店木箱里的唱片一样排开，拖动或按 ← → 翻；点正中那张，黑胶从封套里滑出来转。
   系统开了“减少动态效果”时，两处都直接显示静止的最终状态。 */
(() => {
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const TAU = Math.PI * 2;
  // 只在元素出现在屏幕附近时才跑动画
  const whenVisible = (el, on) => new IntersectionObserver(es => on(es[0].isIntersecting), { rootMargin: '200px 0px' }).observe(el);

  /* ---------- 1. 封面星环 → 封面墙 ---------- */
  window.mountOrbit = ({ root, title, wall, cards: html }) => {
    const n = html.length; if (!n) return;
    const still = REDUCE || n < 12;                          // 封面太少，圆环会显得空，直接摆成墙
    wall.innerHTML = '<i></i>'.repeat(n);                    // 墙只留位置，封面由上面的舞台飞进来
    const stage = document.createElement('div'); stage.className = 'orbit'; stage.innerHTML = html.join('');
    root.prepend(stage); root.classList.add('has-orbit'); root.classList.toggle('ring', !still);
    const cards = [...stage.children];
    let cells = [], C = { x: 0, y: 0 }, R = 0, k = .3, cw = 0, end = 1, narrow = false;
    const measure = () => {
      const rr = root.getBoundingClientRect(), tr = title.getBoundingClientRect();
      cells = [...wall.children].map(c => { const r = c.getBoundingClientRect(); return { x: r.left - rr.left, y: r.top - rr.top }; });
      cw = wall.children[0].getBoundingClientRect().width; narrow = rr.width < 720;
      C = { x: rr.width / 2, y: tr.top - rr.top + tr.height * .56 };
      R = narrow ? rr.width * .62 : Math.min(rr.width * .42, 760);
      k = clamp((narrow ? rr.width * .15 : rr.width * .075) / cw, .2, 1);   // 圆环上的封面相对墙上的大小
      end = Math.max(260, wall.getBoundingClientRect().top + scrollY - innerHeight * .28);
      cards.forEach(c => { c.style.width = c.style.height = cw + 'px'; });
      stage.style.perspectiveOrigin = `${C.x}px ${C.y}px`;
    };
    let spin = 0, p = still ? 1 : 0, mx = 0, my = 0, tmx = 0, tmy = 0, last = performance.now(), run = false, settled = false;
    const frame = now => {
      const dt = Math.min(64, now - last); last = now;
      const target = still ? 1 : clamp(scrollY / end, 0, 1);
      p += (target - p) * (still ? 1 : 1 - Math.pow(.86, dt / 16));
      if (Math.abs(target - p) < .0005) p = target;
      mx += (tmx - mx) * .05; my += (tmy - my) * .05;
      spin += dt * .00011 * (1 - p);
      const tilt = .13 + my * .07;
      cards.forEach((c, i) => {
        const e = ease(clamp(p * 1.4 - (i / n) * .4, 0, 1));
        const th = spin + TAU * i / n + mx * .25;
        const zr = R * Math.cos(th);
        const rx = C.x + R * Math.sin(th) - cw / 2, ry = C.y + zr * Math.sin(tilt) - cw / 2, rz = zr * Math.cos(tilt) - R * .35;
        let rot = ((th % TAU) + TAU) % TAU; if (rot > Math.PI) rot -= TAU;
        const cell = cells[i] || cells[cells.length - 1];
        const x = lerp(rx, cell.x, e), y = lerp(ry, cell.y, e), z = lerp(rz, 0, e), r = lerp(rot, 0, e), s = lerp(k, 1, e);
        c.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateY(${r.toFixed(4)}rad) scale(${s.toFixed(4)})`;
        c.style.opacity = lerp(.32 + .68 * (zr / R + 1) / 2, 1, e).toFixed(3);
        c.style.zIndex = e > .98 ? 1 : Math.round(zr + R);
      });
      // 落成封面墙以后就不再每帧重算
      settled = p === 1 && target === 1;
      stage.classList.toggle('flat', settled);
      if (run && !settled) requestAnimationFrame(frame); else ticking = false;
    };
    let ticking = false;
    const kick = () => { if (!ticking) { ticking = true; last = performance.now(); requestAnimationFrame(frame); } };
    measure(); frame(performance.now());
    whenVisible(root, v => { run = v; if (v) kick(); });
    addEventListener('scroll', () => { if (run) kick(); }, { passive: true });
    addEventListener('resize', () => { measure(); kick(); });
    addEventListener('load', () => { measure(); kick(); });
    if (!still) root.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return;
      const r = root.getBoundingClientRect(); tmx = (e.clientX - r.left) / r.width - .5; tmy = (e.clientY - r.top) / innerHeight - .5; kick(); });
  };

  /* ---------- 2. 唱片箱 ---------- */
  window.mountCrate = ({ el, songs, cover, info }) => {
    const n = songs.length; if (n < 3) { el.remove(); return; }
    const stage = el.querySelector('.crate-stage'), bar = el.querySelector('.crate-track i'), cnt = el.querySelector('.crate-n'), box = el.querySelector('.crate-info');
    stage.innerHTML = songs.map((s, i) => `<div class="rk" data-i="${i}"><div class="vin"><span class="spin vinyl-face"><span class="lbl" style="background-image:url('${cover(s, 160)}')"></span></span><span class="sheen"></span></div>
      <img class="slv" src="${cover(s, 600)}" alt="${(s.n || '').replace(/"/g, '')}" crossorigin="anonymous" draggable="false"></div>`).join('');
    const cards = [...stage.children];
    let pos = 0, target = 0, active = 0, out = false, ov = 0, size = 300, ticking = false;
    const measure = () => { size = stage.querySelector('.rk').getBoundingClientRect().width || 300; };
    const show = i => { active = i; cnt.textContent = `${String(i + 1).padStart(2, '0')} / ${n}`; bar.style.width = `${(i + 1) / n * 100}%`; box.innerHTML = info(songs[i], i); };
    const setOut = v => { out = v; cards.forEach((c, i) => c.classList.toggle('out', v && i === active)); el.classList.toggle('is-out', v);
      const pb = box.querySelector('[data-pull]'); if (pb) pb.textContent = v ? '收回黑胶 ◑' : '抽出黑胶 ◐'; kick(); };
    const go = i => { i = clamp(Math.round(i), 0, n - 1); if (i !== active) setOut(false); target = i; if (i !== active) show(i); kick(); };
    const frame = () => {
      pos += (target - pos) * (REDUCE ? 1 : .14); if (Math.abs(target - pos) < .001) pos = target;
      const ot = out ? 1 : 0; ov += (ot - ov) * (REDUCE ? 1 : .12); if (Math.abs(ot - ov) < .002) ov = ot;
      cards.forEach((c, i) => {
        const d = i - pos, ad = Math.abs(d), sg = Math.sign(d), near = Math.min(ad, 1), far = Math.max(ad - 1, 0);
        if (ad > 9) { c.style.visibility = 'hidden'; return; } c.style.visibility = '';
        let x = sg * (near * .64 + far * .17) * size, z = -(near * .5 + far * .03) * size;
        // 抽出黑胶时：这张往左让一点，右边的唱片整体往右让开，给黑胶留位置
        if (i === active) x -= size * .26 * ov;
        if (i > active) x += size * .5 * ov;
        c.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${(-sg * near * 64).toFixed(2)}deg)`;
        c.style.zIndex = out && i === active ? 200 : 100 - Math.round(ad * 4);
        c.style.opacity = ad > 7 ? (9 - ad) / 2 : 1;
        c.classList.toggle('front', i === active);
      });
      if (pos !== target || ov !== (out ? 1 : 0)) requestAnimationFrame(frame); else ticking = false;
    };
    const kick = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };

    // 拖动 / 点击
    let sx = null, sp = 0, moved = false;
    stage.addEventListener('pointerdown', e => { sx = e.clientX; sp = pos; moved = false; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', e => { if (sx === null) return; const dx = e.clientX - sx; if (Math.abs(dx) > 6) moved = true;
      if (moved) { target = clamp(sp - dx / (size * .32), -.4, n - .6); const r = clamp(Math.round(target), 0, n - 1); if (r !== active) { setOut(false); show(r); } kick(); } });
    const up = e => { if (sx === null) return; sx = null;
      if (moved) return go(target);
      const c = document.elementsFromPoint(e.clientX, e.clientY).map(x => x.closest && x.closest('.rk')).find(Boolean);
      if (!c) return; const i = +c.dataset.i; if (i === active) setOut(!out); else go(i); };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', () => { sx = null; go(target); });
    // 触控板横向滑动；竖向滚动不拦，页面照常往下走
    let wt = null; stage.addEventListener('wheel', e => { if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; e.preventDefault();
      target = clamp(target + e.deltaX / 90, 0, n - 1); const r = Math.round(target); if (r !== active) { setOut(false); show(r); } kick();
      clearTimeout(wt); wt = setTimeout(() => go(target), 140); }, { passive: false });
    stage.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOut(!out); } });
    el.querySelector('[data-prev]').onclick = () => go(active - 1);
    el.querySelector('[data-next]').onclick = () => go(active + 1);
    el.querySelector('.crate-track').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); go((e.clientX - r.left) / r.width * n - .5); };
    box.addEventListener('click', e => { if (e.target.closest('[data-pull]')) setOut(!out); });

    measure(); show(0); frame();
    addEventListener('resize', () => { measure(); kick(); });
  };
})();
