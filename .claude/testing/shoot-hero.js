// Tekstur layar render 3D hero: dashboard demo Online Shop ("Toko Demo") -> hero3d/hero-laptop.webp & hero-phone.webp.
// Run: python3 -m http.server 8123 (repo root), then `node shoot-hero.js` here.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'hero3d');
const chart = path.join(__dirname, 'chartjs/package/dist/chart.umd.js');
async function shoot(b, name, w, h, dsf, outW) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: w < 500, hasTouch: w < 500 });
  const p = await c.newPage();
  if (fs.existsSync(chart)) await p.route('**/chart.js@*/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(chart) }));
  await p.goto('http://localhost:8123/index.html#demo-shop');
  await p.waitForFunction(() => document.body.classList.contains('authenticated') && document.querySelector('#dashboard.active'), null, { timeout: 20000 });
  await p.waitForTimeout(2500);
  await p.addStyleTag({ content: '#kairo-demo-bar,#toast,.kairo-toast-stack{display:none!important} *{caret-color:transparent!important;animation:none!important}' });
  await p.waitForTimeout(300);
  const buf = await p.screenshot();
  const webp = await p.evaluate(async ({ data, outW }) => { const img = new Image(); img.src = data; await img.decode(); const k = outW / img.naturalWidth; const cv = document.createElement('canvas'); cv.width = outW; cv.height = Math.round(img.naturalHeight * k); const x = cv.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, cv.width, cv.height); return cv.toDataURL('image/webp', 0.84); }, { data: 'data:image/png;base64,' + buf.toString('base64'), outW });
  fs.writeFileSync(`${OUT}/${name}.webp`, Buffer.from(webp.split(',')[1], 'base64'));
  console.log(name, fs.statSync(`${OUT}/${name}.webp`).size);
  await c.close();
}
(async () => {
  const b = await chromium.launch();
  await shoot(b, 'hero-laptop', 1440, 900, 1, 1280);
  await shoot(b, 'hero-phone', 390, 844, 2, 520);
  await b.close();
})();
