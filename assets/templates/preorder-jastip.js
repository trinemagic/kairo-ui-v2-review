/* KAIRO - template custom "Pre-Order & Jastip" (business_template = 'preorder_jastip'), owner Okt 2026.
   Dimuat HANYA untuk workspace dengan template ini (loader di kairo-app.js). Template TIDAK dibuka untuk umum.
   Isi: Pre-Order (barang bebas, kategori, ETA, status barang, skema Lunas/DP/Cicilan), detail order (pembayaran, jadwal,
   talangan & biaya, laba), menu Cicilan (Cicilan Customer + Reminder), menu Keuangan (Pembukuan + Modal Talangan), kartu
   Dashboard, lonceng pengingat cicilan. Data uang: tabel ledger_entries (satu sumber, hanya tambah; koreksi = entri 'reversal'),
   jadwal: installment_schedules (berversi). Status bayar & status cicilan DIHITUNG, tidak disimpan.
   Laba order (untuk Withdraw/bagi hasil) = total - refund - talangan - biaya order, hanya untuk order Selesai (barang
   diserahkan + lunas): transactionProfitBreakdown() dibungkus khusus template ini. SQL: .claude/sql/2026-10-preorder-jastip.sql */
(function () {
  'use strict';
  if (window.__kairoJastip) return;
  window.__kairoJastip = true;

  const TPL = 'preorder_jastip';
  const isJastip = () => document.documentElement.dataset.businessTemplate === TPL;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const money = n => { const v = Math.round(num(n)); return (v < 0 ? '−Rp' : 'Rp') + Math.abs(v).toLocaleString('id-ID'); };
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const parseDate = s => { const [y, m, d] = String(s || '').split('-').map(Number); return y ? new Date(y, (m || 1) - 1, d || 1) : null; };
  const dayDiff = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);
  const fmtDate = s => { const d = parseDate(s); return d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t); };
  const busy = (btn, on, text, label) => { if (typeof setBtnLoading === 'function') setBtnLoading(btn, on, text, label); else if (btn) btn.disabled = on; };
  const ws = () => requireWorkspaceId();
  const DUE_SOON_DAYS = 3;

  /* ---------- Istilah & daftar pilihan ---------- */
  const PO_STATUS = [
    ['waiting', 'Menunggu Pembelian'], ['bought', 'Sudah Dibeli'], ['shipping', 'Dalam Pengiriman'],
    ['arrived', 'Tiba di Indonesia'], ['delivered', 'Diserahkan'], ['cancelled', 'Dibatalkan']
  ];
  const poLabel = k => (PO_STATUS.find(x => x[0] === k) || PO_STATUS[0])[1];
  const COST_TYPES = ['Harga barang', 'Ongkir internasional', 'Bea & pajak', 'Ongkir lokal', 'Biaya lain'];
  const CURRENCIES = ['IDR', 'USD', 'JPY', 'KRW', 'SGD', 'MYR', 'THB', 'CNY', 'HKD', 'TWD', 'EUR', 'GBP', 'AUD'];
  const KIND = {
    customer_payment: ['Pembayaran customer', 'in'], refund: ['Refund ke customer', 'out'],
    partner_advance: ['Talangan partner', 'adv'], advance_repayment: ['Pengembalian talangan', 'out'],
    order_cost: ['Biaya order (uang usaha)', 'out'], other_income: ['Pemasukan lain', 'in'],
    operating_expense: ['Pengeluaran operasional', 'out'], reversal: ['Pembatalan catatan', 'none']
  };
  const kindLabel = k => (KIND[k] || [k])[0];
  function payMethods() {
    const opts = [...(document.getElementById('tx-payment')?.options || [])].filter(o => o.value);
    return opts.length ? opts.map(o => [o.value, o.textContent.trim()]) : [['TRANSFER', 'Transfer'], ['CASH', 'Cash'], ['QRIS', 'QRIS'], ['OTHER', 'Lainnya']];
  }
  function platforms() {
    const opts = [...(document.getElementById('tx-platform')?.options || [])].filter(o => o.value);
    return opts.length ? opts.map(o => [o.value, o.textContent.trim()]) : [['WhatsApp', 'WhatsApp'], ['Instagram', 'Instagram'], ['Other', 'Lainnya']];
  }
  const partnerList = () => (Array.isArray(partners) ? partners : []).filter(p => String(p.partner_name || '').toLowerCase() !== 'kas');
  const RECORDER_KEY = 'kairo_jastip_recorder_v1';
  const lastRecorder = () => { try { return localStorage.getItem(RECORDER_KEY) || ''; } catch (_e) { return ''; } };
  const rememberRecorder = v => { try { localStorage.setItem(RECORDER_KEY, v || ''); } catch (_e) { /* tidak penting */ } };

  /* ---------- Data: buku uang + jadwal ---------- */
  let ledger = [], schedules = [], loadedFor = '', ready = true, loading = null;
  async function loadData(force) {
    if (!isJastip()) return;
    const w = String(ws());
    if (!force && loadedFor === w) return;
    if (loading) return loading;
    loading = (async () => {
      try {
        const [l, s] = await Promise.all([
          fetchAllRows(() => db.from('ledger_entries').select('*').eq('workspace_id', w).order('entry_date', { ascending: false }).order('created_at', { ascending: false })),
          fetchAllRows(() => db.from('installment_schedules').select('*').eq('workspace_id', w).order('version', { ascending: true }))
        ]);
        ledger = l || []; schedules = s || []; ready = true; loadedFor = w;
        await loadCustomerMeta(w);
      } catch (e) {
        console.warn('[KAIRO][Jastip] data', e);
        ready = !/relation|does not exist|schema cache/i.test(String(e?.message || ''));
        if (!ready) { ledger = []; schedules = []; loadedFor = w; }
      } finally { loading = null; }
    })();
    return loading;
  }
  const reversedIds = () => new Set(ledger.filter(e => e.kind === 'reversal').map(e => String(e.reverses_id)));
  function liveEntries() { const r = reversedIds(); return ledger.filter(e => e.kind !== 'reversal' && !r.has(String(e.id))); }
  function entriesFor(txId) { return liveEntries().filter(e => String(e.transaction_id || '') === String(txId)); }
  function scheduleFor(txId) {
    const list = schedules.filter(s => String(s.transaction_id) === String(txId)).sort((a, b) => num(b.version) - num(a.version));
    return list[0] || null;
  }
  const scheduleVersions = txId => schedules.filter(s => String(s.transaction_id) === String(txId)).length;

  /* Ringkasan uang satu order. total = Total Tagihan (transactions.total_price). */
  function fin(tx) {
    const es = entriesFor(tx.id), sum = k => es.filter(e => e.kind === k).reduce((s, e) => s + num(e.amount), 0);
    const total = num(tx.total_price), payments = sum('customer_payment'), refunds = sum('refund');
    const paid = payments - refunds;
    const advances = es.filter(e => e.kind === 'partner_advance'), costs = sum('partner_advance') + sum('order_cost');
    const byPartner = {};
    advances.forEach(e => { const k = e.partner_name || '-'; byPartner[k] = (byPartner[k] || 0) + num(e.amount); });
    const remaining = Math.max(0, total - paid), over = Math.max(0, paid - total);
    const cancelled = tx.po_status === 'cancelled', delivered = tx.po_status === 'delivered';
    const done = delivered && remaining <= 0.5;
    return { es, total, payments, refunds, paid, costs, byPartner, remaining, over, cancelled, delivered, done, profit: total - refunds - costs };
  }
  function payState(f) {
    if (f.cancelled) return ['Dibatalkan', 'muted'];
    if (f.over > 0.5) return ['Lebih bayar', 'warn'];
    if (f.remaining <= 0.5) return ['Lunas', 'ok'];
    if (f.paid > 0.5) return [f.paid < f.total ? 'Sebagian' : 'Lunas', 'info'];
    return ['Belum bayar', 'warn'];
  }

  /* Jadwal: items = { base_paid, list:[{seq,due,amount}] }. Pembayaran setelah base_paid dialokasikan FIFO ke cicilan urut. */
  function planRows(tx, f) {
    const s = scheduleFor(tx.id);
    if (!s) return null;
    const data = s.items || {}, list = Array.isArray(data.list) ? data.list : [];
    let pool = Math.max(0, (f || fin(tx)).paid - num(data.base_paid));
    const t = today();
    const rows = list.map((it, i) => {
      const amount = num(it.amount), got = Math.min(amount, pool); pool -= got;
      const left = Math.max(0, amount - got), d = dayDiff(it.due, t);
      let key;
      if (left <= 0.5) key = 'paid';
      else if (d < 0) key = got > 0 ? 'late-partial' : 'late';
      else if (d === 0) key = 'today';
      else if (got > 0) key = 'partial';
      else if (d <= DUE_SOON_DAYS) key = 'soon';
      else key = 'upcoming';
      return { seq: it.seq || i + 1, due: it.due, amount, got, left, days: d, key };
    });
    return { schedule: s, rows, frequency: s.frequency, version: num(s.version), versions: scheduleVersions(tx.id) };
  }
  const ROW_STATE = {
    paid: ['Lunas', 'ok'], partial: ['Sebagian', 'info'], 'late-partial': ['Terlambat · sebagian', 'bad'], late: ['Terlambat', 'bad'],
    today: ['Jatuh tempo hari ini', 'warn'], soon: ['Akan jatuh tempo', 'warn'], upcoming: ['Belum jatuh tempo', 'muted']
  };
  function planState(p, f) {
    if (f.cancelled) return ['Dibatalkan', 'muted'];
    if (f.remaining <= 0.5) return ['Lunas', 'ok'];
    if (!p) return ['Tanpa jadwal', 'muted'];
    if (p.rows.some(r => r.key === 'late' || r.key === 'late-partial')) return ['Terlambat', 'bad'];
    if (p.rows.some(r => r.key === 'today' || r.key === 'soon')) return ['Akan jatuh tempo', 'warn'];
    return ['Berjalan', 'info'];
  }
  const nextRow = p => p && p.rows.find(r => r.left > 0.5);

  /* Semua pre-order (tanpa potongan periode). */
  let allTx = [];
  async function loadOrders() { try { allTx = (await allTransactions()).filter(t => !(typeof isRollupTx === 'function' && isRollupTx(t))); } catch (_e) { allTx = Array.isArray(transactions) ? transactions : []; } return allTx; }
  const itemsText = t => (Array.isArray(t.order_items) ? t.order_items : []).map(x => `${x.name}${num(x.qty) > 1 ? ' ×' + x.qty : ''}`).join(', ') || t.package_code || '-';

  /* Kategori minat & catatan customer (kolom customers.interest_topic_ids / notes; tidak ada = fitur diam). */
  let custMeta = {}, custMetaReady = false;
  async function loadCustomerMeta(w) {
    try {
      const rows = await fetchAllRows(() => db.from('customers').select('id,interest_topic_ids,notes').eq('workspace_id', w));
      custMeta = {}; (rows || []).forEach(r => { custMeta[String(r.id)] = { ids: Array.isArray(r.interest_topic_ids) ? r.interest_topic_ids.map(String) : [], notes: r.notes || '' }; });
      custMetaReady = true;
    } catch (e) { console.warn('[KAIRO][Jastip] minat customer', e); custMetaReady = false; }
  }

  /* Saldo talangan per partner + saldo kas usaha (semua waktu). */
  function advanceBalances() {
    const out = {};
    partnerList().forEach(p => { out[p.partner_name] = { name: p.partner_name, id: p.id, adv: 0, back: 0 }; });
    liveEntries().forEach(e => {
      if (e.kind !== 'partner_advance' && e.kind !== 'advance_repayment') return;
      const k = e.partner_name || '-'; out[k] = out[k] || { name: k, id: e.partner_id, adv: 0, back: 0 };
      if (e.kind === 'partner_advance') out[k].adv += num(e.amount); else out[k].back += num(e.amount);
    });
    Object.values(out).forEach(x => { x.left = x.adv - x.back; });
    return Object.values(out);
  }
  let payoutRows = [];
  function businessCash() {
    let bal = 0;
    liveEntries().forEach(e => { const d = (KIND[e.kind] || [])[1]; if (d === 'in') bal += num(e.amount); else if (d === 'out') bal -= num(e.amount); });
    payoutRows.forEach(p => { bal -= num(p.amount); });
    return bal;
  }

  /* ---------- Laba order untuk bagi hasil (Withdraw) ---------- */
  const coreBreakdown = window.transactionProfitBreakdown;
  if (typeof coreBreakdown === 'function') {
    window.transactionProfitBreakdown = function (t) {
      if (!isJastip() || !t || !t.po_scheme) return coreBreakdown.apply(this, arguments);
      const f = fin(t);
      const base = f.done ? Math.max(0, f.profit) : 0;
      return { hpp: Math.max(0, num(t.total_price) - base), distributable: base, manual: [], manualTotal: 0, percentageBase: base };
    };
  }
  /* Pemasukan lain (+) dan pengeluaran operasional (−) ikut dibagi ke hak partner (Withdraw) memakai % partner yang berlaku
     pada tanggal entrinya. Hak periode (Dashboard/Withdraw/Export) = entri di periode filter; hak kumulatif & validasi
     pencairan = semua entri sampai tanggal itu. */
  function bookShare(partner, from, to) {
    if (typeof shareRuleFor !== 'function') return 0;
    return liveEntries().filter(e => (e.kind === 'other_income' || e.kind === 'operating_expense') && (!from || String(e.entry_date) >= from) && (!to || String(e.entry_date) <= to))
      .reduce((s, e) => s + (e.kind === 'other_income' ? 1 : -1) * num(e.amount) * num(shareRuleFor(partner, e.entry_date)), 0);
  }
  const coreEntitlement = window.entitlementFromTransactions;
  if (typeof coreEntitlement === 'function') {
    window.entitlementFromTransactions = function (txRows, partner, throughDate) {
      const base = coreEntitlement.apply(this, arguments);
      if (!isJastip() || !partner) return base;
      let from = '', to = throughDate ? String(throughDate) : '';
      if (txRows === transactions) { try { const r = getRange(); from = r.from || ''; to = r.to || ''; } catch (_e) { /* periode kustom belum lengkap */ } }
      return base + bookShare(partner, from, to);
    };
  }
  // Data buku uang harus siap sebelum halaman (dan hitungan hak partner) digambar.
  const coreLoad = window.loadPageData;
  if (typeof coreLoad === 'function') {
    window.loadPageData = async function (tab, options) {
      if (isJastip()) { await loadData(Boolean(options && options.force)); try { payoutRows = await allPayouts(); } catch (_e) { /* opsional */ } }
      const r = await coreLoad.apply(this, arguments);
      if (isJastip()) { try { await afterPageLoad(tab || currentAppPage()); } catch (e) { console.warn('[KAIRO][Jastip]', e); } }
      return r;
    };
  }
  async function afterPageLoad(tab) {
    await loadOrders();
    if (tab === 'dashboard') renderDash();
    if (tab === 'input') renderOrders();
    if (tab === 'po-plans') renderPlans();
    if (tab === 'po-finance') renderFinance();
    if (tab === 'customers') decorateCustomers();
    refreshBell();
  }
  // Order yang sudah punya pembayaran/biaya tidak dihapus (supaya buku uang tidak menggantung): pakai Batalkan.
  const coreDelete = window.deleteCancelledTransaction;
  if (typeof coreDelete === 'function') {
    window.deleteCancelledTransaction = function (id) {
      if (isJastip() && entriesFor(id).length) { toast('Pre-order ini sudah punya catatan pembayaran/biaya. Buka detail pre-order lalu pilih Batalkan Pre-Order.', 'warning'); return; }
      return coreDelete.apply(this, arguments);
    };
  }

  /* ---------- Simpan ---------- */
  async function insertLedger(rows) {
    const list = rows.map(r => workspaceInsert({ id: r.id || uuid(), currency: 'IDR', ...r }));
    const { error } = await db.from('ledger_entries').insert(list);
    if (error && !(window.kairoTxGuard && window.kairoTxGuard.isDuplicate(error))) throw error;
    ledger = [...list, ...ledger.filter(e => !list.some(x => x.id === e.id))];
    return list;
  }
  async function insertSchedule(txId, frequency, list, basePaid, reason) {
    const version = scheduleVersions(txId) + 1;
    const row = workspaceInsert({ id: uuid(), transaction_id: txId, version, frequency, items: { base_paid: Math.round(basePaid), list }, reason: reason || null });
    const { error } = await db.from('installment_schedules').insert([row]);
    if (error) throw error;
    schedules.push(row);
    return row;
  }
  function buildSchedule(amount, count, frequency, start) {
    const n = Math.max(1, Math.round(num(count))), each = Math.floor(Math.round(amount) / n), first = parseDate(start) || new Date();
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(first);
      if (frequency === 'weekly') d.setDate(d.getDate() + 7 * i); else d.setMonth(first.getMonth() + i);
      if (frequency === 'monthly' && d.getDate() !== first.getDate()) d.setDate(0); // 31 Jan + 1 bulan = akhir Feb
      return { seq: i + 1, due: iso(d), amount: i === n - 1 ? Math.round(amount) - each * (n - 1) : each };
    });
  }
  async function afterSave() { invalidateWorkspaceData(['transactions']); await refreshAll(); }

  /* ---------- Lembar (overlay) ---------- */
  function sheet(title, body, foot) {
    closeSheet();
    const o = document.createElement('div');
    o.className = 'po-overlay'; o.id = 'po-sheet';
    o.innerHTML = `<div class="po-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="po-sheet-head"><strong>${esc(title)}</strong><button type="button" class="po-x" data-po-close aria-label="Tutup">×</button></div><div class="po-sheet-body">${body}</div>${foot ? `<div class="po-sheet-foot">${foot}</div>` : ''}</div>`;
    document.body.appendChild(o); document.documentElement.classList.add('po-lock');
    o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-po-close]')) closeSheet(); });
    o.querySelectorAll('[data-money]').forEach(i => { try { window.kairoMoneyInput && window.kairoMoneyInput(i); } catch (_e) { /* biarkan angka biasa */ } });
    setTimeout(() => o.querySelector('input:not([type=hidden]),select,textarea')?.focus(), 30);
    return o;
  }
  function closeSheet() { document.getElementById('po-sheet')?.remove(); document.documentElement.classList.remove('po-lock'); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('po-sheet')) closeSheet(); });
  const opt = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const recorderField = () => {
    const ps = partnerList();
    if (ps.length < 2) return '';
    const last = lastRecorder();
    return `<label class="po-f"><span>Dicatat oleh</span><select class="input" name="recorded_by" required><option value="">Pilih partner</option>${opt(ps.map(p => [p.partner_name, p.partner_name]), last)}</select></label>`;
  };
  const moneyVal = el => Math.round(num(el && el.value));

  /* ---------- Form Pre-Order baru ---------- */
  function openNewOrder(prefill) {
    const cats = (Array.isArray(topics) ? topics : []).filter(t => t.is_active !== false);
    const names = (Array.isArray(customerDirectory) ? customerDirectory : []).map(c => `<option value="${esc(c.display_name)}">`).join('');
    const body = `<form id="po-new" class="po-form" autocomplete="off">
      <div class="po-grid2">
        <label class="po-f"><span>Tanggal order</span><input class="input" type="date" name="date" value="${today()}" required></label>
        <label class="po-f"><span>Perkiraan tiba (opsional)</span><input class="input" type="date" name="eta"></label>
      </div>
      <div class="po-grid2">
        <label class="po-f"><span>Nama customer</span><input class="input" name="customer" list="po-cust-list" required value="${esc(prefill?.customer || '')}"><datalist id="po-cust-list">${names}</datalist></label>
        <label class="po-f"><span>WhatsApp (opsional)</span><input class="input" name="wa" inputmode="tel" placeholder="08…"></label>
      </div>
      <label class="po-f"><span>Platform</span><select class="input" name="platform" required><option value="">Pilih platform</option>${opt(platforms(), '')}</select></label>
      <div class="po-grid2"><label class="po-f"><span>Kategori barang</span><select class="input" name="cat"><option value="">Pilih kategori</option>${cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}<option value="__new">＋ Kategori baru…</option></select></label>
        <label class="po-f" id="po-newcat-wrap" hidden><span>Nama kategori baru</span><input class="input" name="newcat" maxlength="40" placeholder="mis. Sepatu, Mainan"></label></div>
      <div class="po-f"><span>Barang</span><div id="po-items" class="po-items"></div><button type="button" class="btn btn-light po-small" id="po-add-item">＋ Tambah barang</button></div>
      <div class="po-f"><span>Biaya tambahan ke customer (jasa titip, ongkir, dll.)</span><div id="po-fees" class="po-items"></div><button type="button" class="btn btn-light po-small" id="po-add-fee">＋ Tambah biaya</button></div>
      <div class="po-total"><span>Total tagihan</span><b id="po-total">Rp0</b></div>
      <div class="po-f"><span>Cara bayar</span><div class="po-seg" role="radiogroup" id="po-scheme">
        <label><input type="radio" name="scheme" value="full" checked><span>Lunas sekarang</span></label>
        <label><input type="radio" name="scheme" value="dp"><span>DP</span></label>
        <label><input type="radio" name="scheme" value="installment"><span>Cicilan</span></label></div></div>
      <div id="po-pay-box" class="po-box"></div>
      <label class="po-f"><span>Catatan (opsional)</span><textarea class="input" name="note" rows="2"></textarea></label>
      ${recorderField()}
    </form>`;
    const o = sheet('Pre-Order Baru', body, `<button type="button" class="btn btn-light" data-po-close>Batal</button><button type="button" class="btn btn-green" id="po-save">Simpan Pre-Order</button>`);
    const form = o.querySelector('#po-new');
    const addLine = (box, kind) => {
      const row = document.createElement('div'); row.className = 'po-line';
      row.innerHTML = kind === 'item'
        ? `<input class="input" name="iname" placeholder="Nama barang" required><input class="input po-qty" name="iqty" type="number" min="1" value="1" aria-label="Jumlah"><input class="input" name="iprice" data-money placeholder="Harga satuan" aria-label="Harga satuan"><button type="button" class="po-del" aria-label="Hapus baris">×</button>`
        : `<input class="input" name="fname" placeholder="Nama biaya" value="Jasa titip"><input class="input" name="fprice" data-money placeholder="Nominal" aria-label="Nominal"><button type="button" class="po-del" aria-label="Hapus baris">×</button>`;
      box.appendChild(row);
      row.querySelectorAll('[data-money]').forEach(i => { try { window.kairoMoneyInput && window.kairoMoneyInput(i); } catch (_e) { /* */ } });
      row.querySelector('.po-del').onclick = () => { row.remove(); recalc(); };
      row.addEventListener('input', recalc);
    };
    const items = () => [...form.querySelectorAll('#po-items .po-line')].map(r => ({ name: r.querySelector('[name=iname]').value.trim(), qty: Math.max(1, Math.round(num(r.querySelector('[name=iqty]').value))), price: moneyVal(r.querySelector('[name=iprice]')) })).filter(x => x.name);
    const fees = () => [...form.querySelectorAll('#po-fees .po-line')].map(r => ({ name: r.querySelector('[name=fname]').value.trim() || 'Biaya', price: moneyVal(r.querySelector('[name=fprice]')) })).filter(x => x.price > 0);
    const total = () => items().reduce((s, x) => s + x.qty * x.price, 0) + fees().reduce((s, x) => s + x.price, 0);
    const scheme = () => form.querySelector('[name=scheme]:checked').value;
    function payBox() {
      const s = scheme(), box = form.querySelector('#po-pay-box');
      const method = `<label class="po-f"><span>Metode bayar</span><select class="input" name="method"><option value="">Pilih metode</option>${opt(payMethods(), '')}</select></label>`;
      if (s === 'full') box.innerHTML = `<div class="po-note">Customer membayar seluruh tagihan sekarang.</div>${method}`;
      else if (s === 'dp') box.innerHTML = `<div class="po-grid2"><label class="po-f"><span>DP dibayar sekarang</span><input class="input" name="dp" data-money placeholder="Rp0"></label><label class="po-f"><span>Pelunasan paling lambat</span><input class="input" type="date" name="due" required></label></div>${method}<div class="po-note" id="po-pay-sum"></div>`;
      else box.innerHTML = `<div class="po-grid2"><label class="po-f"><span>DP dibayar sekarang (opsional)</span><input class="input" name="dp" data-money placeholder="Rp0"></label><label class="po-f"><span>Jumlah cicilan</span><input class="input" type="number" name="count" min="1" max="52" value="3"></label></div>
        <div class="po-grid2"><label class="po-f"><span>Frekuensi</span><select class="input" name="freq"><option value="monthly">Bulanan</option><option value="weekly">Mingguan</option></select></label><label class="po-f"><span>Cicilan pertama</span><input class="input" type="date" name="start" value="${iso(new Date(Date.now() + 7 * 864e5))}"></label></div>${method}<div class="po-plan-preview" id="po-pay-sum"></div>`;
      box.querySelectorAll('[data-money]').forEach(i => { try { window.kairoMoneyInput && window.kairoMoneyInput(i); } catch (_e) { /* */ } });
      recalc();
    }
    function recalc() {
      const t = total();
      o.querySelector('#po-total').textContent = money(t);
      const sum = o.querySelector('#po-pay-sum'); if (!sum) return;
      const dp = moneyVal(form.querySelector('[name=dp]')), rest = Math.max(0, t - dp);
      if (scheme() === 'dp') sum.textContent = `Sisa tagihan setelah DP: ${money(rest)}`;
      else {
        const list = buildSchedule(rest, form.querySelector('[name=count]')?.value, form.querySelector('[name=freq]')?.value, form.querySelector('[name=start]')?.value);
        sum.innerHTML = rest > 0 ? `<b>Jadwal (${list.length}× ${money(list[0].amount)})</b>${list.slice(0, 6).map(r => `<span>${r.seq}. ${fmtDate(r.due)} · ${money(r.amount)}</span>`).join('')}${list.length > 6 ? `<span>… sampai ${fmtDate(list[list.length - 1].due)}</span>` : ''}` : 'Isi barang dulu untuk melihat jadwal.';
      }
    }
    addLine(form.querySelector('#po-items'), 'item');
    form.querySelector('#po-add-item').onclick = () => addLine(form.querySelector('#po-items'), 'item');
    form.querySelector('#po-add-fee').onclick = () => addLine(form.querySelector('#po-fees'), 'fee');
    form.querySelector('#po-scheme').addEventListener('change', payBox);
    form.cat.addEventListener('change', () => { const on = form.cat.value === '__new'; o.querySelector('#po-newcat-wrap').hidden = !on; if (on) form.newcat.focus(); });
    form.addEventListener('input', e => { if (e.target.closest('#po-pay-box')) recalc(); });
    form.addEventListener('change', e => { if (e.target.closest('#po-pay-box')) recalc(); });
    payBox();
    o.querySelector('#po-save').onclick = () => saveNewOrder(form, { items, fees, total, scheme });
  }

  /* Kategori: pilih dari daftar, atau ketik baru -> disimpan ke topic_masters (nama kembar/nonaktif dipakai lagi, tidak dobel). */
  async function pickCategory(id, newName) {
    if (id && id !== '__new') { const t = (topics || []).find(x => String(x.id) === String(id)); return t ? { id: t.id, name: t.name } : null; }
    const name = String(newName || '').trim();
    if (id !== '__new' || !name) return null;
    const hit = (topics || []).find(x => String(x.name || '').trim().toLowerCase() === name.toLowerCase()) || await window.kairoFindTopic?.(name);
    if (hit) {
      if (hit.is_active === false) { const { error } = await db.from('topic_masters').update({ is_active: true }).eq('workspace_id', ws()).eq('id', hit.id); if (error) throw error; }
      if (hit.is_active === false && typeof loadMasters === 'function') await loadMasters();
      return { id: hit.id, name: hit.name };
    }
    const { data, error } = await db.from('topic_masters').insert([workspaceInsert({ name, is_active: true })]).select('id,name').single();
    if (error) throw error;
    if (typeof loadMasters === 'function') await loadMasters();
    return { id: data.id, name: data.name };
  }

  let savingOrder = false;
  async function saveNewOrder(form, h) {
    if (savingOrder) return;
    const g = n => form.querySelector(`[name=${n}]`), val = n => String(g(n)?.value || '').trim();
    const its = h.items(), fees = h.fees(), total = h.total(), scheme = h.scheme();
    const customer = val('customer'), method = val('method'), dp = moneyVal(g('dp'));
    const err = m => { toast(m, 'warning'); };
    if (!customer) return err('Nama customer wajib diisi.');
    if (!val('platform')) return err('Pilih platform dulu.');
    if (!its.length) return err('Isi minimal 1 barang.');
    if (its.some(x => x.price <= 0)) return err('Isi harga satuan setiap barang.');
    if (total <= 0) return err('Total tagihan masih Rp0.');
    if ((scheme === 'full' || dp > 0) && !method) return err('Pilih metode bayar.');
    if (dp > total) return err('DP tidak boleh lebih besar dari total tagihan.');
    if (scheme === 'dp' && !val('due')) return err('Isi tanggal pelunasan paling lambat.');
    if (scheme === 'installment' && total - dp <= 0) return err('Tidak ada sisa untuk dicicil. Pilih Lunas sekarang.');
    if (val('cat') === '__new' && !val('newcat')) return err('Isi nama kategori baru.');
    const recorder = val('recorded_by');
    if (g('recorded_by') && !recorder) return err('Pilih siapa yang mencatat.');
    if (recorder) rememberRecorder(recorder);
    const btn = document.getElementById('po-save');
    savingOrder = true; busy(btn, true, null, 'Menyimpan…');
    try {
      const cat = await pickCategory(val('cat'), val('newcat'));
      const cats = cat ? [cat] : [];
      // Customer: pakai yang sudah ada (nama sama), kalau belum ada dibuat.
      await (typeof loadCustomerDirectory === 'function' ? loadCustomerDirectory() : null);
      let cust = typeof getExactCustomer === 'function' ? getExactCustomer(customer) : null;
      if (!cust) {
        const { data, error } = await db.from('customers').insert([workspaceInsert({ display_name: customer, whatsapp: val('wa') || null })]).select('id,display_name').single();
        if (error) throw error; cust = data;
      }
      const orderItems = its.map((x, i) => ({ id: 'po-item-' + (i + 1), code: 'PO', name: x.name, qty: x.qty, unit_price: x.price, subtotal: x.qty * x.price, cost_price: 0, cost_subtotal: 0, profit_share_mode: 'percentage', manual_profit_split: [] }));
      const feeItems = fees.map((x, i) => ({ id: 'po-fee-' + (i + 1), code: 'FEE', name: x.name, qty: 1, unit_price: x.price, subtotal: x.price, cost_price: 0, cost_subtotal: 0, profit_share_mode: 'percentage', manual_profit_split: [], is_charge: true }));
      const firstPay = scheme === 'full' ? total : dp;
      const payload = {
        transaction_date: val('date') || today(), reading_started_at: new Date().toISOString(), reading_status: 'on_progress', shift_id: null,
        customer_name: cust.display_name || customer, customer_id: cust.id, platform: val('platform'), social_name: null, whatsapp: val('wa') || null,
        package_id: null, package_code: 'PRE-ORDER', package_price: orderItems.reduce((s, x) => s + x.subtotal, 0), package_qty: orderItems.reduce((s, x) => s + x.qty, 0),
        topic_id: cats[0]?.id || null, topic_name: cats.map(c => c.name).join(', ') || null,
        addon_id: null, addon_code: feeItems.length ? 'FEE' : null, addon_price: feeItems.reduce((s, x) => s + x.subtotal, 0), addon_qty: feeItems.length,
        order_items: orderItems, order_topics: cats, order_addons: feeItems,
        price_adjustment_type: 'none', price_adjustment_mode: 'fixed', price_adjustment_value: 0, price_adjustment_amount: 0, tip_amount: 0,
        total_price: total, payment_method: firstPay > 0 ? method : (scheme === 'installment' ? 'CICILAN' : 'DP'),
        notes: val('note') || null, po_status: 'waiting', po_eta: val('eta') || null, po_scheme: scheme
      };
      const attempt = window.kairoTxGuard.begin(payload);
      payload.id = attempt.id;
      const { error } = await db.from('transactions').insert([workspaceInsert(payload)]);
      const already = Boolean(error) && window.kairoTxGuard.isDuplicate(error);
      if (error && !already) throw error;
      if (!already) {
        if (firstPay > 0) await insertLedger([{ id: uuid(), entry_date: payload.transaction_date, kind: 'customer_payment', amount: firstPay, transaction_id: payload.id, customer_id: cust.id, method, category: scheme === 'full' ? 'Pelunasan' : 'DP', recorded_by: recorder || null }]);
        if (scheme === 'dp') await insertSchedule(payload.id, 'once', [{ seq: 1, due: val('due'), amount: total - dp }], dp, null);
        if (scheme === 'installment') await insertSchedule(payload.id, val('freq') === 'weekly' ? 'weekly' : 'monthly', buildSchedule(total - dp, val('count'), val('freq'), val('start')), dp, null);
      }
      window.kairoTxGuard.done();
      closeSheet();
      toast(already ? `Pre-order ${customer} sudah tersimpan sebelumnya, tidak dicatat dobel.` : `Pre-order ${customer} tersimpan.`, 'success');
      await afterSave();
    } catch (e) {
      console.error('[KAIRO][Jastip] simpan', e);
      toast('Gagal menyimpan pre-order: ' + (e.message || e), true);
    } finally { savingOrder = false; busy(btn, false, 'Simpan Pre-Order'); }
  }

  /* ---------- Detail order ---------- */
  const badge = ([t, k]) => `<span class="po-badge is-${k}">${esc(t)}</span>`;
  function openDetail(id) {
    const tx = allTx.find(t => String(t.id) === String(id));
    if (!tx) return;
    const f = fin(tx), p = planRows(tx, f);
    const its = (Array.isArray(tx.order_items) ? tx.order_items : []).map(x => `<div class="po-row"><span>${esc(x.name)} × ${num(x.qty)}</span><b>${money(x.subtotal)}</b></div>`).join('');
    const fees = (Array.isArray(tx.order_addons) ? tx.order_addons : []).map(x => `<div class="po-row"><span>${esc(x.name)}</span><b>${money(x.subtotal)}</b></div>`).join('');
    const pays = f.es.filter(e => e.kind === 'customer_payment' || e.kind === 'refund');
    const costs = f.es.filter(e => e.kind === 'partner_advance' || e.kind === 'order_cost');
    const entryRow = e => `<div class="po-entry"><div><b>${e.kind === 'refund' ? '−' : ''}${money(e.amount)}</b><span>${esc(fmtDate(e.entry_date))} · ${esc(e.kind === 'partner_advance' ? 'Ditalangi ' + (e.partner_name || '-') : e.kind === 'order_cost' ? 'Uang usaha' : kindLabel(e.kind))}${e.category ? ' · ' + esc(e.category) : ''}${e.method ? ' · ' + esc(e.method) : ''}${e.currency && e.currency !== 'IDR' && e.amount_foreign ? ` · ${esc(e.currency)} ${num(e.amount_foreign).toLocaleString('id-ID')} × ${num(e.fx_rate).toLocaleString('id-ID')}` : ''}${e.recorded_by ? ' · dicatat ' + esc(e.recorded_by) : ''}</span>${e.note ? `<em>${esc(e.note)}</em>` : ''}</div><button type="button" class="po-link" data-po-void="${esc(e.id)}">Batalkan</button></div>`;
    const sched = p ? `<table class="po-table"><thead><tr><th>Ke</th><th>Jatuh tempo</th><th>Nominal</th><th>Kurang</th><th>Status</th></tr></thead><tbody>${p.rows.map(r => `<tr><td data-label="Ke">${r.seq}</td><td data-label="Jatuh tempo">${esc(fmtDate(r.due))}</td><td data-label="Nominal">${money(r.amount)}</td><td data-label="Kurang">${r.left > 0.5 ? money(r.left) : '-'}</td><td data-label="Status">${badge(ROW_STATE[r.key])}</td></tr>`).join('')}</tbody></table>${p.versions > 1 ? `<div class="po-muted">Jadwal sudah diubah ${p.versions - 1}× (versi ${p.version}).</div>` : ''}` : '<div class="po-muted">Tanpa jadwal cicilan.</div>';
    const statusSel = `<select class="input" id="po-status-sel">${opt(PO_STATUS, tx.po_status || 'waiting')}</select>`;
    const body = `<div class="po-detail">
      <div class="po-detail-head"><div><b>${esc(tx.customer_name || '-')}</b><span>${esc(fmtDate(tx.transaction_date))} · ${esc(tx.platform || '-')}${tx.topic_name ? ' · ' + esc(tx.topic_name) : ''}</span></div>${badge(payState(f))}</div>
      <div class="po-stats"><div><span>Total tagihan</span><b>${money(f.total)}</b></div><div><span>Sudah dibayar</span><b>${money(f.paid)}</b></div><div><span>Sisa tagihan</span><b>${money(f.remaining)}</b></div></div>
      <section><h4>Status barang</h4><div class="po-grid2">${statusSel}<input class="input" type="date" id="po-eta-in" value="${esc(tx.po_eta || '')}" aria-label="Perkiraan tiba"></div><button type="button" class="btn btn-light po-small" id="po-status-save">Simpan status</button></section>
      <section><h4>Barang</h4>${its}${fees ? `<div class="po-sub">Biaya ke customer</div>${fees}` : ''}${tx.notes ? `<div class="po-muted">Catatan: ${esc(tx.notes)}</div>` : ''}</section>
      <section><div class="po-sec-head"><h4>Pembayaran customer</h4><button type="button" class="btn btn-green po-small" id="po-pay-open">＋ Catat Pembayaran</button></div>${pays.length ? pays.map(entryRow).join('') : '<div class="po-muted">Belum ada pembayaran.</div>'}${f.over > 0.5 ? `<div class="po-warn">Kelebihan bayar ${money(f.over)}. Catat refund bila uangnya dikembalikan.</div>` : ''}</section>
      <section><div class="po-sec-head"><h4>Jadwal cicilan</h4>${f.remaining > 0.5 && !f.cancelled ? `<button type="button" class="btn btn-light po-small" id="po-resched">${p ? 'Ubah jadwal' : 'Buat jadwal'}</button>` : ''}</div>${sched}</section>
      <section><div class="po-sec-head"><h4>Talangan & biaya</h4><button type="button" class="btn btn-light po-small" id="po-cost-open">＋ Catat Biaya</button></div>${costs.length ? costs.map(entryRow).join('') : '<div class="po-muted">Belum ada biaya tercatat.</div>'}
        <div class="po-row po-strong"><span>Total biaya</span><b>${money(f.costs)}</b></div>
        <div class="po-row po-strong"><span>${f.done ? 'Laba order' : 'Perkiraan laba (belum selesai)'}</span><b class="${f.profit < 0 ? 'po-neg' : ''}">${money(f.profit)}</b></div>
        <div class="po-muted">${f.done ? 'Order selesai: laba ini masuk hak bagi hasil partner di Withdraw.' : 'Laba masuk bagi hasil setelah barang Diserahkan dan tagihan Lunas.'}</div></section>
      <section class="po-actions">${!f.cancelled ? `<button type="button" class="btn btn-light" id="po-refund-open">Catat Refund</button><button type="button" class="btn btn-light po-danger" id="po-cancel">Batalkan Pre-Order</button>` : '<div class="po-muted">Pre-order ini dibatalkan.</div>'}</section>
    </div>`;
    const o = sheet('Detail Pre-Order', body);
    o.querySelector('#po-status-save').onclick = e => saveStatus(tx, o.querySelector('#po-status-sel').value, o.querySelector('#po-eta-in').value, e.currentTarget);
    o.querySelector('#po-pay-open').onclick = () => openPayment(tx, 'customer_payment');
    o.querySelector('#po-refund-open')?.addEventListener('click', () => openPayment(tx, 'refund'));
    o.querySelector('#po-cost-open').onclick = () => openCost(tx);
    o.querySelector('#po-resched')?.addEventListener('click', () => openReschedule(tx));
    o.querySelector('#po-cancel')?.addEventListener('click', e => saveStatus(tx, 'cancelled', tx.po_eta, e.currentTarget, true));
    o.querySelectorAll('[data-po-void]').forEach(b => b.addEventListener('click', () => voidEntry(b.dataset.poVoid, tx.id)));
  }
  async function saveStatus(tx, status, eta, btn, confirmCancel) {
    if (confirmCancel && !confirm(`Batalkan pre-order ${tx.customer_name}?\n\nPembayaran & biaya yang sudah dicatat tetap ada. Catat refund bila uang customer dikembalikan.`)) return;
    busy(btn, true, null, 'Menyimpan…');
    try {
      const patch = { po_status: status, po_eta: eta || null, reading_status: status === 'delivered' || status === 'cancelled' ? 'done' : 'on_progress' };
      const { error } = await db.from('transactions').update(patch).eq('workspace_id', ws()).eq('id', tx.id);
      if (error) throw error;
      Object.assign(tx, patch);
      toast(status === 'cancelled' ? 'Pre-order dibatalkan.' : `Status barang: ${poLabel(status)}.`, 'success');
      await afterSave(); openDetail(tx.id);
    } catch (e) { toast('Gagal menyimpan status: ' + (e.message || e), true); busy(btn, false, 'Simpan status'); }
  }
  async function voidEntry(id, txId) {
    const e = ledger.find(x => String(x.id) === String(id));
    if (!e) return;
    const reason = prompt(`Batalkan catatan ${kindLabel(e.kind)} ${money(e.amount)}?\n\nCatatan lama tetap terlihat di riwayat. Tulis alasannya:`);
    if (reason === null) return;
    if (!reason.trim()) { toast('Alasan wajib diisi.', 'warning'); return; }
    try {
      await insertLedger([{ id: uuid(), entry_date: today(), kind: 'reversal', amount: num(e.amount), reverses_id: e.id, transaction_id: e.transaction_id || null, partner_name: e.partner_name || null, note: reason.trim(), recorded_by: lastRecorder() || null }]);
      toast('Catatan dibatalkan.', 'success');
      await afterSave();
      if (txId) openDetail(txId); else if (currentAppPage() === 'po-finance') renderFinance();
    } catch (err) { toast('Gagal membatalkan: ' + (err.message || err), true); }
  }

  function openPayment(tx, kind, presetAmount) {
    const f = fin(tx), refund = kind === 'refund';
    const suggested = presetAmount || (refund ? f.over : (nextRow(planRows(tx, f))?.left || f.remaining));
    const body = `<form class="po-form" id="po-pay-form">
      <div class="po-note">${esc(tx.customer_name)} · sisa tagihan <b>${money(f.remaining)}</b>${refund ? ` · sudah dibayar ${money(f.paid)}` : ''}</div>
      <div class="po-grid2"><label class="po-f"><span>Nominal</span><input class="input" name="amount" data-money value="${Math.round(suggested) || ''}"></label><label class="po-f"><span>Tanggal</span><input class="input" type="date" name="date" value="${today()}"></label></div>
      <label class="po-f"><span>Metode</span><select class="input" name="method"><option value="">Pilih metode</option>${opt(payMethods(), '')}</select></label>
      <label class="po-f"><span>Catatan (opsional)</span><input class="input" name="note"></label>${recorderField()}</form>`;
    const o = sheet(refund ? 'Catat Refund' : 'Catat Pembayaran', body, `<button type="button" class="btn btn-light" data-po-close>Batal</button><button type="button" class="btn btn-green" id="po-pay-save">Simpan</button>`);
    o.querySelector('#po-pay-save').onclick = async e => {
      const form = o.querySelector('#po-pay-form'), amount = moneyVal(form.amount), method = form.method.value, rec = form.recorded_by?.value || '';
      if (amount <= 0) return toast('Nominal harus lebih dari Rp0.', 'warning');
      if (!method) return toast('Pilih metode.', 'warning');
      if (form.recorded_by && !rec) return toast('Pilih siapa yang mencatat.', 'warning');
      if (refund && amount > f.paid + 0.5) return toast(`Refund maksimal ${money(f.paid)} (uang yang sudah dibayar).`, 'warning');
      if (!refund && amount > f.remaining + 0.5 && !confirm(`Nominal ${money(amount)} lebih besar dari sisa tagihan ${money(f.remaining)}. Tetap simpan? Kelebihannya tercatat sebagai lebih bayar.`)) return;
      if (rec) rememberRecorder(rec);
      const btn = e.currentTarget; busy(btn, true, null, 'Menyimpan…');
      try {
        await insertLedger([{ id: uuid(), entry_date: form.date.value || today(), kind, amount, transaction_id: tx.id, customer_id: tx.customer_id || null, method, note: form.note.value.trim() || null, recorded_by: rec || null }]);
        toast(refund ? 'Refund tercatat.' : 'Pembayaran tercatat.', 'success');
        await afterSave(); openDetail(tx.id);
      } catch (err) { toast('Gagal menyimpan: ' + (err.message || err), true); busy(btn, false, 'Simpan'); }
    };
  }

  function openCost(tx) {
    const ps = partnerList();
    const body = `<form class="po-form" id="po-cost-form">
      <label class="po-f"><span>Dibayar oleh</span><select class="input" name="payer">${ps.map(p => `<option value="p:${esc(p.id)}">${esc(p.partner_name)} (talangan pribadi)</option>`).join('')}<option value="biz">Uang usaha (bukan talangan)</option></select></label>
      <div class="po-grid2"><label class="po-f"><span>Jenis biaya</span><select class="input" name="type">${opt(COST_TYPES.map(x => [x, x]), COST_TYPES[0])}</select></label><label class="po-f"><span>Tanggal</span><input class="input" type="date" name="date" value="${today()}"></label></div>
      <div class="po-grid3"><label class="po-f"><span>Mata uang</span><select class="input" name="cur">${opt(CURRENCIES.map(x => [x, x]), 'IDR')}</select></label><label class="po-f po-fx"><span>Nominal asli</span><input class="input" name="foreign" type="number" min="0" step="0.01"></label><label class="po-f po-fx"><span>Kurs ke Rupiah</span><input class="input" name="rate" type="number" min="0" step="0.0001"></label></div>
      <label class="po-f"><span>Nominal Rupiah</span><input class="input" name="amount" data-money></label>
      <label class="po-f"><span>Catatan (opsional)</span><input class="input" name="note" placeholder="mis. invoice toko, resi"></label>${recorderField()}</form>`;
    const o = sheet('Catat Biaya / Talangan', body, `<button type="button" class="btn btn-light" data-po-close>Batal</button><button type="button" class="btn btn-green" id="po-cost-save">Simpan</button>`);
    const form = o.querySelector('#po-cost-form');
    const sync = () => {
      const foreign = form.cur.value !== 'IDR';
      o.querySelectorAll('.po-fx').forEach(x => { x.hidden = !foreign; });
      if (foreign && num(form.foreign.value) > 0 && num(form.rate.value) > 0) form.amount.value = Math.round(num(form.foreign.value) * num(form.rate.value));
    };
    form.addEventListener('input', e => { if (e.target.name !== 'amount') sync(); });
    form.addEventListener('change', sync); sync();
    o.querySelector('#po-cost-save').onclick = async e => {
      const amount = moneyVal(form.amount), payer = form.payer.value, rec = form.recorded_by?.value || '';
      if (amount <= 0) return toast('Nominal Rupiah harus lebih dari Rp0.', 'warning');
      if (form.cur.value !== 'IDR' && (num(form.foreign.value) <= 0 || num(form.rate.value) <= 0)) return toast('Isi nominal asli dan kurs.', 'warning');
      if (form.recorded_by && !rec) return toast('Pilih siapa yang mencatat.', 'warning');
      if (rec) rememberRecorder(rec);
      const partner = payer.startsWith('p:') ? ps.find(p => String(p.id) === payer.slice(2)) : null;
      const btn = e.currentTarget; busy(btn, true, null, 'Menyimpan…');
      try {
        await insertLedger([{ id: uuid(), entry_date: form.date.value || today(), kind: partner ? 'partner_advance' : 'order_cost', amount, transaction_id: tx.id, partner_id: partner?.id || null, partner_name: partner?.partner_name || null, category: form.type.value, currency: form.cur.value, amount_foreign: form.cur.value !== 'IDR' ? num(form.foreign.value) : null, fx_rate: form.cur.value !== 'IDR' ? num(form.rate.value) : null, note: form.note.value.trim() || null, recorded_by: rec || null }]);
        toast(partner ? `Talangan ${partner.partner_name} tercatat.` : 'Biaya order tercatat.', 'success');
        await afterSave(); openDetail(tx.id);
      } catch (err) { toast('Gagal menyimpan: ' + (err.message || err), true); busy(btn, false, 'Simpan'); }
    };
  }

  function openReschedule(tx) {
    const f = fin(tx), cur = scheduleFor(tx.id);
    const body = `<form class="po-form" id="po-rs-form"><div class="po-note">Sisa tagihan <b>${money(f.remaining)}</b> akan dibagi ke jadwal baru. Pembayaran yang sudah masuk tidak berubah; jadwal lama tetap tersimpan sebagai riwayat.</div>
      <div class="po-grid3"><label class="po-f"><span>Jumlah cicilan</span><input class="input" type="number" name="count" min="1" max="52" value="${Math.max(1, (cur?.items?.list || []).length - 1) || 1}"></label><label class="po-f"><span>Frekuensi</span><select class="input" name="freq"><option value="monthly">Bulanan</option><option value="weekly">Mingguan</option><option value="once">Sekali bayar</option></select></label><label class="po-f"><span>Mulai</span><input class="input" type="date" name="start" value="${iso(new Date(Date.now() + 7 * 864e5))}"></label></div>
      <label class="po-f"><span>Alasan perubahan</span><input class="input" name="reason" required placeholder="mis. customer minta mundur 2 minggu"></label><div class="po-plan-preview" id="po-rs-prev"></div></form>`;
    const o = sheet(cur ? 'Ubah Jadwal Cicilan' : 'Buat Jadwal Cicilan', body, `<button type="button" class="btn btn-light" data-po-close>Batal</button><button type="button" class="btn btn-green" id="po-rs-save">Simpan Jadwal</button>`);
    const form = o.querySelector('#po-rs-form');
    const list = () => buildSchedule(f.remaining, form.freq.value === 'once' ? 1 : form.count.value, form.freq.value, form.start.value);
    const prev = () => { o.querySelector('#po-rs-prev').innerHTML = list().map(r => `<span>${r.seq}. ${fmtDate(r.due)} · ${money(r.amount)}</span>`).join(''); };
    form.addEventListener('input', prev); form.addEventListener('change', prev); prev();
    o.querySelector('#po-rs-save').onclick = async e => {
      if (cur && !form.reason.value.trim()) return toast('Isi alasan perubahan jadwal.', 'warning');
      const btn = e.currentTarget; busy(btn, true, null, 'Menyimpan…');
      try {
        await insertSchedule(tx.id, form.freq.value, list(), f.paid, form.reason.value.trim() || null);
        if (tx.po_scheme === 'full') { await db.from('transactions').update({ po_scheme: 'installment' }).eq('workspace_id', ws()).eq('id', tx.id); tx.po_scheme = 'installment'; }
        toast('Jadwal cicilan tersimpan.', 'success');
        await afterSave(); openDetail(tx.id);
      } catch (err) { toast('Gagal menyimpan jadwal: ' + (err.message || err), true); busy(btn, false, 'Simpan Jadwal'); }
    };
  }

  /* ---------- Halaman Pre-Order (menggantikan form Orders) ---------- */
  let orderFilter = 'active', orderQuery = '', orderCat = '';
  function ensureOrdersPage() {
    const sec = document.getElementById('input');
    if (!sec || document.getElementById('po-orders')) return;
    const box = document.createElement('div');
    box.id = 'po-orders'; box.className = 'card po-card';
    box.innerHTML = `<div class="po-top"><div><div class="card-title">Pre-Order</div><div class="page-sub">Pesanan customer, pembayaran DP/cicilan, dan status barang.</div></div><button type="button" class="btn btn-green po-add" id="po-new-open">＋ Pre-Order Baru</button></div>
      <div class="po-tools"><div class="po-filter" role="group" aria-label="Filter pre-order">${[['active', 'Aktif'], ['unpaid', 'Belum lunas'], ['waiting', 'Menunggu barang'], ['done', 'Selesai'], ['cancelled', 'Dibatalkan'], ['all', 'Semua']].map(([k, l]) => `<button type="button" data-po-f="${k}">${l}</button>`).join('')}</div><select class="input po-sel" id="po-cat-filter" aria-label="Filter kategori"></select><input class="input po-search" type="search" id="po-search" placeholder="Cari customer atau barang" aria-label="Cari pre-order"></div>
      <div id="po-list" class="po-list"></div>`;
    sec.prepend(box);
    box.addEventListener('click', e => {
      const f = e.target.closest('[data-po-f]'); if (f) { orderFilter = f.dataset.poF; renderOrders(); return; }
      const d = e.target.closest('[data-po-open]'); if (d) openDetail(d.dataset.poOpen);
    });
    box.querySelector('#po-new-open').onclick = () => openNewOrder();
    box.querySelector('#po-search').addEventListener('input', e => { orderQuery = e.target.value.trim().toLowerCase(); renderOrders(); });
    box.querySelector('#po-cat-filter').addEventListener('change', e => { orderCat = e.target.value; renderOrders(); });
  }
  const poOrders = () => allTx.filter(t => t.po_scheme);
  const orderCats = t => { const list = (Array.isArray(t.order_topics) ? t.order_topics : []).map(x => x && x.name).filter(Boolean); return list.length ? list : String(t.topic_name || '').split(',').map(x => x.trim()).filter(Boolean); };
  function renderOrders() {
    ensureOrdersPage();
    const list = document.getElementById('po-list'); if (!list) return;
    document.querySelectorAll('[data-po-f]').forEach(b => b.classList.toggle('is-active', b.dataset.poF === orderFilter));
    // Dropdown kategori: kategori aktif + kategori yang masih dipakai order lama (walau sudah dinonaktifkan).
    const catSel = document.getElementById('po-cat-filter');
    const catNames = [...new Set([...(Array.isArray(topics) ? topics : []).filter(t => t.is_active !== false).map(t => t.name), ...poOrders().flatMap(orderCats)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
    if (orderCat && !catNames.includes(orderCat)) orderCat = '';
    const catHtml = `<option value="">Semua kategori</option>${catNames.map(n => `<option value="${esc(n)}"${n === orderCat ? ' selected' : ''}>${esc(n)}</option>`).join('')}`;
    if (catSel && catSel.innerHTML !== catHtml) catSel.innerHTML = catHtml;
    if (!ready) { list.innerHTML = '<div class="po-empty">Tabel pre-order belum siap di database. Hubungi admin KAIRO.</div>'; return; }
    const rows = poOrders().map(t => ({ t, f: fin(t) })).filter(({ t, f }) => {
      if (orderFilter === 'active') return !f.cancelled && !f.done;
      if (orderFilter === 'unpaid') return !f.cancelled && f.remaining > 0.5;
      if (orderFilter === 'waiting') return !f.cancelled && !['arrived', 'delivered'].includes(t.po_status);
      if (orderFilter === 'done') return f.done;
      if (orderFilter === 'cancelled') return f.cancelled;
      return true;
    }).filter(({ t }) => !orderCat || orderCats(t).includes(orderCat)).filter(({ t }) => !orderQuery || `${t.customer_name} ${itemsText(t)} ${t.topic_name || ''}`.toLowerCase().includes(orderQuery));
    list.innerHTML = rows.length ? rows.map(({ t, f }) => {
      const p = planRows(t, f), nx = nextRow(p), eta = t.po_eta && !['arrived', 'delivered', 'cancelled'].includes(t.po_status) ? (dayDiff(t.po_eta, today()) < 0 ? `<span class="po-badge is-bad">Lewat ETA ${esc(fmtDate(t.po_eta))}</span>` : `<span class="po-muted">ETA ${esc(fmtDate(t.po_eta))}</span>`) : '';
      return `<button type="button" class="po-item" data-po-open="${esc(t.id)}">
        <div class="po-item-main"><b>${esc(t.customer_name || '-')}</b><span>${esc(itemsText(t))}</span><span class="po-muted">${esc(fmtDate(t.transaction_date))}${t.topic_name ? ' · ' + esc(t.topic_name) : ''}</span></div>
        <div class="po-item-badges">${badge([poLabel(t.po_status), t.po_status === 'cancelled' ? 'muted' : t.po_status === 'delivered' ? 'ok' : t.po_status === 'arrived' ? 'warn' : 'info'])}${badge(payState(f))}${eta}</div>
        <div class="po-item-money"><span>Sisa</span><b>${money(f.remaining)}</b><span class="po-muted">dari ${money(f.total)}</span>${nx ? `<span class="po-muted">Berikutnya ${esc(fmtDate(nx.due))}</span>` : ''}</div></button>`;
    }).join('') : `<div class="po-empty">${poOrders().length ? 'Tidak ada pre-order di filter ini.' : 'Belum ada pre-order. Klik “Pre-Order Baru” untuk mulai.'}</div>`;
  }

  /* ---------- Menu Cicilan (Cicilan Customer | Reminder) ---------- */
  let planTab = 'list', planFilter = 'open';
  function planEntries() {
    return poOrders().filter(t => t.po_scheme === 'dp' || t.po_scheme === 'installment' || scheduleFor(t.id)).map(t => { const f = fin(t), p = planRows(t, f); return { t, f, p, st: planState(p, f), nx: nextRow(p) }; });
  }
  function reminderRows() {
    const out = [];
    planEntries().forEach(({ t, f, p }) => { if (f.cancelled || !p) return; p.rows.filter(r => ['late', 'late-partial', 'today', 'soon'].includes(r.key)).forEach(r => out.push({ t, f, r })); });
    return out.sort((a, b) => a.r.days - b.r.days);
  }
  function waLink(t, r, f) {
    const c = (Array.isArray(customerDirectory) ? customerDirectory : []).find(x => String(x.id) === String(t.customer_id));
    const n = String(t.whatsapp || c?.whatsapp || '').replace(/\D/g, '').replace(/^0/, '62');
    if (!n) return '';
    const wsName = (typeof activeWorkspaceName !== 'undefined' && activeWorkspaceName) || '';
    const text = `Halo ${t.customer_name}, ini pengingat dari ${wsName} untuk pre-order ${itemsText(t)}.\nCicilan ke-${r.seq}: ${money(r.left)} (jatuh tempo ${fmtDate(r.due)}).\nSisa tagihan: ${money(f.remaining)}.\nTerima kasih!`;
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
  }
  function renderPlans() {
    const sec = document.getElementById('po-plans'); if (!sec) return;
    sec.querySelectorAll('[data-plan-tab]').forEach(b => b.classList.toggle('on', b.dataset.planTab === planTab));
    const box = sec.querySelector('#po-plans-body');
    if (planTab === 'reminder') {
      const rows = reminderRows();
      const group = (title, keys) => { const g = rows.filter(x => keys.includes(x.r.key)); return g.length ? `<h4 class="po-group">${title} <span>${g.length}</span></h4>${g.map(({ t, f, r }) => { const wa = waLink(t, r, f); return `<div class="po-rem"><div><b>${esc(t.customer_name)}</b><span>${esc(itemsText(t))}</span><span class="po-muted">Cicilan ke-${r.seq} · ${esc(fmtDate(r.due))}${r.days < 0 ? ` · telat ${-r.days} hari` : r.days > 0 ? ` · ${r.days} hari lagi` : ''}</span></div><div class="po-rem-money"><b>${money(r.left)}</b>${badge(ROW_STATE[r.key])}</div><div class="po-rem-act"><button type="button" class="btn btn-green po-small" data-plan-pay="${esc(t.id)}" data-amount="${Math.round(r.left)}">Catat Bayar</button>${wa ? `<a class="btn btn-light po-small" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : '<span class="po-muted">Tanpa no. WA</span>'}</div></div>`; }).join('')}` : ''; };
      box.innerHTML = rows.length ? group('Terlambat', ['late', 'late-partial']) + group('Jatuh tempo hari ini', ['today']) + group(`Akan jatuh tempo (≤${DUE_SOON_DAYS} hari)`, ['soon']) : '<div class="po-empty">Tidak ada cicilan yang terlambat atau jatuh tempo dalam 3 hari. 🎉</div>';
      return;
    }
    const all = planEntries();
    const rows = all.filter(x => planFilter === 'all' ? true : planFilter === 'late' ? x.st[0] === 'Terlambat' : planFilter === 'soon' ? x.st[0] === 'Akan jatuh tempo' : planFilter === 'paid' ? x.st[0] === 'Lunas' : !x.f.cancelled && x.f.remaining > 0.5);
    const freq = x => x.p ? (x.p.frequency === 'weekly' ? `Mingguan · ${x.p.rows.length}×` : x.p.frequency === 'monthly' ? `Bulanan · ${x.p.rows.length}×` : 'Sekali bayar') : '-';
    const dpOf = x => num(x.p?.schedule?.items?.base_paid);
    box.innerHTML = `<div class="po-filter po-mb" role="group" aria-label="Filter cicilan">${[['open', 'Belum lunas'], ['late', 'Terlambat'], ['soon', 'Akan jatuh tempo'], ['paid', 'Lunas'], ['all', 'Semua']].map(([k, l]) => `<button type="button" data-plan-f="${k}" class="${planFilter === k ? 'is-active' : ''}">${l}</button>`).join('')}</div>
      ${rows.length ? `<div class="po-table-wrap"><table class="po-table po-plan-table"><thead><tr><th>Customer</th><th>Barang</th><th>Total</th><th>DP</th><th>Dibayar</th><th>Sisa</th><th>Frekuensi</th><th>Berikutnya</th><th>Status</th></tr></thead><tbody>${rows.map(x => `<tr data-po-open="${esc(x.t.id)}" tabindex="0"><td data-label="Customer"><b>${esc(x.t.customer_name)}</b></td><td data-label="Barang">${esc(itemsText(x.t))}</td><td data-label="Total">${money(x.f.total)}</td><td data-label="DP">${dpOf(x) ? money(dpOf(x)) : '-'}</td><td data-label="Dibayar">${money(x.f.paid)}</td><td data-label="Sisa"><b>${money(x.f.remaining)}</b></td><td data-label="Frekuensi">${esc(freq(x))}</td><td data-label="Berikutnya">${x.nx ? `${esc(fmtDate(x.nx.due))} · ${money(x.nx.left)}` : '-'}</td><td data-label="Status">${badge(x.st)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="po-empty">${all.length ? 'Tidak ada cicilan di filter ini.' : 'Belum ada pre-order dengan DP atau cicilan.'}</div>`}`;
  }
  function ensurePlansPage() {
    const main = document.querySelector('main.container'); if (!main || document.getElementById('po-plans')) return;
    const s = document.createElement('section'); s.id = 'po-plans'; s.className = 'section';
    s.innerHTML = `<div class="card po-card"><div class="po-top"><div class="po-seg-tabs" role="tablist"><button type="button" data-plan-tab="list" class="on">Cicilan Customer</button><button type="button" data-plan-tab="reminder">Reminder</button></div></div><div id="po-plans-body"></div></div>`;
    main.appendChild(s);
    s.addEventListener('click', e => {
      const tb = e.target.closest('[data-plan-tab]'); if (tb) { planTab = tb.dataset.planTab; renderPlans(); return; }
      const f = e.target.closest('[data-plan-f]'); if (f) { planFilter = f.dataset.planF; renderPlans(); return; }
      const pay = e.target.closest('[data-plan-pay]'); if (pay) { const t = allTx.find(x => String(x.id) === pay.dataset.planPay); if (t) openPayment(t, 'customer_payment', num(pay.dataset.amount)); return; }
      const o = e.target.closest('[data-po-open]'); if (o) openDetail(o.dataset.poOpen);
    });
    s.addEventListener('keydown', e => { if (e.key === 'Enter') { const o = e.target.closest('[data-po-open]'); if (o) openDetail(o.dataset.poOpen); } });
  }

  /* ---------- Menu Keuangan (Pembukuan | Modal Talangan) ---------- */
  let finTab = 'book', finPeriod = 'month', finKind = 'all';
  function periodRange(p) {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth();
    if (p === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
    if (p === 'last') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    if (p === '30') return [iso(new Date(Date.now() - 29 * 864e5)), today()];
    if (p === 'year') return [`${y}-01-01`, `${y}-12-31`];
    return ['', ''];
  }
  function bookRows() {
    const [from, to] = periodRange(finPeriod), inRange = dte => (!from || dte >= from) && (!to || dte <= to);
    const rev = reversedIds();
    const txName = id => { const t = allTx.find(x => String(x.id) === String(id)); return t ? `${t.customer_name} · ${itemsText(t)}` : ''; };
    const rows = ledger.filter(e => inRange(e.entry_date)).map(e => ({ src: 'ledger', e, date: e.entry_date, kind: e.kind, amount: num(e.amount), dir: (KIND[e.kind] || [])[1], voided: rev.has(String(e.id)), desc: [e.category, e.note, e.kind === 'reversal' ? 'membatalkan ' + kindLabel((ledger.find(x => String(x.id) === String(e.reverses_id)) || {}).kind) : ''].filter(Boolean).join(' · '), who: e.partner_name || '', order: txName(e.transaction_id) }));
    payoutRows.filter(p => inRange(String(p.payout_date || ''))).forEach(p => rows.push({ src: 'payout', date: p.payout_date, kind: 'payout', amount: num(p.amount), dir: 'out', desc: p.notes || '', who: p.partner_name || '', order: '' }));
    return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  function laborProfit(from, to) {
    // Laba usaha periode = laba order Selesai (tanggal order di periode) + pemasukan lain − pengeluaran operasional.
    const inRange = d => (!from || d >= from) && (!to || d <= to);
    const orders = poOrders().filter(t => inRange(t.transaction_date)).map(fin).filter(f => f.done).reduce((s, f) => s + f.profit, 0);
    const live = liveEntries().filter(e => inRange(e.entry_date));
    const other = live.filter(e => e.kind === 'other_income').reduce((s, e) => s + num(e.amount), 0), opex = live.filter(e => e.kind === 'operating_expense').reduce((s, e) => s + num(e.amount), 0);
    return { orders, other, opex, total: orders + other - opex };
  }
  function renderFinance() {
    const sec = document.getElementById('po-finance'); if (!sec) return;
    sec.querySelectorAll('[data-fin-tab]').forEach(b => b.classList.toggle('on', b.dataset.finTab === finTab));
    const box = sec.querySelector('#po-fin-body');
    if (finTab === 'adv') {
      const bal = advanceBalances(), cash = businessCash(), totalLeft = bal.reduce((s, x) => s + Math.max(0, x.left), 0);
      const open = poOrders().filter(t => !fin(t).cancelled).map(t => ({ t, f: fin(t) })).filter(x => Object.keys(x.f.byPartner).length);
      box.innerHTML = `<div class="po-note">Talangan = uang pribadi partner untuk biaya pre-order. Pengembalian talangan BUKAN biaya dan BUKAN laba; laba dibagi lewat Withdraw.</div>
        <div class="po-partners">${bal.map(x => `<div class="po-partner"><b>${esc(x.name)}</b><div class="po-row"><span>Menalangi</span><b>${money(x.adv)}</b></div><div class="po-row"><span>Sudah dikembalikan</span><b>${money(x.back)}</b></div><div class="po-row po-strong"><span>Belum kembali</span><b>${money(x.left)}</b></div>${x.left > 0.5 ? `<button type="button" class="btn btn-green po-small" data-repay="${esc(x.name)}">Kembalikan</button>` : ''}</div>`).join('') || '<div class="po-empty">Belum ada partner. Atur di Settings › Pembagian Omzet.</div>'}</div>
        <div class="po-row po-strong po-cashline"><span>Saldo kas usaha (uang masuk − uang keluar)</span><b class="${cash < 0 ? 'po-neg' : ''}">${money(cash)}</b></div>
        ${totalLeft > 0.5 ? `<div class="po-muted">Total talangan belum kembali ${money(totalLeft)}.</div>` : ''}
        <h4 class="po-group">Talangan per pre-order</h4>${open.length ? `<div class="po-table-wrap"><table class="po-table"><thead><tr><th>Pre-order</th><th>Ditalangi</th><th>Sudah dibayar customer</th><th>Status</th></tr></thead><tbody>${open.map(({ t, f }) => `<tr data-po-open="${esc(t.id)}" tabindex="0"><td data-label="Pre-order"><b>${esc(t.customer_name)}</b><br><span class="po-muted">${esc(itemsText(t))}</span></td><td data-label="Ditalangi">${Object.entries(f.byPartner).map(([k, v]) => `${esc(k)} ${money(v)}`).join('<br>')}</td><td data-label="Dibayar customer">${money(f.paid)} / ${money(f.total)}</td><td data-label="Status">${badge(payState(f))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="po-empty">Belum ada talangan tercatat.</div>'}`;
      return;
    }
    const [from, to] = periodRange(finPeriod);
    let rows = bookRows();
    if (finKind === 'in') rows = rows.filter(r => r.dir === 'in'); else if (finKind === 'out') rows = rows.filter(r => r.dir === 'out'); else if (finKind !== 'all') rows = rows.filter(r => r.kind === finKind);
    const act = bookRows().filter(r => !r.voided && r.kind !== 'reversal');
    const inSum = act.filter(r => r.dir === 'in').reduce((s, r) => s + r.amount, 0), outSum = act.filter(r => r.dir === 'out').reduce((s, r) => s + r.amount, 0), advSum = act.filter(r => r.dir === 'adv').reduce((s, r) => s + r.amount, 0);
    const lp = laborProfit(from, to);
    const kindName = r => r.kind === 'payout' ? 'Bagi hasil (Withdraw)' : kindLabel(r.kind);
    const signed = r => r.dir === 'in' ? `<b class="po-pos">+${money(r.amount)}</b>` : r.dir === 'out' ? `<b class="po-neg">−${money(r.amount)}</b>` : r.dir === 'adv' ? `<b>${money(r.amount)}</b><span class="po-muted">ditalangi</span>` : `<b>${money(r.amount)}</b>`;
    box.innerHTML = `<div class="po-tools"><select class="input po-sel" id="po-fin-period" aria-label="Periode">${opt([['month', 'Bulan ini'], ['last', 'Bulan lalu'], ['30', '30 hari terakhir'], ['year', 'Tahun ini'], ['all', 'Semua']], finPeriod)}</select><select class="input po-sel" id="po-fin-kind" aria-label="Jenis">${opt([['all', 'Semua jenis'], ['in', 'Uang masuk'], ['out', 'Uang keluar'], ...Object.keys(KIND).filter(k => k !== 'reversal').map(k => [k, kindLabel(k)])], finKind)}</select><span class="po-grow"></span><button type="button" class="btn btn-light po-small" data-book-add="other_income">＋ Pemasukan</button><button type="button" class="btn btn-light po-small" data-book-add="operating_expense">＋ Pengeluaran</button><button type="button" class="btn btn-light po-small" data-book-export>Export Excel</button></div>
      <div class="po-stats po-stats4"><div><span>Uang masuk</span><b>${money(inSum)}</b></div><div><span>Uang keluar</span><b>${money(outSum)}</b></div><div><span>Biaya ditalangi partner</span><b>${money(advSum)}</b></div><div><span>Laba usaha</span><b class="${lp.total < 0 ? 'po-neg' : ''}">${money(lp.total)}</b></div></div>
      <div class="po-muted po-mb">Laba usaha = laba pre-order selesai ${money(lp.orders)} + pemasukan lain ${money(lp.other)} − pengeluaran operasional ${money(lp.opex)}. Pemasukan lain dan pengeluaran operasional ikut menambah/memotong hak bagi hasil partner di Withdraw sesuai % partner. Uang masuk/keluar = kas usaha (talangan pribadi tidak termasuk).</div>
      ${rows.length ? `<div class="po-table-wrap"><table class="po-table po-book"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th>Partner</th><th>Nominal</th><th></th></tr></thead><tbody>${rows.map(r => `<tr class="${r.voided ? 'is-void' : ''}"><td data-label="Tanggal">${esc(fmtDate(r.date))}</td><td data-label="Jenis">${esc(kindName(r))}${r.voided ? ' <span class="po-badge is-muted">dibatalkan</span>' : ''}</td><td data-label="Keterangan">${esc(r.order || '')}${r.order && r.desc ? '<br>' : ''}<span class="po-muted">${esc(r.desc || (r.order ? '' : '-'))}</span></td><td data-label="Partner">${esc(r.who || '-')}</td><td data-label="Nominal" class="po-amt">${signed(r)}</td><td data-label="">${r.src === 'ledger' && !r.voided && r.kind !== 'reversal' ? `<button type="button" class="po-link" data-po-void="${esc(r.e.id)}">Batalkan</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="po-empty">Belum ada catatan di periode ini.</div>'}`;
  }
  function openBookEntry(kind) {
    const income = kind === 'other_income';
    const body = `<form class="po-form" id="po-book-form"><div class="po-grid2"><label class="po-f"><span>Tanggal</span><input class="input" type="date" name="date" value="${today()}"></label><label class="po-f"><span>Nominal</span><input class="input" name="amount" data-money></label></div>
      <label class="po-f"><span>Kategori</span><input class="input" name="cat" list="po-book-cats" placeholder="${income ? 'mis. Fee lain' : 'mis. Packing, Iklan, Admin bank'}"><datalist id="po-book-cats">${(income ? ['Fee lain', 'Bunga bank', 'Lainnya'] : ['Packing', 'Iklan', 'Admin bank', 'Transportasi', 'Lainnya']).map(x => `<option value="${x}">`).join('')}</datalist></label>
      <label class="po-f"><span>Keterangan</span><input class="input" name="note" required></label>${recorderField()}</form>`;
    const o = sheet(income ? 'Catat Pemasukan Lain' : 'Catat Pengeluaran Operasional', body, `<button type="button" class="btn btn-light" data-po-close>Batal</button><button type="button" class="btn btn-green" id="po-book-save">Simpan</button>`);
    o.querySelector('#po-book-save').onclick = async e => {
      const f = o.querySelector('#po-book-form'), amount = moneyVal(f.amount), rec = f.recorded_by?.value || '';
      if (amount <= 0) return toast('Nominal harus lebih dari Rp0.', 'warning');
      if (!f.note.value.trim()) return toast('Isi keterangan.', 'warning');
      if (f.recorded_by && !rec) return toast('Pilih siapa yang mencatat.', 'warning');
      if (rec) rememberRecorder(rec);
      const btn = e.currentTarget; busy(btn, true, null, 'Menyimpan…');
      try {
        await insertLedger([{ id: uuid(), entry_date: f.date.value || today(), kind, amount, category: f.cat.value.trim() || null, note: f.note.value.trim(), recorded_by: rec || null }]);
        closeSheet(); toast('Tercatat di Pembukuan.', 'success'); await afterSave();
      } catch (err) { toast('Gagal menyimpan: ' + (err.message || err), true); busy(btn, false, 'Simpan'); }
    };
  }
  function openRepay(name) {
    const bal = advanceBalances(), x = bal.find(b => b.name === name); if (!x) return;
    const totalLeft = bal.reduce((s, b) => s + Math.max(0, b.left), 0), cash = Math.max(0, businessCash());
    const suggest = Math.round(Math.min(x.left, totalLeft > 0 ? cash * x.left / totalLeft : 0));
    const body = `<form class="po-form" id="po-repay-form"><div class="po-note">Talangan <b>${esc(name)}</b> yang belum kembali: <b>${money(x.left)}</b>.<br>Saldo kas usaha sekarang ${money(cash)}. Saran (dibagi sebanding sisa talangan tiap partner): <b>${money(suggest)}</b>.</div>
      <div class="po-grid2"><label class="po-f"><span>Nominal dikembalikan</span><input class="input" name="amount" data-money value="${suggest || ''}"></label><label class="po-f"><span>Tanggal</span><input class="input" type="date" name="date" value="${today()}"></label></div>
      <label class="po-f"><span>Metode</span><select class="input" name="method">${opt(payMethods(), 'TRANSFER')}</select></label><label class="po-f"><span>Catatan (opsional)</span><input class="input" name="note"></label>${recorderField()}</form>`;
    const o = sheet('Kembalikan Talangan', body, `<button type="button" class="btn btn-light" data-po-close>Batal</button><button type="button" class="btn btn-green" id="po-repay-save">Simpan</button>`);
    o.querySelector('#po-repay-save').onclick = async e => {
      const f = o.querySelector('#po-repay-form'), amount = moneyVal(f.amount), rec = f.recorded_by?.value || '';
      if (amount <= 0) return toast('Nominal harus lebih dari Rp0.', 'warning');
      if (amount > x.left + 0.5) return toast(`Maksimal ${money(x.left)} (talangan yang belum kembali).`, 'warning');
      if (f.recorded_by && !rec) return toast('Pilih siapa yang mencatat.', 'warning');
      if (amount > cash + 0.5 && !confirm(`Saldo kas usaha hanya ${money(cash)}. Tetap catat pengembalian ${money(amount)}?`)) return;
      if (rec) rememberRecorder(rec);
      const btn = e.currentTarget; busy(btn, true, null, 'Menyimpan…');
      try {
        await insertLedger([{ id: uuid(), entry_date: f.date.value || today(), kind: 'advance_repayment', amount, partner_id: x.id || null, partner_name: name, method: f.method.value, note: f.note.value.trim() || null, recorded_by: rec || null }]);
        closeSheet(); toast(`Pengembalian talangan ${name} tercatat.`, 'success'); await afterSave();
      } catch (err) { toast('Gagal menyimpan: ' + (err.message || err), true); busy(btn, false, 'Simpan'); }
    };
  }
  function ensureFinancePage() {
    const main = document.querySelector('main.container'); if (!main || document.getElementById('po-finance')) return;
    const s = document.createElement('section'); s.id = 'po-finance'; s.className = 'section';
    s.innerHTML = `<div class="card po-card"><div class="po-top"><div class="po-seg-tabs" role="tablist"><button type="button" data-fin-tab="book" class="on">Pembukuan</button><button type="button" data-fin-tab="adv">Modal Talangan</button></div></div><div id="po-fin-body"></div></div>`;
    main.appendChild(s);
    s.addEventListener('click', e => {
      const tb = e.target.closest('[data-fin-tab]'); if (tb) { finTab = tb.dataset.finTab; renderFinance(); return; }
      const add = e.target.closest('[data-book-add]'); if (add) { openBookEntry(add.dataset.bookAdd); return; }
      const ex = e.target.closest('[data-book-export]'); if (ex) { exportBook(ex); return; }
      const rp = e.target.closest('[data-repay]'); if (rp) { openRepay(rp.dataset.repay); return; }
      const v = e.target.closest('[data-po-void]'); if (v) { voidEntry(v.dataset.poVoid, null); return; }
      const o = e.target.closest('[data-po-open]'); if (o) openDetail(o.dataset.poOpen);
    });
    s.addEventListener('change', e => { if (e.target.id === 'po-fin-period') { finPeriod = e.target.value; renderFinance(); } if (e.target.id === 'po-fin-kind') { finKind = e.target.value; renderFinance(); } });
    s.addEventListener('keydown', e => { if (e.key === 'Enter') { const o = e.target.closest('[data-po-open]'); if (o) openDetail(o.dataset.poOpen); } });
  }

  /* ---------- Export Excel Pembukuan (periode & jenis yang sedang dipilih) ---------- */
  async function exportBook(btn) {
    if (window.__kairoDemo) return toast('Export Excel tidak tersedia di mode demo.', 'info');
    if (typeof canUseFeature === 'function' && !canUseFeature('export_excel')) return toast('Export Excel tersedia di paket Pro.', 'warning');
    busy(btn, true, null, 'Menyiapkan…');
    try {
      if (typeof XLSX === 'undefined') await ensureXlsxLibrary();
      const [from, to] = periodRange(finPeriod), lp = laborProfit(from, to);
      let rows = bookRows();
      if (finKind === 'in') rows = rows.filter(r => r.dir === 'in'); else if (finKind === 'out') rows = rows.filter(r => r.dir === 'out'); else if (finKind !== 'all') rows = rows.filter(r => r.kind === finKind);
      const act = bookRows().filter(r => !r.voided && r.kind !== 'reversal'), sum = d => act.filter(r => r.dir === d).reduce((s, r) => s + r.amount, 0);
      const periodName = { month: 'Bulan ini', last: 'Bulan lalu', 30: '30 hari terakhir', year: 'Tahun ini', all: 'Semua' }[finPeriod] || finPeriod;
      const head = { font: { name: 'Arial', sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F305E' } }, alignment: { horizontal: 'center', vertical: 'center', wrap_text: true } };
      const cell = { font: { name: 'Arial', sz: 10 }, alignment: { vertical: 'center', wrap_text: true }, border: ['top', 'bottom', 'left', 'right'].reduce((o, k) => (o[k] = { style: 'thin', color: { rgb: 'D9D9D9' } }, o), {}) };
      const rp = Object.assign({}, cell, { numFmt: '"Rp"#,##0' });
      const makeSheet = (aoa, headRows, moneyCols, widths) => {
        const sh = XLSX.utils.aoa_to_sheet(aoa);
        aoa.forEach((r, ri) => r.forEach((v, ci) => { const a = XLSX.utils.encode_cell({ r: ri, c: ci }); if (!sh[a]) return; sh[a].s = headRows.includes(ri) ? head : (moneyCols.includes(ci) && typeof v === 'number' ? rp : cell); }));
        sh['!cols'] = widths.map(w => ({ wch: w })); return sh;
      };
      const wb = XLSX.utils.book_new();
      const kindName = r => r.kind === 'payout' ? 'Bagi hasil (Withdraw)' : kindLabel(r.kind);
      const book = [['Tanggal', 'Jenis', 'Pre-order', 'Keterangan', 'Partner', 'Masuk', 'Keluar', 'Ditalangi partner', 'Status']];
      rows.slice().reverse().forEach(r => book.push([r.date || '', kindName(r), r.order || '', r.desc || '', r.who || '', r.dir === 'in' ? r.amount : '', r.dir === 'out' ? r.amount : '', r.dir === 'adv' ? r.amount : '', r.voided ? 'Dibatalkan' : (r.kind === 'reversal' ? 'Pembatalan' : '')]));
      const bs = makeSheet(book, [0], [5, 6, 7], [12, 24, 30, 30, 14, 14, 14, 16, 12]); bs['!freeze'] = 'A2';
      XLSX.utils.book_append_sheet(wb, bs, 'Pembukuan');
      const sumRows = [['Ringkasan', ''], ['Periode', `${periodName}${from ? ` (${from} s/d ${to})` : ''}`], ['Uang masuk', sum('in')], ['Uang keluar', sum('out')], ['Biaya ditalangi partner', sum('adv')], [], ['Laba pre-order selesai', lp.orders], ['Pemasukan lain', lp.other], ['Pengeluaran operasional', lp.opex], ['Laba usaha', lp.total]];
      XLSX.utils.book_append_sheet(wb, makeSheet(sumRows, [0], [1], [28, 30]), 'Ringkasan');
      const adv = [['Partner', 'Menalangi', 'Sudah dikembalikan', 'Belum kembali']];
      advanceBalances().forEach(x => adv.push([x.name, x.adv, x.back, x.left]));
      adv.push([], ['Saldo kas usaha', businessCash()]);
      XLSX.utils.book_append_sheet(wb, makeSheet(adv, [0], [1, 2, 3], [20, 16, 18, 16]), 'Modal Talangan');
      const safe = String(activeWorkspaceName || 'KAIRO').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'KAIRO';
      XLSX.writeFile(wb, `${safe}_Pembukuan_${from || 'semua'}${to ? '_sd_' + to : ''}.xlsx`);
      toast('Excel Pembukuan berhasil dibuat.', 'success');
    } catch (err) { console.error(err); toast('Gagal membuat Excel: ' + (err.message || err), true); }
    finally { busy(btn, false, 'Export Excel'); }
  }

  /* ---------- Customer Database: kategori minat, pernah beli, sisa tagihan, catatan ---------- */
  let intFilter = '';
  const activeCats = () => (Array.isArray(topics) ? topics : []).filter(t => t.is_active !== false && t.name);
  const custOrders = (id, name) => { const n = String(name || '').trim().toLowerCase(); return poOrders().filter(t => (id && String(t.customer_id || '') === String(id)) || (!t.customer_id && String(t.customer_name || '').trim().toLowerCase() === n)); };
  function custInfo(id, name) {
    const meta = custMeta[String(id)] || { ids: [], notes: '' };
    const cats = activeCats(), interest = meta.ids.map(x => (cats.find(c => String(c.id) === x) || {}).name).filter(Boolean);
    const orders = custOrders(id, name), bought = [...new Set(orders.flatMap(orderCats))];
    const due = orders.filter(t => t.po_status !== 'cancelled').reduce((s, t) => s + fin(t).remaining, 0);
    return { meta, interest, bought, due };
  }
  function decorateCustomers() {
    if (!isJastip()) return;
    const body = document.getElementById('customer-db-body'), search = document.getElementById('customer-db-search'); if (!body || !search) return;
    const names = [...new Set([...activeCats().map(c => c.name), ...poOrders().flatMap(orderCats)])].sort((a, b) => a.localeCompare(b, 'id'));
    if (intFilter && !names.includes(intFilter)) intFilter = '';
    let sel = document.getElementById('po-int-filter');
    if (!sel) {
      sel = document.createElement('select'); sel.id = 'po-int-filter'; sel.className = 'input po-sel po-int-filter'; sel.setAttribute('aria-label', 'Filter kategori');
      search.parentElement.insertBefore(sel, search);
      sel.addEventListener('change', () => { intFilter = sel.value; window.renderCustomerDatabase(); });
      search.addEventListener('input', () => decorateCustomers());
    }
    sel.innerHTML = `<option value="">Semua kategori</option>${names.map(n => `<option value="${esc(n)}"${n === intFilter ? ' selected' : ''}>${esc(n)}</option>`).join('')}`;
    body.querySelector('.po-int-empty')?.remove();
    let shown = 0;
    body.querySelectorAll('tr').forEach(tr => {
      const btn = tr.querySelector('[data-customer-history-name]'); if (!btn) return;
      const info = custInfo(btn.dataset.customerHistoryId, btn.dataset.customerHistoryName);
      const hide = intFilter && !info.interest.includes(intFilter) && !info.bought.includes(intFilter);
      tr.hidden = Boolean(hide); if (hide) return;
      shown++; const rank = tr.querySelector('.customer-db-rank'); if (rank) rank.textContent = shown;
      tr.querySelector('.po-cust-tags')?.remove();
      const tags = [...info.interest.map(n => `<span class="po-tag">${esc(n)}</span>`), info.due > 0.5 ? `<span class="po-badge is-warn">Sisa ${money(info.due)}</span>` : ''].filter(Boolean);
      if (tags.length) btn.insertAdjacentHTML('afterend', `<div class="po-cust-tags">${tags.join('')}</div>`);
    });
    if (intFilter && !shown) body.insertAdjacentHTML('beforeend', `<tr class="po-int-empty"><td colspan="8" class="empty">Belum ada customer dengan minat atau pembelian kategori ${esc(intFilter)}.</td></tr>`);
  }
  function mountInterestPanel(id, name) {
    const content = document.querySelector('#customer-history-modal #customer-history-content'); if (!content || !isJastip()) return;
    content.querySelector('.po-int-panel')?.remove();
    const box = document.createElement('div'); box.className = 'po-int-panel';
    if (!id || !custMetaReady) { box.innerHTML = `<div class="po-muted">${!id ? 'Customer ini belum tersimpan di database, jadi kategori minat belum bisa diatur.' : 'Kategori minat belum bisa dimuat. Coba Refresh.'}</div>`; content.prepend(box); return; }
    const info = custInfo(id, name), cats = activeCats();
    box.innerHTML = `<div class="po-int-head"><b>Kategori minat</b><span class="po-muted">Pilih kategori barang yang biasa dicari customer ini.</span></div>
      <div class="po-int-chips">${cats.map(c => { const on = info.meta.ids.includes(String(c.id)); return `<button type="button" class="po-int-chip${on ? ' on' : ''}" data-int="${esc(c.id)}" aria-pressed="${on}">${esc(c.name)}</button>`; }).join('') || '<span class="po-muted">Belum ada kategori. Tambah lewat form Pre-Order.</span>'}</div>
      <div class="po-int-meta"><span>Pernah beli: <b>${esc(info.bought.join(', ') || '-')}</b></span><span>Sisa tagihan: <b>${money(info.due)}</b></span></div>
      <label class="po-f"><span>Catatan</span><textarea class="input" rows="2" data-int-note placeholder="mis. suka ukuran S, minta dikabari PO Jepang">${esc(info.meta.notes)}</textarea></label>
      <div class="po-int-actions"><button type="button" class="btn btn-green po-small" data-int-save>Simpan</button></div>`;
    content.prepend(box);
    box.addEventListener('click', async e => {
      const chip = e.target.closest('[data-int]'); if (chip) { chip.classList.toggle('on'); chip.setAttribute('aria-pressed', chip.classList.contains('on')); return; }
      const save = e.target.closest('[data-int-save]'); if (!save) return;
      const ids = [...box.querySelectorAll('[data-int].on')].map(b => b.dataset.int), notes = box.querySelector('[data-int-note]').value.trim();
      busy(save, true, null, 'Menyimpan…');
      try {
        const { error } = await db.from('customers').update({ interest_topic_ids: ids, notes: notes || null }).eq('workspace_id', ws()).eq('id', id);
        if (error) throw error;
        custMeta[String(id)] = { ids, notes };
        toast(`Minat ${name} tersimpan.`, 'success');
        window.renderCustomerDatabase();
      } catch (err) { toast('Gagal menyimpan: ' + (err.message || err), true); }
      finally { busy(save, false, 'Simpan'); }
    });
  }
  const coreCustRender = window.renderCustomerDatabase;
  if (typeof coreCustRender === 'function') window.renderCustomerDatabase = function () { const r = coreCustRender.apply(this, arguments); if (isJastip()) { try { decorateCustomers(); } catch (e) { console.warn('[KAIRO][Jastip]', e); } } return r; };
  const coreHistory = window.openCustomerHistory;
  if (typeof coreHistory === 'function') window.openCustomerHistory = async function (id, name) { const r = await coreHistory.apply(this, arguments); if (isJastip()) { try { if (!(Array.isArray(topics) && topics.length) && typeof loadMasters === 'function') await loadMasters(); mountInterestPanel(id, name); } catch (e) { console.warn('[KAIRO][Jastip]', e); } } return r; };

  /* ---------- Dashboard ---------- */
  function renderDash() {
    const grid = document.getElementById('kpi-revenue')?.closest('.kpi')?.parentElement; if (!grid) return;
    const lab = document.getElementById('kpi-revenue')?.closest('.kpi')?.querySelector('.kpi-label');
    if (lab && !/Nilai Pre-Order/.test(lab.textContent)) lab.textContent = lab.textContent.replace(/^(Omset|Omzet|Penjualan)/i, 'Nilai Pre-Order');
    const txLab = document.getElementById('kpi-tx')?.closest('.kpi')?.querySelector('.kpi-label'); if (txLab) txLab.textContent = 'Jumlah Pre-Order';
    let row = document.getElementById('po-dash');
    if (!row) { row = document.createElement('div'); row.id = 'po-dash'; row.className = 'po-dash'; grid.insertAdjacentElement('afterend', row); row.addEventListener('click', onDashClick); }
    const os = poOrders().map(t => ({ t, f: fin(t) })).filter(x => !x.f.cancelled);
    const owed = os.reduce((s, x) => s + x.f.remaining, 0), rem = reminderRows(), late = rem.filter(x => x.r.key === 'late' || x.r.key === 'late-partial');
    const bal = advanceBalances(), advLeft = bal.reduce((s, x) => s + Math.max(0, x.left), 0);
    const waiting = os.filter(x => !['arrived', 'delivered'].includes(x.t.po_status)).length, arrived = os.filter(x => x.t.po_status === 'arrived');
    const mask = typeof maskedNominals !== 'undefined' && maskedNominals, m = n => mask ? '••••••' : money(n);
    const todo = [
      ...late.map(x => ({ id: x.t.id, tone: 'bad', t: `${x.t.customer_name}: cicilan ke-${x.r.seq} telat ${-x.r.days} hari`, v: m(x.r.left) })),
      ...rem.filter(x => !late.includes(x)).map(x => ({ id: x.t.id, tone: 'warn', t: `${x.t.customer_name}: cicilan ke-${x.r.seq} ${x.r.days === 0 ? 'jatuh tempo hari ini' : `${x.r.days} hari lagi`}`, v: m(x.r.left) })),
      ...arrived.map(x => ({ id: x.t.id, tone: 'info', t: `${x.t.customer_name}: barang sudah tiba, belum diserahkan`, v: x.f.remaining > 0.5 ? 'sisa ' + m(x.f.remaining) : 'lunas' })),
      ...os.filter(x => x.t.po_eta && !['arrived', 'delivered'].includes(x.t.po_status) && dayDiff(x.t.po_eta, today()) < 0).map(x => ({ id: x.t.id, tone: 'warn', t: `${x.t.customer_name}: lewat perkiraan tiba (${fmtDate(x.t.po_eta)})`, v: poLabel(x.t.po_status) }))
    ];
    row.innerHTML = `<div class="po-dash-stats">
        <button type="button" class="po-dstat" data-go="input"><span>Sisa tagihan customer</span><b>${m(owed)}</b><em>${os.filter(x => x.f.remaining > 0.5).length} pre-order belum lunas</em></button>
        <button type="button" class="po-dstat${late.length ? ' is-bad' : ''}" data-go="po-plans" data-tab="reminder"><span>Cicilan terlambat</span><b>${late.length}</b><em>${late.length ? m(late.reduce((s, x) => s + x.r.left, 0)) : 'Semua tepat waktu'}</em></button>
        <button type="button" class="po-dstat" data-go="po-finance" data-tab="adv"><span>Talangan belum kembali</span><b>${m(advLeft)}</b><em>${bal.filter(x => x.left > 0.5).map(x => `${esc(x.name)} ${m(x.left)}`).join(' · ') || 'Tidak ada'}</em></button>
        <button type="button" class="po-dstat" data-go="input" data-filter="waiting"><span>Menunggu barang</span><b>${waiting}</b><em>${arrived.length} sudah tiba, belum diserahkan</em></button>
      </div>
      <div class="card po-todo"><div class="card-title">Perlu tindakan</div>${todo.length ? todo.slice(0, 6).map(x => `<button type="button" class="po-todo-item is-${x.tone}" data-po-open="${esc(x.id)}"><span>${esc(x.t)}</span><b>${esc(x.v)}</b></button>`).join('') + (todo.length > 6 ? `<button type="button" class="po-link" data-go="po-plans" data-tab="reminder">Lihat semua (${todo.length})</button>` : '') : '<div class="po-empty">Semua beres. Tidak ada cicilan telat atau barang yang menunggu diserahkan.</div>'}</div>`;
  }
  function onDashClick(e) {
    const o = e.target.closest('[data-po-open]'); if (o) { openDetail(o.dataset.poOpen); return; }
    const g = e.target.closest('[data-go]'); if (!g) return;
    if (g.dataset.go === 'po-plans') { planTab = g.dataset.tab || 'list'; openPlans(); }
    else if (g.dataset.go === 'po-finance') { finTab = g.dataset.tab || 'book'; openFinance(); }
    else { orderFilter = g.dataset.filter || 'unpaid'; window.openAppPage('input'); window.loadPageData('input').catch(() => {}); }
  }

  /* ---------- Navigasi ---------- */
  const ICON_PLAN = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M8 14h3M8 17h6"/></svg>';
  const ICON_FIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15v-4M12 15V8M16 15v-6"/></svg>';
  const PAGES = { 'po-plans': ['Cicilan', 'Rencana cicilan customer dan pengingat jatuh tempo.', ICON_PLAN], 'po-finance': ['Keuangan', 'Pembukuan pemasukan & pengeluaran, serta modal talangan partner.', ICON_FIN] };
  function openPlans() { ensurePlansPage(); window.openAppPage('po-plans'); renderPlans(); window.loadPageData('po-plans').catch(() => {}); }
  function openFinance() { ensureFinancePage(); window.openAppPage('po-finance'); renderFinance(); window.loadPageData('po-finance').catch(() => {}); }
  function ensureNav() {
    if (!isJastip()) return;
    const nav = document.querySelector('#saas-sidebar .saas-sidebar-nav');
    let after = nav && nav.querySelector('[data-tab="input"]');
    Object.entries(PAGES).forEach(([id, [label, , icon]]) => {
      if (nav && !nav.querySelector(`[data-tab="${id}"]`)) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.dataset.tab = id;
        b.innerHTML = `<span class="saas-nav-icon">${icon}</span><span class="saas-nav-label">${label}</span>`;
        b.addEventListener('click', id === 'po-plans' ? openPlans : openFinance);
        nav.appendChild(b);
      }
      const b = nav && nav.querySelector(`[data-tab="${id}"]`);
      if (b && after && after.nextElementSibling !== b) after.insertAdjacentElement('afterend', b);
      if (b) after = b;
      const grid = document.querySelector('#kairo-mobile-more-sheet .kairo-mobile-more-grid');
      if (grid && !grid.querySelector(`[data-mobile-tab="${id}"]`)) {
        const m = document.createElement('button'); m.type = 'button'; m.className = 'saas-mobile-nav-btn kairo-mobile-more-item'; m.dataset.mobileTab = id;
        m.innerHTML = `<span>${icon}</span><span>${label}</span>`;
        m.addEventListener('click', () => { document.querySelector('#kairo-mobile-more-sheet .kairo-mobile-more-backdrop')?.click(); (id === 'po-plans' ? openPlans : openFinance)(); });
        const prev = grid.querySelector('[data-mobile-tab="po-plans"]');
        if (prev && id !== 'po-plans') prev.after(m); else grid.prepend(m);
      }
    });
    document.querySelectorAll('[data-tab="input"] .saas-nav-label, [data-mobile-tab="input"] > span:last-child').forEach(l => { if (l.textContent !== 'Pre-Order') l.textContent = 'Pre-Order'; });
  }
  const coreOpen = window.openAppPage;
  if (typeof coreOpen === 'function') {
    window.openAppPage = function (tab) {
      if (isJastip() && tab === 'cash') tab = 'po-finance';
      if (isJastip()) { ensurePlansPage(); ensureFinancePage(); }
      const r = coreOpen.call(this, tab);
      if (isJastip()) {
        const t = document.querySelector('main.container .page-title'), s = document.querySelector('main.container .page-sub');
        const copy = PAGES[tab] || (tab === 'input' ? ['Pre-Order', 'Catat pesanan, pembayaran, dan status barang.'] : null);
        if (copy) { if (t) t.textContent = copy[0]; if (s) s.textContent = copy[1]; }
        if (PAGES[tab]) document.querySelectorAll('#saas-sidebar .tab').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
      }
      return r;
    };
  }

  /* ---------- Lonceng ---------- */
  window.kairoTemplateNotifications = async function () {
    if (!isJastip()) return null;
    await loadData(false); await loadOrders();
    return reminderRows().map(({ t, r }) => ({ id: `po:${t.id}:${r.seq}:${r.key}`, name: t.customer_name || '-', pkg: `Cicilan ke-${r.seq} · ${money(r.left)}`, note: r.days < 0 ? `Telat ${-r.days} hari` : r.days === 0 ? 'Jatuh tempo hari ini' : `${r.days} hari lagi`, urgent: r.days < 0, minutes: 0 }));
  };
  window.kairoTemplateNotifyCopy = () => isJastip() ? { title: 'Pengingat cicilan', sub: 'Cicilan terlambat & jatuh tempo ≤3 hari', empty: 'Tidak ada cicilan yang terlambat atau jatuh tempo dekat.', unit: 'pengingat' } : null;
  function refreshBell() { try { window.kairoNotifications?.refresh?.(); } catch (_e) { /* lonceng opsional */ } }

  /* ---------- Mulai ---------- */
  function boot() {
    if (!isJastip()) return;
    document.body.classList.add('po-jastip');
    ensureNav(); ensureOrdersPage(); ensurePlansPage(); ensureFinancePage();
    // Muat ulang halaman aktif lewat loadPageData yang sudah dibungkus: hitungan hak partner (Withdraw) baru benar
    // setelah buku uang termuat, jadi ringkasan yang terlanjur dihitung sebelum template ini dimuat digambar ulang.
    window.loadPageData(currentAppPage(), { force: true }).catch(e => console.warn('[KAIRO][Jastip]', e));
  }
  new MutationObserver(() => ensureNav()).observe(document.getElementById('app-shell') || document.body, { childList: true, subtree: true });
  document.addEventListener('kairo:refreshed', () => { if (isJastip()) afterPageLoad(currentAppPage()); });
  const coreDash = window.renderDashboard;
  if (typeof coreDash === 'function') window.renderDashboard = function () { const r = coreDash.apply(this, arguments); if (isJastip()) { try { renderDash(); ensureNav(); } catch (e) { console.warn('[KAIRO][Jastip]', e); } } return r; };
  window.kairoJastip = { open: openDetail, newOrder: openNewOrder, fin: id => { const t = allTx.find(x => String(x.id) === String(id)); return t ? fin(t) : null; }, plan: id => { const t = allTx.find(x => String(x.id) === String(id)); return t ? planRows(t, fin(t)) : null; }, reload: () => loadData(true), balances: advanceBalances, cash: businessCash };
  boot();
})();
