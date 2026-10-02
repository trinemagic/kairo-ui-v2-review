// Boot helper: opens the locally served app (http://localhost:8123) with the in-memory
// mock Supabase from mockdb.js and puts it in an authenticated workspace state.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const MOCK = fs.readFileSync(path.join(__dirname, 'mockdb.js'), 'utf8');
const BASE = process.env.KAIRO_URL || 'http://localhost:8123/index.html';

async function bootApp(browser, { width = 1440, height = 900, mobile = false, plan = 'pro', seed = '', template = '', dsf = 1, workspaceName = 'Trine Magic' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errs.push('console: ' + m.text()); });
  await page.route('**/supabase-js@2', r => r.fulfill({ contentType: 'application/javascript', body: MOCK }));
  const chart = path.join(__dirname, 'chartjs/package/dist/chart.umd.min.js');
  if (fs.existsSync(chart)) await page.route('**/npm/chart.js', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(chart, 'utf8') }));
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  await page.evaluate(({ plan, seed, workspaceName }) => {
    const T = window.__db.tables; // eslint-disable-line no-unused-vars
    eval(seed);
    activeWorkspaceId = 'w1'; activeWorkspaceRole = 'owner'; activeWorkspacePlan = plan; activeWorkspaceName = workspaceName; window.activeWorkspaceName = workspaceName;
    try { activeWorkspaceBranding = window.__db.tables.workspace_branding?.[0] || {}; } catch (e) {}
    document.body.classList.remove('auth-locked');
    document.body.classList.add('authenticated');
    try { window.hydrateSaasUi && window.hydrateSaasUi(); } catch (e) { console.warn(e); }
  }, { plan, seed, workspaceName });
  await page.waitForTimeout(500);
  // template: 'seller' loads Seller App Premium the way kairo-app.js does for
  // business_template=digital_subscription (the mock session has no user metadata).
  if (template === 'seller') {
    await page.evaluate(() => {
      document.documentElement.dataset.businessTemplate = 'digital_subscription';
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.id = 'seller-app-premium-css'; l.href = 'assets/templates/seller-app-premium.css'; document.head.appendChild(l);
      const s = document.createElement('script'); s.id = 'seller-app-premium-js'; s.src = 'assets/templates/seller-app-premium.js'; document.body.appendChild(s);
    });
    await page.waitForFunction(() => document.body.classList.contains('seller-app-premium'), null, { timeout: 8000 });
    await page.waitForTimeout(500);
  }
  return page;
}

module.exports = { chromium, bootApp };
