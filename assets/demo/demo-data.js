/* KAIRO demo: data contoh per template (dibuat saat halaman dibuka, tanggal selalu relatif terhadap hari ini).
   Hanya dimuat saat alamat berakhiran #demo / #demo-<template>. Tidak ada data asli dan tidak ada koneksi ke database. */
(function () {
  'use strict';
  const WS = 'demo-ws', DAY = 86400000;
  const now = Date.now();
  let seed = 20261008;
  const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const NAMES = ['Alya Putri', 'Bima Pratama', 'Citra Dewi', 'Dimas Saputra', 'Eka Lestari', 'Farhan Maulana', 'Gita Permata', 'Hana Safitri', 'Indra Wijaya', 'Jihan Aulia', 'Kevin Hartono', 'Laras Ayu'];
  const META = {
    jasa: { template: 'service_consultation', label: 'Jasa Online' },
    shop: { template: 'online_shop', label: 'Online Shop' },
    digital: { template: 'digital_product', label: 'Digital Product' },
    seller: { template: 'digital_subscription', label: 'Seller App Premium' }
  };

  function base(kind) {
    const T = {};
    T.workspaces = [{ id: WS, name: 'Toko Demo', slug: 'toko-demo', status: 'active' }];
    T.workspace_members = [{ id: 'm1', workspace_id: WS, user_id: 'demo-user', role: 'owner', status: 'active', workspaces: T.workspaces[0] }];
    T.workspace_subscriptions = [{ id: 's1', workspace_id: WS, plan: 'pro', status: 'active', current_period_end: new Date(now + 365 * DAY).toISOString() }];
    T.workspace_branding = [{ workspace_id: WS, receipt_labels: {}, setup_state: { completed_at: new Date().toISOString() } }];
    T.customers = NAMES.map((n, i) => ({ id: 'c' + i, workspace_id: WS, display_name: n, created_at: new Date(now - (60 - i) * DAY).toISOString() }));
    T.partners = [{ id: 'pa1', workspace_id: WS, partner_name: 'Dini', share_pct: 40, percentage: 0.4, is_active: true }, { id: 'pa2', workspace_id: WS, partner_name: 'Raka', share_pct: 40, percentage: 0.4, is_active: true }, { id: 'pa3', workspace_id: WS, partner_name: 'Kas', share_pct: 20, percentage: 0.2, is_active: true }];
    T.profit_share_rules = T.partners.map(p => ({ ...p }));
    T.payouts = [{ id: 'po1', workspace_id: WS, partner_id: 'pa1', partner_name: 'Dini', amount: 250000, payout_date: iso(now - 6 * DAY), notes: 'Transfer mingguan' }, { id: 'po2', workspace_id: WS, partner_id: 'pa2', partner_name: 'Raka', amount: 250000, payout_date: iso(now - 6 * DAY), notes: 'Transfer mingguan' }];
    T.cash_expenses = [{ id: 'ce1', workspace_id: WS, expense_date: iso(now - 2 * DAY), amount: 85000, description: 'Iklan Instagram' }, { id: 'ce2', workspace_id: WS, expense_date: iso(now - 9 * DAY), amount: 45000, description: 'Langganan tools' }];
    T.cash_injections = [{ id: 'ci1', workspace_id: WS, injection_date: iso(now - 40 * DAY), amount: 1000000, source: 'Pribadi', description: 'Modal awal' }];
    T.reading_shifts = [{ id: 'sh1', workspace_id: WS, opened_at: new Date(now - 3 * 3600000).toISOString(), closed_at: null }];
    T.promos = [{ id: 'pr1', workspace_id: WS, name: 'Promo Gajian', target: 'all', discount_type: 'percent', discount_value: 10, is_active: true, starts_at: iso(now), ends_at: iso(now + 7 * DAY) }];
    T.transactions = [];
    return T;
  }

  function tx(T, i, d, o) {
    const total = o.items.reduce((s, x) => s + x.subtotal, 0) + (o.addons || []).reduce((s, x) => s + x.subtotal, 0);
    const c = i % NAMES.length;
    T.transactions.push({
      id: 'tx' + i, workspace_id: WS, transaction_date: iso(d), created_at: new Date(d).toISOString(),
      reading_started_at: new Date(o.openMin ? now - o.openMin * 60000 : d).toISOString(), reading_status: o.openMin ? 'on_progress' : 'done',
      customer_name: NAMES[c], customer_id: 'c' + c, platform: o.platform, payment_method: pick(['QRIS', 'TRANSFER', 'QRIS', 'CASH']),
      order_items: o.items, order_topics: o.topics || [], order_addons: o.addons || [],
      package_code: o.items[0].code, package_qty: o.items[0].qty, total_price: total, tip_amount: 0, ...(o.extra || {})
    });
  }
  const item = (p, qty) => ({ id: p.id, code: p.code, name: p.name, qty, unit_price: p.price, subtotal: p.price * qty, cost_price: p.cost, cost_subtotal: p.cost * qty });

  function service(kind) {
    const T = base(kind);
    const digital = kind === 'digital';
    const P = digital
      ? [{ id: 'p1', code: 'NOTION', name: 'Template Notion Keuangan', price: 49000, cost: 5000 }, { id: 'p2', code: 'EBOOK', name: 'E-book Panduan Freelance', price: 79000, cost: 8000 }, { id: 'p3', code: 'PRESET', name: 'Preset Lightroom (10)', price: 59000, cost: 4000 }, { id: 'p4', code: 'CANVA', name: 'Paket Template Canva', price: 99000, cost: 10000 }]
      : [{ id: 'p1', code: 'LOGO', name: 'Desain Logo', price: 350000, cost: 90000 }, { id: 'p2', code: 'FEED', name: 'Desain Feed Instagram (9 post)', price: 250000, cost: 60000 }, { id: 'p3', code: 'REELS', name: 'Edit Video Reels', price: 150000, cost: 40000 }, { id: 'p4', code: 'BRAND', name: 'Konsultasi Brand 1 Jam', price: 200000, cost: 20000 }];
    const A = digital
      ? [{ id: 'a1', code: 'UPD', name: 'Update Seumur Hidup', price: 25000, cost: 0 }, { id: 'a2', code: 'WA', name: 'Bantuan Setup via WhatsApp', price: 35000, cost: 5000 }]
      : [{ id: 'a1', code: 'REV', name: 'Revisi Tambahan', price: 50000, cost: 10000 }, { id: 'a2', code: 'MST', name: 'File Master', price: 75000, cost: 0 }, { id: 'a3', code: 'EXP', name: 'Kilat 24 Jam', price: 100000, cost: 20000 }];
    const TOP = digital ? ['Produktivitas', 'Desain', 'Edukasi'] : ['Branding', 'Sosial Media', 'Promosi'];
    const PL = ['Instagram', 'TikTok', 'WhatsApp', 'Instagram', 'X'];
    T.package_masters = P.map(p => ({ id: p.id, workspace_id: WS, code: p.code, name: p.name, price: p.price, cost_price: p.cost, is_active: true }));
    T.addon_masters = A.map(a => ({ id: a.id, workspace_id: WS, code: a.code, name: a.name, price: a.price, cost_price: a.cost, is_active: true }));
    T.topic_masters = TOP.map((n, i) => ({ id: 't' + (i + 1), workspace_id: WS, name: n, is_active: true }));
    for (let i = 0; i < 64; i++) {
      const d = now - (i * 0.7 + rnd() * 0.5) * DAY, p = pick(P), q = rnd() > 0.85 ? 2 : 1;
      const addons = rnd() > 0.65 ? [{ ...item(pick(A), 1) }] : [];
      tx(T, i, d, { items: [item(p, q)], addons, topics: [{ name: pick(TOP) }], platform: pick(PL), openMin: i < 2 ? 8 + i * 22 : 0 });
    }
    return T;
  }

  function shop() {
    const T = base('shop');
    const P = [['Kaos Polos Hitam', 85000, 40000, 18, 6], ['Totebag Kanvas', 65000, 45000, 40, 10], ['Topi Baseball', 70000, 30000, 0, 5], ['Tumbler 500ml', 120000, 90000, 7, 8], ['Gantungan Kunci', 15000, 6000, 85, 20], ['Hoodie Oversize', 210000, 120000, 12, 5]].map((x, i) => ({ id: 'sp' + i, code: 'P' + (i + 1), name: x[0], price: x[1], cost: x[2], stock: x[3], min: x[4] }));
    const CH = ['Shopee', 'Shopee', 'Tokopedia', 'TikTok Shop', 'WhatsApp', 'Toko Offline', 'Lazada', 'Shopee'];
    T.package_masters = P.map(p => ({ id: p.id, workspace_id: WS, code: p.code, name: p.name, price: p.price, cost_price: p.cost, stock_qty: p.stock, stock_min: p.min, is_active: true }));
    T.addon_masters = [{ id: 'a1', workspace_id: WS, code: 'BOX', name: 'Kemasan Kado', price: 8000, cost_price: 3000, is_active: true }];
    T.topic_masters = ['Pakaian', 'Aksesoris', 'Perlengkapan'].map((n, i) => ({ id: 't' + (i + 1), workspace_id: WS, name: n, is_active: true }));
    T.workspace_branding[0].receipt_labels = { __topic_label: 'Kategori', __fee_enabled: true, __platform_fees: { Shopee: 8, Tokopedia: 6, 'TikTok Shop': 4.5, Lazada: 7 }, __platforms: ['Shopee', 'Tokopedia', 'TikTok Shop', 'Lazada', 'WhatsApp', 'Instagram', 'Toko Offline', 'Lainnya'] };
    for (let i = 0; i < 86; i++) {
      const d = now - (i * 0.5 + rnd() * 0.4) * DAY, p = pick(P), q = 1 + Math.floor(rnd() * 3), p2 = pick(P);
      const items = [item(p, q)]; if (rnd() > 0.75 && p2 !== p) items.push(item(p2, 1));
      tx(T, i, d, { items, addons: rnd() > 0.85 ? [item({ id: 'a1', code: 'BOX', name: 'Kemasan Kado', price: 8000, cost: 3000 }, 1)] : [], topics: [{ name: pick(['Pakaian', 'Aksesoris', 'Perlengkapan']) }], platform: pick(CH), openMin: i < 2 ? 9 + i * 25 : 0 });
    }
    T.order_returns = [
      { id: 'r1', workspace_id: WS, transaction_date: iso(now - 2 * DAY), kind: 'batal', reason: 'Pembeli batal', platform: 'Shopee', total_price: 85000, items: [], restocked: false },
      { id: 'r2', workspace_id: WS, transaction_date: iso(now - 5 * DAY), kind: 'retur', reason: 'Barang rusak/cacat', platform: 'Shopee', total_price: 210000, restocked: false, items: [{ id: 'sp5', name: 'Hoodie Oversize', qty: 1 }] },
      { id: 'r3', workspace_id: WS, transaction_date: iso(now - 11 * DAY), kind: 'retur', reason: 'Tidak sesuai deskripsi', platform: 'Tokopedia', total_price: 65000, restocked: true, items: [{ id: 'sp1', name: 'Totebag Kanvas', qty: 1 }] },
      { id: 'r4', workspace_id: WS, transaction_date: iso(now - 14 * DAY), kind: 'batal', reason: 'Stok habis', platform: 'TikTok Shop', total_price: 70000, items: [] }
    ];
    return T;
  }

  function seller() {
    const T = base('seller');
    T.package_masters = []; T.addon_masters = []; T.topic_masters = [];
    const SP = [['Netflix', 'Sharing 1P', '1 bulan', 45000, 30000], ['Spotify', 'Individual', '1 bulan', 25000, 15000], ['Canva', 'Pro', '7 hari', 15000, 5000], ['YouTube', 'Family', '1 bulan', 35000, 20000], ['CapCut', 'Pro', '14 hari', 20000, 8000], ['ChatGPT', 'Plus', '1 bulan', 90000, 65000]];
    const stat = ['new', 'on_progress', 'done', 'done', 'done'];
    for (let i = 0; i < 40; i++) {
      const d = now - (i * 0.9 + rnd() * 0.5) * DAY, [pr, va, du, price, cost] = pick(SP), q = rnd() > 0.8 ? 2 : 1, total = price * q;
      T.transactions.push({
        id: 'stx' + i, workspace_id: WS, transaction_date: iso(d), created_at: new Date(d).toISOString(), reading_started_at: new Date(d).toISOString(), reading_status: i < 4 ? 'on_progress' : 'done',
        customer_name: NAMES[i % NAMES.length], customer_id: 'c' + (i % NAMES.length), platform: pick(['Instagram', 'WhatsApp', 'TikTok']), payment_method: pick(['QRIS', 'TRANSFER']),
        device: pick(['iPhone 13', 'Android', 'Laptop']), package_code: 'SELLER_APP', package_qty: q, topic_name: 'Seller App Premium', total_price: total, tip_amount: 0,
        order_items: [{ code: pr, name: pr + ' · ' + va + ' · ' + du, category: 'Streaming', product: pr, variant: va, duration: du, qty: q, unit_price: price, subtotal: total, cost_price: cost, cost_subtotal: cost * q, seller_payment_received: total, seller_payment_total: total, seller_order_status: i < 4 ? stat[i % 2] : 'done' }],
        order_topics: [{ name: 'Seller App Premium' }], order_addons: []
      });
    }
    return T;
  }

  window.__kairoDemoMeta = META;
  window.__kairoDemoBuild = kind => { seed = 20261008; return kind === 'shop' ? shop() : kind === 'seller' ? seller() : service(kind); };
})();
