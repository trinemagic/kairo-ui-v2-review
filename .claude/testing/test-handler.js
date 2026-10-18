/* Tes pembagian omzet per handler (Jasa Online): Settings, form Orders, snapshot di transaksi, perhitungan hak partner, handler nonaktif, paket Gratis, template lain.
   Jalankan: cd .claude/testing && node test-handler.js (server lokal :8123 harus hidup). Tidak menguji Supabase asli / Safari / HP asli. */
const { chromium, bootApp } = require('./boot.js');
const SEED = require('./seed.js');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  GAGAL:', m); } else console.log('  ok:', m); };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const PARTNERS = `T.partners=[{id:'g',workspace_id:'w1',partner_name:'Ganesh',percentage:0.5,is_active:true},{id:'m',workspace_id:'w1',partner_name:'Merry',percentage:0.25,is_active:true},{id:'y',workspace_id:'w1',partner_name:'Yono',percentage:0.2,is_active:true},{id:'k',workspace_id:'w1',partner_name:'Kas',percentage:0.05,is_active:true}];T.profit_share_rules=T.partners.map(p=>({...p}));T.transactions=[];T.payouts=[];`;
const SUB = plan => `T.workspace_subscriptions=[{workspace_id:'w1',plan:'${plan}',status:'active'}];`;
async function setup(b, opts = {}) {
  const p = await bootApp(b, { seed: SEED + PARTNERS + SUB(opts.plan || 'pro'), ...opts });
  await p.evaluate(async () => { await loadMasters(); });
  await p.waitForTimeout(500);
  return p;
}
const ent = (p, tx, name) => p.evaluate(([tx, name]) => entitlementFromTransactions([tx], partners.find(x => x.partner_name === name)), [tx, name]);
async function openProfitSettings(p) {
  await p.evaluate(() => { openAppPage('settings'); const s = document.getElementById('settings-category-select'); if (s) { s.value = 'profit'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
  await p.waitForTimeout(800);
}
(async () => {
  console.log('=== Jasa Online, Pro ===');
  let b = await chromium.launch(); let p = await setup(b);
  await openProfitSettings(p);
  ok(await p.evaluate(() => !!document.getElementById('kairo-handler-card')), 'kartu "Pembagian per handler" ada di Pembagian Omzet');
  ok(!(await p.evaluate(() => !!document.getElementById('tx-handler-group'))), 'sebelum dinyalakan: form Orders tanpa Handler (akun lama tidak berubah)');
  // order lama (tanpa snapshot) tetap aturan lama
  const base = { id: 'old', total_price: 100000, transaction_date: '2026-10-10', created_at: '2026-10-10T05:00:00Z', order_items: [], order_addons: [] };
  ok(near(await ent(p, base, 'Ganesh'), 100000 * 0.5), 'order tanpa handler: Ganesh 50% seperti biasa');
  // nyalakan
  await p.evaluate(() => { const i = document.getElementById('kh-on'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelectorAll('#kairo-handler-card .kh-row[data-id]').length) === 3, 'tabel handler: 3 partner (Kas tidak termasuk)');
  const prev = await p.evaluate(() => document.querySelector('.kh-row[data-id="g"] small').textContent);
  ok(/masing-masing 20%/.test(prev), 'pratinjau Ganesh: lainnya masing-masing 20% -> ' + prev);
  await p.click('#kh-save'); await p.waitForTimeout(900);
  const saved = await p.evaluate(() => window.__db.tables.workspace_branding[0].receipt_labels?.__handler);
  ok(saved && saved.on === true && saved.main.g === 60 && saved.pair_pct === 50 && saved.inactive.length === 0, 'tersimpan di branding: ' + JSON.stringify(saved));
  ok(await p.evaluate(() => window.kairoHandler.isOn()), 'mode handler aktif');
  // form Orders
  await p.evaluate(async () => { openAppPage('input'); await loadPageData('input', { force: true }); });
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => !!document.getElementById('tx-handler')), 'form Orders punya pilihan Handler');
  const opts = await p.evaluate(() => [...document.querySelectorAll('#tx-handler option')].map(o => o.textContent));
  ok(JSON.stringify(opts) === JSON.stringify(['-- Pilih Handler --', 'Ganesh', 'Merry', 'Yono']), 'pilihan: ' + opts.join(' | '));
  const fill = (name = 'Pelanggan Handler') => p.evaluate(name => {
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('tx-platform', 'Instagram'); set('tx-payment', 'TRANSFER'); document.getElementById('tx-date').value = todayISO();
    document.getElementById('tx-customer').value = name;
    const pk = document.querySelector('.package-check'); pk.checked = true; pk.dispatchEvent(new Event('change', { bubbles: true }));
    const tp = document.querySelector('.topic-check'); tp.checked = true; tp.dispatchEvent(new Event('change', { bubbles: true }));
  }, name);
  await fill();
  ok(!(await p.evaluate(() => document.getElementById('tx-form').checkValidity())) && (await p.evaluate(() => [...document.querySelectorAll('#tx-form :invalid')].map(e => e.id))).includes('tx-handler'), 'tanpa handler: form menolak (wajib pilih)');
  await p.selectOption('#tx-handler', 'g');
  const h1 = await p.innerText('#tx-handler-hint');
  ok(/Ganesh 60%/.test(h1) && /Merry 20%/.test(h1) && /Yono 20%/.test(h1), 'petunjuk pembagian: ' + h1);
  await p.evaluate(() => document.getElementById('tx-form').requestSubmit()); await p.waitForTimeout(700);
  ok(!/Handler:/.test(await p.innerText('#receipt-content')), 'struk untuk customer tidak memuat data handler (internal)');
  await p.evaluate(() => document.getElementById('confirm-save')?.click()); await p.waitForTimeout(1500);
  const tx = await p.evaluate(() => window.__db.tables.transactions.find(t => t.customer_name === 'Pelanggan Handler'));
  ok(tx && tx.handler_partner_id === 'g' && tx.handler_name === 'Ganesh', 'transaksi menyimpan handler: ' + (tx && tx.handler_name));
  const spl = tx && tx.handler_split;
  ok(spl && near(spl.find(x => x.partner_id === 'g').pct, 0.6) && near(spl.find(x => x.partner_id === 'm').pct, 0.2) && near(spl.find(x => x.partner_id === 'y').pct, 0.2), 'snapshot: Ganesh 60% / Merry 20% / Yono 20%');
  ok(await p.evaluate(() => document.getElementById('tx-handler').value) === '', 'handler dikosongkan lagi setelah simpan');
  await p.evaluate(async () => { openAppPage('dashboard'); await loadPageData('dashboard', { force: true }); }); await p.waitForTimeout(700);
  ok(await p.evaluate(() => { const row = document.querySelector('#tx-table-body tr[data-handler="Ganesh"]'); row?.querySelector('.kairo-tx-detail-btn')?.click(); return /HandlerGanesh/.test(document.querySelector('#kairo-tx-detail dl')?.textContent || ''); }), 'dialog Detail riwayat menampilkan Handler: Ganesh');
  await p.evaluate(() => document.querySelector('.kairo-tx-detail-close')?.click());
  await p.evaluate(async () => { openAppPage('input'); await loadPageData('input', { force: true }); }); await p.waitForTimeout(400);
  // hak partner: total 100.000, tanpa HPP; Kas 5% dulu, sisa 95% dibagi 60/20/20
  const t2 = { id: 'x', total_price: 100000, transaction_date: '2026-10-10', created_at: '2026-10-10T05:00:00Z', order_items: [], order_addons: [], handler_split: spl };
  const eg = await ent(p, t2, 'Ganesh'), em = await ent(p, t2, 'Merry'), ey = await ent(p, t2, 'Yono');
  ok(near(eg, 57000) && near(em, 19000) && near(ey, 19000), `hak: Ganesh ${eg} / Merry ${em} / Yono ${ey} (Kas 5.000 dipotong dulu)`);
  ok(near(await p.evaluate(t => cashEntitlementFromTransactions([t]), t2), 5000), 'hak Kas tetap 5.000 (tidak terpengaruh handler)');
  ok(near(eg + em + ey + 5000, 100000), 'total semua hak = total order');
  // handler Merry
  const sM = await p.evaluate(() => window.kairoHandler.splitFor(partners.find(x => x.id === 'm'), partners.filter(x => x.id !== 'k'), { main: {}, pair_pct: 50, inactive: [] }));
  ok(near(sM.find(x => x.partner_id === 'm').pct, 0.6) && near(sM.find(x => x.partner_id === 'g').pct, 0.2), 'kalau Merry handler: Merry 60%, lainnya 20%');
  // nonaktifkan Yono
  await openProfitSettings(p);
  await p.evaluate(() => { const i = document.querySelector('.kh-row[data-id="y"] [data-kh-active]'); i.checked = false; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(300);
  const pv = await p.evaluate(() => document.querySelector('.kh-row[data-id="g"] small').textContent);
  ok(/Tinggal 2 handler: Ganesh 50% · Merry 50%/.test(pv), 'pratinjau setelah Yono nonaktif: ' + pv);
  ok(await p.evaluate(() => document.querySelector('.kh-row[data-id="g"] [data-kh-pct]').disabled), 'kolom porsi dikunci saat tinggal 2 aktif (otomatis)');
  await p.click('#kh-save'); await p.waitForTimeout(900);
  await p.evaluate(async () => { openAppPage('input'); await loadPageData('input', { force: true }); });
  await p.waitForTimeout(600);
  const opts2 = await p.evaluate(() => [...document.querySelectorAll('#tx-handler option')].map(o => o.textContent));
  ok(JSON.stringify(opts2) === JSON.stringify(['-- Pilih Handler --', 'Ganesh', 'Merry']), 'Yono tidak bisa dipilih lagi: ' + opts2.join(' | '));
  await fill('Pelanggan Dua'); await p.selectOption('#tx-handler', 'g');
  const h2 = await p.innerText('#tx-handler-hint');
  ok(/Ganesh 50%/.test(h2) && /Merry 50%/.test(h2) && !/Yono/.test(h2), '2 handler aktif: 50-50 -> ' + h2);
  await p.evaluate(() => document.getElementById('tx-form').requestSubmit()); await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById('confirm-save')?.click()); await p.waitForTimeout(1500);
  const tx2 = await p.evaluate(() => window.__db.tables.transactions.filter(t => t.handler_name === 'Ganesh').pop());
  console.log('   tx2:', JSON.stringify(tx2 && tx2.handler_split), 'jumlah order bertanda handler:', await p.evaluate(() => window.__db.tables.transactions.filter(t => t.handler_name).length));
  ok(tx2 && tx2.handler_split.length === 2 && near(tx2.handler_split[0].pct, 0.5), 'order baru memakai 50-50 tanpa mengubah angka manual');
  // order lama (Yono ikut) tidak berubah
  const eyOld = await ent(p, { ...t2 }, 'Yono');
  ok(near(eyOld, 19000), 'order lama: hak Yono tetap 19.000 (snapshot)');
  // payout ke partner yang haknya hanya dari handler
  ok(await p.evaluate(() => { const part = partners.find(x => x.id === 'y'); return typeof partnerHasHandlerShare === 'function'; }), 'fungsi partnerHasHandlerShare ada');
  ok(p.errs.filter(e => !/ERR_TUNNEL|status of 404/.test(e)).length === 0, 'tanpa error JS ' + JSON.stringify(p.errs.filter(e => !/ERR_TUNNEL|status of 404/.test(e))));
  await b.close();

  console.log('=== Matikan lagi: kembali ke pembagian biasa ===');
  b = await chromium.launch(); p = await setup(b);
  await openProfitSettings(p);
  await p.evaluate(() => { const i = document.getElementById('kh-on'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.click('#kh-save'); await p.waitForTimeout(800);
  await openProfitSettings(p);
  await p.evaluate(() => { const i = document.getElementById('kh-on'); i.checked = false; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.click('#kh-save'); await p.waitForTimeout(800);
  await p.evaluate(async () => { openAppPage('input'); await loadPageData('input', { force: true }); });
  await p.waitForTimeout(500);
  ok(!(await p.evaluate(() => !!document.getElementById('tx-handler-group'))), 'dimatikan: pilihan Handler hilang dari form Orders');
  await b.close();

  console.log('=== Validasi pengaturan ===');
  b = await chromium.launch(); p = await setup(b);
  await openProfitSettings(p);
  await p.evaluate(() => { const i = document.getElementById('kh-on'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.fill('.kh-row[data-id="g"] [data-kh-pct]', '100'); await p.click('#kh-save'); await p.waitForTimeout(500);
  ok(/antara 1% dan 99%/.test(await p.innerText('#kh-status')), 'porsi 100% ditolak dengan pesan jelas');
  await b.close();

  console.log('=== Paket Gratis & template lain: tidak ada fitur ===');
  b = await chromium.launch(); p = await setup(b, { plan: 'basic' });
  await openProfitSettings(p);
  ok(!(await p.evaluate(() => !!document.getElementById('kairo-handler-card'))), 'Gratis: kartu handler tidak ada');
  await b.close();
  for (const tpl of ['shop', 'pos', 'seller']) {
    b = await chromium.launch(); p = await bootApp(b, { template: tpl, seed: require('./' + { shop: 'seed-shop.js', pos: 'seed-pos.js', seller: 'seed-seller.js' }[tpl]) });
    await openProfitSettings(p);
    ok(!(await p.evaluate(() => !!document.getElementById('kairo-handler-card'))), tpl + ': kartu handler tidak ada');
    ok(!(await p.evaluate(() => window.kairoHandler.isOn())), tpl + ': mode handler tidak pernah aktif');
    await b.close();
  }
  console.log(fails ? 'TOTAL GAGAL ' + fails : 'SEMUA LULUS');
})();
