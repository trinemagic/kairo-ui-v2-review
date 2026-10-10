/* KAIRO - Online Shop (produk fisik): analitik toko di atas kerangka tampilan dasar.
   Dimuat HANYA untuk workspace dengan business_template=online_shop (loader di kairo-app.js).
   Isi: kartu Profit di Dashboard, Performance (Laba per Produk, Analisis Channel, Batal & Retur),
   daftar Platform Penjualan yang bisa diatur (Settings), dialog Batal/Retur saat hapus order.
   Memakai fungsi/variabel global kairo-app.js (transactions, rupiah, transactionProfitBreakdown, ...). */
(function () {
  'use strict';
  if (window.__kairoShop) return;
  window.__kairoShop = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const money = n => (typeof rupiah === 'function' ? rupiah(Math.round(Number(n) || 0)) : 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID'));
  const pct = (a, b, d = 0) => (b > 0 ? (a / b * 100).toLocaleString('id-ID', { maximumFractionDigits: d }) + '%' : '-');
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const isMasked = () => typeof maskedNominals !== 'undefined' && maskedNominals;

  /* ---------- Channel penjualan (bisa diatur user) ---------- */
  const DEFAULT_PLATFORMS = ['Shopee', 'Tokopedia', 'TikTok Shop', 'Lazada', 'WhatsApp', 'Instagram', 'Toko Offline', 'Lainnya'];
  function platformList() {
    const l = (typeof activeWorkspaceBranding !== 'undefined' && activeWorkspaceBranding?.receipt_labels?.__platforms) || null;
    const clean = Array.isArray(l) ? l.map(x => String(x || '').trim()).filter(Boolean) : [];
    return clean.length ? clean : DEFAULT_PLATFORMS.slice();
  }
  function syncPlatformSelect() {
    const sel = document.getElementById('tx-platform');
    if (!sel) return;
    const cur = sel.value, list = platformList();
    if (cur && !list.includes(cur)) list.push(cur);
    const html = '<option value="">-- Pilih Platform --</option>' + list.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    if (sel.dataset.shopOptions === html) return;
    sel.innerHTML = html;
    sel.dataset.shopOptions = html;
    sel.value = cur;
  }

  /* Komisi per channel: __platform_fees {nama channel: persen}, saklar __fee_enabled. Dipakai Profit Dashboard & Performa Platform. */
  const brandingLabels = () => (typeof activeWorkspaceBranding !== 'undefined' && activeWorkspaceBranding?.receipt_labels) || {};
  const feeEnabled = () => brandingLabels().__fee_enabled === true;
  function feePercent(platform) {
    if (!feeEnabled()) return 0;
    const fees = brandingLabels().__platform_fees || {};
    const raw = String(platform || '').trim().toLowerCase();
    if (!raw) return 0;
    for (const [k, v] of Object.entries(fees)) if (k.toLowerCase() === raw) return Math.max(0, Math.min(100, num(v)));
    const key = typeof platformKey === 'function' ? platformKey(platform) : '';
    for (const [k, v] of Object.entries(fees)) if (key && typeof platformKey === 'function' && platformKey(k) === key) return Math.max(0, Math.min(100, num(v)));
    return 0;
  }
  const feeOf = t => num(t?.total_price) * feePercent(t?.platform) / 100;

  let draft = null; // { list: [{name, fee}], enabled }
  function startDraft() {
    const fees = brandingLabels().__platform_fees || {};
    draft = { enabled: feeEnabled(), list: platformList().map(n => ({ name: n, fee: fees[n] === undefined || fees[n] === null ? '' : String(fees[n]) })) };
  }
  function renderPlatformRows() {
    const box = document.getElementById('shop-platform-rows');
    if (!box) return;
    const sw = document.getElementById('shop-fee-enabled');
    if (sw) sw.checked = draft.enabled;
    box.classList.toggle('fee-off', !draft.enabled);
    box.innerHTML = draft.list.map((r, i) => `<div class="shop-platform-row"><strong>${esc(r.name)}</strong><label class="shop-fee"><input class="input" type="number" min="0" max="100" step="0.1" inputmode="decimal" placeholder="0" value="${esc(r.fee)}" data-shop-fee="${i}" aria-label="Komisi ${esc(r.name)} (%)"><span>%</span></label><button type="button" class="shop-row-del" data-shop-chip-del="${i}" aria-label="Hapus ${esc(r.name)}">×</button></div>`).join('') || '<span class="shop-muted">Belum ada platform.</span>';
  }
  function mountPlatformSettings() {
    if (document.getElementById('shop-platform-card')) return;
    const topicCard = document.getElementById('settings-topic-card');
    if (!topicCard) return;
    const card = document.createElement('div');
    card.className = 'card settings-master-card';
    card.id = 'shop-platform-card';
    card.innerHTML = `<div class="settings-master-head"><div><div class="card-title">Platform Penjualan</div><div class="page-sub">Pilihan asal order di Orders dan dasar grafik platform.</div></div></div>
      <div class="shop-fee-switch"><label class="kairo-switch"><input type="checkbox" id="shop-fee-enabled"><span aria-hidden="true"></span><b class="sr-only">Hitung komisi platform</b></label><div><strong>Hitung komisi platform</strong><small>Profit dan laba platform dipotong komisi sesuai persen di bawah.</small></div></div>
      <div id="shop-platform-rows" class="shop-platform-rows"></div>
      <div class="shop-platform-add"><input class="input" id="shop-platform-input" maxlength="30" placeholder="Nama platform baru"><button type="button" class="btn btn-light" id="shop-platform-add">Tambah</button></div>
      <div class="shop-platform-actions"><button type="button" class="btn btn-green" id="shop-platform-save">Simpan Platform</button><button type="button" class="btn btn-light" id="shop-platform-reset">Kembalikan Bawaan</button></div>`;
    (topicCard.closest('.settings-category-panel') || topicCard.parentNode).appendChild(card);
    startDraft();
    renderPlatformRows();
    const input = card.querySelector('#shop-platform-input');
    const add = () => {
      const v = input.value.trim();
      if (!v) return;
      if (draft.list.some(x => x.name.toLowerCase() === v.toLowerCase())) { showToast('Platform itu sudah ada.', 'warning'); return; }
      draft.list.push({ name: v, fee: '' }); input.value = ''; renderPlatformRows();
    };
    card.addEventListener('input', e => { const f = e.target.closest('[data-shop-fee]'); if (f) draft.list[Number(f.dataset.shopFee)].fee = f.value; });
    card.addEventListener('change', e => { if (e.target.id === 'shop-fee-enabled') { draft.enabled = e.target.checked; renderPlatformRows(); } });
    card.addEventListener('click', async e => {
      const del = e.target.closest('[data-shop-chip-del]');
      if (del) { draft.list.splice(Number(del.dataset.shopChipDel), 1); renderPlatformRows(); return; }
      if (e.target.closest('#shop-platform-add')) { add(); return; }
      if (e.target.closest('#shop-platform-reset')) { draft.list = DEFAULT_PLATFORMS.map(n => ({ name: n, fee: '' })); renderPlatformRows(); return; }
      if (e.target.closest('#shop-platform-save')) {
        try {
          if (!draft.list.length) throw new Error('Isi minimal satu platform.');
          const fees = {};
          draft.list.forEach(r => { const v = r.fee === '' ? 0 : Number(r.fee); if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error(`Komisi ${r.name} harus 0–100%.`); if (v > 0) fees[r.name] = v; });
          const wid = requireWorkspaceId();
          const labels = { ...brandingLabels(), __platforms: draft.list.map(r => r.name), __platform_fees: fees, __fee_enabled: draft.enabled };
          const { error } = await db.from('workspace_branding').upsert({ workspace_id: wid, receipt_labels: labels, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
          if (error) throw error;
          await loadWorkspaceSaasContext();
          syncPlatformSelect();
          renderShopDashboardKpi();
          if (document.getElementById('shop-analytics')) renderChannelCard();
          showToast('Platform penjualan disimpan.');
        } catch (err) { showToast(err.message || 'Gagal menyimpan platform.', true); }
      }
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  }


  /* ---------- Metode pembayaran (bisa diatur user): receipt_labels.__payments ---------- */
  const DEFAULT_PAYMENTS = ['QRIS', 'Cash', 'Transfer', 'Other'];
  function paymentList() {
    const l = brandingLabels().__payments;
    const clean = Array.isArray(l) ? l.map(x => String(x || '').trim()).filter(Boolean) : [];
    return clean.length ? clean : DEFAULT_PAYMENTS.slice();
  }
  function syncPaymentSelect() {
    const sel = document.getElementById('tx-payment');
    if (!sel) return;
    const cur = sel.value, list = paymentList();
    if (cur && !list.some(x => x.toLowerCase() === cur.toLowerCase())) list.push(cur);
    const html = '<option value="">-- Pilih Metode Pembayaran --</option>' + list.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    if (sel.dataset.shopOptions === html) return;
    sel.innerHTML = html;
    sel.dataset.shopOptions = html;
    sel.value = list.find(x => x.toLowerCase() === cur.toLowerCase()) || cur;
  }
  let payDraft = null;
  function renderPaymentRows() {
    const box = document.getElementById('shop-payment-rows');
    if (!box) return;
    box.innerHTML = payDraft.map((n, i) => `<div class="shop-platform-row"><strong>${esc(n)}</strong><button type="button" class="shop-row-del" data-shop-pay-del="${i}" aria-label="Hapus ${esc(n)}">×</button></div>`).join('') || '<span class="shop-muted">Belum ada metode pembayaran.</span>';
  }
  function mountPaymentSettings() {
    if (document.getElementById('shop-payment-card')) return;
    const anchor = document.getElementById('shop-platform-card') || document.getElementById('settings-topic-card');
    if (!anchor) return;
    const card = document.createElement('div');
    card.className = 'card settings-master-card';
    card.id = 'shop-payment-card';
    card.innerHTML = `<div class="settings-master-head"><div><div class="card-title">Metode Pembayaran</div><div class="page-sub">Pilihan metode pembayaran di Orders, mis. QRIS, Transfer, COD, atau nama dompet digital.</div></div></div>
      <div id="shop-payment-rows" class="shop-platform-rows"></div>
      <div class="shop-platform-add"><input class="input" id="shop-payment-input" maxlength="30" placeholder="Nama metode baru"><button type="button" class="btn btn-light" id="shop-payment-add">Tambah</button></div>
      <div class="shop-platform-actions"><button type="button" class="btn btn-green" id="shop-payment-save">Simpan Metode</button><button type="button" class="btn btn-light" id="shop-payment-reset">Kembalikan Bawaan</button></div>`;
    anchor.after(card);
    payDraft = paymentList();
    renderPaymentRows();
    const input = card.querySelector('#shop-payment-input');
    const add = () => {
      const v = input.value.trim();
      if (!v) return;
      if (payDraft.some(x => x.toLowerCase() === v.toLowerCase())) { showToast('Metode itu sudah ada.', 'warning'); return; }
      payDraft.push(v); input.value = ''; renderPaymentRows();
    };
    card.addEventListener('click', async e => {
      const del = e.target.closest('[data-shop-pay-del]');
      if (del) { payDraft.splice(Number(del.dataset.shopPayDel), 1); renderPaymentRows(); return; }
      if (e.target.closest('#shop-payment-add')) { add(); return; }
      if (e.target.closest('#shop-payment-reset')) { payDraft = DEFAULT_PAYMENTS.slice(); renderPaymentRows(); return; }
      if (e.target.closest('#shop-payment-save')) {
        try {
          if (!payDraft.length) throw new Error('Isi minimal satu metode pembayaran.');
          const wid = requireWorkspaceId();
          const labels = { ...brandingLabels(), __payments: payDraft.slice() };
          const { error } = await db.from('workspace_branding').upsert({ workspace_id: wid, receipt_labels: labels, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
          if (error) throw error;
          await loadWorkspaceSaasContext();
          syncPaymentSelect();
          showToast('Metode pembayaran disimpan.');
        } catch (err) { showToast(err.message || 'Gagal menyimpan metode pembayaran.', true); }
      }
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  }

  // Logo kecil channel marketplace (huruf + warna); channel lain tetap memakai logo bawaan.
  const BRAND = { 'Shopee': ['S', '#ee4d2d'], 'Tokopedia': ['T', '#03ac0e'], 'TikTok Shop': ['♪', '#111827'], 'Lazada': ['L', '#2a37d4'], 'Toko Offline': ['⌂', '#6b7a90'], 'Lainnya': ['•', '#8794a8'], 'Other': ['•', '#8794a8'] };
  function installPlatformLogo() {
    if (typeof platformLogo !== 'function' || platformLogo.__shop) return;
    const core = platformLogo;
    const w = function (name) {
      const k = typeof platformKey === 'function' ? platformKey(name) : String(name || '');
      const b = BRAND[k];
      return b ? `<span class="platform-logo shop-logo" style="background:${b[1]};color:#fff"><strong>${b[0]}</strong></span>` : core.apply(this, arguments);
    };
    w.__shop = true;
    window.platformLogo = w;
  }

  /* ---------- Dashboard: kartu Profit ---------- */
  const profitOf = t => Math.max(-1e12, num(t?.total_price) - transactionProfitBreakdown(t).hpp - feeOf(t));
  const isRollup = t => typeof isRollupTx === 'function' && isRollupTx(t);
  function periodSuffix() {
    const p = typeof activePeriod !== 'undefined' ? String(activePeriod) : 'today';
    return p === 'today' ? 'Hari Ini' : p === '7days' ? '7 Hari Terakhir' : p === '30days' ? '30 Hari Terakhir' : 'Periode Kustom';
  }
  function renderShopDashboardKpi() {
    const revEl = document.getElementById('kpi-revenue');
    if (!revEl || !Array.isArray(transactions)) return;
    const revCard = revEl.closest('.kpi');
    let card = document.getElementById('shop-kpi-profit-card');
    if (!card && revCard) {
      card = document.createElement('div');
      card.className = 'kpi shop-profit-kpi';
      card.id = 'shop-kpi-profit-card';
      card.innerHTML = '<div class="kpi-head"><div class="kpi-label">Profit</div><button type="button" class="kpi-eye" id="shop-profit-eye" aria-label="Sembunyikan nominal"></button></div><div class="kpi-value" id="shop-kpi-profit">Rp0</div>';
      revCard.insertAdjacentElement('afterend', card);
      document.getElementById('shop-profit-eye')?.addEventListener('click', () => { if (typeof toggleKpiVisibility === 'function') toggleKpiVisibility(); });
      try { updateKpiEyeButtons(); } catch (_e) { /* tombol mata lama */ }
    }
    if (!card) return;
    const profit = transactions.filter(t => !isRollup(t)).reduce((s, t) => s + profitOf(t), 0);
    const label = card.querySelector('.kpi-label');
    const text = 'Profit ' + periodSuffix();
    if (label && label.textContent !== text) label.textContent = text;
    const val = document.getElementById('shop-kpi-profit');
    if (val) val.textContent = isMasked() ? '••••••' : money(profit);
  }
  document.addEventListener('click', e => { if (e.target.closest?.('#dashboard .kpi-eye')) setTimeout(renderShopDashboardKpi, 0); }, true);

  /* ---------- Performance ---------- */
  const tile = (label, value) => `<div class="shop-tile"><span>${label}</span><strong>${value}</strong></div>`;
  const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const cardHead = (title, sub, key, toggle = true) => `<div class="shop-head"><div><div class="card-title">${title}</div>${sub ? `<div class="page-sub">${sub}</div>` : ''}</div>${toggle ? `<button type="button" class="shop-toggle" data-shop-toggle="${key}" aria-expanded="false" aria-controls="shop-${key}-data" title="Tampilkan tabel data"><span>Tabel</span>${CHEVRON}</button>` : ''}</div>`;
  function ensurePerfCards() {
    if (document.getElementById('shop-analytics')) return true;
    const anchor = document.getElementById('product-sales-card');
    if (!anchor) return false;
    const wrap = document.createElement('div');
    wrap.id = 'shop-analytics';
    wrap.innerHTML = `
      <div class="card shop-card" id="shop-profit-card">
        ${cardHead('Laba per Produk', 'Laba kotor = omzet − HPP', 'profit')}
        <div class="chart-wrap shop-chart"><canvas id="shop-profit-chart"></canvas></div>
        <div class="shop-data" id="shop-profit-data" hidden>
          <div class="table-wrap"><table><thead><tr><th>Produk</th><th>Terjual</th><th>Omzet</th><th>Laba</th><th>Margin</th><th>Kontribusi laba</th></tr></thead><tbody id="shop-profit-table"></tbody></table></div>
        </div>
      </div>
      <div class="card shop-card" id="shop-channel-card">
        ${cardHead('Performa Platform', '<span id="shop-channel-sub"></span>', 'channel')}
        <div class="chart-wrap shop-chart"><canvas id="shop-channel-chart"></canvas></div>
        <div class="shop-data" id="shop-channel-data" hidden>
          <div class="table-wrap"><table><thead id="shop-channel-head"></thead><tbody id="shop-channel-table"></tbody></table></div>
        </div>
      </div>
      <div class="card shop-card" id="shop-returns-card" hidden>
        ${cardHead('Batal &amp; Retur', '', 'returns')}
        <div class="shop-tiles" id="shop-return-tiles"></div>
        <div class="chart-wrap shop-chart shop-chart-short"><canvas id="shop-returns-chart"></canvas></div>
        <div class="shop-data" id="shop-returns-data" hidden>
          <div class="table-wrap"><table><thead><tr><th>Alasan</th><th>Batal</th><th>Retur</th><th>Nilai order</th></tr></thead><tbody id="shop-return-table"></tbody></table></div>
        </div>
      </div>`;
    anchor.insertAdjacentElement('afterend', wrap);
    wrap.addEventListener('click', e => {
      const t = e.target.closest('[data-shop-toggle]');
      if (t) {
        const box = document.getElementById(`shop-${t.dataset.shopToggle}-data`);
        const open = box.hidden;
        box.hidden = !open;
        t.setAttribute('aria-expanded', open ? 'true' : 'false');
        t.title = open ? 'Sembunyikan tabel data' : 'Tampilkan tabel data';
        return;
      }
    });
    return true;
  }

  // Grafik batang horizontal gaya Performance (helper chart milik kairo-app.js). rows: [{label, value, text, tip, other}]
  const charts = {};
  function drawBars(id, rows, empty) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    if (charts[id]) charts[id].destroy();
    const c = chartBrandColors();
    const short = v => { const t = String(v); return t.length > 22 ? t.slice(0, 21) + '…' : t; };
    const has = rows.length > 0;
    charts[id] = new Chart(canvas, {
      type: 'bar',
      data: { labels: has ? rows.map(r => r.label) : [empty], datasets: [{ data: has ? rows.map(r => r.value) : [0], backgroundColor: has ? rows.map(r => (r.other ? c.other : c.primary)) : [c.other], borderRadius: 6, barThickness: 'flex', maxBarThickness: 26 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 12 } },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: items => items[0]?.label || '', label: x => (has ? rows[x.dataIndex].tip : empty) } }
        },
        scales: chartAxes(c, { x: { beginAtZero: true, grace: '5%', ticks: { callback: v => (id === 'shop-profit-chart' || id === 'shop-channel-chart' ? shortRupiah(v) : v), precision: 0 }, grid: { display: true } }, y: { grid: { display: false }, ticks: { callback() { return short(this.getLabelForValue(arguments[0])); } } } })
      }
    });
  }
  const rpShort = n => (typeof shortRupiah === 'function' ? shortRupiah(n) : money(n));
  // Top 5 + "Lainnya" supaya tetap ringkas; tabel menampilkan semuanya.
  function topRows(list, limit, merge) {
    if (list.length <= limit + 1) return list;
    return [...list.slice(0, limit), merge(list.slice(limit))];
  }

  function rowsInRange() { return (Array.isArray(transactions) ? transactions : []).filter(t => !isRollup(t)); }

  function renderProfitCard() {
    const body = document.getElementById('shop-profit-table');
    if (!body) return;
    const map = new Map();
    rowsInRange().forEach(t => {
      (Array.isArray(t.order_items) ? t.order_items : []).forEach(x => {
        const name = String(x?.name || x?.code || '').trim() || '-';
        const qty = Math.max(0, num(x?.qty || 1));
        const revenue = x?.subtotal !== undefined && x?.subtotal !== null ? num(x.subtotal) : num(x?.unit_price ?? x?.price) * qty;
        const cost = x?.cost_subtotal !== undefined && x?.cost_subtotal !== null ? num(x.cost_subtotal) : num(x?.cost_price) * qty;
        const r = map.get(name) || { name, qty: 0, revenue: 0, cost: 0 };
        r.qty += qty; r.revenue += revenue; r.cost += cost;
        map.set(name, r);
      });
    });
    const list = [...map.values()].map(r => ({ ...r, profit: r.revenue - r.cost, noCost: r.cost <= 0 })).sort((a, b) => b.profit - a.profit);
    const positive = list.reduce((s, r) => s + Math.max(0, r.profit), 0);
    body.innerHTML = list.length ? list.map(r => `<tr><td><strong>${esc(r.name)}</strong></td><td>${r.qty.toLocaleString('id-ID')}</td><td>${money(r.revenue)}</td><td><strong class="${r.profit < 0 ? 'shop-neg' : ''}">${money(r.profit)}</strong></td><td${r.noCost ? ' title="Harga modal belum diisi"' : ''}>${r.noCost ? '-' : pct(r.profit, r.revenue, 1)}</td><td>${pct(Math.max(0, r.profit), positive)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">Belum ada penjualan pada periode ini.</td></tr>';
    const chartRows = topRows(list.filter(r => r.profit > 0).map(r => ({
      label: r.name, value: r.profit, margin: r.noCost ? null : r.profit / r.revenue, profit: r.profit, revenue: r.revenue, qty: r.qty
    })), 5, rest => ({ label: 'Lainnya', other: true, value: rest.reduce((s, x) => s + x.profit, 0), margin: null, profit: rest.reduce((s, x) => s + x.profit, 0), revenue: rest.reduce((s, x) => s + x.revenue, 0), qty: rest.reduce((s, x) => s + x.qty, 0) }));
    drawBars('shop-profit-chart', chartRows.map(r => ({
      label: r.label, value: r.value, other: r.other,
      tip: [`Laba ${money(r.profit)}`, `${r.qty.toLocaleString('id-ID')} terjual`]
    })), 'Belum ada penjualan');
  }

  function renderChannelCard() {
    const body = document.getElementById('shop-channel-table');
    if (!body) return;
    const withFee = feeEnabled();
    const sub = document.getElementById('shop-channel-sub');
    if (sub) sub.textContent = withFee ? 'Laba setelah komisi platform' : 'Laba sebelum komisi platform';
    document.getElementById('shop-channel-head').innerHTML = `<tr><th>Platform</th><th>Order</th><th>Omzet</th>${withFee ? '<th>Komisi</th>' : ''}<th>Laba</th><th>Margin</th><th>Rata-rata/order</th><th>Porsi omzet</th></tr>`;
    const map = new Map();
    rowsInRange().forEach(t => {
      const k = t.platform ? (typeof platformKey === 'function' ? platformKey(t.platform) : t.platform) : 'Tanpa platform';
      const r = map.get(k) || { name: k, orders: 0, revenue: 0, fee: 0, profit: 0 };
      r.orders++; r.revenue += num(t.total_price); r.fee += feeOf(t); r.profit += profitOf(t);
      map.set(k, r);
    });
    const list = [...map.values()].sort((a, b) => b.revenue - a.revenue);
    const totalRev = list.reduce((s, r) => s + r.revenue, 0);
    const cols = withFee ? 8 : 7;
    body.innerHTML = list.length ? list.map(r => `<tr><td><span class="shop-channel-name">${typeof platformLogo === 'function' ? platformLogo(r.name) : ''}<strong>${esc(r.name)}</strong></span></td><td>${r.orders.toLocaleString('id-ID')}</td><td>${money(r.revenue)}</td>${withFee ? `<td>${r.fee ? '−' + money(r.fee) : '-'}</td>` : ''}<td><strong class="${r.profit < 0 ? 'shop-neg' : ''}">${money(r.profit)}</strong></td><td>${pct(r.profit, r.revenue, 1)}</td><td>${money(r.orders ? r.revenue / r.orders : 0)}</td><td>${pct(r.revenue, totalRev)}</td></tr>`).join('') : `<tr><td colspan="${cols}" class="empty">Belum ada penjualan pada periode ini.</td></tr>`;
    const rows = topRows(list, 5, rest => ({ name: 'Lainnya', other: true, orders: rest.reduce((s, x) => s + x.orders, 0), revenue: rest.reduce((s, x) => s + x.revenue, 0), fee: rest.reduce((s, x) => s + x.fee, 0), profit: rest.reduce((s, x) => s + x.profit, 0) }));
    drawBars('shop-channel-chart', rows.map(r => ({
      label: r.name, value: r.revenue, other: r.other,
      tip: [`Omzet ${money(r.revenue)} (${pct(r.revenue, totalRev)})`, ...(withFee ? [`Komisi ${money(r.fee)}`] : []), `Laba ${money(r.profit)} · margin ${pct(r.profit, r.revenue, 1)}`, `${r.orders} order`]
    })), 'Belum ada penjualan');
  }

  /* Batal & Retur: tabel order_returns (SQL .claude/sql/2026-10-online-shop-returns.sql). Tabel belum ada = kartu disembunyikan. */
  let returnsSeq = 0, returnsMissing = false;
  async function renderReturnsCard() {
    const card = document.getElementById('shop-returns-card');
    if (!card || returnsMissing) return;
    const seq = ++returnsSeq;
    let rows = [];
    try {
      const { from, to } = getRange();
      let q = db.from('order_returns').select('*').eq('workspace_id', requireWorkspaceId());
      if (from) q = q.gte('transaction_date', from);
      if (to) q = q.lte('transaction_date', to);
      const { data, error } = await q;
      if (error) throw error;
      rows = data || [];
    } catch (err) {
      if (/order_returns|relation|does not exist|schema cache/i.test(String(err?.message || err?.code || ''))) returnsMissing = true;
      card.hidden = true; return;
    }
    if (seq !== returnsSeq) return;
    const orders = rowsInRange().length, bad = rows.length;
    const batal = rows.filter(r => r.kind !== 'retur').length, retur = bad - batal;
    const value = rows.reduce((s, r) => s + num(r.total_price), 0);
    card.hidden = false;
    document.getElementById('shop-return-tiles').innerHTML = [tile('Batal', batal.toLocaleString('id-ID')), tile('Retur', retur.toLocaleString('id-ID')), tile('Tingkat Batal/Retur', pct(bad, orders + bad, 1)), tile('Nilai Order', money(value))].join('');
    const byReason = new Map();
    rows.forEach(r => { const k = r.reason || 'Lainnya'; const x = byReason.get(k) || { b: 0, r: 0, v: 0 }; if (r.kind === 'retur') x.r++; else x.b++; x.v += num(r.total_price); byReason.set(k, x); });
    const reasons = [...byReason.entries()].sort((a, b) => (b[1].b + b[1].r) - (a[1].b + a[1].r));
    document.getElementById('shop-return-table').innerHTML = reasons.length ? reasons.map(([k, x]) => `<tr><td>${esc(k)}</td><td>${x.b}</td><td>${x.r}</td><td>${money(x.v)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">Belum ada batal/retur pada periode ini.</td></tr>';
    drawBars('shop-returns-chart', reasons.map(([k, x]) => ({
      label: k, value: x.b + x.r,
      tip: [`${x.b} batal, ${x.r} retur`, `Nilai ${money(x.v)}`]
    })), 'Belum ada batal/retur');
  }

  function renderPerformanceExtras() {
    if (!ensurePerfCards()) return;
    renderProfitCard();
    renderChannelCard();
    renderReturnsCard();
  }
  // Warna grafik ikut tema/mode gelap: gambar ulang hanya saat tema atau mode gelap berubah.
  let lastLook = '', lookTimer = 0;
  const look = () => (document.documentElement.dataset.wsTheme || '') + '|' + document.body.classList.contains('saas-dark');
  lastLook = look();
  const onLook = () => {
    const now = look();
    if (now === lastLook) return;
    lastLook = now;
    clearTimeout(lookTimer);
    lookTimer = setTimeout(() => { if (document.getElementById('shop-analytics')) { renderProfitCard(); renderChannelCard(); if (!returnsMissing) renderReturnsCard(); } }, 150);
  };
  new MutationObserver(onLook).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ws-theme'] });
  new MutationObserver(onLook).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* ---------- Hapus order = Batal / Retur (dicatat) ---------- */
  const REASONS = { batal: ['Pembeli batal', 'Stok habis', 'Salah input', 'Lainnya'], retur: ['Barang rusak/cacat', 'Salah kirim', 'Tidak sesuai deskripsi', 'Lainnya'] };
  function askReason(customerName) {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.className = 'shop-modal';
      const opts = k => REASONS[k].map(r => `<option>${esc(r)}</option>`).join('');
      ov.innerHTML = `<div class="shop-modal-card" role="dialog" aria-modal="true" aria-label="Hapus order"><h3>Hapus order ${esc(customerName || '')}?</h3>
        <p>Order dihapus dari omzet, profit, kas, grafik, dan riwayat. Tindakan ini tidak bisa dibatalkan. Pilih alasannya supaya tercatat di Performance.</p>
        ${stockReady() ? '<p class="shop-hint">Batal mengembalikan stok. Retur tidak, kembalikan manual dari tabel Stok.</p>' : ''}
        <div class="shop-seg"><label><input type="radio" name="shop-kind" value="batal" checked> Batal</label><label><input type="radio" name="shop-kind" value="retur"> Retur</label></div>
        <label class="label" for="shop-reason">Alasan</label><select id="shop-reason" class="input">${opts('batal')}</select>
        <div class="shop-modal-actions"><button type="button" class="btn btn-light" data-shop-no>Kembali</button><button type="button" class="btn btn-danger" data-shop-yes>Hapus Order</button></div></div>`;
      document.body.appendChild(ov);
      const close = v => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      ov.addEventListener('change', e => { if (e.target.name === 'shop-kind') ov.querySelector('#shop-reason').innerHTML = opts(e.target.value); });
      ov.addEventListener('click', e => {
        if (e.target === ov || e.target.closest('[data-shop-no]')) close(null);
        else if (e.target.closest('[data-shop-yes]')) close({ kind: ov.querySelector('input[name="shop-kind"]:checked').value, reason: ov.querySelector('#shop-reason').value });
      });
      ov.querySelector('[data-shop-yes]').focus();
    });
  }
  function installDelete() {
    if (typeof deleteCancelledTransaction !== 'function' || deleteCancelledTransaction.__shop) return;
    const core = deleteCancelledTransaction;
    const w = async function (transactionId, customerName, customerId) {
      if (!transactionId) return;
      const answer = await askReason(customerName);
      if (!answer) return;
      const pool = [...(Array.isArray(transactions) ? transactions : []), ...(typeof historyTransactions !== 'undefined' && Array.isArray(historyTransactions) ? historyTransactions : [])];
      let t = pool.find(x => String(x.id) === String(transactionId));
      if (!t) {
        try { const { data } = await db.from('transactions').select('*').eq('workspace_id', requireWorkspaceId()).eq('id', transactionId); t = data && data[0]; } catch (_e) { /* tanpa catatan */ }
      }
      if (t && !returnsMissing) {
        try {
          const { error } = await db.from('order_returns').insert({
            workspace_id: requireWorkspaceId(), transaction_id: String(transactionId), transaction_date: t.transaction_date || null,
            kind: answer.kind, reason: answer.reason, platform: t.platform || null, customer_name: t.customer_name || customerName || null,
            total_price: num(t.total_price), hpp: transactionProfitBreakdown(t).hpp,
            items: (Array.isArray(t.order_items) ? t.order_items : []).map(x => ({ id: x.id ?? null, name: x.name || x.code || '-', qty: num(x.qty || 1) })),
            restocked: false
          });
          if (error) throw error;
        } catch (err) {
          if (/order_returns|relation|does not exist|schema cache/i.test(String(err?.message || ''))) returnsMissing = true;
          else showToast('Catatan batal/retur gagal disimpan, order tetap dihapus.', 'warning');
        }
      }
      return core.call(this, transactionId, customerName, customerId, { skipConfirm: true });
    };
    w.__shop = true;
    window.deleteCancelledTransaction = w;
  }

  /* ---------- Stok produk ----------
     Kolom package_masters.stock_qty / stock_min + trigger database (SQL .claude/sql/2026-10-online-shop-stock.sql).
     Kolom belum ada = semua bagian stok tersembunyi. stock_qty kosong = produk tidak dilacak. */
  const stockReady = () => Array.isArray(packages) && packages.length > 0 && packages.some(p => 'stock_qty' in p);
  const hasStock = p => p && p.stock_qty !== null && p.stock_qty !== undefined;
  const tracked = () => (Array.isArray(packages) ? packages : []).filter(hasStock);
  const isLow = p => hasStock(p) && p.stock_qty > 0 && p.stock_min !== null && p.stock_min !== undefined && p.stock_qty <= p.stock_min;
  window.kairoShopStock = { ready: () => stockReady(), left: id => { const p = (packages || []).find(x => String(x.id) === String(id)); return hasStock(p) ? num(p.stock_qty) : null; } };

  // Lonceng: stok menipis (sesuai batas minimum user) dan stok habis.
  window.kairoShopStockNotifications = () => {
    if (!stockReady()) return [];
    return tracked().filter(p => p.stock_qty <= 0 || isLow(p)).map(p => ({
      id: `stock:${p.id}:${p.stock_qty}`, name: p.name, pkg: p.stock_qty <= 0 ? 'Stok habis' : 'Stok menipis',
      note: p.stock_qty <= 0 ? 'Habis' : `Sisa ${p.stock_qty}`, urgent: p.stock_qty <= 0
    })).sort((a, b) => Number(b.urgent) - Number(a.urgent));
  };
  const refreshBell = () => { try { window.kairoNotifications?.refresh?.(); } catch (_e) { /* lonceng belum siap */ } };

  // Toast saat stok baru saja melewati batas minimum / habis (misalnya setelah order disimpan).
  const lastQty = new Map();
  function watchStockLevels() {
    if (!stockReady()) return;
    const warn = [];
    tracked().forEach(p => {
      const prev = lastQty.get(String(p.id));
      if (prev !== undefined && prev > p.stock_qty) {
        if (p.stock_qty <= 0) warn.push(`${p.name} habis`);
        else if (isLow(p) && !(prev > 0 && prev <= num(p.stock_min))) warn.push(`${p.name} menipis (sisa ${p.stock_qty})`);
      }
      lastQty.set(String(p.id), p.stock_qty);
    });
    if (warn.length) showToast('Stok: ' + warn.join(', '), 'warning');
    refreshBell();
  }

  function mountStockSettings() {
    const panel = document.querySelector('.settings-category-panel[data-settings-panel="packages"]');
    const old = document.getElementById('shop-stock-settings');
    if (!panel || !stockReady()) { if (old) old.hidden = true; return; }
    let card = old;
    if (!card) {
      card = document.createElement('div');
      card.className = 'card settings-master-card';
      card.id = 'shop-stock-settings';
      card.innerHTML = '<div class="settings-master-head"><div><div class="card-title">Stok Produk</div><div class="page-sub">Kosongkan stok jika produk tidak dilacak.</div></div></div><div id="shop-stock-rows" class="shop-stock-rows"></div>';
      panel.appendChild(card);
      card.addEventListener('click', async e => {
        const btn = e.target.closest('[data-shop-stock-save]');
        if (!btn) return;
        const row = btn.closest('.shop-stock-row');
        const read = sel => { const v = row.querySelector(sel).value.trim(); return v === '' ? null : Math.round(Number(v)); };
        const qty = read('.shop-stock-qty'), min = read('.shop-stock-min');
        if ((qty !== null && !Number.isFinite(qty)) || (min !== null && (!Number.isFinite(min) || min < 0))) { showToast('Isi stok dengan angka.', true); return; }
        const orig = btn.textContent; window.kairoBtnLoading(btn, true, undefined, 'Menyimpan…');
        try {
          const { error } = await db.from('package_masters').update({ stock_qty: qty, stock_min: min }).eq('workspace_id', requireWorkspaceId()).eq('id', row.dataset.id);
          if (error) throw error;
          lastQty.clear();
          await loadMasters();
          showToast('Stok disimpan.');
        } catch (err) { showToast(window.kairoFriendlyError(err.message, 'menyimpan stok') || 'Gagal menyimpan stok.', true); }
        finally { window.kairoBtnLoading(btn, false, orig); }
      });
    }
    card.hidden = false;
    const sig = packages.map(p => `${p.id}|${p.name}|${p.stock_qty}|${p.stock_min}`).join(';');
    if (card.dataset.sig === sig) return;
    card.dataset.sig = sig;
    document.getElementById('shop-stock-rows').innerHTML = `<div class="shop-stock-row shop-stock-head"><span>Produk</span><span>Stok</span><span>Batas menipis</span><span></span></div>` + packages.map(p => `<div class="shop-stock-row" data-id="${esc(p.id)}"><strong>${esc(p.name)}</strong><input class="input shop-stock-qty" type="number" step="1" inputmode="numeric" placeholder="Tidak dilacak" value="${p.stock_qty ?? ''}" aria-label="Stok ${esc(p.name)}"><input class="input shop-stock-min" type="number" min="0" step="1" inputmode="numeric" placeholder="-" value="${p.stock_min ?? ''}" aria-label="Batas menipis ${esc(p.name)}"><button type="button" class="btn btn-light" data-shop-stock-save>Simpan</button></div>`).join('');
  }

  // Orders: "Sisa N" di samping harga produk.
  function decorateOrderStock() {
    if (!stockReady()) return;
    document.querySelectorAll('#tx-packages .master-item').forEach(item => {
      const id = item.dataset.id || item.querySelector('.package-check')?.dataset.id;
      const p = packages.find(x => String(x.id) === String(id));
      const small = item.querySelector('.master-main small');
      if (!p || !small) return;
      let tag = item.querySelector('.shop-stock-tag');
      if (!hasStock(p)) { tag?.remove(); item.classList.remove('is-soldout'); return; }
      if (!tag) { tag = document.createElement('span'); tag.className = 'shop-stock-tag'; small.insertAdjacentElement('afterend', tag); }
      const text = p.stock_qty <= 0 ? 'Habis' : `Sisa ${p.stock_qty}`;
      if (tag.textContent !== text) tag.textContent = text;
      tag.classList.toggle('is-low', p.stock_qty <= 0 || isLow(p));
      item.classList.toggle('is-soldout', p.stock_qty <= 0);
    });
  }
  // Kartu produk dengan stok 0 tidak bisa ditambahkan ke order.
  // Klik kartu produk: stok habis atau sudah mencapai sisa stok = ditolak (tidak bisa melebihi stok).
  document.getElementById('tx-packages')?.addEventListener('click', e => {
    const card = e.target.closest('.pick-card');
    if (!card || !stockReady() || e.target.closest('.pick-minus')) return;
    const p = packages.find(x => String(x.id) === String(card.dataset.id));
    if (!hasStock(p)) return;
    const on = document.querySelector(`.package-check[data-id="${card.dataset.id}"]`)?.checked;
    const q = on ? num(document.querySelector(`.package-qty[data-id="${card.dataset.id}"]`)?.value || 1) : 0;
    if (p.stock_qty <= 0) { e.stopImmediatePropagation(); e.stopPropagation(); showToast(`Stok ${p.name} habis.`, true); }
    else if (q + 1 > p.stock_qty) { e.stopImmediatePropagation(); e.stopPropagation(); showToast(`Stok ${p.name} hanya sisa ${p.stock_qty}.`, true); }
  }, true);
  // Stok habis atau qty melebihi sisa stok = order diblokir (juga bila qty datang dari Autofill).
  document.addEventListener('submit', e => {
    if (e.target?.id !== 'tx-form' || !stockReady()) return;
    const empty = [], over = [];
    document.querySelectorAll('.package-check:checked').forEach(c => {
      const p = packages.find(x => String(x.id) === String(c.dataset.id));
      const q = num(document.querySelector(`.package-qty[data-id="${c.dataset.id}"]`)?.value || 1);
      if (!hasStock(p)) return;
      if (p.stock_qty <= 0) empty.push(p.name);
      else if (q > p.stock_qty) over.push(`${p.name} (sisa ${p.stock_qty}, order ${q})`);
    });
    if (empty.length || over.length) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      showToast((empty.length ? 'Stok habis: ' + empty.join(', ') + '. ' : '') + (over.length ? 'Stok kurang: ' + over.join(', ') + '. ' : '') + 'Order tidak bisa disimpan.', true);
    }
  }, true);

  // Retur yang belum dikembalikan ke stok: dari order_returns (kind retur, restocked=false).
  async function pendingReturns() {
    if (returnsMissing) return new Map();
    try {
      const { data, error } = await db.from('order_returns').select('id,items').eq('workspace_id', requireWorkspaceId()).eq('kind', 'retur').eq('restocked', false);
      if (error) throw error;
      const map = new Map();
      (data || []).forEach(r => (Array.isArray(r.items) ? r.items : []).forEach(it => {
        if (it?.id === undefined || it?.id === null) return;
        const m = map.get(String(it.id)) || { qty: 0, ids: new Set() };
        m.qty += Math.max(0, num(it.qty || 1)); m.ids.add(r.id); map.set(String(it.id), m);
      }));
      return map;
    } catch (_e) { return new Map(); }
  }

  async function restockReturn(productId) {
    const pend = (await pendingReturns()).get(String(productId));
    if (!pend || !pend.qty) { renderDashStock(); return; }
    const p = packages.find(x => String(x.id) === String(productId));
    if (!hasStock(p)) return;
    try {
      const wid = requireWorkspaceId();
      const { error } = await db.from('package_masters').update({ stock_qty: num(p.stock_qty) + pend.qty }).eq('workspace_id', wid).eq('id', productId);
      if (error) throw error;
      const { error: e2 } = await db.from('order_returns').update({ restocked: true }).eq('workspace_id', wid).in('id', [...pend.ids]);
      if (e2) throw e2;
      lastQty.clear();
      await loadMasters();
      showToast(`${pend.qty} ${p.name} dikembalikan ke stok.`);
    } catch (err) { showToast(err.message || 'Gagal mengembalikan stok.', true); }
  }

  // Data stok per produk (sisa hari dari penjualan 30 hari); dipakai kartu Performance dan tabel Dashboard.
  async function stockData() {
    const list = tracked();
    if (!stockReady() || !list.length) return null;
    let rows = [], pend = new Map();
    try { rows = typeof allTransactions === 'function' ? await allTransactions() : []; } catch (_e) { rows = []; }
    pend = await pendingReturns();
    const since = new Date(); since.setDate(since.getDate() - 29);
    const sinceISO = typeof localISODate === 'function' ? localISODate(since) : since.toISOString().slice(0, 10);
    const sold = new Map();
    rows.filter(t => !isRollup(t) && String(t.transaction_date || '') >= sinceISO).forEach(t => {
      (Array.isArray(t.order_items) ? t.order_items : []).forEach(x => { const k = String(x?.id ?? ''); sold.set(k, (sold.get(k) || 0) + Math.max(0, num(x?.qty || 1))); });
    });
    return list.map(p => {
      const stock = num(p.stock_qty), min = p.stock_min === null || p.stock_min === undefined ? null : num(p.stock_min);
      const s30 = sold.get(String(p.id)) || 0, perDay = s30 / 30, days = perDay > 0 ? stock / perDay : null;
      let status = 'Aman', tone = 'ok';
      if (stock <= 0) { status = 'Habis'; tone = 'bad'; }
      else if ((min !== null && stock <= min) || (days !== null && days <= 7)) { status = 'Menipis'; tone = 'warn'; }
      else if (s30 === 0) { status = 'Tidak laku'; tone = 'muted'; }
      return { id: p.id, name: p.name, stock, s30, days, value: Math.max(0, stock) * num(p.cost_price), status, tone, retur: pend.get(String(p.id))?.qty || 0 };
    });
  }
  const stockOrder = { bad: 0, warn: 1, ok: 2, muted: 3 };
  const sortStock = data => [...data].sort((a, b) => (stockOrder[a.tone] - stockOrder[b.tone]) || ((a.days ?? 1e9) - (b.days ?? 1e9)));
  const restockBtn = d => d.retur ? `<button type="button" class="shop-restock" data-shop-restock="${esc(d.id)}" title="Kembalikan ${d.retur} ke stok">+${d.retur} ke stok</button>` : '';

  /* ---------- Dashboard: tabel Stok Produk menggantikan Riwayat Open Store ---------- */
  let dashSeq = 0;
  async function renderDashStock() {
    const shift = document.querySelector('#dashboard > .shift-card');
    if (!shift) return;
    let panel = document.getElementById('shop-dash-stock');
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'shop-dash-stock'; panel.className = 'shop-dash-stock';
      panel.innerHTML = '<div class="shop-dash-head"><div class="card-title">Stok Produk</div><span id="shop-dash-count"></span></div><div class="table-wrap"><table><thead id="shop-dash-head"></thead><tbody id="shop-dash-body"></tbody></table></div>';
      shift.appendChild(panel);
    }
    const seq = ++dashSeq;
    const data = await stockData();
    if (seq !== dashSeq) return;
    const head = document.getElementById('shop-dash-head'), body = document.getElementById('shop-dash-body'), count = document.getElementById('shop-dash-count');
    if (!data) {
      count.textContent = '';
      head.innerHTML = '';
      body.innerHTML = '<tr><td class="empty">Isi stok produk di Settings › Produk &amp; Harga supaya stok terpantau di sini.</td></tr>';
      return;
    }
    const showRetur = data.some(d => d.retur > 0), low = data.filter(d => d.tone === 'bad' || d.tone === 'warn').length;
    count.textContent = low ? `${low} perlu perhatian` : '';
    head.innerHTML = `<tr><th>Produk</th><th>Stok</th><th class="c-days">Sisa hari</th>${showRetur ? '<th>Retur</th>' : ''}<th>Status</th></tr>`;
    body.innerHTML = sortStock(data).map(d => `<tr class="tone-${d.tone}"><td><strong>${esc(d.name)}</strong></td><td><b>${d.stock.toLocaleString('id-ID')}</b></td><td class="c-days">${d.days === null ? '-' : Math.floor(d.days).toLocaleString('id-ID')}</td>${showRetur ? `<td>${restockBtn(d)}</td>` : ''}<td><span class="shop-status tone-${d.tone}">${esc(d.status)}</span></td></tr>`).join('');
  }
  document.addEventListener('click', e => { const b = e.target.closest?.('[data-shop-restock]'); if (b) { b.disabled = true; restockReturn(b.dataset.shopRestock).finally(() => { b.disabled = false; }); } });

  /* ---------- Pasang ---------- */
  function wrap(name, after) {
    const core = window[name];
    if (typeof core !== 'function' || core.__shop) return;
    const w = function () { const r = core.apply(this, arguments); try { after(); } catch (e) { console.warn('online-shop', e); } return r; };
    w.__shop = true;
    window[name] = w;
  }
  function install() {
    installPlatformLogo();
    installDelete();
    wrap('renderDashboard', () => { renderShopDashboardKpi(); renderDashStock(); });
    wrap('renderPerformanceKpis', renderPerformanceExtras);
    wrap('applyTopicFieldLabel', () => { syncPlatformSelect(); syncPaymentSelect(); });
    mountPlatformSettings();
    mountPaymentSettings();
    syncPlatformSelect();
    syncPaymentSelect();
    wrap('renderMasterOptions', () => { decorateOrderStock(); watchStockLevels(); renderDashStock(); });
    wrap('renderSettingsMasterData', mountStockSettings);
    mountStockSettings();
    decorateOrderStock();
    renderShopDashboardKpi();
    renderDashStock();
    if (document.getElementById('product-sales-card')) renderPerformanceExtras();
  }
  install();
  document.addEventListener('kairo:refreshed', () => { syncPlatformSelect(); syncPaymentSelect(); });
  // Opsi channel dibangun ulang bila form Orders digambar ulang / branding dimuat ulang.
  new MutationObserver(() => { syncPlatformSelect(); syncPaymentSelect(); }).observe(document.getElementById('tx-form') || document.body, { childList: true, subtree: true });
})();
