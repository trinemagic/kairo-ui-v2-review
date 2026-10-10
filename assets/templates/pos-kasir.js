/* KAIRO - Kasir / POS: Dashboard Kasir di atas kerangka tampilan dasar.
   Dimuat HANYA untuk workspace dengan business_template=pos_kasir (loader di kairo-app.js).
   Isi (tahap 1, Dashboard): kartu Profit + Rata-rata per Struk, Sesi Kasir (memakai Open/Close Store lama), Penjualan per Jam,
   Produk Terlaris, Metode Pembayaran + Tipe Pesanan. Tahap 2: Layar Kasir (keranjang, bayar, struk) + Open Bill. Sesi Kasir lengkap (modal awal/selisih), stok menyusul.
   Memakai fungsi/variabel global kairo-app.js (transactions, rupiah, transactionProfitBreakdown, ...). */
(function () {
  'use strict';
  if (window.__kairoPos) return;
  window.__kairoPos = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const money = n => (typeof rupiah === 'function' ? rupiah(Math.round(Number(n) || 0)) : 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'));
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const isMasked = () => typeof maskedNominals !== 'undefined' && maskedNominals;
  const isRollup = t => typeof isRollupTx === 'function' && isRollupTx(t);
  const rows = () => (Array.isArray(transactions) ? transactions.filter(t => !isRollup(t)) : []);
  const profitOf = t => Math.max(-1e12, num(t?.total_price) - transactionProfitBreakdown(t).hpp);
  function periodSuffix() {
    const p = typeof activePeriod !== 'undefined' ? String(activePeriod) : 'today';
    return p === 'today' ? 'Hari Ini' : p === '7days' ? '7 Hari Terakhir' : p === '30days' ? '30 Hari Terakhir' : 'Periode Kustom';
  }
  const setText = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
  const shown = n => (isMasked() ? '••••••' : money(n));

  /* ---------- Kartu statistik: Penjualan, Profit, Jumlah Struk, Saldo Kas, Rata-rata per Struk ---------- */
  function renderKpis() {
    const revEl = document.getElementById('kpi-revenue');
    if (!revEl || !Array.isArray(transactions)) return;
    const list = rows(), suffix = periodSuffix();
    const total = list.reduce((s, t) => s + num(t.total_price), 0);
    setText(revEl.closest('.kpi')?.querySelector('.kpi-label'), 'Penjualan ' + suffix);
    setText(document.getElementById('kpi-tx')?.closest('.kpi')?.querySelector('.kpi-label'), 'Jumlah Struk');
    let card = document.getElementById('pos-kpi-profit-card');
    if (!card) {
      card = document.createElement('div');
      card.className = 'kpi pos-profit-kpi';
      card.id = 'pos-kpi-profit-card';
      card.innerHTML = '<div class="kpi-head"><div class="kpi-label">Profit</div><button type="button" class="kpi-eye" id="pos-profit-eye" aria-label="Sembunyikan nominal"></button></div><div class="kpi-value" id="pos-kpi-profit">Rp0</div>';
      revEl.closest('.kpi').insertAdjacentElement('afterend', card);
      document.getElementById('pos-profit-eye')?.addEventListener('click', () => { if (typeof toggleKpiVisibility === 'function') toggleKpiVisibility(); });
      try { updateKpiEyeButtons(); } catch (_e) { /* tombol mata lama */ }
    }
    setText(card.querySelector('.kpi-label'), 'Profit ' + suffix);
    setText(document.getElementById('pos-kpi-profit'), shown(list.reduce((s, t) => s + profitOf(t), 0)));
    // Kartu "Omzet Bulan Ini" (kpi-rights) dipakai ulang untuk Rata-rata per Struk.
    const rights = document.getElementById('kpi-rights');
    if (rights) {
      setText(rights.closest('.kpi')?.querySelector('.kpi-label'), 'Rata-rata per Struk');
      setText(rights, shown(list.length ? total / list.length : 0));
    }
  }
  document.addEventListener('click', e => { if (e.target.closest?.('#dashboard .kpi-eye')) setTimeout(() => { renderKpis(); renderDrawerKpi(); renderPanels(); }, 0); }, true);

  /* ---------- Istilah Sesi Kasir (Open/Close Store lama, ID tetap) ---------- */
  function relabelShift() {
    const card = document.querySelector('#dashboard > .shift-card');
    if (!card) return;
    setText(card.querySelector('.shift-top .card-title'), 'Sesi Kasir');
    setText(document.getElementById('open-shift-btn'), 'Buka Kasir');
    setText(document.getElementById('close-shift-btn'), 'Tutup Kasir');
    const stats = card.querySelectorAll('.shift-stat-label');
    ['Penjualan Sesi Ini', 'Struk Sesi Ini', 'Dibuka', 'Durasi'].forEach((t, i) => setText(stats[i], t));
  }

  /* ---------- Panel: Penjualan per Jam | Produk Terlaris, Metode Pembayaran, Tipe Pesanan ---------- */
  let chart = null;
  function ensureMount() {
    const shift = document.querySelector('#dashboard > .shift-card');
    if (!shift) return false;
    if (!document.getElementById('pos-hourly')) {
      const hourly = document.createElement('div');
      hourly.id = 'pos-hourly'; hourly.className = 'pos-hourly';
      hourly.innerHTML = '<div class="pos-head"><div class="card-title">Penjualan per Jam</div><span class="pos-sub" id="pos-peak"></span></div><div class="pos-chart"><canvas id="pos-hourly-chart"></canvas></div>';
      shift.appendChild(hourly);
    }
    if (!document.getElementById('pos-dash-row')) {
      const row = document.createElement('div');
      row.id = 'pos-dash-row'; row.className = 'pos-dash-row';
      row.innerHTML = `
        <div class="card"><div class="card-title">Produk Terlaris</div><div class="table-wrap"><table><thead><tr><th>Produk</th><th>Terjual</th><th>Omzet</th></tr></thead><tbody id="pos-top-body"></tbody></table></div></div>
        <div class="card"><div class="card-title">Metode Pembayaran</div><div id="pos-pay"></div><div class="card-title pos-gap">Tipe Pesanan</div><div id="pos-type"></div></div>`;
      shift.insertAdjacentElement('afterend', row);
    }
    return true;
  }

  const hourOf = t => {
    const raw = t.reading_started_at || t.created_at || '';
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.getHours();
  };

  async function drawHourly(list) {
    const canvas = document.getElementById('pos-hourly-chart');
    if (!canvas) return;
    const byHour = new Array(24).fill(0);
    list.forEach(t => { const h = hourOf(t); if (h !== null) byHour[h] += num(t.total_price); });
    const used = byHour.map((v, h) => (v > 0 ? h : -1)).filter(h => h >= 0);
    const from = used.length ? Math.max(0, Math.min(...used) - 1) : 8, to = used.length ? Math.min(23, Math.max(...used) + 1) : 19;
    const hours = []; for (let h = from; h <= to; h++) hours.push(h);
    const vals = hours.map(h => byHour[h]);
    const top = [...vals].sort((a, b) => b - a).filter(v => v > 0).slice(0, 2);
    const peak = hours.filter((h, i) => vals[i] > 0 && top.includes(vals[i]));
    setText(document.getElementById('pos-peak'), peak.length ? 'Jam ramai: ' + peak.map(h => String(h).padStart(2, '0') + '.00').join(' & ') : '');
    try { await ensureChartLibrary(); } catch (_e) { return; }
    if (typeof Chart === 'undefined') return;
    const c = chartBrandColors();
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: hours.map(h => String(h).padStart(2, '0')), datasets: [{ data: vals, backgroundColor: vals.map((v, i) => (peak.includes(hours[i]) ? c.primary : c.alpha(c.primary, .45))), borderRadius: 6, maxBarThickness: 34 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => `Jam ${i[0].label}.00`, label: x => (isMasked() ? '••••••' : money(x.parsed.y)) } } },
        scales: chartAxes(c, { x: { grid: { display: false } }, y: { beginAtZero: true, grace: '8%', ticks: { callback: v => (typeof shortRupiah === 'function' ? shortRupiah(v) : v), maxTicksLimit: 5 } } })
      }
    });
  }

  function renderPanels() {
    if (!Array.isArray(transactions) || !ensureMount()) return;
    const list = rows();
    // Produk terlaris
    const sold = new Map();
    list.forEach(t => (Array.isArray(t.order_items) ? t.order_items : []).forEach(x => {
      const k = String(x?.name || x?.code || '-');
      const o = sold.get(k) || { name: k, qty: 0, rev: 0 };
      o.qty += Math.max(0, num(x?.qty || 1)); o.rev += num(x?.subtotal ?? (num(x?.unit_price) * num(x?.qty || 1)));
      sold.set(k, o);
    }));
    const top = [...sold.values()].sort((a, b) => b.qty - a.qty || b.rev - a.rev).slice(0, 5);
    document.getElementById('pos-top-body').innerHTML = top.length
      ? top.map(r => `<tr><td><strong>${esc(r.name)}</strong></td><td>${r.qty.toLocaleString('id-ID')}</td><td>${shown(r.rev)}</td></tr>`).join('')
      : '<tr><td colspan="3" class="empty">Belum ada penjualan pada periode ini.</td></tr>';
    // Metode pembayaran
    const group = (key, fallback) => {
      const m = new Map();
      list.forEach(t => { const k = String(t[key] || fallback).trim() || fallback; const o = m.get(k) || { name: k, n: 0, rev: 0 }; o.n++; o.rev += num(t.total_price); m.set(k, o); });
      return [...m.values()].sort((a, b) => b.rev - a.rev);
    };
    const total = list.reduce((s, t) => s + num(t.total_price), 0);
    const pay = group('payment_method', 'Lainnya');
    const bc = chartBrandColors();
    const COLORS = [bc.primary, bc.accent, '#dfa94a', '#8794a8', '#c4455c'];
    document.getElementById('pos-pay').innerHTML = pay.length
      ? `<div class="pos-split">${pay.map((r, i) => `<span style="width:${total ? r.rev / total * 100 : 0}%;background:${COLORS[i % COLORS.length]}"></span>`).join('')}</div>` +
        pay.map((r, i) => `<div class="pos-lg"><span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(r.name)}</span><b>${total ? Math.round(r.rev / total * 100) : 0}% · ${shown(r.rev)}</b></div>`).join('')
      : '<div class="pos-empty">Belum ada penjualan pada periode ini.</div>';
    const type = group('platform', 'Tanpa tipe');
    document.getElementById('pos-type').innerHTML = type.length
      ? type.map(r => `<div class="pos-lg"><span>${esc(r.name)}</span><b>${r.n.toLocaleString('id-ID')} struk</b></div>`).join('')
      : '<div class="pos-empty">Belum ada penjualan pada periode ini.</div>';
    drawHourly(list);
  }


  /* =====================================================================
     LAYAR KASIR (pengganti Orders) + OPEN BILL
     Keranjang -> transactions (struktur sama dengan form Orders lama: order_items/order_addons dengan snapshot HPP,
     jadi laba, stok, pembagian omzet, riwayat, Export tetap bekerja). Open Bill = tabel pos_open_bills (SQL
     .claude/sql/2026-10-pos-open-bill.sql); tanpa tabel itu tombol Simpan Bill disembunyikan.
     ===================================================================== */
  const DEFAULT_PAY = ['Tunai', 'QRIS', 'Debit', 'Lainnya'];
  const DEFAULT_TYPES = ['Dine In', 'Take Away', 'Online'];
  const labels = () => (typeof activeWorkspaceBranding !== 'undefined' && activeWorkspaceBranding?.receipt_labels) || {};
  const listOf = (key, dflt) => { const l = labels()[key]; const c = Array.isArray(l) ? l.map(x => String(x || '').trim()).filter(Boolean) : []; return c.length ? c : dflt.slice(); };
  const payList = () => listOf('__payments', DEFAULT_PAY);
  const typeList = () => listOf('__order_types', DEFAULT_TYPES);
  const isCash = n => /tunai|cash/i.test(String(n || ''));
  const cleanInt = v => Math.max(0, Math.round(Number(String(v ?? '').replace(/\D/g, '')) || 0));
  const fmtInt = v => (v ? Number(v).toLocaleString('id-ID') : '');
  const ago = iso => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 60 ? m + ' mnt' : Math.floor(m / 60) + ' j ' + (m % 60) + ' m'; };

  const cart = { items: new Map(), addons: new Map(), type: '', table: '', customer: '', discMode: 'percent', discValue: 0, pay: '', received: 0, billId: null, billCreated: null };
  let bills = [], billsReady = true, query = '', saving = false, warnedNoSession = false, catSel = '';
  const taxCfg = () => { const t = labels().__tax || {}; return { taxOn: t.tax_on === true, taxPct: Math.max(0, Math.min(100, num(t.tax_pct))), taxName: String(t.tax_name || 'Pajak').slice(0, 20), svcOn: t.svc_on === true, svcPct: Math.max(0, Math.min(100, num(t.svc_pct))) }; };

  const activeMasters = list => (Array.isArray(list) ? list : []).filter(x => x && x.is_active !== false);
  const stockLeft = p => (p && p.stock_qty !== null && p.stock_qty !== undefined ? num(p.stock_qty) : null);
  const lineOf = (m, qty) => {
    const cost = Math.max(0, num(m.cost_price)), unit = num(m.price);
    return { id: m.id, code: m.code, name: m.name, qty, unit_price: unit, subtotal: unit * qty, cost_price: cost, cost_subtotal: cost * qty, profit_share_mode: m.profit_share_mode || 'percentage', manual_profit_split: Array.isArray(m.manual_profit_split) ? m.manual_profit_split : [] };
  };
  function totals() {
    const items = [...cart.items].map(([id, q]) => { const m = (packages || []).find(x => String(x.id) === String(id)); return m ? lineOf(m, q) : null; }).filter(Boolean);
    const adds = [...cart.addons].map(([id, q]) => { const m = (addons || []).find(x => String(x.id) === String(id)); return m ? lineOf(m, q) : null; }).filter(Boolean);
    const subtotal = items.reduce((s, x) => s + x.subtotal, 0) + adds.reduce((s, x) => s + x.subtotal, 0);
    const raw = Math.max(0, num(cart.discValue));
    const disc = Math.min(subtotal, cart.discMode === 'percent' ? subtotal * Math.min(raw, 100) / 100 : raw);
    const base = Math.max(0, subtotal - Math.round(disc)), c = taxCfg();
    const svc = c.svcOn ? Math.round(base * c.svcPct / 100) : 0, tax = c.taxOn ? Math.round((base + svc) * c.taxPct / 100) : 0;
    return { items, adds, subtotal, disc: Math.round(disc), svc, tax, cfg: c, total: base + svc + tax };
  }
  const cartCount = () => [...cart.items.values()].reduce((s, q) => s + q, 0);
  function resetCart(keepType) {
    cart.items.clear(); cart.addons.clear(); cart.table = ''; cart.customer = ''; cart.discValue = 0; cart.discMode = 'percent'; cart.pay = ''; cart.received = 0; cart.billId = null; cart.billCreated = null;
    if (!keepType) cart.type = '';
  }

  /* ---------- Open Bill (Supabase) ---------- */
  async function loadBills() {
    try {
      const { data, error } = await db.from('pos_open_bills').select('*').eq('workspace_id', requireWorkspaceId()).order('created_at', { ascending: true });
      if (error) throw error;
      bills = data || []; billsReady = true;
    } catch (err) {
      billsReady = !/pos_open_bills|relation|does not exist|schema cache/i.test(String(err?.message || err?.code || '')) ? billsReady : false;
      bills = [];
    }
    renderBills(); renderCart(); renderGrid();
  }
  async function saveBill() {
    if (saving) return;
    const t = totals();
    if (!t.items.length) { showToast('Pilih produk dulu sebelum menyimpan bill.', 'warning'); return; }
    const label = cart.table ? 'Meja ' + cart.table : (cart.customer || 'Bill ' + (bills.length + 1));
    const row = { label, order_type: cart.type || typeList()[0], table_no: cart.table || null, customer_name: cart.customer || null, items: [...cart.items].map(([id, qty]) => ({ id, qty })), addons: [...cart.addons].map(([id, qty]) => ({ id, qty })), discount_mode: cart.discMode, discount_value: num(cart.discValue), updated_at: new Date().toISOString() };
    saving = true;
    try {
      const wid = requireWorkspaceId();
      const q = cart.billId ? db.from('pos_open_bills').update(row).eq('workspace_id', wid).eq('id', cart.billId) : db.from('pos_open_bills').insert([{ ...row, workspace_id: wid, ...(typeof activeAuthUserId !== 'undefined' && activeAuthUserId ? { created_by: activeAuthUserId } : {}) }]);
      const { error } = await q;
      if (error) throw error;
      showToast(`Bill ${label} disimpan.`);
      resetCart(true);
      await loadBills();
    } catch (err) { showToast('Gagal menyimpan bill: ' + (err.message || err), true); }
    finally { saving = false; }
  }
  function openBill(id) {
    const b = bills.find(x => String(x.id) === String(id));
    if (!b) return;
    resetCart();
    cart.billId = b.id; cart.billCreated = b.created_at; cart.type = b.order_type || ''; cart.table = b.table_no || ''; cart.customer = b.customer_name || '';
    cart.discMode = b.discount_mode === 'fixed' ? 'fixed' : 'percent'; cart.discValue = num(b.discount_value);
    (Array.isArray(b.items) ? b.items : []).forEach(x => cart.items.set(String(x.id), num(x.qty)));
    (Array.isArray(b.addons) ? b.addons : []).forEach(x => cart.addons.set(String(x.id), num(x.qty)));
    renderBills(); renderCart(); renderGrid();
    document.getElementById('pos-cart')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  async function deleteBill() {
    if (!cart.billId || !confirm('Hapus bill ini? Pesanan di dalamnya hilang.')) return;
    try {
      const { error } = await db.from('pos_open_bills').delete().eq('workspace_id', requireWorkspaceId()).eq('id', cart.billId);
      if (error) throw error;
      showToast('Bill dihapus.'); resetCart(true); await loadBills(); renderGrid();
    } catch (err) { showToast('Gagal menghapus bill: ' + (err.message || err), true); }
  }

  // Service & pajak dicatat sebagai baris tambahan. Pajak memakai HPP = nominal pajak, jadi LABA tidak menghitung pajak sebagai untung
  // (uang pajak bukan milik usaha); omzet/penjualan tetap angka yang dibayar pelanggan.
  const extraLines = t => [
    ...(t.svc ? [{ id: 'pos-service', code: 'SVC', name: 'Service ' + t.cfg.svcPct + '%', qty: 1, unit_price: t.svc, subtotal: t.svc, cost_price: 0, cost_subtotal: 0, profit_share_mode: 'percentage', manual_profit_split: [], is_charge: true }] : []),
    ...(t.tax ? [{ id: 'pos-tax', code: 'TAX', name: t.cfg.taxName + ' ' + t.cfg.taxPct + '%', qty: 1, unit_price: t.tax, subtotal: t.tax, cost_price: t.tax, cost_subtotal: t.tax, profit_share_mode: 'percentage', manual_profit_split: [], is_charge: true }] : [])
  ];
  /* ---------- Bayar ---------- */
  async function nextReceiptNo() {
    try {
      const { data } = await db.from('transactions').select('receipt_no').eq('workspace_id', requireWorkspaceId()).order('receipt_no', { ascending: false, nullsFirst: false }).limit(1);
      return (Array.isArray(data) ? data.reduce((m, r) => Math.max(m, num(r.receipt_no)), 0) : 0) + 1;
    } catch (_e) { return null; }
  }
  async function pay() {
    if (saving) return;
    const t = totals();
    if (!t.items.length) { showToast('Keranjang masih kosong.', true); return; }
    if (!cart.pay) { showToast('Pilih metode pembayaran dulu.', true); return; }
    if (isCash(cart.pay) && cart.received > 0 && cart.received < t.total) { showToast('Uang diterima kurang dari total.', true); return; }
    for (const l of t.items) { const m = (packages || []).find(x => String(x.id) === String(l.id)); const left = stockLeft(m); if (left !== null && l.qty > left) { showToast(`Stok ${l.name} hanya sisa ${left}.`, true); return; } }
    if (typeof currentShift !== 'undefined' && !currentShift && !warnedNoSession) { warnedNoSession = true; showToast('Kasir belum dibuka: struk tetap tersimpan tapi belum masuk sesi.', 'warning'); }
    saving = true;
    const btn = document.getElementById('pos-pay-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }
    try {
      const type = cart.type || typeList()[0];
      const receiptNo = await nextReceiptNo();
      const now = new Date();
      const payload = {
        transaction_date: todayISO(), reading_started_at: now.toISOString(), reading_status: 'done',
        shift_id: (typeof currentShift !== 'undefined' && currentShift?.id) || null,
        customer_name: cart.customer || (cart.table ? 'Meja ' + cart.table : 'Umum'), customer_id: null, platform: type,
        social_name: null, whatsapp: null,
        package_id: t.items[0].id, package_code: t.items.map(x => x.code).join(', '), package_price: t.items.reduce((s, x) => s + x.subtotal, 0), package_qty: t.items.reduce((s, x) => s + x.qty, 0),
        topic_id: null, topic_name: null,
        addon_id: t.adds[0]?.id || null, addon_code: t.adds.map(x => x.code).join(', ') || null, addon_price: t.adds.reduce((s, x) => s + x.subtotal, 0), addon_qty: t.adds.reduce((s, x) => s + x.qty, 0),
        order_items: t.items, order_topics: [], order_addons: [...t.adds, ...extraLines(t)],
        price_adjustment_type: t.disc > 0 ? 'discount' : 'none', price_adjustment_mode: cart.discMode, price_adjustment_value: t.disc > 0 ? num(cart.discValue) : 0, price_adjustment_amount: -t.disc,
        tip_amount: 0, total_price: t.total, payment_method: cart.pay, notes: cart.table ? 'Meja ' + cart.table : null,
        ...(receiptNo ? { receipt_no: receiptNo } : {})
      };
      const { error } = await db.from('transactions').insert([workspaceInsert(payload)]);
      if (error) throw error;
      const billId = cart.billId, received = cart.received;
      if (billId) { try { await db.from('pos_open_bills').delete().eq('workspace_id', requireWorkspaceId()).eq('id', billId); } catch (_e) { /* bill sisa dibersihkan manual */ } }
      showReceipt({ ...payload, received, change: isCash(cart.pay) && received >= t.total ? received - t.total : 0, subtotal: t.subtotal, svc: t.svc, tax: t.tax, svcPct: t.cfg.svcPct, taxPct: t.cfg.taxPct, taxName: t.cfg.taxName, table: cart.table, at: now });
      resetCart(true);
      showToast('Pembayaran tersimpan.');
      await Promise.all([refreshAll(), loadBills()]);
      renderGrid();
    } catch (err) { showToast('Gagal menyimpan: ' + (err.message || err), true); }
    finally { saving = false; renderCart(); }
  }

  /* ---------- Struk (cetak lewat browser) ---------- */
  // Cetak: lewat modul printer (kairo-printer.js: printer biasa, USB, serial, Bluetooth, RawBT). Cadangan: cetak browser 58 mm.
  function printPaper(wrap) {
    const paper = wrap.querySelector('#pos-receipt-paper');
    if (window.kairoPrinter) { window.kairoPrinter.printDom(paper); return; }
    const old = wrap.id; document.body.classList.add('pos-printing'); wrap.id = 'pos-receipt'; window.print();
    setTimeout(() => { document.body.classList.remove('pos-printing'); wrap.id = old; }, 500);
  }
  function showReceipt(p) {
    document.getElementById('pos-receipt')?.remove();
    const wsName = (typeof activeWorkspaceName !== 'undefined' && activeWorkspaceName) || 'Struk';
    const lines = [...p.order_items, ...p.order_addons.filter(x => !x.is_charge)].map(x => `<div class="r-line"><span>${esc(x.name)} × ${x.qty}</span><b>${money(x.subtotal)}</b></div>`).join('');
    const d = p.at;
    const el = document.createElement('div');
    el.id = 'pos-receipt'; el.className = 'pos-receipt-wrap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="pos-receipt-card"><div class="pos-receipt" id="pos-receipt-paper">
      <div class="r-title">${esc(wsName)}</div>
      <div class="r-meta">${p.receipt_no ? 'Struk #' + String(p.receipt_no).padStart(4, '0') + ' · ' : ''}${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="r-meta">${esc(p.platform)}${p.table ? ' · Meja ' + esc(p.table) : ''}</div><hr>
      ${lines}<hr>
      <div class="r-line"><span>Subtotal</span><b>${money(p.subtotal)}</b></div>
      ${p.price_adjustment_amount ? `<div class="r-line"><span>Diskon</span><b>−${money(-p.price_adjustment_amount)}</b></div>` : ''}
      ${p.svc ? `<div class="r-line"><span>Service ${p.svcPct}%</span><b>${money(p.svc)}</b></div>` : ''}
      ${p.tax ? `<div class="r-line"><span>${esc(p.taxName)} ${p.taxPct}%</span><b>${money(p.tax)}</b></div>` : ''}
      <div class="r-line r-total"><span>Total</span><b>${money(p.total_price)}</b></div>
      <div class="r-line"><span>${esc(p.payment_method)}</span><b>${p.received ? money(p.received) : money(p.total_price)}</b></div>
      ${p.change ? `<div class="r-line"><span>Kembalian</span><b>${money(p.change)}</b></div>` : ''}
      <div class="r-foot">Terima kasih</div></div>
      <div class="pos-receipt-actions"><button type="button" class="btn btn-light" data-r="close">Tutup</button><button type="button" class="btn btn-green" data-r="print">Cetak</button></div></div>`;
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-r]');
      if (a?.dataset.r === 'print') printPaper(el);
      else if (a?.dataset.r === 'close' || e.target === el) el.remove();
    });
    document.body.appendChild(el);
    // Cetak otomatis (opsional, Settings › Struk › Printer Struk): hanya untuk printer yang sudah terhubung, tanpa dialog.
    const kp = window.kairoPrinter;
    if (kp && kp.config.auto && ['usb', 'serial', 'ble'].includes(kp.config.mode)) kp.printDom(el.querySelector('#pos-receipt-paper'), { silent: true });
  }

  /* ---------- Tampilan ---------- */
  function mountKasir() {
    const section = document.getElementById('input');
    if (!section) return false;
    if (document.getElementById('pos-kasir')) return true;
    const root = document.createElement('div');
    root.id = 'pos-kasir'; root.className = 'pos-kasir';
    root.innerHTML = `
      <div class="card pos-bills-card" id="pos-bills-card" hidden><div class="pos-head"><div class="card-title">Bill Terbuka</div><span class="pos-sub" id="pos-bills-sub"></span></div><div class="pos-bills" id="pos-bills"></div></div>
      <div class="pos-main">
        <div class="card pos-products"><div class="pos-search"><input class="input" id="pos-search" type="search" placeholder="Cari produk atau scan barcode…" autocomplete="off" inputmode="search"></div><div class="pos-cats" id="pos-cats" hidden></div><div class="pos-grid" id="pos-grid"></div><div class="pos-addons" id="pos-addons"></div></div>
        <div class="card pos-cart" id="pos-cart"></div>
      </div>
      <button type="button" class="pos-mobilebar" id="pos-mobilebar" hidden></button>`;
    section.appendChild(root);
    const search = root.querySelector('#pos-search');
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); renderGrid(); });
    // Scanner barcode = keyboard: kode produk + Enter menambah produk yang cocok persis.
    search.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const code = search.value.trim().toLowerCase();
      const m = activeMasters(packages).find(x => String(x.code || '').toLowerCase() === code) || (visibleProducts().length === 1 ? visibleProducts()[0] : null);
      if (m) { addItem(m.id); search.value = ''; query = ''; renderGrid(); } else showToast('Produk tidak ditemukan.', 'warning');
    });
    root.querySelector('#pos-cats').addEventListener('click', e => { const c = e.target.closest('[data-cat]'); if (c) { catSel = c.dataset.cat; renderCats(); renderGrid(); } });
    root.querySelector('#pos-grid').addEventListener('click', e => { const c = e.target.closest('[data-pid]'); if (c) addItem(c.dataset.pid); });
    root.querySelector('#pos-addons').addEventListener('click', e => { const c = e.target.closest('[data-aid]'); if (c) { const id = c.dataset.aid; cart.addons.set(id, (cart.addons.get(id) || 0) + 1); renderCart(); renderAddons(); } });
    root.querySelector('#pos-bills').addEventListener('click', e => { const c = e.target.closest('[data-bill]'); if (c) openBill(c.dataset.bill); });
    root.querySelector('#pos-mobilebar').addEventListener('click', () => document.getElementById('pos-cart')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    const cartEl = root.querySelector('#pos-cart');
    cartEl.addEventListener('click', onCartClick);
    cartEl.addEventListener('input', onCartInput);
    cartEl.addEventListener('change', onCartInput);
    return true;
  }
  const visibleProducts = () => activeMasters(packages).filter(p => (!catSel || String(p.category || '') === catSel) && (!query || String(p.name || '').toLowerCase().includes(query) || String(p.code || '').toLowerCase().includes(query)));
  const categoryNames = () => (Array.isArray(topics) ? topics : []).map(t => String(t.name || '').trim()).filter(Boolean);
  function renderCats() {
    const box = document.getElementById('pos-cats');
    if (!box) return;
    const names = categoryNames().filter(n => activeMasters(packages).some(p => String(p.category || '') === n));
    if (catSel && !names.includes(catSel)) catSel = '';
    box.hidden = !names.length;
    box.innerHTML = names.length ? ['', ...names].map(n => `<button type="button" class="pos-cat${n === catSel ? ' on' : ''}" data-cat="${esc(n)}">${n ? esc(n) : 'Semua'}</button>`).join('') : '';
  }
  function addItem(id) {
    const m = (packages || []).find(x => String(x.id) === String(id));
    if (!m) return;
    const left = stockLeft(m), cur = cart.items.get(String(id)) || 0;
    if (left !== null && left <= 0) { showToast(`Stok ${m.name} habis.`, true); return; }
    if (left !== null && cur + 1 > left) { showToast(`Stok ${m.name} hanya sisa ${left}.`, true); return; }
    cart.items.set(String(id), cur + 1);
    renderGrid(); renderCart();
  }
  function renderGrid() {
    const grid = document.getElementById('pos-grid');
    if (!grid) return;
    const list = visibleProducts();
    grid.innerHTML = list.length ? list.map(p => {
      const q = cart.items.get(String(p.id)) || 0, left = stockLeft(p);
      const low = left !== null && left > 0 && left <= (p.stock_min === null || p.stock_min === undefined ? 5 : num(p.stock_min));
      return `<button type="button" class="pos-prod${left !== null && left <= 0 ? ' is-out' : ''}${p.image_url ? ' has-img' : ''}" data-pid="${esc(p.id)}">${p.image_url ? `<img class="pos-prod-img" src="${esc(p.image_url)}" alt="" loading="lazy">` : ''}${q ? `<em>${q}</em>` : ''}<b>${esc(p.name)}</b><span>${money(p.price)}</span>${left !== null ? `<small class="${low ? 'is-low' : ''}">${left <= 0 ? 'Habis' : low ? 'Menipis · ' + left : 'Stok ' + left}</small>` : ''}</button>`;
    }).join('') : `<div class="pos-empty">${(packages || []).length ? 'Produk tidak ditemukan.' : 'Belum ada produk. Tambah dulu di menu Produk.'}</div>`;
    renderAddons(); renderCats();
  }
  function renderAddons() {
    const box = document.getElementById('pos-addons');
    if (!box) return;
    const list = activeMasters(addons);
    box.innerHTML = list.length ? '<div class="pos-sub">Tambahan cepat</div><div class="pos-chips">' + list.map(a => { const q = cart.addons.get(String(a.id)) || 0; return `<button type="button" class="pos-chip${q ? ' on' : ''}" data-aid="${esc(a.id)}">${esc(a.name)} · ${money(a.price)}${q ? ' ×' + q : ''}</button>`; }).join('') + '</div>' : '';
  }
  function renderBills() {
    const card = document.getElementById('pos-bills-card');
    if (!card) return;
    card.hidden = !billsReady || !bills.length;
    document.getElementById('pos-bills-sub').textContent = bills.length ? bills.length + ' bill' : '';
    document.getElementById('pos-bills').innerHTML = bills.map(b => {
      const total = (() => { const items = (Array.isArray(b.items) ? b.items : []).reduce((s, x) => { const m = (packages || []).find(p => String(p.id) === String(x.id)); return s + (m ? num(m.price) * num(x.qty) : 0); }, 0); const ad = (Array.isArray(b.addons) ? b.addons : []).reduce((s, x) => { const m = (addons || []).find(p => String(p.id) === String(x.id)); return s + (m ? num(m.price) * num(x.qty) : 0); }, 0); return items + ad; })();
      return `<button type="button" class="pos-bill${String(cart.billId) === String(b.id) ? ' on' : ''}" data-bill="${esc(b.id)}"><b>${esc(b.label || 'Bill')}</b><span>${money(total)}</span><small>${esc(b.order_type || '')} · ${ago(b.created_at)}</small></button>`;
    }).join('');
  }
  function renderCart() {
    const el = document.getElementById('pos-cart');
    if (!el) return;
    const t = totals(), types = typeList(), pays = payList();
    if (!cart.type) cart.type = types[0];
    const dine = /dine/i.test(cart.type);
    const cash = isCash(cart.pay);
    const keep = document.activeElement && el.contains(document.activeElement) ? document.activeElement.id : '';
    el.innerHTML = `
      <div class="pos-cart-head"><div class="card-title">${cart.billId ? 'Bill: ' + esc(cart.table ? 'Meja ' + cart.table : cart.customer || 'Terbuka') : 'Struk Baru'}</div>${cart.billId ? `<span class="pos-pill">Bill terbuka · ${ago(cart.billCreated)}</span>` : ''}</div>
      <div class="pos-types">${types.map(x => `<button type="button" class="pos-seg${x === cart.type ? ' on' : ''}" data-type="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <div class="pos-fields"><input class="input" id="pos-table" placeholder="No. meja (opsional)" value="${esc(cart.table)}" maxlength="12" ${dine ? '' : 'hidden'}><input class="input" id="pos-cust" placeholder="Nama pelanggan (opsional)" value="${esc(cart.customer)}" maxlength="40"></div>
      <div class="pos-lines">${t.items.length ? t.items.map(l => `<div class="pos-line"><div><b>${esc(l.name)}</b><small>${money(l.unit_price)}</small></div><div class="pos-qty"><button type="button" data-dec="${esc(l.id)}" aria-label="Kurangi">−</button><span>${l.qty}</span><button type="button" data-inc="${esc(l.id)}" aria-label="Tambah">+</button></div><b>${money(l.subtotal)}</b></div>`).join('') + t.adds.map(l => `<div class="pos-line is-add"><div><b>${esc(l.name)}</b><small>Tambahan</small></div><div class="pos-qty"><button type="button" data-adec="${esc(l.id)}" aria-label="Kurangi">−</button><span>${l.qty}</span><button type="button" data-ainc="${esc(l.id)}" aria-label="Tambah">+</button></div><b>${money(l.subtotal)}</b></div>`).join('') : '<div class="pos-empty">Klik produk untuk menambah ke struk.</div>'}</div>
      <div class="pos-disc"><span>Diskon</span><select id="pos-disc-mode" class="input"><option value="percent"${cart.discMode === 'percent' ? ' selected' : ''}>%</option><option value="fixed"${cart.discMode === 'fixed' ? ' selected' : ''}>Rp</option></select><input class="input" id="pos-disc" inputmode="numeric" placeholder="0" value="${cart.discValue ? esc(cart.discValue) : ''}"></div>
      <div class="pos-sum"><div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>${t.disc ? `<div><span>Diskon</span><span>−${money(t.disc)}</span></div>` : ''}${t.svc ? `<div><span>Service ${t.cfg.svcPct}%</span><span>${money(t.svc)}</span></div>` : ''}${t.tax ? `<div><span>${esc(t.cfg.taxName)} ${t.cfg.taxPct}%</span><span>${money(t.tax)}</span></div>` : ''}<div class="pos-total"><span>Total</span><span>${money(t.total)}</span></div></div>
      <div class="pos-pays">${pays.map(x => `<button type="button" class="pos-seg${x === cart.pay ? ' on' : ''}" data-pay="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      ${cash ? `<div class="pos-cash"><input class="input" id="pos-recv" inputmode="numeric" placeholder="Uang diterima" value="${cart.received ? 'Rp' + fmtInt(cart.received) : ''}"><div class="pos-quick"><button type="button" data-recv="${t.total}">Uang pas</button>${[20000, 50000, 100000].filter(v => v >= t.total).slice(0, 3).map(v => `<button type="button" data-recv="${v}">${shortMoney(v)}</button>`).join('')}</div><div class="pos-change"><span>Kembalian</span><b>${cart.received >= t.total && t.total > 0 ? money(cart.received - t.total) : '-'}</b></div></div>` : ''}
      <div class="pos-actions">${billsReady ? `<button type="button" class="btn btn-light" id="pos-save-bill">${cart.billId ? 'Simpan Perubahan' : 'Simpan Bill'}</button>` : ''}<button type="button" class="btn btn-green" id="pos-pay-btn"${saving || !t.items.length ? ' disabled' : ''}>Bayar &amp; Cetak Struk</button></div>
      ${cart.billId ? '<button type="button" class="pos-linkdel" id="pos-del-bill">Hapus bill ini</button>' : ''}`;
    if (keep) document.getElementById(keep)?.focus();
    const bar = document.getElementById('pos-mobilebar');
    if (bar) { const n = cartCount(); bar.hidden = !n || cartVisible; bar.textContent = `Lihat Struk · ${n} item · ${money(t.total)}`; }
  }
  const shortMoney = v => (v >= 1000 ? v / 1000 + 'rb' : String(v));
  function onCartClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.type !== undefined) { cart.type = d.type; renderCart(); }
    else if (d.pay !== undefined) { cart.pay = d.pay; if (!isCash(cart.pay)) cart.received = 0; renderCart(); }
    else if (d.inc !== undefined) { addItem(d.inc); }
    else if (d.dec !== undefined) { const q = (cart.items.get(d.dec) || 0) - 1; if (q <= 0) cart.items.delete(d.dec); else cart.items.set(d.dec, q); renderGrid(); renderCart(); }
    else if (d.ainc !== undefined) { cart.addons.set(d.ainc, (cart.addons.get(d.ainc) || 0) + 1); renderAddons(); renderCart(); }
    else if (d.adec !== undefined) { const q = (cart.addons.get(d.adec) || 0) - 1; if (q <= 0) cart.addons.delete(d.adec); else cart.addons.set(d.adec, q); renderAddons(); renderCart(); }
    else if (d.recv !== undefined) { cart.received = cleanInt(d.recv); renderCart(); }
    else if (b.id === 'pos-pay-btn') pay();
    else if (b.id === 'pos-save-bill') saveBill();
    else if (b.id === 'pos-del-bill') deleteBill();
  }
  function onCartInput(e) {
    const t = e.target;
    if (t.id === 'pos-table') cart.table = t.value.trim();
    else if (t.id === 'pos-cust') cart.customer = t.value.trim();
    else if (t.id === 'pos-disc-mode' && e.type === 'change') { cart.discMode = t.value; renderCart(); }
    else if (t.id === 'pos-disc') { cart.discValue = Math.max(0, num(String(t.value).replace(',', '.').replace(/[^\d.]/g, ''))); refreshTotalsOnly(); }
    else if (t.id === 'pos-recv') { cart.received = cleanInt(t.value); t.value = cart.received ? 'Rp' + fmtInt(cart.received) : ''; refreshTotalsOnly(); }
  }
  // Ketik diskon / uang diterima: perbarui ringkasan tanpa menggambar ulang kolom yang sedang diketik.
  function refreshTotalsOnly() {
    const t = totals(), el = document.getElementById('pos-cart');
    if (!el) return;
    const sum = el.querySelector('.pos-sum');
    if (sum) sum.innerHTML = `<div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>${t.disc ? `<div><span>Diskon</span><span>−${money(t.disc)}</span></div>` : ''}${t.svc ? `<div><span>Service ${t.cfg.svcPct}%</span><span>${money(t.svc)}</span></div>` : ''}${t.tax ? `<div><span>${esc(t.cfg.taxName)} ${t.cfg.taxPct}%</span><span>${money(t.tax)}</span></div>` : ''}<div class="pos-total"><span>Total</span><span>${money(t.total)}</span></div>`;
    const ch = el.querySelector('.pos-change b');
    if (ch) ch.textContent = cart.received >= t.total && t.total > 0 ? money(cart.received - t.total) : '-';
    const bar = document.getElementById('pos-mobilebar'); if (bar) bar.textContent = `Lihat Struk · ${cartCount()} item · ${money(t.total)}`;
  }

  /* =====================================================================
     SETTINGS KASIR (Settings › Kategori): Tipe Pesanan, Metode Pembayaran, Pajak & Service, dan penempatan produk ke kategori.
     Daftar kategori = kartu "Kategori" bawaan (topic_masters); kolom package_masters.category menyimpan nama kategorinya
     (SQL .claude/sql/2026-10-pos-product-category.sql). Pengaturan lain di workspace_branding.receipt_labels (__order_types, __payments, __tax).
     ===================================================================== */
  let typeDraft = null, payDraft = null, taxDraft = null;
  const rowsHtml = (arr, attr) => arr.map((n, i) => `<div class="pos-set-row"><strong>${esc(n)}</strong><button type="button" class="pos-set-del" ${attr}="${i}" aria-label="Hapus ${esc(n)}">×</button></div>`).join('') || '<span class="pos-sub">Belum ada.</span>';
  function renderSettingsLists() {
    const a = document.getElementById('pos-set-types'), b = document.getElementById('pos-set-pays');
    if (a) a.innerHTML = rowsHtml(typeDraft, 'data-type-del');
    if (b) b.innerHTML = rowsHtml(payDraft, 'data-pay-del');
    const t = taxDraft;
    const set = (id, v) => { const e = document.getElementById(id); if (e && e !== document.activeElement) { if (e.type === 'checkbox') e.checked = v; else e.value = v; } };
    set('pos-set-svc-on', t.svcOn); set('pos-set-svc-pct', t.svcPct || ''); set('pos-set-tax-on', t.taxOn); set('pos-set-tax-pct', t.taxPct || ''); set('pos-set-tax-name', t.taxName);
    document.getElementById('pos-set-tax-fields')?.classList.toggle('is-off', !t.taxOn);
    document.getElementById('pos-set-svc-fields')?.classList.toggle('is-off', !t.svcOn);
  }
  function mountPosSettings() {
    if (document.getElementById('pos-settings-card')) return;
    const anchor = document.getElementById('settings-topic-card');
    if (!anchor) return;
    typeDraft = typeList(); payDraft = payList(); taxDraft = taxCfg();
    const card = document.createElement('div');
    card.className = 'card settings-master-card'; card.id = 'pos-settings-card';
    card.innerHTML = `<div class="settings-master-head"><div><div class="card-title">Pengaturan Kasir</div><div class="page-sub">Pilihan yang muncul di layar Kasir.</div></div></div>
      <div class="pos-set-block"><div class="pos-set-title">Tipe Pesanan</div><div id="pos-set-types" class="pos-set-rows"></div><div class="pos-set-add"><input class="input" id="pos-set-type-in" maxlength="24" placeholder="Mis. Dine In, Take Away, GrabFood"><button type="button" class="btn btn-light" id="pos-set-type-add">Tambah</button></div></div>
      <div class="pos-set-block"><div class="pos-set-title">Metode Pembayaran</div><div id="pos-set-pays" class="pos-set-rows"></div><div class="pos-set-add"><input class="input" id="pos-set-pay-in" maxlength="24" placeholder="Mis. Tunai, QRIS, Debit, GoPay"><button type="button" class="btn btn-light" id="pos-set-pay-add">Tambah</button></div><div class="pos-sub">Metode bernama "Tunai" atau "Cash" otomatis memunculkan uang diterima dan kembalian.</div></div>
      <div class="pos-set-block"><div class="pos-set-title">Service &amp; Pajak <span class="pos-sub">(opsional, dihitung dari subtotal setelah diskon)</span></div>
        <div class="pos-set-line"><label class="kairo-switch"><input type="checkbox" id="pos-set-svc-on"><span aria-hidden="true"></span><b class="sr-only">Service charge</b></label><strong>Service charge</strong><span class="pos-set-fields" id="pos-set-svc-fields"><input class="input" id="pos-set-svc-pct" inputmode="decimal" placeholder="5"><em>%</em></span></div>
        <div class="pos-set-line"><label class="kairo-switch"><input type="checkbox" id="pos-set-tax-on"><span aria-hidden="true"></span><b class="sr-only">Pajak</b></label><strong>Pajak</strong><span class="pos-set-fields" id="pos-set-tax-fields"><input class="input" id="pos-set-tax-name" maxlength="20" placeholder="PB1"><input class="input" id="pos-set-tax-pct" inputmode="decimal" placeholder="10"><em>%</em></span></div>
        <div class="pos-sub">Pajak tidak dihitung sebagai laba. Penjualan di Dashboard tetap angka yang dibayar pelanggan.</div></div>
      <div class="pos-set-actions"><button type="button" class="btn btn-green" id="pos-set-save">Simpan Pengaturan Kasir</button><button type="button" class="btn btn-light" id="pos-set-reset">Kembalikan Bawaan</button></div>`;
    anchor.after(card);
    renderSettingsLists();
    card.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.typeDel !== undefined) { typeDraft.splice(Number(t.dataset.typeDel), 1); renderSettingsLists(); return; }
      if (t.dataset.payDel !== undefined) { payDraft.splice(Number(t.dataset.payDel), 1); renderSettingsLists(); return; }
      const addTo = (arr, inputId) => { const i = document.getElementById(inputId), v = i.value.trim(); if (!v) return; if (arr.some(x => x.toLowerCase() === v.toLowerCase())) { showToast('Sudah ada.', 'warning'); return; } arr.push(v); i.value = ''; renderSettingsLists(); };
      if (t.id === 'pos-set-type-add') { addTo(typeDraft, 'pos-set-type-in'); return; }
      if (t.id === 'pos-set-pay-add') { addTo(payDraft, 'pos-set-pay-in'); return; }
      if (t.id === 'pos-set-reset') { typeDraft = DEFAULT_TYPES.slice(); payDraft = DEFAULT_PAY.slice(); taxDraft = { taxOn: false, taxPct: 0, taxName: 'PB1', svcOn: false, svcPct: 0 }; renderSettingsLists(); return; }
      if (t.id === 'pos-set-save') {
        try {
          if (!typeDraft.length || !payDraft.length) throw new Error('Isi minimal satu tipe pesanan dan satu metode pembayaran.');
          const pct = id => { const v = Number(String(document.getElementById(id).value || '0').replace(',', '.')); if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error('Persen harus 0–100.'); return v; };
          const tax = { svc_on: document.getElementById('pos-set-svc-on').checked, svc_pct: pct('pos-set-svc-pct'), tax_on: document.getElementById('pos-set-tax-on').checked, tax_pct: pct('pos-set-tax-pct'), tax_name: document.getElementById('pos-set-tax-name').value.trim() || 'Pajak' };
          if ((tax.svc_on && !tax.svc_pct) || (tax.tax_on && !tax.tax_pct)) throw new Error('Isi persen service/pajak yang diaktifkan.');
          const wid = requireWorkspaceId();
          const next = { ...labels(), __order_types: typeDraft.slice(), __payments: payDraft.slice(), __tax: tax };
          const { error } = await db.from('workspace_branding').upsert({ workspace_id: wid, receipt_labels: next, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
          if (error) throw error;
          await loadWorkspaceSaasContext();
          typeDraft = typeList(); payDraft = payList(); taxDraft = taxCfg(); renderSettingsLists();
          renderCart();
          showToast('Pengaturan kasir disimpan.');
        } catch (err) { showToast(err.message || 'Gagal menyimpan pengaturan.', true); }
      }
    });
    card.addEventListener('change', e => {
      if (e.target.id === 'pos-set-svc-on') { taxDraft.svcOn = e.target.checked; document.getElementById('pos-set-svc-fields')?.classList.toggle('is-off', !e.target.checked); }
      if (e.target.id === 'pos-set-tax-on') { taxDraft.taxOn = e.target.checked; document.getElementById('pos-set-tax-fields')?.classList.toggle('is-off', !e.target.checked); }
    });
    ['pos-set-type-in', 'pos-set-pay-in'].forEach(id => document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(id === 'pos-set-type-in' ? 'pos-set-type-add' : 'pos-set-pay-add').click(); } }));
  }

  /* =====================================================================
     PERFORMANCE KASIR: kartu analitik di bawah "Penjualan per Produk" (ikut filter periode utama).
     Jam Ramai, Kategori Terlaris, Metode Pembayaran, Tipe Pesanan, Laba per Produk, Rekap Sesi. Tiap kartu = grafik + tombol "Tabel".
     ===================================================================== */
  const anCharts = {};
  const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const anHead = (title, sub, key, toggle = true) => `<div class="pos-an-head"><div><div class="card-title">${title}</div>${sub ? `<div class="page-sub">${sub}</div>` : ''}</div>${toggle ? `<button type="button" class="pos-toggle" data-an-toggle="${key}" aria-expanded="false" title="Tampilkan tabel data"><span>Tabel</span>${CHEV}</button>` : ''}</div>`;
  function ensureAnalytics() {
    if (document.getElementById('pos-analytics')) return true;
    const anchor = document.getElementById('product-sales-card');
    if (!anchor) return false;
    const card = (id, title, sub, head) => `<div class="card pos-an-card" id="pos-an-${id}">${anHead(title, sub, id)}<div class="pos-an-chart"><canvas id="pos-an-${id}-chart"></canvas></div><div class="pos-an-data" id="pos-an-${id}-data" hidden><div class="table-wrap"><table><thead>${head}</thead><tbody id="pos-an-${id}-body"></tbody></table></div></div></div>`;
    const wrap = document.createElement('div');
    wrap.id = 'pos-analytics'; wrap.className = 'pos-analytics';
    wrap.innerHTML =
      card('hour', 'Jam Ramai', 'Penjualan per jam, dua jam tersibuk ditandai', '<tr><th>Jam</th><th>Struk</th><th>Penjualan</th></tr>') +
      card('cat', 'Kategori Terlaris', 'Penjualan per kategori produk', '<tr><th>Kategori</th><th>Terjual</th><th>Penjualan</th><th>Laba</th></tr>') +
      card('pay', 'Metode Pembayaran', 'Porsi penjualan per metode', '<tr><th>Metode</th><th>Struk</th><th>Penjualan</th><th>Porsi</th></tr>') +
      card('type', 'Tipe Pesanan', 'Dine In, Take Away, dan lainnya', '<tr><th>Tipe</th><th>Struk</th><th>Penjualan</th><th>Rata-rata/struk</th></tr>') +
      card('profit', 'Laba per Produk', 'Laba kotor = penjualan − HPP', '<tr><th>Produk</th><th>Terjual</th><th>Penjualan</th><th>Laba</th><th>Margin</th></tr>') +
      `<div class="card pos-an-card" id="pos-an-session">${anHead('Rekap Sesi Kasir', 'Sesi pada periode ini, termasuk selisih kas', 'session', false)}<div class="table-wrap"><table><thead><tr><th>Dibuka</th><th>Durasi</th><th>Struk</th><th>Penjualan</th><th>Tunai</th><th>Selisih kas</th></tr></thead><tbody id="pos-an-session-body"></tbody></table></div></div>`;
    anchor.insertAdjacentElement('afterend', wrap);
    wrap.addEventListener('click', e => {
      const t = e.target.closest('[data-an-toggle]');
      if (!t) return;
      const box = document.getElementById(`pos-an-${t.dataset.anToggle}-data`);
      const open = box.hidden; box.hidden = !open;
      t.setAttribute('aria-expanded', open ? 'true' : 'false'); t.title = open ? 'Sembunyikan tabel data' : 'Tampilkan tabel data';
    });
    return true;
  }
  const grp = (list, keyFn) => { const m = new Map(); list.forEach(t => { const k = keyFn(t); const o = m.get(k) || { name: k, n: 0, rev: 0 }; o.n++; o.rev += num(t.total_price); m.set(k, o); }); return [...m.values()].sort((a, b) => b.rev - a.rev); };
  const pctOf = (a, b) => (b > 0 ? Math.round(a / b * 100) + '%' : '-');
  async function anChart(id, cfg) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    try { await ensureChartLibrary(); } catch (_e) { return; }
    if (typeof Chart === 'undefined') return;
    if (anCharts[id]) anCharts[id].destroy();
    anCharts[id] = new Chart(canvas, cfg);
  }
  function hBars(id, rows, empty, fmt) {
    const c = chartBrandColors(), has = rows.length > 0;
    return anChart(id, {
      type: 'bar',
      data: { labels: has ? rows.map(r => r.label) : [empty], datasets: [{ data: has ? rows.map(r => r.value) : [0], backgroundColor: has ? rows.map(r => (r.other ? c.other : c.primary)) : [c.other], borderRadius: 6, maxBarThickness: 26 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 12 } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => i[0]?.label || '', label: x => (has ? (isMasked() ? '••••••' : (fmt ? fmt(rows[x.dataIndex]) : money(x.parsed.x))) : empty) } } },
        scales: chartAxes(c, { x: { beginAtZero: true, grace: '5%', ticks: { callback: v => (typeof shortRupiah === 'function' ? shortRupiah(v) : v), maxTicksLimit: 5 }, grid: { display: true } }, y: { grid: { display: false } } })
      }
    });
  }
  const topN = (rows, n) => (rows.length <= n + 1 ? rows : [...rows.slice(0, n), { label: 'Lainnya', other: true, value: rows.slice(n).reduce((s, r) => s + r.value, 0) }]);
  const empty = cols => `<tr><td colspan="${cols}" class="empty">Belum ada penjualan pada periode ini.</td></tr>`;

  function renderSessions() {
    const body = document.getElementById('pos-an-session-body');
    if (!body) return;
    let rg = null; try { rg = getRange(); } catch (_e) { rg = null; }
    const sess = (typeof shifts !== 'undefined' ? shifts : []).filter(x => { const d = localISODate(new Date(x.opened_at)); return !rg || ((!rg.from || d >= rg.from) && (!rg.to || d <= rg.to)); });
    body.innerHTML = sess.length ? sess.map(x => { const sm = sessionSummary(x), d = x.cash_difference; return `<tr><td>${esc(dt(x.opened_at))}</td><td>${x.closed_at ? esc(dur(x.opened_at, x.closed_at)) : 'berjalan'}</td><td>${sm.count}</td><td>${shown(sm.total)}</td><td>${shown(sm.cash)}</td><td><span class="pos-diff-tag ${d == null ? '' : d === 0 ? 'ok' : d > 0 ? 'plus' : 'minus'}">${d == null ? (x.closed_at ? 'Tidak dihitung' : '-') : d === 0 ? 'Pas' : (d > 0 ? '+' : '−') + money(Math.abs(d))}</span></td></tr>`; }).join('') : '<tr><td colspan="6" class="empty">Belum ada sesi pada periode ini.</td></tr>';
  }
  function renderAnalytics() {
    if (!ensureAnalytics()) return;
    const list = rows(), total = list.reduce((s, t) => s + num(t.total_price), 0);
    // Jam ramai
    const byHour = new Array(24).fill(0), cnt = new Array(24).fill(0);
    list.forEach(t => { const h = hourOf(t); if (h !== null) { byHour[h] += num(t.total_price); cnt[h]++; } });
    const used = byHour.map((v, h) => (v > 0 ? h : -1)).filter(h => h >= 0);
    const from = used.length ? Math.max(0, Math.min(...used) - 1) : 8, to = used.length ? Math.min(23, Math.max(...used) + 1) : 19, hours = [];
    for (let h = from; h <= to; h++) hours.push(h);
    const vals = hours.map(h => byHour[h]), top2 = [...vals].sort((a, b) => b - a).filter(v => v > 0).slice(0, 2), c = chartBrandColors();
    document.getElementById('pos-an-hour-body').innerHTML = used.length ? hours.filter(h => byHour[h] > 0).map(h => `<tr><td>${String(h).padStart(2, '0')}.00</td><td>${cnt[h]}</td><td>${shown(byHour[h])}</td></tr>`).join('') : empty(3);
    anChart('pos-an-hour-chart', { type: 'bar', data: { labels: hours.map(h => String(h).padStart(2, '0')), datasets: [{ data: vals, backgroundColor: vals.map(v => (v > 0 && top2.includes(v) ? c.primary : c.alpha(c.primary, .45))), borderRadius: 6, maxBarThickness: 34 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => `Jam ${i[0].label}.00`, label: x => (isMasked() ? '••••••' : money(x.parsed.y)) } } }, scales: chartAxes(c, { x: { grid: { display: false } }, y: { beginAtZero: true, grace: '8%', ticks: { callback: v => (typeof shortRupiah === 'function' ? shortRupiah(v) : v), maxTicksLimit: 5 } } }) } });
    // Kategori + laba per produk (dari item struk; kategori dari master produk)
    const catOf = new Map((packages || []).map(p => [String(p.id), String(p.category || '')]));
    const cat = new Map(), prod = new Map();
    list.forEach(t => (Array.isArray(t.order_items) ? t.order_items : []).forEach(x => {
      const qty = Math.max(0, num(x?.qty || 1)), rev = x?.subtotal != null ? num(x.subtotal) : num(x?.unit_price) * qty, cost = x?.cost_subtotal != null ? num(x.cost_subtotal) : num(x?.cost_price) * qty;
      const k = catOf.get(String(x?.id)) || 'Tanpa kategori', a = cat.get(k) || { name: k, qty: 0, rev: 0, cost: 0 }; a.qty += qty; a.rev += rev; a.cost += cost; cat.set(k, a);
      const pn = String(x?.name || x?.code || '-'), b = prod.get(pn) || { name: pn, qty: 0, rev: 0, cost: 0 }; b.qty += qty; b.rev += rev; b.cost += cost; prod.set(pn, b);
    }));
    const cats = [...cat.values()].sort((a, b) => b.rev - a.rev);
    document.getElementById('pos-an-cat-body').innerHTML = cats.length ? cats.map(r => `<tr><td><strong>${esc(r.name)}</strong></td><td>${r.qty.toLocaleString('id-ID')}</td><td>${shown(r.rev)}</td><td>${shown(r.rev - r.cost)}</td></tr>`).join('') : empty(4);
    hBars('pos-an-cat-chart', topN(cats.map(r => ({ label: r.name, value: r.rev, qty: r.qty })), 5), 'Belum ada penjualan', r => `${money(r.value)} · ${(r.qty || 0).toLocaleString('id-ID')} terjual`);
    const prods = [...prod.values()].map(r => ({ ...r, profit: r.rev - r.cost })).sort((a, b) => b.profit - a.profit);
    document.getElementById('pos-an-profit-body').innerHTML = prods.length ? prods.map(r => `<tr><td><strong>${esc(r.name)}</strong></td><td>${r.qty.toLocaleString('id-ID')}</td><td>${shown(r.rev)}</td><td><strong>${shown(r.profit)}</strong></td><td>${r.cost > 0 ? pctOf(r.profit, r.rev) : '-'}</td></tr>`).join('') : empty(5);
    hBars('pos-an-profit-chart', topN(prods.filter(r => r.profit > 0).map(r => ({ label: r.name, value: r.profit, qty: r.qty })), 5), 'Belum ada penjualan', r => `Laba ${money(r.value)} · ${(r.qty || 0).toLocaleString('id-ID')} terjual`);
    // Metode bayar + tipe pesanan
    const pay = grp(list, t => String(t.payment_method || 'Lainnya').trim() || 'Lainnya');
    document.getElementById('pos-an-pay-body').innerHTML = pay.length ? pay.map(r => `<tr><td><strong>${esc(r.name)}</strong></td><td>${r.n}</td><td>${shown(r.rev)}</td><td>${pctOf(r.rev, total)}</td></tr>`).join('') : empty(4);
    hBars('pos-an-pay-chart', pay.map(r => ({ label: r.name, value: r.rev, n: r.n })), 'Belum ada penjualan', r => `${money(r.value)} · ${r.n} struk · ${pctOf(r.value, total)}`);
    const type = grp(list, t => String(t.platform || 'Tanpa tipe').trim() || 'Tanpa tipe');
    document.getElementById('pos-an-type-body').innerHTML = type.length ? type.map(r => `<tr><td><strong>${esc(r.name)}</strong></td><td>${r.n}</td><td>${shown(r.rev)}</td><td>${shown(r.n ? r.rev / r.n : 0)}</td></tr>`).join('') : empty(4);
    hBars('pos-an-type-chart', type.map(r => ({ label: r.name, value: r.rev, n: r.n })), 'Belum ada penjualan', r => `${money(r.value)} · ${r.n} struk`);
    renderSessions();
    if (typeof fetchShiftData === 'function') Promise.resolve(fetchShiftData()).then(renderSessions).catch(() => {});
  }

  // "Orders" -> "Kasir" di menu.
  function relabelMenu() {
    document.querySelectorAll('[data-tab="input"], [data-mobile-tab="input"], .kairo-mobile-orders-main, #app-shell nav button').forEach(b => {
      if (!b.matches('[data-tab="input"], [data-mobile-tab="input"], .kairo-mobile-orders-main')) return;
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) if (n.nodeValue.trim() === 'Orders') n.nodeValue = n.nodeValue.replace('Orders', 'Kasir');
    });
  }
  function retitle() {
    if (!document.getElementById('input')?.classList.contains('active')) return;
    setText(document.querySelector('main.container .page-title'), 'Kasir');
    setText(document.querySelector('main.container .page-sub'), 'Catat penjualan, tahan bill, dan bayar.');
  }
  const titleEl = () => document.querySelector('main.container .page-title');
  if (titleEl()) new MutationObserver(() => { if (titleEl().textContent !== 'Kasir') retitle(); }).observe(titleEl(), { childList: true, characterData: true, subtree: true });
  // Bar "Lihat Struk" (HP) disembunyikan saat struk sudah terlihat di layar.
  let cartVisible = false, cartObs = null;
  function watchCart() {
    const el = document.getElementById('pos-cart');
    if (!el || cartObs || !('IntersectionObserver' in window)) return;
    cartObs = new IntersectionObserver(es => { cartVisible = es[0].isIntersecting; syncBar(); }, { threshold: 0.25 });
    cartObs.observe(el);
  }
  function syncBar() { const bar = document.getElementById('pos-mobilebar'); if (bar) bar.hidden = !cartCount() || cartVisible; }
  let kasirReady = false;
  function initKasir(force) {
    mountPosSettings();
    if (!mountKasir()) return;
    relabelMenu();
    if (kasirReady && !force) return;
    kasirReady = true;
    watchCart();
    renderGrid(); renderBills(); renderCart();
    loadBills();
  }
  document.addEventListener('kairo:refreshed', () => { renderGrid(); loadBills(); });
  document.addEventListener('click', e => { if (e.target.closest?.('[data-tab="input"], [data-mobile-tab="input"], .kairo-mobile-orders-main')) setTimeout(() => { initKasir(true); retitle(); }, 80); }, true);
  window.kairoPos = { reload: () => { renderGrid(); renderCart(); loadBills(); } };


  /* =====================================================================
     SESI KASIR LENGKAP: modal awal laci saat buka, hitung uang fisik + selisih saat tutup, rekap sesi (cetak), riwayat sesi.
     Memakai tabel reading_shifts (sesi lama) + kolom opening_cash/cash_out/counted_cash/expected_cash/cash_difference/close_note
     (SQL .claude/sql/2026-10-pos-session-cash.sql). Tombol #open-shift-btn / #close-shift-btn lama diambil alih (capture).
     ===================================================================== */
  const dt = iso => (iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
  const dur = (a, b) => { const m = Math.max(0, Math.floor((new Date(b || Date.now()) - new Date(a)) / 60000)); return m >= 60 ? Math.floor(m / 60) + 'j ' + (m % 60) + 'm' : m + 'm'; };
  function sessionSummary(shift) {
    const rowsOf = (typeof shiftTransactions !== 'undefined' ? shiftTransactions : []).filter(t => shift && String(t.shift_id) === String(shift.id));
    const by = new Map();
    rowsOf.forEach(t => { const k = String(t.payment_method || 'Lainnya'); const o = by.get(k) || { name: k, n: 0, total: 0 }; o.n++; o.total += num(t.total_price); by.set(k, o); });
    const methods = [...by.values()].sort((a, b) => b.total - a.total);
    const total = rowsOf.reduce((s, t) => s + num(t.total_price), 0);
    const cash = rowsOf.filter(t => isCash(t.payment_method)).reduce((s, t) => s + num(t.total_price), 0);
    const opening = num(shift?.opening_cash), out = num(shift?.cash_out);
    return { count: rowsOf.length, total, cash, methods, opening, out, expected: opening + cash - out };
  }
  function drawerNow() {
    if (typeof currentShift === 'undefined' || !currentShift) return null;
    const s = sessionSummary(currentShift);
    return s.opening + s.cash - s.out;
  }
  function posModal(html, onMount) {
    document.getElementById('pos-modal')?.remove();
    const el = document.createElement('div');
    el.id = 'pos-modal'; el.className = 'pos-receipt-wrap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="pos-modal-card">${html}</div>`;
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-m-close]')) el.remove(); });
    document.body.appendChild(el);
    onMount?.(el);
    return el;
  }
  const moneyInput = (id, ph) => `<input class="input" id="${id}" inputmode="numeric" placeholder="${ph || 'Rp0'}" autocomplete="off">`;
  function wireMoney(el, id, onChange) {
    const i = el.querySelector('#' + id);
    if (!i) return () => 0;
    i.addEventListener('input', () => { const v = cleanInt(i.value); i.value = v ? 'Rp' + fmtInt(v) : ''; onChange?.(v); });
    return () => cleanInt(i.value);
  }

  function openSessionModal() {
    if (typeof currentShift !== 'undefined' && currentShift) { showToast('Kasir sudah dibuka.', 'info'); return; }
    posModal(`<div class="card-title">Buka Kasir</div><p class="pos-sub">Isi uang modal di laci sebelum mulai berjualan.</p>
      <label class="label" for="pos-open-cash">Modal awal laci</label>${moneyInput('pos-open-cash')}
      <div class="pos-modal-actions"><button type="button" class="btn btn-light" data-m-close>Batal</button><button type="button" class="btn btn-green" id="pos-open-go">Buka Kasir</button></div>`, el => {
      const get = wireMoney(el, 'pos-open-cash');
      el.querySelector('#pos-open-cash').focus();
      el.querySelector('#pos-open-go').addEventListener('click', async e => {
        const btn = e.currentTarget; btn.disabled = true;
        try {
          const { error } = await db.from('reading_shifts').insert([workspaceInsert({ opened_at: new Date().toISOString(), opening_cash: get() })]);
          if (error) throw error;
          el.remove();
          showToast('Kasir dibuka.');
          await Promise.all([fetchShiftData(), refreshAll()]);
          renderShiftDashboard(); refresh();
        } catch (err) { btn.disabled = false; showToast('Gagal membuka kasir: ' + (err.message || err), true); }
      });
    });
  }

  function closeSessionModal() {
    if (typeof currentShift === 'undefined' || !currentShift) { showToast('Kasir belum dibuka.', 'info'); return; }
    const shift = currentShift, sum = sessionSummary(shift);
    posModal(`<div class="card-title">Tutup Kasir</div><p class="pos-sub">Dibuka ${esc(dt(shift.opened_at))} · ${esc(dur(shift.opened_at))}</p>
      <div class="pos-recap">
        <div class="r"><span>Penjualan (${sum.count} struk)</span><b>${money(sum.total)}</b></div>
        ${sum.methods.map(m => `<div class="r sub"><span>${esc(m.name)} · ${m.n}</span><span>${money(m.total)}</span></div>`).join('')}
        <div class="r"><span>Modal awal laci</span><b>${money(sum.opening)}</b></div>
        <div class="r"><span>Tunai masuk</span><b>${money(sum.cash)}</b></div>
      </div>
      <label class="label" for="pos-cash-out">Uang keluar dari laci (opsional)</label>${moneyInput('pos-cash-out')}
      <div class="pos-recap"><div class="r tot"><span>Seharusnya di laci</span><b id="pos-expected">${money(sum.expected)}</b></div></div>
      <label class="label" for="pos-counted">Uang fisik di laci (hasil hitung)</label>${moneyInput('pos-counted')}
      <div class="pos-diff" id="pos-diff"><span>Selisih</span><b>-</b></div>
      <label class="label" for="pos-close-note">Catatan (opsional)</label><input class="input" id="pos-close-note" maxlength="120" placeholder="Mis. kembalian kurang">
      <div class="pos-modal-actions"><button type="button" class="btn btn-light" data-m-close>Batal</button><button type="button" class="btn btn-green" id="pos-close-go">Tutup Kasir</button></div>`, el => {
      let out = 0, counted = null;
      const recalc = () => {
        const expected = sum.opening + sum.cash - out;
        el.querySelector('#pos-expected').textContent = money(expected);
        const d = el.querySelector('#pos-diff'), b = d.querySelector('b');
        if (counted === null) { b.textContent = '-'; d.className = 'pos-diff'; return; }
        const diff = counted - expected;
        b.textContent = diff === 0 ? 'Pas' : (diff > 0 ? '+' : '−') + money(Math.abs(diff));
        d.className = 'pos-diff ' + (diff === 0 ? 'ok' : diff > 0 ? 'plus' : 'minus');
      };
      wireMoney(el, 'pos-cash-out', v => { out = v; recalc(); });
      wireMoney(el, 'pos-counted', v => { counted = el.querySelector('#pos-counted').value === '' ? null : v; recalc(); });
      el.querySelector('#pos-counted').focus();
      el.querySelector('#pos-close-go').addEventListener('click', async e => {
        if (counted === null && !confirm('Uang fisik belum diisi. Tutup kasir tanpa hitung kas?')) return;
        const btn = e.currentTarget; btn.disabled = true;
        const expected = sum.opening + sum.cash - out;
        const row = { closed_at: new Date().toISOString(), cash_out: out, counted_cash: counted, expected_cash: expected, cash_difference: counted === null ? null : counted - expected, close_note: el.querySelector('#pos-close-note').value.trim() || null };
        try {
          const { error } = await db.from('reading_shifts').update(row).eq('workspace_id', requireWorkspaceId()).eq('id', shift.id);
          if (error) throw error;
          el.remove();
          showToast('Kasir ditutup.');
          await Promise.all([fetchShiftData(), refreshAll()]);
          renderShiftDashboard(); refresh();
          showSessionRecap({ ...shift, ...row });
        } catch (err) { btn.disabled = false; showToast('Gagal menutup kasir: ' + (err.message || err), true); }
      });
    });
  }

  function showSessionRecap(shift) {
    const sum = sessionSummary(shift), wsName = (typeof activeWorkspaceName !== 'undefined' && activeWorkspaceName) || 'Rekap Sesi';
    const diff = shift.cash_difference;
    document.getElementById('pos-recap-view')?.remove();
    const el = document.createElement('div');
    el.id = 'pos-recap-view'; el.className = 'pos-receipt-wrap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="pos-receipt-card"><div class="pos-receipt" id="pos-receipt-paper">
      <div class="r-title">${esc(wsName)}</div><div class="r-meta">REKAP SESI KASIR</div>
      <div class="r-meta">${esc(dt(shift.opened_at))} → ${esc(shift.closed_at ? dt(shift.closed_at) : 'berjalan')}</div><hr>
      <div class="r-line"><span>Jumlah struk</span><b>${sum.count}</b></div>
      ${sum.methods.map(m => `<div class="r-line"><span>${esc(m.name)} (${m.n})</span><b>${money(m.total)}</b></div>`).join('')}
      <div class="r-line r-total"><span>Total penjualan</span><b>${money(sum.total)}</b></div><hr>
      <div class="r-line"><span>Modal awal</span><b>${money(sum.opening)}</b></div>
      <div class="r-line"><span>Tunai masuk</span><b>${money(sum.cash)}</b></div>
      <div class="r-line"><span>Uang keluar</span><b>${money(sum.out)}</b></div>
      <div class="r-line"><span>Seharusnya</span><b>${money(shift.expected_cash ?? sum.expected)}</b></div>
      ${shift.counted_cash !== null && shift.counted_cash !== undefined ? `<div class="r-line"><span>Hitung fisik</span><b>${money(shift.counted_cash)}</b></div><div class="r-line r-total"><span>Selisih</span><b>${diff === 0 ? 'Pas' : (diff > 0 ? '+' : '−') + money(Math.abs(diff))}</b></div>` : ''}
      ${shift.close_note ? `<div class="r-meta" style="margin-top:6px">${esc(shift.close_note)}</div>` : ''}
      </div><div class="pos-receipt-actions"><button type="button" class="btn btn-light" data-r="close">Tutup</button><button type="button" class="btn btn-green" data-r="print">Cetak</button></div></div>`;
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-r]');
      if (a?.dataset.r === 'print') printPaper(el);
      else if (a?.dataset.r === 'close' || e.target === el) el.remove();
    });
    document.body.appendChild(el);
  }

  function showSessionHistory() {
    const list = (typeof shifts !== 'undefined' ? shifts : []).filter(x => x.closed_at || x.id);
    posModal(`<div class="card-title">Riwayat Sesi</div><p class="pos-sub">30 sesi terakhir. Pilih satu untuk melihat rekapnya.</p>
      <div class="pos-sessions">${list.length ? list.map(x => { const sm = sessionSummary(x), d = x.cash_difference; return `<button type="button" class="pos-session" data-sid="${esc(x.id)}"><b>${esc(dt(x.opened_at))}</b><span>${x.closed_at ? dur(x.opened_at, x.closed_at) : 'berjalan'} · ${sm.count} struk · ${money(sm.total)}</span><small class="${d === null || d === undefined ? '' : d === 0 ? 'ok' : d > 0 ? 'plus' : 'minus'}">${d === null || d === undefined ? (x.closed_at ? 'Kas tidak dihitung' : 'Sesi berjalan') : d === 0 ? 'Kas pas' : 'Selisih ' + (d > 0 ? '+' : '−') + money(Math.abs(d))}</small></button>`; }).join('') : '<div class="pos-empty">Belum ada sesi.</div>'}</div>
      <div class="pos-modal-actions"><button type="button" class="btn btn-light" data-m-close>Tutup</button></div>`, el => {
      el.addEventListener('click', e => { const b = e.target.closest('[data-sid]'); if (!b) return; const x = list.find(r => String(r.id) === b.dataset.sid); if (x) { el.remove(); showSessionRecap(x); } });
    });
  }

  function mountSessionUi() {
    const card = document.querySelector('#dashboard > .shift-card .shift-top');
    if (card && !document.getElementById('pos-shift-history')) {
      const b = document.createElement('button');
      b.type = 'button'; b.id = 'pos-shift-history'; b.className = 'btn btn-light pos-shift-history'; b.textContent = 'Riwayat Sesi';
      card.appendChild(b);
      b.addEventListener('click', showSessionHistory);
    }
  }
  // Ambil alih tombol Open/Close lama (capture) supaya modal kasir yang jalan, bukan prompt() tanggal.
  document.addEventListener('click', e => {
    const open = e.target.closest?.('#open-shift-btn'), close = e.target.closest?.('#close-shift-btn');
    if (!open && !close) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if ((open || close).disabled) return;
    if (open) openSessionModal(); else closeSessionModal();
  }, true);

  // Kartu "Saldo Kas" dipakai ulang jadi "Kas Tunai di Laci" (modal awal + tunai masuk sesi berjalan).
  function renderDrawerKpi() {
    const el = document.getElementById('kpi-cash');
    if (!el) return;
    const card = el.closest('.kpi');
    setText(card?.querySelector('.kpi-label'), 'Kas Tunai di Laci');
    card.hidden = false; card.removeAttribute('hidden'); document.body.classList.remove('kairo-no-cash');
    const v = drawerNow();
    if (typeof lastKpiValues !== 'undefined') lastKpiValues['kpi-cash'] = v === null ? 0 : v;
    setText(el, v === null ? '-' : shown(v));
  }

  // Judul riwayat transaksi: "Struk Terbaru" (tabelnya sendiri tetap sama).
  function relabelHistory() {
    setText(document.querySelector('#transaction-history-card .card-title > span:last-child'), 'Struk Terbaru');
    setText(document.querySelector('#transaction-history-card .history-card-subtitle'), 'Struk penjualan terbaru. Pakai filter tanggal untuk mengatur yang tampil.');
  }
  function refresh() { relabelHistory(); renderKpis(); renderDrawerKpi(); relabelShift(); mountSessionUi(); renderPanels(); initKasir(); }

  /* ---------- Pasang ---------- */
  function wrap(name, after) {
    const core = window[name];
    if (typeof core !== 'function' || core.__pos) return;
    const w = function () { const r = core.apply(this, arguments); try { after(); } catch (e) { console.warn('pos-kasir', e); } return r; };
    w.__pos = true;
    window[name] = w;
  }
  wrap('renderDashboard', refresh);
  wrap('renderPerformanceKpis', () => { try { renderAnalytics(); } catch (e) { console.warn('pos analytics', e); } });
  wrap('renderMasterOptions', () => { if (document.getElementById('pos-kasir')) { renderGrid(); renderCart(); } mountPosSettings(); });
  wrap('renderSettingsMasterData', () => { mountPosSettings(); });
  new MutationObserver(() => { if (!document.getElementById('pos-settings-card')) mountPosSettings(); }).observe(document.getElementById('settings') || document.body, { childList: true, subtree: true });
  refresh();
  // Warna grafik ikut tema / mode gelap.
  let lastLook = '';
  const look = () => (document.documentElement.dataset.wsTheme || '') + '|' + document.body.classList.contains('saas-dark');
  lastLook = look();
  const onLook = () => { const now = look(); if (now !== lastLook) { lastLook = now; setTimeout(() => { renderPanels(); if (document.getElementById('pos-analytics')) renderAnalytics(); }, 150); } };
  new MutationObserver(onLook).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ws-theme'] });
  new MutationObserver(onLook).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
