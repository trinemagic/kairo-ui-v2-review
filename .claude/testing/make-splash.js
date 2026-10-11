// Buat ulang gambar layar awal iOS (apple-touch-startup-image) di assets/splash/.
// Jalankan: node .claude/testing/make-splash.js   (tanpa server; font dibaca dari berkas)
// Isi harus sama dengan #kairo-splash di index.html (latar #1F305E, logo 104px, KAIRO + WORKSPACES). Daftar ukuran = daftar <link> di index.html.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const font = fs.readFileSync(path.join(root, 'assets/fonts/plus-jakarta-sans-latin-wght-normal.woff2')).toString('base64');
const icon = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(root, 'assets/brand/kairo-app-icon.svg')).toString('base64');
// [lebar css, tinggi css, dpr, tinggi status bar css]
const DEVICES = [
  [440, 956, 3, 62], [402, 874, 3, 62], [430, 932, 3, 59], [393, 852, 3, 59], [428, 926, 3, 47], [390, 844, 3, 47],
  [375, 812, 3, 44], [414, 896, 3, 44], [414, 896, 2, 48], [414, 736, 3, 20], [375, 667, 2, 20], [320, 568, 2, 20]
];
(async () => {
  const b = await chromium.launch();
  for (const [w, h, dpr, sb] of DEVICES) {
    const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await page.setContent(`<html><head><style>
      @font-face{font-family:"Plus Jakarta Sans";src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:200 800}
      html,body{margin:0;height:100%;background:#1F305E;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#fff}
      .c{position:fixed;left:0;right:0;top:0;bottom:0;display:grid;place-items:center}
      /* isi diturunkan setengah tinggi status bar: di app, layar awal berada di bawah status bar */
      .in{display:grid;justify-items:center;gap:18px;transform:translateY(${sb / 2}px)}
      .in img{width:104px;height:104px;display:block}
      .n{display:grid;justify-items:center;gap:2px;text-align:center}
      .n b{font-size:30px;font-weight:800;letter-spacing:.14em;line-height:1.1}
      .n span{font-size:15px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#a9bddc}
    </style></head><body><div class="c"><div class="in"><img src="${icon}"><div class="n"><b>KAIRO</b><span>Workspaces</span></div></div></div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const out = path.join(root, `assets/splash/ios-${w * dpr}x${h * dpr}.png`);
    await page.screenshot({ path: out });
    await page.close();
    console.log(path.basename(out), fs.statSync(out).size + ' B');
  }
  await b.close();
})();
