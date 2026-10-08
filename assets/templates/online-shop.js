/* KAIRO - Online Shop (produk fisik): analitik toko di atas kerangka tampilan dasar.
   Dimuat HANYA untuk workspace dengan business_template=online_shop (loader di kairo-app.js).
   Isi: kartu Profit di Dashboard, Performance (Laba per Produk, Analisis Channel, Batal & Retur),
   daftar Channel Penjualan yang bisa diatur (Settings), dialog Batal/Retur saat hapus order.
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
    const html = '<option value="">-- Pilih Channel --</option>' + list.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    if (sel.dataset.shopOptions === html) return;
    sel.innerHTML = html;
    sel.dataset.shopOptions = html;
    sel.value = cur;
  }

  let draftPlatforms = null;
  function renderPlatformChips() {
    const box = document.getElementById('shop-platform-chips');
    if (!box) return;
    box.innerHTML = draftPlatforms.map((p, i) => `<span class="shop-chip">${esc(p)}<button type="button" data-shop-chip-del="${i}" aria-label="Hapus ${esc(p)}">×</button></span>`).join('') || '<span class="shop-muted">Belum ada channel.</span>';
  }
  function mountPlatformSettings() {
    if (document.getElementById('shop-platform-card')) return;
    const topicCard = document.getElementById('settings-topic-card');
    if (!topicCard) return;
    const card = document.createElement('div');
    card.className = 'card settings-master-card';
    card.id = 'shop-platform-card';
    card.innerHTML = `<div class="settings-master-head"><div><div class="card-title">Channel Penjualan</div><div class="page-sub">Pilihan asal order di menu Orders dan dasar grafik channel di Performance. Contoh: Shopee, Tokopedia, WhatsApp, Toko Offline.</div></div></div>
      <div id="shop-platform-chips" class="shop-chips"></div>
      <div class="shop-platform-add"><input class="input" id="shop-platform-input" maxlength="30" placeholder="Nama channel baru"><button type="button" class="btn btn-light" id="shop-platform-add">Tambah</button></div>
      <div class="shop-platform-actions"><button type="button" class="btn btn-green" id="shop-platform-save">Simpan Channel</button><button type="button" class="btn btn-light" id="shop-platform-reset">Kembalikan Bawaan</button></div>`;
    (topicCard.closest('.settings-category-panel') || topicCard.parentNode).appendChild(card);
    draftPlatforms = platformList();
    renderPlatformChips();
    const input = card.querySelector('#shop-platform-input');
    const add = () => {
      const v = input.value.trim();
      if (!v) return;
      if (draftPlatforms.some(x => x.toLowerCase() === v.toLowerCase())) { showToast('Channel itu sudah ada.', 'warning'); return; }
      draftPlatforms.push(v); input.value = ''; renderPlatformChips();
    };
    card.addEventListener('click', async e => {
      const del = e.target.closest('[data-shop-chip-del]');
      if (del) { draftPlatforms.splice(Number(del.dataset.shopChipDel), 1); renderPlatformChips(); return; }
      if (e.target.closest('#shop-platform-add')) { add(); return; }
      if (e.target.closest('#shop-platform-reset')) { draftPlatforms = DEFAULT_PLATFORMS.slice(); renderPlatformChips(); return; }
      if (e.target.closest('#shop-platform-save')) {
        try {
          if (!draftPlatforms.length) throw new Error('Isi minimal satu channel.');
          const wid = requireWorkspaceId();
          const labels = { ...(activeWorkspaceBranding?.receipt_labels || {}), __platforms: draftPlatforms };
          const { error } = await db.from('workspace_branding').upsert({ workspace_id: wid, receipt_labels: labels, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
          if (error) throw error;
          await loadWorkspaceSaasContext();
          syncPlatformSelect();
          showToast('Channel penjualan disimpan.');
        } catch (err) { showToast(err.message || 'Gagal menyimpan channel.', true); }
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
  const profitOf = t => Math.max(-1e12, num(t?.total_price) - transactionProfitBreakdown(t).hpp);
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
        ${cardHead('Performa Channel', 'Omzet per channel, laba sebelum komisi channel', 'channel')}
        <div class="chart-wrap shop-chart"><canvas id="shop-channel-chart"></canvas></div>
        <div class="shop-data" id="shop-channel-data" hidden>
          <div class="table-wrap"><table><thead><tr><th>Channel</th><th>Order</th><th>Omzet</th><th>Laba</th><th>Margin</th><th>Rata-rata/order</th><th>Porsi omzet</th></tr></thead><tbody id="shop-channel-table"></tbody></table></div>
        </div>
      </div>
      <div class="card shop-card" id="shop-stock-card" hidden>
        ${cardHead('Stok Produk', '', 'stock', false)}
        <div class="shop-tiles" id="shop-stock-tiles"></div>
        <div class="table-wrap shop-stock-table-wrap"><table class="shop-stock-table"><thead id="shop-stock-head"></thead><tbody id="shop-stock-table"></tbody></table></div>
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
    const map = new Map();
    rowsInRange().forEach(t => {
      const k = t.platform ? (typeof platformKey === 'function' ? platformKey(t.platform) : t.platform) : 'Tanpa channel';
      const r = map.get(k) || { name: k, orders: 0, revenue: 0, profit: 0 };
      r.orders++; r.revenue += num(t.total_price); r.profit += profitOf(t);
      map.set(k, r);
    });
    const list = [...map.values()].sort((a, b) => b.revenue - a.revenue);
    const totalRev = list.reduce((s, r) => s + r.revenue, 0);
    body.innerHTML = list.length ? list.map(r => `<tr><td><span class="shop-channel-name">${typeof platformLogo === 'function' ? platformLogo(r.name) : ''}<strong>${esc(r.name)}</strong></span></td><td>${r.orders.toLocaleString('id-ID')}</td><td>${money(r.revenue)}</td><td><strong class="${r.profit < 0 ? 'shop-neg' : ''}">${money(r.profit)}</strong></td><td>${pct(r.profit, r.revenue, 1)}</td><td>${money(r.orders ? r.revenue / r.orders : 0)}</td><td>${pct(r.revenue, totalRev)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">Belum ada penjualan pada periode ini.</td></tr>';
    const rows = topRows(list, 5, rest => ({ name: 'Lainnya', other: true, orders: rest.reduce((s, x) => s + x.orders, 0), revenue: rest.reduce((s, x) => s + x.revenue, 0), profit: rest.reduce((s, x) => s + x.profit, 0) }));
    drawBars('shop-channel-chart', rows.map(r => ({
      label: r.name, value: r.revenue, other: r.other,
      tip: [`Omzet ${money(r.revenue)} (${pct(r.revenue, totalRev)})`, `Laba ${money(r.profit)} · margin ${pct(r.profit, r.revenue, 1)}`, `${r.orders} order`]
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
    renderStockCard();
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
    lookTimer = setTimeout(() => { if (document.getElementById('shop-analytics')) { renderProfitCard(); renderChannelCard(); renderStockCard(); if (!returnsMissing) renderReturnsCard(); } }, 150);
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
        btn.disabled = true;
        try {
          const { error } = await db.from('package_masters').update({ stock_qty: qty, stock_min: min }).eq('workspace_id', requireWorkspaceId()).eq('id', row.dataset.id);
          if (error) throw error;
          lastQty.clear();
          await loadMasters();
          showToast('Stok disimpan.');
        } catch (err) { showToast(err.message || 'Gagal menyimpan stok.', true); }
        finally { btn.disabled = false; }
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
  document.getElementById('tx-packages')?.addEventListener('click', e => {
    const card = e.target.closest('.pick-card');
    if (!card || !stockReady() || e.target.closest('.pick-minus')) return;
    const p = packages.find(x => String(x.id) === String(card.dataset.id));
    if (hasStock(p) && p.stock_qty <= 0) { e.stopImmediatePropagation(); e.stopPropagation(); showToast(`Stok ${p.name} habis.`, true); }
  }, true);
  // Stok 0 = order diblokir. Qty melebihi sisa stok hanya diberi peringatan.
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
    if (empty.length) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      showToast('Stok habis: ' + empty.join(', ') + '. Order tidak bisa disimpan.', true);
      return;
    }
    if (over.length) showToast('Stok kurang: ' + over.join(', ') + '. Stok akan minus.', 'warning');
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
    if (!pend || !pend.qty) { renderStockCard(); return; }
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

  let stockSeq = 0;
  async function renderStockCard() {
    const card = document.getElementById('shop-stock-card');
    if (!card) return;
    const list = tracked();
    if (!stockReady() || !list.length) { card.hidden = true; return; }
    const seq = ++stockSeq;
    let rows = [], pend = new Map();
    try { rows = typeof allTransactions === 'function' ? await allTransactions() : []; } catch (_e) { rows = []; }
    pend = await pendingReturns();
    if (seq !== stockSeq) return;
    const since = new Date(); since.setDate(since.getDate() - 29);
    const sinceISO = typeof localISODate === 'function' ? localISODate(since) : since.toISOString().slice(0, 10);
    const sold = new Map();
    rows.filter(t => !isRollup(t) && String(t.transaction_date || '') >= sinceISO).forEach(t => {
      (Array.isArray(t.order_items) ? t.order_items : []).forEach(x => { const k = String(x?.id ?? ''); sold.set(k, (sold.get(k) || 0) + Math.max(0, num(x?.qty || 1))); });
    });
    const data = list.map(p => {
      const stock = num(p.stock_qty), min = p.stock_min === null || p.stock_min === undefined ? null : num(p.stock_min);
      const s30 = sold.get(String(p.id)) || 0, perDay = s30 / 30, days = perDay > 0 ? stock / perDay : null;
      let status = 'Aman', tone = 'ok';
      if (stock <= 0) { status = 'Habis'; tone = 'bad'; }
      else if ((min !== null && stock <= min) || (days !== null && days <= 7)) { status = 'Menipis'; tone = 'warn'; }
      else if (s30 === 0) { status = 'Tidak laku'; tone = 'muted'; }
      return { id: p.id, name: p.name, stock, s30, days, value: Math.max(0, stock) * num(p.cost_price), status, tone, retur: pend.get(String(p.id))?.qty || 0 };
    });
    const nLow = data.filter(d => d.tone === 'warn').length, nOut = data.filter(d => d.tone === 'bad').length;
    card.hidden = false;
    document.getElementById('shop-stock-tiles').innerHTML = [tile('Produk Dilacak', data.length), tile('Stok Menipis', nLow), tile('Stok Habis', nOut), tile('Nilai Stok', money(data.reduce((s, d) => s + d.value, 0)))].join('');
    const order = { bad: 0, warn: 1, ok: 2, muted: 3 };
    const sorted = [...data].sort((a, b) => (order[a.tone] - order[b.tone]) || ((a.days ?? 1e9) - (b.days ?? 1e9)));
    const maxStock = Math.max(1, ...data.map(d => d.stock));
    const showRetur = data.some(d => d.retur > 0);
    document.getElementById('shop-stock-head').innerHTML = `<tr><th>Produk</th><th>Stok</th><th>Terjual 30 hari</th><th>Sisa hari</th><th>Nilai stok</th>${showRetur ? '<th>Retur</th>' : ''}<th>Status</th></tr>`;
    document.getElementById('shop-stock-table').innerHTML = sorted.map(d => `<tr class="tone-${d.tone}"><td><strong>${esc(d.name)}</strong></td><td><span class="shop-level"><b>${d.stock.toLocaleString('id-ID')}</b><i><u style="width:${Math.max(d.stock > 0 ? 6 : 0, d.stock / maxStock * 100)}%"></u></i></span></td><td>${d.s30.toLocaleString('id-ID')}</td><td>${d.days === null ? '-' : Math.floor(d.days).toLocaleString('id-ID')}</td><td>${money(d.value)}</td>${showRetur ? `<td>${d.retur ? `<button type="button" class="shop-restock" data-shop-restock="${esc(d.id)}" title="Kembalikan ${d.retur} ke stok">+${d.retur} ke stok</button>` : ''}</td>` : ''}<td><span class="shop-status tone-${d.tone}">${esc(d.status)}</span></td></tr>`).join('');
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
    wrap('renderDashboard', renderShopDashboardKpi);
    wrap('renderPerformanceKpis', renderPerformanceExtras);
    wrap('applyTopicFieldLabel', syncPlatformSelect);
    mountPlatformSettings();
    syncPlatformSelect();
    wrap('renderMasterOptions', () => { decorateOrderStock(); watchStockLevels(); if (document.getElementById('shop-analytics')) renderStockCard(); });
    wrap('renderSettingsMasterData', mountStockSettings);
    mountStockSettings();
    decorateOrderStock();
    renderShopDashboardKpi();
    if (document.getElementById('product-sales-card')) renderPerformanceExtras();
  }
  install();
  document.addEventListener('kairo:refreshed', syncPlatformSelect);
  // Opsi channel dibangun ulang bila form Orders digambar ulang / branding dimuat ulang.
  new MutationObserver(() => syncPlatformSelect()).observe(document.getElementById('tx-form') || document.body, { childList: true, subtree: true });
})();
