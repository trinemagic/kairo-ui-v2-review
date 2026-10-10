/* KAIRO - Kasir / POS: halaman Produk (tambah produk + foto, harga, modal, stok, pembagian untung).
   Dimuat HANYA untuk workspace pos_kasir (loader di kairo-app.js), setelah pos-kasir.js.
   Satu tempat untuk semua urusan produk, dibuat sesederhana mungkin (ramah orang tua): kartu produk besar, lembar isian bertahap.
   Menyimpan ke package_masters (foto: kolom image_url + Storage workspace-branding/<workspace>/products/). Tambahan = addon_masters. */
(function () {
  'use strict';
  if (window.__kairoPosProduk) return;
  window.__kairoPosProduk = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const money = n => (typeof rupiah === 'function' ? rupiah(Math.round(num(n))) : 'Rp' + Math.round(num(n)).toLocaleString('id-ID'));
  const digits = v => String(v ?? '').replace(/[^\d]/g, '');
  const fmtIn = v => { const n = Number(digits(v)); return n ? n.toLocaleString('id-ID') : ''; };
  const BUCKET = 'workspace-branding';
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9"/></svg>';
  const PLACEHOLDER = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10.5" r="1.6"/><path d="m4 17 5-4.5 3.5 3L15 13l5 4.5"/></svg>';

  const UNITS = ['pcs', 'porsi', 'potong', 'gelas', 'bungkus', 'box'];
  let kind = 'package';          // package | addon
  let filter = 'all';            // all | low | out
  let query = '';
  let draft = null;              // produk yang sedang diisi di lembar
  let photoBlob = null;          // foto baru (sudah dikompres) yang belum diunggah

  const list = () => (kind === 'addon' ? addons : packages) || [];
  const active = () => list().filter(x => x && x.is_active !== false);
  const tracked = p => p && p.stock_qty !== null && p.stock_qty !== undefined;
  const lowAt = p => (p.stock_min === null || p.stock_min === undefined ? 5 : num(p.stock_min));
  const stockState = p => (!tracked(p) ? 'none' : num(p.stock_qty) <= 0 ? 'out' : num(p.stock_qty) <= lowAt(p) ? 'low' : 'ok');
  const wid = () => requireWorkspaceId();
  const initials = n => { const w = String(n || '?').trim().split(/\s+/); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase(); };
  const hue = n => { let h = 0; for (const c of String(n || '')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

  /* ---------- Halaman + menu ---------- */
  function ensurePage() {
    if (document.getElementById('pos-products')) return;
    const main = document.querySelector('main.container');
    if (!main) return;
    const s = document.createElement('section');
    s.id = 'pos-products'; s.className = 'section';
    s.innerHTML = `<div class="pp-top">
        <div class="pp-seg" role="tablist"><button type="button" class="on" data-kind="package">Produk</button><button type="button" data-kind="addon">Tambahan</button></div>
        <button type="button" class="btn btn-green pp-add" id="pp-add">＋ Tambah <span id="pp-add-word">Produk</span></button>
      </div>
      <div class="pp-tools"><input class="input pp-search" id="pp-search" placeholder="Cari nama atau kode…" autocomplete="off">
        <div class="pp-chips" id="pp-chips"><button type="button" class="on" data-f="all">Semua</button><button type="button" data-f="low">Menipis</button><button type="button" data-f="out">Habis</button></div></div>
      <div id="pp-grid" class="pp-grid"></div>`;
    main.appendChild(s);
    s.addEventListener('click', onPageClick);
    s.querySelector('#pp-search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderGrid(); });
  }
  function ensureNav() {
    const nav = document.querySelector('#saas-sidebar .saas-sidebar-nav');
    if (nav && !nav.querySelector('[data-tab="pos-products"]')) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tab'; b.dataset.tab = 'pos-products';
      b.innerHTML = `<span class="saas-nav-icon">${ICON}</span><span class="saas-nav-label">Produk</span>`;
      b.addEventListener('click', openPage);
      const after = nav.querySelector('[data-tab="input"]');
      if (after) after.insertAdjacentElement('afterend', b); else nav.appendChild(b);
    }
    const grid = document.querySelector('#kairo-mobile-more-sheet .kairo-mobile-more-grid');
    if (grid && !grid.querySelector('[data-mobile-tab="pos-products"]')) {
      const m = document.createElement('button');
      m.type = 'button'; m.className = 'saas-mobile-nav-btn kairo-mobile-more-item'; m.dataset.mobileTab = 'pos-products';
      m.innerHTML = `<span>${ICON}</span><span>Produk</span>`;
      m.addEventListener('click', () => { document.querySelector('#kairo-mobile-more-sheet .kairo-mobile-more-backdrop')?.click(); openPage(); });
      grid.prepend(m);
    }
  }
  function openPage() {
    ensurePage();
    if (typeof openAppPage === 'function') openAppPage('pos-products');
    setText(document.querySelector('main.container .page-title'), 'Produk');
    setText(document.querySelector('main.container .page-sub'), 'Tambah produk, foto, harga, modal, dan stok di satu tempat.');
    renderGrid();
  }
  const setText = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };

  /* ---------- Daftar ---------- */
  function renderGrid() {
    const box = document.getElementById('pp-grid');
    if (!box) return;
    document.getElementById('pp-add-word').textContent = kind === 'addon' ? 'Tambahan' : 'Produk';
    document.getElementById('pp-chips').hidden = kind === 'addon';
    document.querySelectorAll('#pos-products .pp-seg button').forEach(b => b.classList.toggle('on', b.dataset.kind === kind));
    document.querySelectorAll('#pp-chips button').forEach(b => b.classList.toggle('on', b.dataset.f === filter));
    let rows = active();
    if (kind === 'package' && filter !== 'all') rows = rows.filter(p => stockState(p) === filter);
    if (query) rows = rows.filter(p => String(p.name || '').toLowerCase().includes(query) || String(p.code || '').toLowerCase().includes(query));
    rows = rows.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id'));
    if (!rows.length) {
      box.innerHTML = `<div class="pp-empty">${active().length ? 'Tidak ada yang cocok.' : `Belum ada ${kind === 'addon' ? 'tambahan' : 'produk'}. Tekan tombol hijau di atas untuk mulai.`}</div>`;
      return;
    }
    box.innerHTML = rows.map(p => {
      const profit = num(p.price) - num(p.cost_price), st = stockState(p);
      const badge = st === 'none' ? '' : `<span class="pp-badge is-${st}">${st === 'out' ? 'Habis' : st === 'low' ? 'Menipis · ' + p.stock_qty : 'Stok ' + p.stock_qty + (p.unit ? ' ' + p.unit : '')}</span>`;
      const img = p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : `<span class="pp-ph pp-initial" style="--h:${hue(p.name)}">${esc(initials(p.name))}</span>`;
      return `<button type="button" class="pp-card" data-id="${esc(p.id)}"><span class="pp-photo">${img}${badge}</span><b class="pp-name">${esc(p.name)}</b>${p.category || p.unit ? `<small class="pp-sub">${esc([p.category, p.unit].filter(Boolean).join(' · '))}</small>` : ''}<span class="pp-price">${money(p.price)}</span><span class="pp-profit ${profit < 0 ? 'is-neg' : ''}">Untung ${money(profit)}</span></button>`;
    }).join('');
  }
  function onPageClick(e) {
    const seg = e.target.closest('.pp-seg button'); if (seg) { kind = seg.dataset.kind; filter = 'all'; renderGrid(); return; }
    const chip = e.target.closest('#pp-chips button'); if (chip) { filter = chip.dataset.f; renderGrid(); return; }
    if (e.target.closest('#pp-add')) { openSheet(null); return; }
    const card = e.target.closest('.pp-card'); if (card) openSheet(list().find(x => String(x.id) === card.dataset.id));
  }

  /* ---------- Pembagian untung ---------- */
  const splitPartners = () => (typeof profitManualPartners === 'function' ? profitManualPartners() : []).filter(p => p && p.partner_name);
  function globalPct(p) {
    try { const v = Number(shareRuleFor(p, new Date().toISOString().slice(0, 10))); return Number.isFinite(v) ? Math.round(v * 1000) / 10 : 0; } catch (_e) { return 0; }
  }
  function initialSplit(item) {
    const parts = splitPartners(), saved = Array.isArray(item?.manual_profit_split) ? item.manual_profit_split : [];
    const net = Math.max(0, num(item?.price) - num(item?.cost_price));
    const custom = String(item?.profit_share_mode || 'percentage') === 'manual' && saved.length;
    const pcts = parts.map(p => {
      const r = saved.find(x => (x.partner_id && p.id && String(x.partner_id) === String(p.id)) || String(x.partner_name || '').toLowerCase() === String(p.partner_name || '').toLowerCase());
      if (!custom) return 0;
      if (r && r.pct !== undefined && r.pct !== null) return num(r.pct);
      return r && net > 0 ? Math.round(num(r.amount) / net * 1000) / 10 : 0;
    });
    return { custom: !!custom, pcts };
  }

  /* ---------- Lembar isian ---------- */
  function openSheet(item) {
    const isNew = !item;
    photoBlob = null;
    draft = {
      id: item?.id || null, name: item?.name || '', code: item?.code || '', category: item?.category || '', unit: item?.unit || (kind === 'package' ? 'pcs' : ''),
      price: num(item?.price), cost: num(item?.cost_price), image: item?.image_url || '',
      track: tracked(item), qty: tracked(item) ? num(item.stock_qty) : 0, min: item?.stock_min === null || item?.stock_min === undefined ? 5 : num(item.stock_min),
      ...initialSplit(item), isNew
    };
    const word = kind === 'addon' ? 'tambahan' : 'produk';
    let ov = document.getElementById('pp-sheet');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'pp-sheet'; ov.className = 'pp-overlay';
    const cats = kind === 'package' ? (Array.isArray(topics) ? topics : []).map(t => String(t.name || '').trim()).filter(Boolean) : [];
    ov.innerHTML = `<div class="pp-sheet" role="dialog" aria-modal="true" aria-label="${isNew ? 'Tambah' : 'Ubah'} ${word}">
      <div class="pp-sheet-head"><b>${isNew ? 'Tambah' : 'Ubah'} ${word}</b><button type="button" class="pp-x" data-act="close" aria-label="Tutup">×</button></div>
      <div class="pp-sheet-body">
        <section class="pp-step"><h4><i>1</i>Foto</h4>
          <div class="pp-photo-row"><div class="pp-photo-box" id="pp-photo-box"></div>
            <div class="pp-photo-btns"><button type="button" class="pp-pbtn" id="pp-cam-btn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/></svg>Ambil Foto</button>
              <label class="pp-pbtn is-light"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10.5" r="1.6"/><path d="m4 17 5-4.5 3.5 3L15 13l5 4.5"/></svg>Dari Galeri<input type="file" id="pp-file" accept="image/*" hidden></label>
              <input type="file" id="pp-cam" accept="image/*" capture="environment" hidden></div></div>
          <div class="pp-photo-hint"><small>Boleh dilewati. Foto otomatis dipotong persegi dan dikecilkan. Di komputer, foto juga bisa diseret ke sini.</small></div>
          <button type="button" class="pp-link is-red" id="pp-photo-del" hidden>Hapus foto</button></section>
        <section class="pp-step"><h4><i>2</i>Nama</h4>
          <input class="input pp-big" id="pp-name" maxlength="60" placeholder="${kind === 'addon' ? 'Mis. Extra Shot' : 'Mis. Kopi Susu'}" autocomplete="off">
          ${kind === 'package' ? `<div class="pp-label">Kategori <small>(boleh dikosongkan)</small></div><div class="pp-cats" id="pp-cats">${['', ...cats].map(c => `<button type="button" data-cat="${esc(c)}">${c ? esc(c) : 'Tanpa kategori'}</button>`).join('')}</div>
          <div class="pp-newcat"><input class="input" id="pp-newcat" maxlength="30" placeholder="Kategori baru…"><button type="button" class="btn btn-light" id="pp-newcat-add">Tambah</button></div>` : ''}
          ${kind === 'package' ? `<div class="pp-label">Satuan</div><div class="pp-cats pp-units" id="pp-units">${UNITS.map(u => `<button type="button" data-unit="${u}">${u}</button>`).join('')}</div>` : ''}
          <details class="pp-more"><summary>Kode / barcode (opsional)</summary><input class="input" id="pp-code" maxlength="40" placeholder="Kosong = dibuat otomatis. Scanner barcode: arahkan lalu scan di sini"></details></section>
        <section class="pp-step"><h4><i>3</i>Harga &amp; modal</h4>
          <div class="pp-two"><div><div class="pp-label">Harga jual</div><input class="input pp-big pp-money" id="pp-price" inputmode="numeric" placeholder="Rp0"></div>
          <div><div class="pp-label">Modal (HPP) <small>harga beli / bahan</small></div><input class="input pp-big pp-money" id="pp-cost" inputmode="numeric" placeholder="Rp0"></div></div>
          <div class="pp-profit-box" id="pp-profit-box"></div></section>
        ${kind === 'package' ? `<section class="pp-step"><h4><i>4</i>Stok</h4>
          <label class="pp-switch"><input type="checkbox" id="pp-track"><span aria-hidden="true"></span><b>Hitung stok produk ini</b></label>
          <div id="pp-stock-body"><div class="pp-label">Stok sekarang</div>
            <div class="pp-stepper"><button type="button" data-q="-1" aria-label="Kurangi">−</button><input class="input pp-big" id="pp-qty" inputmode="numeric"><button type="button" data-q="1" aria-label="Tambah">＋</button></div>
            <div class="pp-quick"><button type="button" data-q="5">+5</button><button type="button" data-q="10">+10</button><button type="button" data-q="50">+50</button></div>
            <div class="pp-label">Ingatkan saya kalau sisa <small>sama atau kurang dari</small></div><input class="input pp-big pp-small" id="pp-min" inputmode="numeric"></div></section>` : ''}
        <section class="pp-step"><h4><i>${kind === 'package' ? 5 : 4}</i>Pembagian untung</h4><div id="pp-split"></div></section>
        <section class="pp-step pp-danger" ${isNew ? 'hidden' : ''}><button type="button" class="pp-link is-red" data-act="delete">Hapus ${word} ini</button></section>
      </div>
      <div class="pp-sheet-foot"><button type="button" class="btn btn-light" data-act="close">Batal</button><button type="button" class="btn btn-green" data-act="save">Simpan</button></div></div>`;
    document.body.appendChild(ov);
    document.documentElement.classList.add('pp-lock');
    const $ = id => ov.querySelector('#' + id);
    $('pp-name').value = draft.name; if ($('pp-code')) { $('pp-code').value = draft.code; if (draft.code) ov.querySelector('.pp-more').open = true; }
    $('pp-price').value = fmtIn(draft.price); $('pp-cost').value = fmtIn(draft.cost);
    if ($('pp-track')) { $('pp-track').checked = draft.track; $('pp-qty').value = draft.qty; $('pp-min').value = draft.min; }
    paintPhoto(); paintCats(); paintUnits(); paintProfit(); paintSplit(); paintStock();
    ov.addEventListener('click', onSheetClick);
    ov.addEventListener('input', onSheetInput);
    ov.addEventListener('change', onSheetChange);
    ov.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); ov.classList.add('is-drop'); } });
    ov.addEventListener('dragleave', e => { if (e.target === ov) ov.classList.remove('is-drop'); });
    ov.addEventListener('drop', e => { ov.classList.remove('is-drop'); const f = e.dataTransfer?.files?.[0]; if (f && /^image\//.test(f.type)) { e.preventDefault(); handleFile(f); } });
    setTimeout(() => { if (isNew) $('pp-name').focus(); }, 60);
  }
  function closeSheet() {
    document.getElementById('pp-sheet')?.remove();
    document.documentElement.classList.remove('pp-lock');
    draft = null; photoBlob = null;
  }
  const S = id => document.getElementById(id);

  function paintPhoto() {
    const box = S('pp-photo-box'); if (!box) return;
    box.innerHTML = draft.image ? `<img src="${esc(draft.image)}" alt="Foto produk">` : PLACEHOLDER;
    S('pp-photo-del').hidden = !draft.image;
  }
  function paintCats() {
    document.querySelectorAll('#pp-cats button').forEach(b => b.classList.toggle('on', b.dataset.cat === (draft.category || '')));
  }
  function paintUnits() {
    document.querySelectorAll('#pp-units button').forEach(b => b.classList.toggle('on', b.dataset.unit === draft.unit));
  }
  function paintProfit() {
    const box = S('pp-profit-box'); if (!box) return;
    const gain = draft.price - draft.cost, pct = draft.price > 0 ? Math.round(gain / draft.price * 100) : 0;
    box.className = 'pp-profit-box' + (draft.price > 0 && gain < 0 ? ' is-neg' : '');
    box.innerHTML = draft.price > 0 ? `<span>Untung per ${kind === 'addon' ? 'tambahan' : 'produk'}</span><b>${money(gain)}</b><small>${gain >= 0 ? pct + '% dari harga jual' : 'Modal lebih besar dari harga jual'}</small>` : '<small>Isi harga jual dan modal, untungnya dihitung otomatis.</small>';
  }
  function paintStock() {
    const body = S('pp-stock-body'); if (!body) return;
    body.hidden = !draft.track;
  }
  function paintSplit() {
    const box = S('pp-split'); if (!box) return;
    const parts = splitPartners();
    if (!parts.length) { box.innerHTML = '<div class="pp-note">Belum ada partner. Seluruh untung masuk ke pemilik.</div>'; return; }
    const net = Math.max(0, draft.price - draft.cost);
    const gl = parts.map(p => `<li><span>${esc(p.partner_name)}</span><b>${globalPct(p)}%</b></li>`).join('');
    const total = draft.pcts.reduce((a, b) => a + num(b), 0);
    box.innerHTML = `<div class="pp-radio"><label class="${draft.custom ? '' : 'on'}"><input type="radio" name="pp-mode" value="auto" ${draft.custom ? '' : 'checked'}><span><b>Ikut aturan umum</b><small>Sama seperti produk lainnya</small></span></label>
      <label class="${draft.custom ? 'on' : ''}"><input type="radio" name="pp-mode" value="custom" ${draft.custom ? 'checked' : ''}><span><b>Atur sendiri untuk produk ini</b><small>Bagi untung sesuai keinginan</small></span></label></div>
      ${draft.custom ? `<div class="pp-presets"><button type="button" data-preset="even">Bagi rata</button>${parts.map((p, i) => `<button type="button" data-preset="only" data-i="${i}">Semua ke ${esc(p.partner_name)}</button>`).join('')}</div>
        <div class="pp-rows">${parts.map((p, i) => `<div class="pp-row"><span>${esc(p.partner_name)}</span><div class="pp-pct"><input class="input" data-pct="${i}" inputmode="decimal" value="${draft.pcts[i] ? String(draft.pcts[i]).replace('.', ',') : ''}" placeholder="0"><em>%</em></div><b class="pp-nom" data-nom="${i}">${money(net * num(draft.pcts[i]) / 100)}</b></div>`).join('')}</div>
        <div class="pp-sum ${total > 100.01 ? 'is-neg' : ''}" id="pp-sum">${sumText(total)}</div>`
      : `<ul class="pp-global">${gl}</ul><div class="pp-note">Untung ${money(net)} dibagi sesuai persen di atas.</div>`}`;
  }
  const sumText = total => (total > 100.01 ? `Total ${fmtPct(total)}% — melebihi 100%` : total < 99.99 ? `Total ${fmtPct(total)}% — sisa ${fmtPct(100 - total)}% ikut aturan umum` : 'Total 100%');
  const fmtPct = v => String(Math.round(v * 10) / 10).replace('.', ',');
  function refreshSplitNumbers() {
    const net = Math.max(0, draft.price - draft.cost);
    document.querySelectorAll('#pp-split [data-nom]').forEach(el => { el.textContent = money(net * num(draft.pcts[Number(el.dataset.nom)]) / 100); });
    const total = draft.pcts.reduce((a, b) => a + num(b), 0), sum = S('pp-sum');
    if (sum) { sum.textContent = sumText(total); sum.classList.toggle('is-neg', total > 100.01); }
  }

  function onSheetInput(e) {
    const t = e.target;
    if (t.classList.contains('pp-money')) { t.value = fmtIn(t.value); draft[t.id === 'pp-price' ? 'price' : 'cost'] = num(digits(t.value)); paintProfit(); refreshSplitNumbers(); return; }
    if (t.id === 'pp-name') draft.name = t.value;
    if (t.id === 'pp-code') draft.code = t.value;
    if (t.id === 'pp-qty') { t.value = digits(t.value); draft.qty = num(t.value); }
    if (t.id === 'pp-min') { t.value = digits(t.value); draft.min = num(t.value); }
    if (t.dataset.pct !== undefined) { draft.pcts[Number(t.dataset.pct)] = num(String(t.value).replace(',', '.')); refreshSplitNumbers(); }
  }
  function onSheetChange(e) {
    const t = e.target;
    if (t.id === 'pp-file' || t.id === 'pp-cam') { handleFile(t.files && t.files[0]); t.value = ''; return; }
    if (t.id === 'pp-track') { draft.track = t.checked; paintStock(); return; }
    if (t.name === 'pp-mode') {
      draft.custom = t.value === 'custom';
      if (draft.custom && !draft.pcts.some(v => num(v) > 0)) presetEven();
      paintSplit();
    }
  }
  function presetEven() {
    const n = splitPartners().length || 1, base = Math.floor(1000 / n) / 10;
    draft.pcts = splitPartners().map((_p, i) => (i === n - 1 ? Math.round((100 - base * (n - 1)) * 10) / 10 : base));
  }
  function onSheetClick(e) {
    if (e.target === e.currentTarget) { closeSheet(); return; }
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.act === 'close') { closeSheet(); return; }
    if (t.dataset.act === 'save') { save(t); return; }
    if (t.dataset.act === 'delete') { remove(t); return; }
    if (t.dataset.unit !== undefined) { draft.unit = t.dataset.unit; paintUnits(); return; }
    if (t.dataset.cat !== undefined) { draft.category = t.dataset.cat; paintCats(); return; }
    if (t.id === 'pp-cam-btn') { takePhoto(); return; }
    if (t.id === 'pp-photo-del') { draft.image = ''; photoBlob = null; paintPhoto(); return; }
    if (t.id === 'pp-newcat-add') { addCategory(); return; }
    if (t.dataset.q) {
      const d = num(t.dataset.q), isQuick = t.closest('.pp-quick');
      draft.qty = Math.max(0, num(S('pp-qty').value) + d); S('pp-qty').value = draft.qty; void isQuick; return;
    }
    if (t.dataset.preset === 'even') { presetEven(); paintSplit(); return; }
    if (t.dataset.preset === 'only') { draft.pcts = splitPartners().map((_p, i) => (i === Number(t.dataset.i) ? 100 : 0)); paintSplit(); }
  }

  async function addCategory() {
    const inp = S('pp-newcat'), name = inp.value.trim();
    if (!name) return;
    if ((topics || []).some(x => String(x.name || '').toLowerCase() === name.toLowerCase())) { draft.category = (topics.find(x => String(x.name).toLowerCase() === name.toLowerCase())).name; inp.value = ''; paintCats(); return; }
    try {
      let res = await db.from('topic_masters').insert({ workspace_id: wid(), name, code: name.toUpperCase().slice(0, 12), is_active: true });
      if (res.error && /code/i.test(String(res.error.message))) res = await db.from('topic_masters').insert({ workspace_id: wid(), name, is_active: true });
      if (res.error) throw res.error;
      await loadMasters();
      const row = document.getElementById('pp-cats');
      if (row) row.insertAdjacentHTML('beforeend', `<button type="button" data-cat="${esc(name)}">${esc(name)}</button>`);
      draft.category = name; inp.value = ''; paintCats();
    } catch (err) { showToast(err.message || 'Gagal menambah kategori.', true); }
  }

  /* ---------- Foto ---------- */
  async function handleFile(file) {
    if (!file) return;
    try {
      const bmp = await new Promise((ok, no) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); ok(im); }; im.onerror = () => { URL.revokeObjectURL(u); no(new Error('Foto tidak bisa dibaca.')); }; im.src = u; });
      const side = Math.min(bmp.naturalWidth, bmp.naturalHeight), sx = (bmp.naturalWidth - side) / 2, sy = (bmp.naturalHeight - side) / 2;
      let size = 480, blob = null;
      for (const q of [0.82, 0.7, 0.58, 0.46]) {
        const c = document.createElement('canvas'); c.width = c.height = size;
        c.getContext('2d').drawImage(bmp, sx, sy, side, side, 0, 0, size, size);
        blob = await new Promise(r => c.toBlob(r, 'image/webp', q));
        if (!blob || blob.type !== 'image/webp') { blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); }
        if (blob && blob.size <= 90 * 1024) break;
        size = Math.max(320, size - 40);
      }
      if (!blob) throw new Error('Foto tidak bisa diproses.');
      photoBlob = blob;
      draft.image = URL.createObjectURL(blob);
      paintPhoto();
    } catch (err) { showToast(err.message || 'Foto gagal diproses.', true); }
  }
  // Ambil Foto: di HP membuka kamera belakang; di komputer memakai webcam dengan pratinjau langsung.
  function takePhoto() {
    const touch = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    if (touch || !navigator.mediaDevices?.getUserMedia) { document.getElementById('pp-cam')?.click(); return; }
    const cam = document.createElement('div');
    cam.className = 'pp-cam'; cam.innerHTML = '<video autoplay playsinline muted></video><div class="pp-cam-bar"><button type="button" class="btn btn-light" data-cam="x">Batal</button><button type="button" class="btn btn-green" data-cam="snap">Ambil Foto</button></div>';
    document.getElementById('pp-sheet').appendChild(cam);
    const video = cam.querySelector('video');
    let stream = null;
    const stop = () => { stream?.getTracks().forEach(t => t.stop()); cam.remove(); };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false }).then(st => { stream = st; video.srcObject = st; }).catch(() => { cam.remove(); showToast('Kamera tidak bisa dibuka. Pakai "Dari Galeri".', 'warning'); });
    cam.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.cam === 'x') { stop(); return; }
      if (!video.videoWidth) return;
      const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      c.toBlob(bl => { stop(); if (bl) handleFile(new File([bl], 'foto.jpg', { type: 'image/jpeg' })); }, 'image/jpeg', 0.92);
    });
  }
  async function uploadPhoto(id) {
    const ext = photoBlob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${wid()}/products/${id}-${Date.now().toString(36)}.${ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, photoBlob, { contentType: photoBlob.type, upsert: true });
    if (error) throw error;
    return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /* ---------- Simpan / hapus ---------- */
  function buildSplit(net) {
    const parts = splitPartners();
    if (!draft.custom || !parts.length) return { mode: 'percentage', split: [] };
    const total = draft.pcts.reduce((a, b) => a + num(b), 0);
    if (total > 100.01) throw new Error('Total pembagian untung melebihi 100%.');
    const split = parts.map((p, i) => ({ partner_id: p.id || null, partner_name: p.partner_name || '', pct: num(draft.pcts[i]), amount: Math.floor(net * num(draft.pcts[i]) / 100) }));
    // Pembulatan: selisih receh dimasukkan ke partner dengan bagian terbesar supaya total tepat.
    const want = Math.floor(net * Math.min(100, total) / 100), got = split.reduce((a, r) => a + r.amount, 0);
    if (total >= 99.99 && want - got > 0) { const big = split.reduce((m, r, i) => (r.pct > split[m].pct ? i : m), 0); split[big].amount += want - got; }
    return { mode: 'manual', split };
  }
  async function save(btn) {
    try {
      const name = draft.name.trim();
      if (!name) throw new Error('Isi nama dulu.');
      if (!(draft.price > 0)) throw new Error('Isi harga jual.');
      if (draft.cost > draft.price) { if (!confirm('Modal lebih besar dari harga jual, produk akan rugi. Tetap simpan?')) return; }
      const net = Math.max(0, draft.price - draft.cost), sp = buildSplit(net);
      btn.disabled = true;
      const payload = { name, price: draft.price, cost_price: draft.cost, profit_share_mode: sp.mode, manual_profit_split: sp.split };
      const code = draft.code.trim();
      payload.code = code || null;
      if (code && list().some(x => x.is_active !== false && String(x.id) !== String(draft.id) && String(x.code || '').toLowerCase() === code.toLowerCase())) throw new Error('Kode/barcode itu sudah dipakai produk lain.');
      if (kind === 'package') {
        payload.category = draft.category || null;
        payload.unit = draft.unit || null;
        payload.stock_qty = draft.track ? Math.max(0, Math.round(draft.qty)) : null;
        payload.stock_min = draft.track ? Math.max(0, Math.round(draft.min)) : null;
      }
      const table = kind === 'addon' ? 'addon_masters' : 'package_masters';
      let id = draft.id;
      if (!id) {
        if (!payload.code) payload.code = (kind === 'addon' ? 'AD' : 'P') + Date.now().toString(36).toUpperCase().slice(-5);
        const { data, error } = await db.from(table).insert({ ...payload, workspace_id: wid(), is_active: true }).select('id').single();
        if (error) throw error;
        id = data.id;
      }
      if (kind === 'package') {
        if (photoBlob) payload.image_url = await uploadPhoto(id);
        else if (!draft.image) payload.image_url = null;
        else payload.image_url = draft.image;
      }
      if (draft.id || (kind === 'package' && 'image_url' in payload)) {
        const { error } = await db.from(table).update(payload).eq('workspace_id', wid()).eq('id', id);
        if (error) throw error;
      }
      await loadMasters();
      try { await refreshAll(); } catch (_e) { /* tampilan lain menyusul */ }
      const word = kind === 'addon' ? 'Tambahan' : 'Produk';
      closeSheet(); renderGrid(); window.kairoPos?.reload?.();
      showToast(`${word} "${name}" disimpan.`);
    } catch (err) {
      const m = String(err.message || '');
      showToast(/image_url/i.test(m) ? 'Kolom foto belum ada di database.' : (m || 'Gagal menyimpan.'), true);
      btn.disabled = false;
    }
  }
  async function remove(btn) {
    if (!draft?.id) return;
    if (!confirm(`Hapus "${draft.name}"? Riwayat penjualan lama tetap aman.`)) return;
    btn.disabled = true;
    try {
      const { error } = await db.from(kind === 'addon' ? 'addon_masters' : 'package_masters').update({ is_active: false }).eq('workspace_id', wid()).eq('id', draft.id);
      if (error) throw error;
      await loadMasters();
      closeSheet(); renderGrid(); window.kairoPos?.reload?.();
      showToast('Dihapus.');
    } catch (err) { showToast(err.message || 'Gagal menghapus.', true); btn.disabled = false; }
  }

  /* ---------- Stok untuk Dashboard + Lonceng ---------- */
  function problems() {
    return (packages || []).filter(p => p && p.is_active !== false && ['out', 'low'].includes(stockState(p))).sort((a, b) => num(a.stock_qty) - num(b.stock_qty));
  }
  window.kairoShopStockNotifications = function () {
    return problems().map(p => ({ id: `stock:${p.id}:${p.stock_qty}`, name: p.name, pkg: num(p.stock_qty) <= 0 ? 'Stok habis' : 'Stok menipis', note: num(p.stock_qty) <= 0 ? 'Habis' : `Sisa ${p.stock_qty}`, urgent: num(p.stock_qty) <= 0 }));
  };
  function renderDashStock() {
    const row = document.getElementById('pos-dash-row'); if (!row) return;
    let card = document.getElementById('pos-dash-stock');
    if (!card) { card = document.createElement('div'); card.id = 'pos-dash-stock'; card.className = 'card pp-dash'; row.insertAdjacentElement('afterend', card); }
    const bad = problems(), n = (packages || []).filter(p => p && p.is_active !== false && tracked(p)).length;
    card.innerHTML = `<div class="pp-dash-head"><div><div class="card-title">Stok Produk</div><div class="page-sub">${n ? (bad.length ? `${bad.length} produk perlu diisi ulang` : 'Semua stok aman') : 'Belum ada stok yang dihitung'}</div></div><button type="button" class="btn btn-light" id="pp-dash-go">Kelola Produk</button></div>`
      + (bad.length ? `<div class="pp-dash-list">${bad.slice(0, 8).map(p => `<span class="pp-dash-item is-${stockState(p)}"><b>${esc(p.name)}</b><em>${num(p.stock_qty) <= 0 ? 'Habis' : 'Sisa ' + p.stock_qty}</em></span>`).join('')}</div>` : '');
    card.querySelector('#pp-dash-go').onclick = openPage;
  }

  function boot() { ensurePage(); ensureNav(); renderGrid(); renderDashStock(); }
  function wrap(name, after) {
    const core = window[name];
    if (typeof core !== 'function' || core.__pp) return;
    const w = function () { const r = core.apply(this, arguments); try { after(); } catch (e) { console.warn('pos-produk', e); } return r; };
    w.__pp = true; window[name] = w;
  }
  wrap('renderDashboard', () => { ensureNav(); renderDashStock(); });
  wrap('renderMasterOptions', () => { renderGrid(); renderDashStock(); });
  new MutationObserver(() => ensureNav()).observe(document.getElementById('app-shell') || document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('pp-sheet')) closeSheet(); });
  document.addEventListener('kairo:refreshed', () => { renderGrid(); renderDashStock(); });
  window.kairoPosProduk = { open: openPage, edit: id => { kind = 'package'; openPage(); openSheet((packages || []).find(x => String(x.id) === String(id))); } };
  boot();
})();
