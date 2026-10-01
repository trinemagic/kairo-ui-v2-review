# Alat tes KAIRO (tanpa Supabase asli)

Sandbox Claude memblokir CDN Supabase dan database asli, jadi app diuji dengan
**mock Supabase in-memory** (`mockdb.js`) yang disuntikkan menggantikan
`supabase-js@2`. Semua query dicatat di `window.__db.log`, data ada di
`window.__db.tables.<nama_tabel>`.

## Menjalankan
```bash
cd /home/user/kairo-ui-v2-review && python3 -m http.server 8123 &   # sajikan repo
cd .claude/testing
npm pack chart.js@4 >/dev/null && mkdir -p chartjs && tar xzf chart.js-*.tgz -C chartjs && rm chart.js-*.tgz   # opsional, untuk Performance
node example.js                     # contoh: dashboard + screenshot ke out/
node audit-contrast.js dark         # audit kontras WCAG semua menu (dark)
node audit-contrast.js light light  # audit kontras (light)
```

## File
- `mockdb.js` — klien Supabase palsu (select/eq/lte/gte/in/order/range/insert/update/delete/upsert).
  `window.__db.failInsert[tabel] = 'pesan'` memaksa insert gagal;
  `window.__db.rejectColumn[tabel] = 'kolom'` menolak payload yang berisi kolom itu.
- `boot.js` — `bootApp(browser, {width, height, mobile, plan, seed})` membuka app dalam
  keadaan login (workspace `w1`, role owner).
- `seed.js` — data contoh: master paket/addon/topik, partner (`profit_share_rules`),
  40 transaksi (3 On Progress untuk notifikasi), customer, payout, kas, shift, promo.
- `audit-contrast.js` — buka 8 menu × desktop/mobile, hitung rasio kontras semua
  teks terlihat vs latar sebenarnya, tulis `out/<tag>-audit.json`.

Catatan: hanya Chromium (tidak ada WebKit/Safari). `out/` dan `chartjs/` diabaikan git.
