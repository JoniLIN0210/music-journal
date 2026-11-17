/* 回到顶部的小黑胶：滚动时唱片跟着转，往回滚就是倒带；外圈记录读到了哪里。 */
window.mountRecord = cover => {
  const R = 25, C = 2 * Math.PI * R, b = document.createElement('button');
  b.className = 'rec'; b.setAttribute('aria-label', '回到顶部');
  b.innerHTML = `<svg viewBox="0 0 52 52"><circle class="track" cx="26" cy="26" r="${R}"/><circle class="prog" cx="26" cy="26" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>
    <span class="disc"><span class="spin vinyl-face"><span class="lbl" style="background-image:url('${cover}')"></span></span><span class="sheen"></span></span>
    <span class="tip">Rewind · 回到开头</span>`;
  document.body.append(b);
  const spin = b.querySelector('.spin'), prog = b.querySelector('.prog'), h = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const upd = () => { const y = h.scrollTop, p = y / Math.max(1, h.scrollHeight - h.clientHeight);
    prog.style.strokeDashoffset = C * (1 - p);
    if (!still) spin.style.transform = `rotate(${y * .3}deg)`;
    b.classList.toggle('on', y > innerHeight * .8); };
  addEventListener('scroll', upd, { passive: true }); upd();
  b.onclick = () => scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
};
