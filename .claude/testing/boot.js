// Boot helper: opens the locally served app (http://localhost:8123) with the in-memory
// mock Supabase from mockdb.js and puts it in an authenticated workspace state.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const MOCK = fs.readFileSync(path.join(__dirname, 'mockdb.js'), 'utf8');
const BASE = process.env.KAIRO_URL || 'http://localhost:8123/index.html';

async function bootApp(browser, { width = 1440, height = 900, mobile = false, plan = 'pro', seed = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errs.push('console: ' + m.text()); });
  await page.route('**/supabase-js@2', r => r.fulfill({ contentType: 'application/javascript', body: MOCK }));
  const chart = path.join(__dirname, 'chartjs/package/dist/chart.umd.min.js');
  if (fs.existsSync(chart)) await page.route('**/npm/chart.js', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(chart, 'utf8') }));
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  await page.evaluate(({ plan, seed }) => {
    const T = window.__db.tables; // eslint-disable-line no-unused-vars
    eval(seed);
    activeWorkspaceId = 'w1'; activeWorkspaceRole = 'owner'; activeWorkspacePlan = plan; activeWorkspaceName = 'Trine Magic';
    try { activeWorkspaceBranding = window.__db.tables.workspace_branding?.[0] || {}; } catch (e) {}
    document.body.classList.remove('auth-locked');
    document.body.classList.add('authenticated');
    try { window.hydrateSaasUi && window.hydrateSaasUi(); } catch (e) { console.warn(e); }
  }, { plan, seed });
  await page.waitForTimeout(500);
  return page;
}

module.exports = { chromium, bootApp };
