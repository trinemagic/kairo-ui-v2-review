// Screenshot contoh untuk Panduan (assets/guide/<template>-<section>.webp), data contoh nama netral "Toko Demo".
// Run: python3 -m http.server 8123 (repo root), then `node shoot-guide.js` here. Ulangi bila tampilan menu berubah.
const { chromium, bootApp } = require('./boot.js');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '../../assets/guide'); fs.mkdirSync(OUT, { recursive: true });
// Contoh toko online umum untuk tampilan dasar (sama dengan shoot-landing.js: bukan contoh jasa tarot).
const SWAP = [["'TR3'", "'TOTE'"], ["'Tarot 3 Kartu'", "'Totebag Kanvas'"], ["'LOVE'", "'KAOS'"], ["'Love Reading'", "'Kaos Polos'"], ["'VN'", "'WRAP'"], ["'Voice Note'", "'Gift Wrap'"],
 ["'Karier'", "'Reguler'"], ["'Asmara'", "'Pre-order'"], ["'Nesa'", "'Partner A'"], ["'Ganesh'", "'Partner B'"]];
const swap = src => SWAP.reduce((s, [a, b]) => s.split(a).join(b), src);
const BASE = swap(require('./seed.js')) + `;T.workspace_branding[0].receipt_labels={start:'Tanggal',status_value:'Diproses',package:'Produk',topic:'Kategori',addon:'Tambahan'};`;
// Seller: hanya transaksi aplikasi premium (seed-seller menumpang di seed.js yang berisi contoh jasa).
const SELLER = swap(require('./seed-seller.js')) + `;T.transactions=T.transactions.filter(t=>String(t.id).startsWith('stx'));`;

async function toWebp(page, buf, file, width) {
  const data = 'data:image/png;base64,' + buf.toString('base64');
  const webp = await page.evaluate(async ({ data, width }) => {
    const img = new Image(); img.src = data; await img.decode();
    const w = Math.min(width, img.naturalWidth), h = Math.round(img.naturalHeight * w / img.naturalWidth);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/webp', 0.8);
  }, { data, width });
  fs.writeFileSync(file, Buffer.from(webp.split(',')[1], 'base64'));
  console.log(path.basename(file), fs.statSync(file).size);
}

(async () => {
  const b = await chromium.launch();
  for (const [tpl, seed] of [['base', BASE], ['seller', SELLER]]) {
    const p = await bootApp(b, { seed, plan: 'pro', width: 1440, height: 900, dsf: 1.5, workspaceName: 'Toko Demo', template: tpl === 'seller' ? 'seller' : '' });
    await p.evaluate(() => { window.kairoDisplayName = 'Toko Demo'; try { hydrateSaasUi(); } catch (e) {} });
    await p.addStyleTag({ content: '*{caret-color:transparent!important;animation:none!important;transition:none!important} #living-origami-bg,.origami-drifter{display:none!important}' });
    // Periode 30 hari supaya kartu & grafik berisi data contoh.
    await p.evaluate(() => document.querySelector('.period-btn[data-period="30days"], [data-period="30days"]')?.click());
    await p.evaluate(() => loadPageData('dashboard', { force: true }));
    await p.waitForTimeout(1200);
    const tabs = ['dashboard', 'input', 'customers', 'promo', 'performance', 'payout', 'cash', 'settings'].concat(tpl === 'seller' ? ['subscriptions'] : []);
    for (const tab of tabs) {
      await p.evaluate(tab => { (tab === 'settings' ? document.getElementById('saas-settings-side-btn') : document.querySelector(`#saas-sidebar .tab[data-tab="${tab}"]`))?.click(); window.scrollTo(0, 0); }, tab);
      await p.waitForTimeout(tab === 'subscriptions' ? 3000 : 1500);
      if (tab === 'subscriptions') { await p.evaluate(() => [...document.querySelectorAll('#subscriptions button')].find(b => b.textContent.trim() === 'Semua')?.click()); await p.waitForTimeout(800); }
      // Orders seller: tampilkan keranjang "Buat Pesanan Baru" (bagian khas template ini).
      if (tpl === 'seller' && tab === 'input') { await p.evaluate(() => { const e = document.querySelector('.seller-app-head'); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 40); }); await p.waitForTimeout(500); }
      // Area konten utama saja (tanpa sidebar), setinggi satu layar.
      const box = await p.evaluate(() => { const x = Math.round(document.getElementById('saas-sidebar').getBoundingClientRect().right + 8); return { x, y: 0, width: innerWidth - x, height: 860 }; });
      const buf = await p.screenshot({ clip: box });
      await toWebp(p, buf, path.join(OUT, `${tpl}-${tab}.webp`), 900);
    }
    await p.context().close();
  }
  await b.close();
})();
