const { chromium, bootApp } = require('./boot.js');
// SELLER=1 audits the Seller App Premium template with seller data.
const SELLER = !!process.env.SELLER;
const SEED = require(SELLER ? './seed-seller.js' : './seed.js');
const fs = require('fs');
const { lowContrast } = require('./contrast-lib.js');
// Usage: node audit-contrast.js [tag] [light]   -> writes out/<tag>-audit.json + screenshots
const path = require('path');
const S = path.join(__dirname, 'out'); fs.mkdirSync(S, { recursive: true });
const tag = process.argv[2] || 'audit', dark = process.argv[3] !== 'light';
(async () => {
  const b = await chromium.launch();
  const out = {};
  for (const [vp, w, h, m] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
    const p = await bootApp(b, { width: w, height: h, mobile: m, seed: SEED, template: SELLER ? 'seller' : '' });
    if (dark) await p.evaluate(() => { if (!document.body.classList.contains('saas-dark')) document.getElementById('saas-theme-toggle').click(); });
    await p.waitForTimeout(700);
    for (const tab of ['dashboard', 'performance', 'input', 'customers', 'promo', 'payout', 'cash', 'settings']) {
      await p.evaluate(async t => { try { openAppPage(t); await loadPageData(t, { force: true }); } catch (e) { console.warn('load', t, e.message); } }, tab);
      await p.waitForTimeout(900);
      const low = await lowContrast(p);
      out[`${vp}:${tab}`] = low;
      await p.screenshot({ path: `${S}/${tag}-${vp}-${tab}.png`, fullPage: vp === 'desktop' ? false : false });
    }
    out[`${vp}:errors`] = p.errs.slice(0, 8);
    await p.close();
  }
  fs.writeFileSync(`${S}/${tag}-audit.json`, JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) console.log(k, Array.isArray(v) ? v.length : v);
  await b.close();
})();
