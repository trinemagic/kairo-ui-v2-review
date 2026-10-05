// Seller App Premium: contrast audit of states the menu audit does not reach (order builder with a
// filled cart, Settings > Produk, customer history dialog, full dashboard history, seller badges).
// Usage: node audit-seller.js [dark|light]   -> out/seller-states-<mode>.json + screenshots
const { chromium, bootApp } = require('./boot.js');
const { lowContrast } = require('./contrast-lib.js');
const SEED = require('./seed-seller.js');
const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] === 'light' ? 'light' : 'dark';
const go = (p, tab) => p.evaluate(async t => { openAppPage(t); await loadPageData(t, { force: true }); }, tab);
(async () => {
  const b = await chromium.launch();
  const out = {};
  for (const [vp, w, h, m] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
    const p = await bootApp(b, { width: w, height: h, mobile: m, seed: SEED, template: 'seller' });
    if (mode === 'dark') await p.evaluate(() => { if (!document.body.classList.contains('saas-dark')) document.getElementById('saas-theme-toggle').click(); });
    await p.waitForTimeout(600);
    const shot = async name => { out[`${vp}:${name}`] = await lowContrast(p, name === 'customer-dialog' ? '#customer-history-modal, .modal.show, dialog[open]' : undefined); await p.screenshot({ path: path.join(OUT, `seller-${mode}-${vp}-${name}.png`), fullPage: false }); };

    await go(p, 'dashboard'); await p.waitForTimeout(900);
    await p.evaluate(() => document.getElementById('seller-history-toggle')?.click()); await p.waitForTimeout(300);
    await shot('dashboard-all-history');
    for (const sel of ['.seller-history-card', '.seller-expiry-row', '.seller-tracker-row']) {
      { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.hover({ force: true }).catch(() => {}); } await p.waitForTimeout(200);
      out[`${vp}:hover ${sel}`] = await lowContrast(p, `#dashboard ${sel}:hover`);
    }

    await go(p, 'input'); await p.waitForTimeout(900);
    const click = async sel => { const el = p.locator(sel).first(); if (await el.count()) { await el.click({ force: true }).catch(() => {}); await p.waitForTimeout(250); return true; } return false; };
    await click('[data-seller-category]'); await click('[data-seller-product]'); await click('[data-seller-variant]'); await click('[data-seller-duration]');
    await click('#seller-add-order');
    await click('[data-seller-category]:nth-child(2)'); await click('[data-seller-product]');
    await p.evaluate(() => document.getElementById('seller-app-premium-template')?.scrollIntoView());
    await shot('orders-cart');

    await go(p, 'customers'); await p.waitForTimeout(900);
    await shot('customers');
    if (await click('.customer-db-name-btn')) {
      await p.waitForTimeout(600); await shot('customer-dialog');
      // Hover state of the dialog table and of the seller dashboard cards is checked separately.
      { const r = p.locator('#customer-history-modal tbody tr').first(); await r.scrollIntoViewIfNeeded().catch(() => {}); await r.hover({ force: true }).catch(() => {}); } await p.waitForTimeout(250);
      out[`${vp}:customer-dialog-hover`] = await lowContrast(p, '#customer-history-modal'); await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelector('.modal.show .btn-close, .modal.show [data-close], #customer-history-modal .close')?.click()); }

    await go(p, 'settings'); await p.waitForTimeout(600);
    await p.evaluate(() => { const s = document.getElementById('settings-category-select'); if (s) { s.value = 'packages'; s.dispatchEvent(new Event('change', { bubbles: true })); } document.querySelector('[data-settings-category="packages"]')?.click(); });
    await p.waitForTimeout(1200);
    await shot('settings-products');
    out[`${vp}:errors`] = p.errs.slice(0, 8);
    await p.close();
  }
  fs.writeFileSync(path.join(OUT, `seller-states-${mode}.json`), JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) { console.log(k, Array.isArray(v) ? v.length : v); if (Array.isArray(v)) v.slice(0, 40).forEach(x => console.log('   ', x)); }
  await b.close();
})();
