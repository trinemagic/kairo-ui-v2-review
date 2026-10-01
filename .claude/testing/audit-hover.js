// Dark-mode hover audit: hovers the first data row of every visible table on the given menus
// and reports the lowest text/background contrast in that row.   node audit-hover.js [tag]
const { chromium, bootApp } = require('./boot.js');
// SELLER=1 audits the Seller App Premium template with seller data.
const SELLER = !!process.env.SELLER;
const SEED = require(SELLER ? './seed-seller.js' : './seed.js');
const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const tag = process.argv[2] || 'hover';
(async () => {
  const b = await chromium.launch();
  const p = await bootApp(b, { seed: SEED, template: SELLER ? 'seller' : '' });
  await p.evaluate(() => { if (!document.body.classList.contains('saas-dark')) document.getElementById('saas-theme-toggle').click(); });
  await p.waitForTimeout(700);
  const res = {};
  for (const tab of ['dashboard', 'customers', 'payout', 'cash', 'input', 'performance']) {
    await p.evaluate(async t => { openAppPage(t); await loadPageData(t, { force: true }); }, tab);
    await p.waitForTimeout(900);
    const n = await p.evaluate(() => [...document.querySelectorAll('.section.active table')].filter(t => t.offsetHeight).length);
    for (let i = 0; i < n; i++) {
      const row = p.locator('.section.active table:visible').nth(i).locator('tbody tr').first();
      if (!(await row.count())) continue;
      await row.scrollIntoViewIfNeeded().catch(() => {});
      await row.hover({ force: true }).catch(() => {});
      await p.waitForTimeout(250);
      const r = await p.evaluate(i => {
        const parse = c => { let m = c.match(/rgba?\(([^)]+)\)/); if (m) { const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; } m = c.match(/color\(srgb ([^)]+)\)/); if (m) { const v = m[1].split(/[ /]+/).filter(Boolean).map(Number); return { r: v[0] * 255, g: v[1] * 255, b: v[2] * 255, a: v.length > 3 ? v[3] : 1 }; } return null; };
        const lum = ({ r, g, b }) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b) };
        const blend = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
        const bgOf = el => { const st = []; let e = el; while (e && e.nodeType === 1) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) st.push(c); if (c && c.a >= 1) break; e = e.parentElement; } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let k = st.length - 1; k >= 0; k--) base = blend(st[k], base); return base; };
        const table = [...document.querySelectorAll('.section.active table')].filter(t => t.offsetHeight)[i];
        const tr = table.querySelector('tbody tr'); let worst = 99, sample = '';
        tr.querySelectorAll('td, td *').forEach(el => { if (!el.offsetWidth || ![...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim())) return; const fg = parse(getComputedStyle(el).color), bg = bgOf(el); const f = fg.a < 1 ? blend(fg, bg) : fg; const L1 = lum(f), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); if (ratio < worst) { worst = ratio; sample = `"${el.textContent.trim().slice(0, 24)}" fg=${getComputedStyle(el).color} bg=rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0})`; } });
        const head = table.closest('.card')?.querySelector('.card-title, .card-title-icon')?.textContent.trim().slice(0, 30) || table.id || '';
        return { table: head, worst: +worst.toFixed(2), sample, rowBg: getComputedStyle(tr).backgroundColor, tdBg: getComputedStyle(tr.querySelector('td')).backgroundColor };
      }, i);
      res[`${tab}#${i}`] = r;
      await p.screenshot({ path: path.join(OUT, `${tag}-${tab}-${i}.png`), clip: await row.boundingBox().then(bb => bb ? { x: Math.max(0, bb.x - 10), y: Math.max(0, bb.y - 50), width: Math.min(1100, bb.width + 20), height: bb.height + 100 } : undefined) }).catch(() => {});
    }
  }
  for (const [k, v] of Object.entries(res)) console.log((v.worst < 4.5 ? 'LOW ' : 'ok  ') + k.padEnd(14), String(v.worst).padEnd(6), v.table.padEnd(30), v.sample);
  console.log('errors', JSON.stringify(p.errs));
  await b.close();
})();
