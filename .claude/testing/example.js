// Minimal example: boot the app with seed data, open a page, print state, screenshot.
// Run from this folder:  node example.js
const { chromium, bootApp } = require('./boot.js');
const SEED = require('./seed.js');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await bootApp(browser, { seed: SEED + "window.kairoDisplayName='Owner';" });
  await page.evaluate(async () => { openAppPage('dashboard'); await loadPageData('dashboard', { force: true }); });
  await page.waitForTimeout(800);
  console.log(await page.evaluate(() => ({
    greeting: document.querySelector('#kairo-v3-dashboard-head h2')?.textContent,
    historyRows: document.querySelectorAll('#tx-table-body tr').length,
    dbCalls: window.__db.log.length
  })));
  await page.screenshot({ path: path.join(out, 'dashboard.png') });
  console.log('errors:', page.errs);
  await browser.close();
})();
