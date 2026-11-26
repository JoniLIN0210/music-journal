/* 主页的两处 3D 动效，只用浏览器自带的 3D 变换，不引入外部库。
   1. mountOrbit：首屏的一段滚动“场景”。封面先在大数字后面排成倾斜的圆环；往下滚，圆环升到屏幕中央，
      拉成一座随滚动旋转的螺旋塔；再往下，塔炸开，前 36 张落成封面墙，其余的飞向镜头外淡出。
   2. mountCrate：唱片箱，前 20 首从一叠里扇形展开；拖动（带惯性）或按 ← → 翻；点正中那张，黑胶从封套里滑出来转。
   系统开了“减少动态效果”或封面太少时，首屏直接摆成静态封面墙。
   顺滑的关键：所有位置都按“平滑过的滚动位置”计算；前后遮挡交给浏览器按 3D 深度排序，不在每一帧改 z-index。 */
(() => {
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;
  const wrap = a => { a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a; };     // 角度归到 (-π, π]
  const lerpA = (a, b, t) => a + wrap(b - a) * t;                                     // 沿最近的方向转过去
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const span = (s, a, b) => clamp((s - a) / (b - a), 0, 1);
  const damp = (k, dt) => 1 - Math.pow(1 - k, dt / 16.67);                            // 与帧率无关的缓动系数
  const seen = (el, on, margin = '200px 0px') => new IntersectionObserver(es => on(es[0].isIntersecting), { rootMargin: margin }).observe(el);

  /* ---------- 1. 首屏场景：圆环 → 螺旋塔 → 封面墙 ---------- */
  window.mountOrbit = ({ root, title, wall, scene, cards: html, extra = [] }) => {
    const W = html.length; if (!W) return;
    if (REDUCE || W < 12) {                                    // 静态：直接把封面放进墙里
      wall.classList.add('static'); wall.innerHTML = html.join(''); if (scene) scene.remove(); return;
    }
    const narrow = innerWidth < 720;
    const all = narrow ? html : html.concat(extra.slice(0, 40)), N = all.length;
    wall.innerHTML = '<i></i>'.repeat(W);
    const stage = document.createElement('div'); stage.className = 'orbit';
    const space = document.createElement('div'); space.className = 'orbit-3d'; space.innerHTML = all.join('');
    stage.appendChild(space); root.prepend(stage); root.classList.add('has-orbit', 'ring');
    const cards = [...space.children];
    cards.forEach((c, i) => { if (i >= W) { c.classList.add('ex'); c.removeAttribute('href'); c.removeAttribute('data-note'); c.tabIndex = -1; } });
    const rnd = cards.map((_, i) => { const a = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return a - Math.floor(a); });

    let cells = [], cw = 100, vw = 0, vh = 0, end = 1, R = 0, Rh = 0, k = .3, tY = 0;
    const measure = () => {
      vw = innerWidth; vh = innerHeight; const sy = scrollY;
      cells = [...wall.children].map(c => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + sy + r.height / 2 }; });
      cw = wall.children[0].getBoundingClientRect().width;
      const tr = title.getBoundingClientRect(); tY = tr.top + sy + tr.height * .56;
      R = narrow ? vw * .62 : Math.min(vw * .42, 760);
      Rh = narrow ? vw * .38 : Math.min(vw * .26, 420);
      k = clamp((narrow ? vw * .15 : vw * .075) / cw, .2, 1);
      end = Math.max(600, cells[0].y - cw / 2 - vh * .22);
      cards.forEach(c => { c.style.width = c.style.height = cw + 'px'; });
    };

    let sy = scrollY, prev = sy, vel = 0, mx = 0, my = 0, tmx = 0, tmy = 0, t0 = performance.now(), last = t0, run = true, ticking = false;
    const frame = now => {
      const dt = Math.min(50, now - last); last = now;
      sy += (scrollY - sy) * damp(.11, dt); if (Math.abs(scrollY - sy) < .2) sy = scrollY;
      vel += ((sy - prev) / Math.max(dt, 1) - vel) * damp(.15, dt); prev = sy;
      mx += (tmx - mx) * damp(.05, dt); my += (tmy - my) * damp(.05, dt);
      const s = clamp(sy / end, 0, 1), time = (now - t0) * .0001;
      const spin = time + s * TAU * .9 + mx * .3;
      const tilt = .13 + my * .07 + clamp(vel * .06, -.22, .22);       // 滚得快，环会被“甩”得更斜
      const ringY = Math.max(tY - sy, vh * .6);                        // 圆环先跟着大数字往上走，到屏幕中间偏下停住，交给螺旋塔
      const turns = narrow ? 2.2 : 3.2, hh = vh * (narrow ? 1.2 : 1.5);
      for (let i = 0; i < N; i++) {
        const c = cards[i], st = i / N;
        const eB = ease(span(s, .1 + st * .1, .38 + st * .1));          // 圆环 → 螺旋塔
        const eC = ease(span(s, .56 + st * .14, .82 + st * .14));       // 螺旋塔 → 墙 / 飞散
        // 圆环
        const th = spin + TAU * (i % W) / W, zr = R * Math.cos(th);
        const rx = vw / 2 + R * Math.sin(th), ry = ringY + zr * Math.sin(tilt), rz = zr * Math.cos(tilt) - R * .35;
        // 螺旋塔：绕竖轴转，自下而上
        const ph = spin * 1.7 + TAU * i / (N / turns), zh = Rh * Math.cos(ph);
        const hx = vw / 2 + Rh * Math.sin(ph), hy = vh / 2 + (st - .5) * hh + zh * Math.sin(tilt) * .3, hz = zh - Rh * .15;
        // 终点：墙上的格子，或飞出画面
        let fx, fy, fz, fr, fs, fo;
        if (i < W) { const cell = cells[i]; fx = cell.x; fy = cell.y - scrollY; fz = 0; fr = 0; fs = 1; fo = 1; }
        else { const a = rnd[i] * TAU; fx = vw / 2 + Math.cos(a) * vw * .75; fy = vh / 2 + Math.sin(a) * vh * .75; fz = 300 + rnd[i] * 500; fr = (rnd[i] - .5) * 3; fs = k; fo = 0; }
        const x = lerp(lerp(rx, hx, eB), fx, eC), y = lerp(lerp(ry, hy, eB), fy, eC), z = lerp(lerp(rz, hz, eB), fz, eC);
        const r = lerpA(lerpA(wrap(th), wrap(ph), eB), fr, eC), sc = lerp(lerp(k, k * 1.08, eB), fs, eC);
        // 远处的淡一些；多出来的封面不进圆环，等螺旋塔成形时才出现
        const oR = i < W ? .3 + .7 * (zr / R + 1) / 2 : 0, oH = .3 + .7 * (zh / Rh + 1) / 2;
        const o = lerp(lerp(oR, oH, eB), fo, eC);
        c.style.transform = `translate3d(${(x - cw / 2).toFixed(1)}px,${(y - cw / 2).toFixed(1)}px,${z.toFixed(1)}px) rotateY(${r.toFixed(4)}rad) scale(${sc.toFixed(4)})`;
        c.style.opacity = o.toFixed(3);
      }
      const idle = s >= 1 && sy === scrollY;                              // 已经落成墙：只在滚动时跟着格子走
      stage.classList.toggle('flat', idle);
      if (run && !idle) requestAnimationFrame(frame); else ticking = false;
    };
    const kick = () => { if (!ticking) { ticking = true; last = performance.now(); requestAnimationFrame(frame); } };
    measure(); kick();
    seen(root, v => { run = v; stage.style.visibility = v ? '' : 'hidden'; if (v) kick(); }, '0px');
    addEventListener('scroll', () => { if (run) kick(); }, { passive: true });
    addEventListener('resize', () => { measure(); kick(); });
    addEventListener('load', () => { measure(); kick(); });
    addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || !run) return; tmx = e.clientX / innerWidth - .5; tmy = e.clientY / innerHeight - .5; kick(); }, { passive: true });
  };

  /* ---------- 2. 唱片箱 ---------- */
  window.mountCrate = ({ el, songs, cover, info }) => {
    const n = songs.length; if (n < 3) { el.remove(); return; }
    const stage = el.querySelector('.crate-stage'), bar = el.querySelector('.crate-track i'), cnt = el.querySelector('.crate-n'), box = el.querySelector('.crate-info');
    stage.innerHTML = songs.map((s, i) => `<div class="rk" data-i="${i}"><div class="vin"><span class="spin vinyl-face"><span class="lbl" style="background-image:url('${cover(s, 160)}')"></span></span><span class="sheen"></span></div>
      <img class="slv" src="${cover(s, 600)}" alt="${(s.n || '').replace(/"/g, '')}" crossorigin="anonymous" draggable="false"></div>`).join('');
    const cards = [...stage.children];
    let pos = 0, target = 0, active = 0, out = false, ov = 0, fan = REDUCE ? 1 : 0, fanT = REDUCE ? 1 : 0, size = 300, ticking = false, last = 0;
    const measure = () => { size = cards[0].getBoundingClientRect().width || 300; };
    const show = i => { active = i; cnt.textContent = `${String(i + 1).padStart(2, '0')} / ${n}`; bar.style.width = `${(i + 1) / n * 100}%`; box.innerHTML = info(songs[i], i); };
    const setOut = v => { out = v; cards.forEach((c, i) => c.classList.toggle('out', v && i === active)); el.classList.toggle('is-out', v);
      const pb = box.querySelector('[data-pull]'); if (pb) pb.textContent = v ? '收回黑胶 ◑' : '抽出黑胶 ◐'; kick(); };
    const pick = i => { const r = clamp(Math.round(i), 0, n - 1); if (r !== active) { setOut(false); show(r); } };
    const go = i => { target = clamp(Math.round(i), 0, n - 1); pick(target); kick(); };
    let zs = [];
    const frame = now => {
      const dt = Math.min(50, now - (last || now)); last = now;
      pos += (target - pos) * (REDUCE ? 1 : damp(.13, dt)); if (Math.abs(target - pos) < .001) pos = target;
      const ot = out ? 1 : 0; ov += (ot - ov) * (REDUCE ? 1 : damp(.12, dt)); if (Math.abs(ot - ov) < .002) ov = ot;
      fan += (fanT - fan) * damp(.06, dt); if (Math.abs(fanT - fan) < .002) fan = fanT;
      const fe = ease(fan);
      cards.forEach((c, i) => {
        const d = i - pos, ad = Math.abs(d), sg = Math.sign(d), near = Math.min(ad, 1), far = Math.max(ad - 1, 0);
        if (ad > 9) { if (c.style.visibility !== 'hidden') c.style.visibility = 'hidden'; return; } if (c.style.visibility) c.style.visibility = '';
        let x = sg * (near * .64 + far * .17) * size, z = -(near * .5 + far * .03) * size, ry = -sg * near * 64;
        if (i === active) x -= size * .26 * ov;
        if (i > active) x += size * .5 * ov;
        // 入场：先叠成一摞，再扇形展开
        const y = (1 - fe) * (ad * size * .02 - size * .1);
        x *= fe; ry *= fe; z = lerp(-ad * 6, z, fe);
        c.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg)`;
        const zi = out && i === active ? 200 : 100 - Math.round(ad * 4);
        if (zs[i] !== zi) { c.style.zIndex = zi; zs[i] = zi; }           // 只在需要时改层级
        const o = ad > 7 ? (9 - ad) / 2 : 1; c.style.opacity = o;
        c.classList.toggle('front', i === active);
      });
      if (pos !== target || ov !== (out ? 1 : 0) || fan !== fanT) requestAnimationFrame(frame); else ticking = false;
    };
    const kick = () => { if (!ticking) { ticking = true; last = 0; requestAnimationFrame(frame); } };

    // 拖动（松手后带惯性滑一段）/ 点击
    let sx = null, sp = 0, moved = false, lx = 0, lt = 0, v = 0;
    stage.addEventListener('pointerdown', e => { sx = lx = e.clientX; lt = performance.now(); sp = pos; v = 0; moved = false; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', e => { if (sx === null) return; const dx = e.clientX - sx; if (Math.abs(dx) > 6) moved = true;
      const t = performance.now(); v = lerp(v, (e.clientX - lx) / Math.max(1, t - lt), .4); lx = e.clientX; lt = t;
      if (moved) { target = clamp(sp - dx / (size * .32), -.4, n - .6); pick(target); kick(); } });
    const up = e => { if (sx === null) return; sx = null;
      if (moved) return go(target - v * 260 / (size * .32));
      const c = document.elementsFromPoint(e.clientX, e.clientY).map(x => x.closest && x.closest('.rk')).find(Boolean);
      if (!c) return; const i = +c.dataset.i; if (i === active) setOut(!out); else go(i); };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', () => { sx = null; go(target); });
    // 触控板横向滑动；竖向滚动不拦，页面照常往下走
    let wt = null; stage.addEventListener('wheel', e => { if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; e.preventDefault();
      target = clamp(target + e.deltaX / 90, 0, n - 1); pick(target); kick();
      clearTimeout(wt); wt = setTimeout(() => go(target), 140); }, { passive: false });
    stage.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOut(!out); } });
    el.querySelector('[data-prev]').onclick = () => go(active - 1);
    el.querySelector('[data-next]').onclick = () => go(active + 1);
    el.querySelector('.crate-track').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); go((e.clientX - r.left) / r.width * n - .5); };
    box.addEventListener('click', e => { if (e.target.closest('[data-pull]')) setOut(!out); });

    measure(); show(0); kick();
    seen(stage, vis => { if (vis && fanT === 0) { fanT = 1; kick(); } }, '0px 0px -25% 0px');
    addEventListener('resize', () => { measure(); kick(); });
  };
})();
