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
  document.addEventListener('click', e => { if (e.target.closest?.('#dashboard .kpi-eye')) setTimeout(() => { renderKpis(); renderPanels(); }, 0); }, true);

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
  let bills = [], billsReady = true, query = '', saving = false;

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
    return { items, adds, subtotal, disc: Math.round(disc), total: Math.max(0, subtotal - Math.round(disc)) };
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
        order_items: t.items, order_topics: [], order_addons: t.adds,
        price_adjustment_type: t.disc > 0 ? 'discount' : 'none', price_adjustment_mode: cart.discMode, price_adjustment_value: t.disc > 0 ? num(cart.discValue) : 0, price_adjustment_amount: -t.disc,
        tip_amount: 0, total_price: t.total, payment_method: cart.pay, notes: cart.table ? 'Meja ' + cart.table : null,
        ...(receiptNo ? { receipt_no: receiptNo } : {})
      };
      const { error } = await db.from('transactions').insert([workspaceInsert(payload)]);
      if (error) throw error;
      const billId = cart.billId, received = cart.received;
      if (billId) { try { await db.from('pos_open_bills').delete().eq('workspace_id', requireWorkspaceId()).eq('id', billId); } catch (_e) { /* bill sisa dibersihkan manual */ } }
      showReceipt({ ...payload, received, change: isCash(cart.pay) && received >= t.total ? received - t.total : 0, subtotal: t.subtotal, table: cart.table, at: now });
      resetCart(true);
      showToast('Pembayaran tersimpan.');
      await Promise.all([refreshAll(), loadBills()]);
      renderGrid();
    } catch (err) { showToast('Gagal menyimpan: ' + (err.message || err), true); }
    finally { saving = false; renderCart(); }
  }

  /* ---------- Struk (cetak lewat browser) ---------- */
  function showReceipt(p) {
    document.getElementById('pos-receipt')?.remove();
    const wsName = (typeof activeWorkspaceName !== 'undefined' && activeWorkspaceName) || 'Struk';
    const lines = [...p.order_items, ...p.order_addons].map(x => `<div class="r-line"><span>${esc(x.name)} × ${x.qty}</span><b>${money(x.subtotal)}</b></div>`).join('');
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
      <div class="r-line r-total"><span>Total</span><b>${money(p.total_price)}</b></div>
      <div class="r-line"><span>${esc(p.payment_method)}</span><b>${p.received ? money(p.received) : money(p.total_price)}</b></div>
      ${p.change ? `<div class="r-line"><span>Kembalian</span><b>${money(p.change)}</b></div>` : ''}
      <div class="r-foot">Terima kasih</div></div>
      <div class="pos-receipt-actions"><button type="button" class="btn btn-light" data-r="close">Tutup</button><button type="button" class="btn btn-green" data-r="print">Cetak</button></div></div>`;
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-r]');
      if (a?.dataset.r === 'print') { document.body.classList.add('pos-printing'); window.print(); setTimeout(() => document.body.classList.remove('pos-printing'), 500); }
      else if (a?.dataset.r === 'close' || e.target === el) el.remove();
    });
    document.body.appendChild(el);
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
        <div class="card pos-products"><div class="pos-search"><input class="input" id="pos-search" type="search" placeholder="Cari produk atau scan barcode…" autocomplete="off" inputmode="search"></div><div class="pos-grid" id="pos-grid"></div><div class="pos-addons" id="pos-addons"></div></div>
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
  const visibleProducts = () => activeMasters(packages).filter(p => !query || String(p.name || '').toLowerCase().includes(query) || String(p.code || '').toLowerCase().includes(query));
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
      return `<button type="button" class="pos-prod${left !== null && left <= 0 ? ' is-out' : ''}" data-pid="${esc(p.id)}">${q ? `<em>${q}</em>` : ''}<b>${esc(p.name)}</b><span>${money(p.price)}</span>${left !== null ? `<small>${left <= 0 ? 'Habis' : 'Stok ' + left}</small>` : ''}</button>`;
    }).join('') : `<div class="pos-empty">${(packages || []).length ? 'Produk tidak ditemukan.' : 'Belum ada produk. Isi di Settings › Produk &amp; Harga.'}</div>`;
    renderAddons();
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
      <div class="pos-sum"><div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>${t.disc ? `<div><span>Diskon</span><span>−${money(t.disc)}</span></div>` : ''}<div class="pos-total"><span>Total</span><span>${money(t.total)}</span></div></div>
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
    if (sum) sum.innerHTML = `<div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>${t.disc ? `<div><span>Diskon</span><span>−${money(t.disc)}</span></div>` : ''}<div class="pos-total"><span>Total</span><span>${money(t.total)}</span></div>`;
    const ch = el.querySelector('.pos-change b');
    if (ch) ch.textContent = cart.received >= t.total && t.total > 0 ? money(cart.received - t.total) : '-';
    const bar = document.getElementById('pos-mobilebar'); if (bar) bar.textContent = `Lihat Struk · ${cartCount()} item · ${money(t.total)}`;
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

  function refresh() { renderKpis(); relabelShift(); renderPanels(); initKasir(); }

  /* ---------- Pasang ---------- */
  function wrap(name, after) {
    const core = window[name];
    if (typeof core !== 'function' || core.__pos) return;
    const w = function () { const r = core.apply(this, arguments); try { after(); } catch (e) { console.warn('pos-kasir', e); } return r; };
    w.__pos = true;
    window[name] = w;
  }
  wrap('renderDashboard', refresh);
  wrap('renderMasterOptions', () => { if (document.getElementById('pos-kasir')) { renderGrid(); renderCart(); } });
  refresh();
  // Warna grafik ikut tema / mode gelap.
  let lastLook = '';
  const look = () => (document.documentElement.dataset.wsTheme || '') + '|' + document.body.classList.contains('saas-dark');
  lastLook = look();
  const onLook = () => { const now = look(); if (now !== lastLook) { lastLook = now; setTimeout(renderPanels, 150); } };
  new MutationObserver(onLook).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ws-theme'] });
  new MutationObserver(onLook).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
