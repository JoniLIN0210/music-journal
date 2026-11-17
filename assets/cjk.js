/* ---------- 中文断行：只在标点处换行，不让一两个字落单 ---------- */
window.clauses = el => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), ns = []; while (w.nextNode()) ns.push(w.currentNode);
  ns.forEach(n => { const parts = n.textContent.match(/[^，。；：！？、]+[，。；：！？、]*|[，。；：！？、]+/g); if (!parts || !n.textContent.trim()) return;
    const f = document.createDocumentFragment();
    parts.forEach(p => { const [, a, core, b] = p.match(/^(\s*)([\s\S]*?)(\s*)$/); if (a) f.append(' ');
      const sp = document.createElement('span'); sp.className = 'cl'; sp.textContent = core; f.append(sp); if (b) f.append(' '); });
    n.replaceWith(f); }); };
