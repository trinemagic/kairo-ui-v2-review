// Shared WCAG contrast scanner. lowContrast(page, rootSelector) returns readable lines
// for every visible text element under the roots whose contrast is below AA.
const DEFAULT_ROOTS = '.section.active, #app-shell .header, #app-shell main.container > .toolbar, #saas-sidebar';
async function lowContrast(page, rootSel = DEFAULT_ROOTS) {
  return page.evaluate(rootSel => {
    const parse = c => { let m = c.match(/rgba?\(([^)]+)\)/); if (m) { const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; } m = c.match(/color\(srgb ([^)]+)\)/); if (m) { const v = m[1].split(/[ /]+/).filter(Boolean).map(Number); return { r: v[0] * 255, g: v[1] * 255, b: v[2] * 255, a: v.length > 3 ? v[3] : 1 }; } return null; };
    const lum = ({ r, g, b }) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b) };
    const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
    const bgOf = el => { const stack = []; let e = el; while (e && e.nodeType === 1) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (c && c.a > 0) stack.push(c); if (cs.backgroundImage !== 'none' && !stack.length) return null; if (c && c.a >= 1) break; e = e.parentElement; } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base); return base; };
    const roots = rootSel ? [...document.querySelectorAll(rootSel)].filter(r => r.offsetWidth) : [];
    const res = []; const seen = new Set();
    roots.forEach(root => root.querySelectorAll('*').forEach(el => {
      if (!el.offsetWidth || !el.offsetHeight) return;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1) || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
      if (!own) return;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity < .5) return;
      const fg = parse(cs.color); const bg = bgOf(el); if (!fg || !bg) return;
      const f = fg.a < 1 ? blend(fg, bg) : fg; const L1 = lum(f), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700; const need = (size >= 18.66 && bold) || size >= 24 ? 3 : 4.5;
      if (el.disabled || el.closest('[disabled],[aria-disabled="true"],.plan-locked,.entitlement-locked')) return;
      if (ratio < need) { const txt = (el.value || el.textContent).trim().replace(/\s+/g, ' ').slice(0, 40); const key = el.tagName + '.' + String(el.className).slice(0, 40) + '|' + txt; if (seen.has(key)) return; seen.add(key); res.push(`${ratio.toFixed(2)} [${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).split(' ')[0]}] "${txt}" fg=${cs.color} bg=rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`); }
    }));
    return res;
  }, rootSel);
}
module.exports = { lowContrast, DEFAULT_ROOTS };
