/* KAIRO - Kasir / POS: Dashboard Kasir di atas kerangka tampilan dasar.
   Dimuat HANYA untuk workspace dengan business_template=pos_kasir (loader di kairo-app.js).
   Isi (tahap 1, Dashboard): kartu Profit + Rata-rata per Struk, Sesi Kasir (memakai Open/Close Store lama), Penjualan per Jam,
   Produk Terlaris, Metode Pembayaran + Tipe Pesanan. Layar Kasir, Sesi Kasir lengkap (modal awal/selisih), stok menyusul.
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

  function refresh() { renderKpis(); relabelShift(); renderPanels(); }

  /* ---------- Pasang ---------- */
  function wrap(name, after) {
    const core = window[name];
    if (typeof core !== 'function' || core.__pos) return;
    const w = function () { const r = core.apply(this, arguments); try { after(); } catch (e) { console.warn('pos-kasir', e); } return r; };
    w.__pos = true;
    window[name] = w;
  }
  wrap('renderDashboard', refresh);
  refresh();
  // Warna grafik ikut tema / mode gelap.
  let lastLook = '';
  const look = () => (document.documentElement.dataset.wsTheme || '') + '|' + document.body.classList.contains('saas-dark');
  lastLook = look();
  const onLook = () => { const now = look(); if (now !== lastLook) { lastLook = now; setTimeout(renderPanels, 150); } };
  new MutationObserver(onLook).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ws-theme'] });
  new MutationObserver(onLook).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
