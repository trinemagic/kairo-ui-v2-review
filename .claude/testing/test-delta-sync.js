// Uji sinkron transaksi bertahap (allTransactions): muat penuh sekali, lalu hanya baris berubah; tambah/ubah/hapus; sama dengan muat penuh; tanpa kolom updated_at = selalu penuh.
const { chromium, bootApp } = require('./boot.js');
const SEED = require('./seed.js');
(async () => {
  const b = await chromium.launch();
  const p = await bootApp(b, { seed: SEED });
  const ev = (f, a) => p.evaluate(f, a);
  // semua baris awal diberi updated_at (seolah kolom sudah ada di DB)
  await ev(() => { window.__db.tables.transactions.forEach((r, i) => { r.updated_at = new Date(Date.now() - 3*3600e3 - i * 60e3).toISOString(); }); });
  // tambah banyak baris supaya perbedaan terlihat
  await ev(() => { const T = window.__db.tables.transactions; const base = T[0]; for (let i = 0; i < 1960; i++) T.push({ ...base, id: 'bulk' + i, updated_at: new Date(Date.now() - 3*3600e3 - (100 + i) * 60e3).toISOString(), transaction_date: new Date(Date.now() - (i % 300) * 864e5).toISOString().slice(0, 10) }); });
  const info = () => ev(() => ({ rowsOut: window.__db.rowsOut, store: txStore.map.size, delta: txStore.delta, n: window.__db.tables.transactions.length }));
  const reset = () => ev(() => { window.__db.rowsOut = 0; window.__db.log.length = 0; });
  const lastTxSelects = () => ev(() => window.__db.log.filter(l => l.startsWith('select:transactions')).map(l => (/updated_at/.test(l) ? 'delta' : /"in"/.test(l) ? 'ambil-id-hilang' : 'penuh/hitung/daftar-id')));
  const sync = () => ev(async () => { invalidateWorkspaceData(['transactions']); const rows = await allTransactions(); return rows.length; });

  // 1. muat penuh (store dikosongkan)
  await ev(() => { txStore.wid = ''; txStore.map = new Map(); txStore.delta = false; invalidateWorkspaceData(['transactions']); });
  await reset(); console.log('1 muat penuh  : baris', await sync(), JSON.stringify(await info()), JSON.stringify(await lastTxSelects()));
  // 2. sinkron tanpa perubahan x10
  await reset(); for (let i = 0; i < 10; i++) await sync();
  console.log('2 10x refresh tanpa perubahan: baris dikirim', (await info()).rowsOut, '(dulu 10 x 2000 = 20000)');
  // 3. insert baru
  await ev(async () => { await db.from('transactions').insert([{ id: 'new1', workspace_id: 'w1', transaction_date: '2026-10-11', total_price: 123, customer_name: 'Baru' }]); });
  await reset(); const n3 = await sync(); console.log('3 insert      : baris', n3, 'dikirim', (await info()).rowsOut, JSON.stringify(await lastTxSelects()));
  // 4. update
  await ev(async () => { await db.from('transactions').update({ customer_name: 'DIUBAH' }).eq('id', 'new1'); });
  await reset(); await sync(); console.log('4 update      :', await ev(async () => (await allTransactions()).find(r => r.id === 'new1').customer_name), 'dikirim', (await info()).rowsOut);
  // 5. hapus
  await ev(async () => { await db.from('transactions').delete().eq('id', 'bulk5'); });
  await reset(); const n5 = await sync(); console.log('5 hapus       : baris', n5, 'ada bulk5?', await ev(async () => (await allTransactions()).some(r => r.id === 'bulk5')), JSON.stringify(await lastTxSelects()));
  // 6. insert + hapus bersamaan
  await ev(async () => { await db.from('transactions').insert([{ id: 'new2', workspace_id: 'w1', transaction_date: '2026-10-11', total_price: 1 }]); await db.from('transactions').delete().eq('id', 'bulk6'); });
  await reset(); const n6 = await sync(); console.log('6 ins+hapus   : baris', n6, 'new2?', await ev(async () => (await allTransactions()).some(r => r.id === 'new2')), 'bulk6?', await ev(async () => (await allTransactions()).some(r => r.id === 'bulk6')));
  await sync();
  const ordered = await ev(async () => { const r = await allTransactions(); for (let i = 1; i < r.length; i++) { const a = r[i-1], b = r[i]; if (String(a.transaction_date) < String(b.transaction_date)) return false; if (String(a.transaction_date) === String(b.transaction_date) && String(a.created_at||'') < String(b.created_at||'')) return false; } return true; });
  console.log('10 urutan hasil bertahap (tanggal desc, dibuat desc):', ordered);
  // 7. sama persis dengan muat penuh baru?
  const delta = await ev(async () => (await allTransactions()).map(r => r.id + '|' + r.customer_name + '|' + r.total_price));
  await ev(() => { txStore.wid = ''; txStore.map = new Map(); txStore.delta = false; });
  const full = await ev(async () => { invalidateWorkspaceData(['transactions']); return (await allTransactions()).map(r => r.id + '|' + r.customer_name + '|' + r.total_price); });
  const sameSet = JSON.stringify([...delta].sort()) === JSON.stringify([...full].sort());
  console.log('7 hasil bertahap == muat penuh? isi sama:', sameSet, '| urutan sama:', '(urutan diuji terpisah)' , '| baris', delta.length, full.length);
  // 8. kolom tidak ada (updated_at kosong) -> selalu penuh
  await ev(() => { window.__db.noUpdatedAt = true; window.__db.tables.transactions.forEach(r => { delete r.updated_at; }); txStore.wid = ''; txStore.map = new Map(); txStore.delta = false; });
  await sync(); await reset(); await sync(); await sync(); console.log('8 tanpa kolom : tiap refresh penuh ->', JSON.stringify(await lastTxSelects()), 'delta flag', (await info()).delta);
  // 9. validasi pencairan/kas memakai data terbaru
  await ev(() => { window.__db.noUpdatedAt = false; });
  console.log('9 freshTransactionsUpTo:', await ev(async () => (await freshTransactionsUpTo('2026-10-11')).length));
  console.log('errs', JSON.stringify(p.errs));
  await b.close();
})();
