/* KAIRO - Printer struk (owner Okt 2026): satu modul untuk mencetak struk ke printer apa pun.
   Cara cetak (dipilih per perangkat, tersimpan di localStorage 'kairo_printer_v1'):
   - system : dialog cetak browser/OS. Semua printer yang terpasang di komputer/HP (USB, jaringan, AirPrint, Bluetooth lewat OS). Selalu tersedia.
   - usb    : WebUSB, printer termal ESC/POS 58/80 mm langsung (Chrome/Edge; Android juga). Windows butuh driver WinUSB bila printer sudah dipakai driver bawaan.
   - serial : Web Serial (Chrome/Edge desktop): printer USB-serial atau Bluetooth klasik yang sudah di-pair di komputer.
   - ble    : Web Bluetooth (Chrome/Edge, Android & desktop): printer termal Bluetooth Low Energy.
   - rawbt  : aplikasi RawBT (Android) untuk printer Bluetooth biasa/klasik; data dikirim lewat intent.
   Isi struk dikirim sebagai GAMBAR (raster ESC/POS GS v 0): layout desain, font, dan huruf Indonesia tampil sama di printer apa pun.
   API: kairoPrinter.printCanvas(canvas), printDom(el), printOrdersReceipt(), test(), connect(), disconnect(), status(), config. */
(function () {
  'use strict';
  if (window.kairoPrinter) return;

  const KEY = 'kairo_printer_v1';
  const DEF = { mode: 'system', paper: 58, copies: 1, cut: true, drawer: false, auto: false, baud: 9600 };
  const DOTS = { 58: 384, 80: 576 };
  const MODES = [
    ['system', 'Printer biasa (dialog cetak)', 'Pakai dialog cetak browser. Cocok untuk printer apa pun yang sudah terpasang di komputer/HP: USB, jaringan, AirPrint, atau Bluetooth lewat sistem.'],
    ['usb', 'USB langsung (ESC/POS)', 'Cetak tanpa dialog ke printer termal 58/80 mm lewat kabel USB. Chrome atau Edge.'],
    ['serial', 'Serial / Bluetooth klasik', 'Printer yang sudah di-pair di komputer (muncul sebagai port COM) atau USB-serial. Chrome atau Edge di komputer.'],
    ['ble', 'Bluetooth BLE', 'Printer termal Bluetooth Low Energy. Chrome atau Edge (Android dan komputer).'],
    ['rawbt', 'RawBT (Android)', 'Untuk printer Bluetooth biasa di HP Android. Pasang aplikasi RawBT dulu, lalu pilih printernya di aplikasi itu.']
  ];
  const BLE_SERVICES = ['000018f0-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '0000ff00-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb', '38eb4a80-c570-11e3-9507-0002a5d5c51b'];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const toast = (m, k) => { try { showToast(m, k); } catch (_e) { /* belum siap */ } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function load() {
    try { return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch (_e) { return { ...DEF }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_e) { /* penyimpanan diblokir */ } }
  const cfg = load();
  const support = {
    system: () => true,
    usb: () => !!navigator.usb,
    serial: () => !!navigator.serial,
    ble: () => !!navigator.bluetooth,
    rawbt: () => /android/i.test(navigator.userAgent)
  };
  const needsLink = m => m === 'usb' || m === 'serial' || m === 'ble';

  /* ---------------------------------------------------------------- ESC/POS */
  // Canvas -> bitmap 1-bit (hitam = 1) selebar printer. Putih transparan dianggap putih.
  function rasterize(canvas, dots) {
    const h = Math.max(1, Math.round(canvas.height * dots / canvas.width));
    const c = document.createElement('canvas'); c.width = dots; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, dots, h);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(canvas, 0, 0, dots, h);
    const px = x.getImageData(0, 0, dots, h).data, wb = dots / 8, out = new Uint8Array(wb * h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < dots; xx++) {
      const i = (yy * dots + xx) * 4, lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
      if (lum < 150) out[yy * wb + (xx >> 3)] |= 0x80 >> (xx & 7);
    }
    return { data: out, wb, h };
  }
  function escpos(canvas) {
    const dots = DOTS[cfg.paper] || 384, { data, wb, h } = rasterize(canvas, dots), parts = [];
    const push = (...b) => parts.push(Uint8Array.from(b));
    for (let n = 0; n < Math.max(1, cfg.copies | 0); n++) {
      push(0x1b, 0x40);                                   // ESC @ : reset
      push(0x1b, 0x61, 0x00);                             // rata kiri
      for (let y0 = 0; y0 < h; y0 += 96) {                // pita 96 baris supaya buffer printer murah tidak penuh
        const rows = Math.min(96, h - y0);
        push(0x1d, 0x76, 0x30, 0x00, wb & 255, wb >> 8, rows & 255, rows >> 8);   // GS v 0
        parts.push(data.subarray(y0 * wb, (y0 + rows) * wb));
      }
      push(0x1b, 0x64, 4);                                // maju 4 baris
      if (cfg.drawer && n === 0) push(0x1b, 0x70, 0x00, 0x19, 0xfa);   // buka laci uang
      if (cfg.cut) push(0x1d, 0x56, 0x42, 0x00);          // potong sebagian (printer tanpa pemotong mengabaikan)
    }
    const len = parts.reduce((a, p) => a + p.length, 0), all = new Uint8Array(len);
    let o = 0; parts.forEach(p => { all.set(p, o); o += p.length; });
    return all;
  }

  /* -------------------------------------------------------------- transport */
  let conn = null;   // { mode, label, write(bytes), close() }

  async function usbConnect(pick) {
    let dev = null;
    if (!pick) { const list = await navigator.usb.getDevices(); dev = list.find(d => d.__kairoPicked) || list[0] || null; }
    if (!dev) { if (!pick) return null; dev = await navigator.usb.requestDevice({ filters: [] }); }
    await dev.open();
    if (dev.configuration === null) await dev.selectConfiguration(1);
    let found = null;
    for (const itf of dev.configuration.interfaces) for (const alt of itf.alternates) for (const ep of alt.endpoints) {
      if (ep.direction === 'out' && ep.type === 'bulk' && (!found || alt.interfaceClass === 7)) found = { itf: itf.interfaceNumber, alt: alt.alternateSetting, ep: ep.endpointNumber };
    }
    if (!found) { await dev.close().catch(() => {}); throw new Error('Printer USB ini tidak punya jalur cetak yang dikenali.'); }
    await dev.claimInterface(found.itf);
    if (found.alt) await dev.selectAlternateInterface(found.itf, found.alt);
    dev.__kairoPicked = true;
    return {
      mode: 'usb', label: [dev.manufacturerName, dev.productName].filter(Boolean).join(' ') || 'Printer USB',
      async write(bytes) { for (let i = 0; i < bytes.length; i += 4096) await dev.transferOut(found.ep, bytes.subarray(i, i + 4096)); },
      async close() { try { await dev.releaseInterface(found.itf); await dev.close(); } catch (_e) { /* sudah lepas */ } }
    };
  }
  async function serialConnect(pick) {
    let port = null;
    if (!pick) { const ports = await navigator.serial.getPorts(); port = ports[0] || null; if (!port) return null; }
    else port = await navigator.serial.requestPort();
    if (!port.readable && !port.writable) await port.open({ baudRate: Number(cfg.baud) || 9600 });
    return {
      mode: 'serial', label: 'Port serial / Bluetooth',
      async write(bytes) { const w = port.writable.getWriter(); try { for (let i = 0; i < bytes.length; i += 512) { await w.write(bytes.subarray(i, i + 512)); } } finally { w.releaseLock(); } },
      async close() { try { await port.close(); } catch (_e) { /* sudah tutup */ } }
    };
  }
  async function bleConnect(pick) {
    let dev = null;
    if (!pick) { if (navigator.bluetooth.getDevices) { const l = await navigator.bluetooth.getDevices(); dev = l[0] || null; } if (!dev) return null; }
    else dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
    const server = await dev.gatt.connect();
    let chr = null;
    for (const uuid of BLE_SERVICES) {
      try {
        const svc = await server.getPrimaryService(uuid), cs = await svc.getCharacteristics();
        chr = cs.find(c => c.properties.writeWithoutResponse) || cs.find(c => c.properties.write);
        if (chr) break;
      } catch (_e) { /* layanan ini tidak ada */ }
    }
    if (!chr) { try { dev.gatt.disconnect(); } catch (_e) { /* */ } throw new Error('Bluetooth ini bukan printer termal yang dikenali.'); }
    return {
      mode: 'ble', label: dev.name || 'Printer Bluetooth',
      async write(bytes) {
        const size = 100;
        for (let i = 0; i < bytes.length; i += size) {
          const part = bytes.subarray(i, i + size);
          if (chr.properties.writeWithoutResponse && chr.writeValueWithoutResponse) await chr.writeValueWithoutResponse(part); else await chr.writeValue(part);
          await sleep(18);
        }
      },
      async close() { try { dev.gatt.disconnect(); } catch (_e) { /* */ } }
    };
  }
  function rawbtSend(bytes) {
    let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    window.location.href = 'intent:base64,' + btoa(bin) + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;';
  }

  async function ensureConn(allowPrompt) {
    if (conn && conn.mode === cfg.mode) return conn;
    let c = null;
    try {
      if (cfg.mode === 'usb') c = await usbConnect(false) || (allowPrompt ? await usbConnect(true) : null);
      else if (cfg.mode === 'serial') c = await serialConnect(false) || (allowPrompt ? await serialConnect(true) : null);
      else if (cfg.mode === 'ble') c = await bleConnect(false) || (allowPrompt ? await bleConnect(true) : null);
    } catch (e) { if (e && e.name === 'NotFoundError') return null; throw e; }
    conn = c; syncUi();
    return conn;
  }

  /* ------------------------------------------------------------- cetak sistem */
  function setPaperVars() {
    document.documentElement.style.setProperty('--kp-paper', (cfg.paper || 58) + 'mm');
    let st = document.getElementById('kp-page-style');
    if (!st) { st = document.createElement('style'); st.id = 'kp-page-style'; document.head.appendChild(st); }
    st.textContent = '@page{size:' + (cfg.paper || 58) + 'mm auto;margin:0}';
  }
  function systemPrintCanvas(canvas) {
    return new Promise(resolve => {
      setPaperVars();
      document.getElementById('kp-print-sheet')?.remove();
      const sheet = document.createElement('div'); sheet.id = 'kp-print-sheet';
      const img = new Image(); img.alt = 'Struk';
      img.onload = () => {
        sheet.appendChild(img); document.body.appendChild(sheet); document.body.classList.add('kp-printing');
        const done = () => { document.body.classList.remove('kp-printing'); sheet.remove(); window.removeEventListener('afterprint', done); resolve(); };
        window.addEventListener('afterprint', done);
        setTimeout(() => window.print(), 60);
        setTimeout(done, 60000);
      };
      img.src = canvas.toDataURL('image/png');
    });
  }

  /* ---------------------------------------------------------------- publik */
  async function printCanvas(canvas, opts) {
    const o = opts || {};
    try {
      if (cfg.mode === 'system') { await systemPrintCanvas(canvas); return true; }
      const bytes = escpos(canvas);
      if (cfg.mode === 'rawbt') { rawbtSend(bytes); return true; }
      const c = await ensureConn(!o.silent);
      if (!c) { if (!o.silent) toast('Printer belum terhubung. Atur di Settings › Struk › Printer Struk.', 'warning'); return false; }
      await c.write(bytes);
      return true;
    } catch (e) {
      conn = null; syncUi();
      toast('Gagal mencetak: ' + (e && e.message ? e.message : e) + '. Cek printer lalu coba lagi.', true);
      return false;
    }
  }

  // Struk Kasir/Rekap Sesi (DOM .pos-receipt) -> gambar. Isi dibaca dari kelas r-title/r-meta/r-line/hr/r-foot.
  function domToCanvas(el) {
    const W = 576, pad = 8, base = 26, font = n => `${n}px "Plus Jakarta Sans", Arial, sans-serif`;
    const items = [];
    [...el.children].forEach(ch => {
      if (ch.tagName === 'HR') items.push({ t: 'hr' });
      else if (ch.classList.contains('r-line')) { const [a, b] = ch.querySelectorAll('span,b'); items.push({ t: 'line', a: (a?.textContent || '').trim(), b: (b?.textContent || '').trim(), bold: ch.classList.contains('r-total') }); }
      else if (ch.classList.contains('r-title')) items.push({ t: 'title', a: ch.textContent.trim() });
      else { const tx = ch.textContent.trim(); if (tx) items.push({ t: 'text', a: tx, foot: ch.classList.contains('r-foot') }); }
    });
    const c = document.createElement('canvas'), x = c.getContext('2d');
    c.width = W; c.height = 4000; x.font = font(base);
    const wrap = (txt, size, weight, max) => {
      x.font = `${weight} ${font(size)}`; const words = String(txt).split(/\s+/), lines = []; let cur = '';
      words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; });
      if (cur) lines.push(cur); return lines;
    };
    let y = 16;
    const draw = [];
    items.forEach(it => {
      if (it.t === 'hr') { draw.push({ k: 'hr', y: y + 16 }); y += 30; }
      else if (it.t === 'title') { wrap(it.a, base + 10, 800, W - pad * 2).forEach(l => { y += base + 16; draw.push({ k: 'c', s: l, y, size: base + 10, w: 800 }); }); y += 6; }
      else if (it.t === 'text') { wrap(it.a, base - 3, 600, W - pad * 2).forEach(l => { y += base + 4; draw.push({ k: 'c', s: l, y, size: base - 3, w: 600 }); }); if (it.foot) y += 14; }
      else {
        const size = it.bold ? base + 4 : base, w = it.bold ? 800 : 600;
        x.font = `${w} ${font(size)}`; const bw = x.measureText(it.b).width, left = wrap(it.a, size, w, W - pad * 2 - bw - 14);
        left.forEach((l, i) => { y += size + 10; draw.push({ k: 'l', s: l, y, size, w }); if (i === 0) draw.push({ k: 'r', s: it.b, y, size, w }); });
      }
    });
    y += 30;
    const out = document.createElement('canvas'); out.width = W; out.height = Math.max(60, y);
    const g = out.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, out.height); g.fillStyle = '#000';
    draw.forEach(d => {
      if (d.k === 'hr') { g.save(); g.strokeStyle = '#000'; g.lineWidth = 2; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(pad, d.y); g.lineTo(W - pad, d.y); g.stroke(); g.restore(); return; }
      g.font = `${d.w} ${font(d.size)}`; g.textAlign = d.k === 'c' ? 'center' : d.k === 'r' ? 'right' : 'left';
      g.fillText(d.s, d.k === 'c' ? W / 2 : d.k === 'r' ? W - pad : pad, d.y);
    });
    return out;
  }
  async function printDom(el, opts) {
    if (!el) return false;
    try { await document.fonts?.load?.('600 26px "Plus Jakarta Sans"'); await document.fonts?.load?.('800 36px "Plus Jakarta Sans"'); } catch (_e) { /* pakai font cadangan */ }
    return printCanvas(domToCanvas(el), opts);
  }
  async function printOrdersReceipt() {
    if (typeof window.kairoReceiptCanvas !== 'function') { toast('Struk belum siap dicetak.', true); return false; }
    try { return await printCanvas(await window.kairoReceiptCanvas()); } catch (e) { toast(e.message || 'Gagal menyiapkan struk.', true); return false; }
  }
  function testCanvas() {
    const c = document.createElement('canvas'); c.width = 576; c.height = 560; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 576, 560); g.fillStyle = '#000'; g.textAlign = 'center';
    g.font = '800 40px "Plus Jakarta Sans", Arial'; g.fillText('TES CETAK', 288, 64);
    g.font = '600 24px "Plus Jakarta Sans", Arial'; g.fillText('KAIRO Workspaces', 288, 104);
    g.fillText('Kertas ' + cfg.paper + ' mm · ' + (MODES.find(m => m[0] === cfg.mode) || ['', ''])[1], 288, 140);
    g.strokeStyle = '#000'; g.lineWidth = 2; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(10, 164); g.lineTo(566, 164); g.stroke(); g.setLineDash([]);
    g.textAlign = 'left'; g.font = '600 22px "Plus Jakarta Sans", Arial'; g.fillText('Rata kiri', 10, 200); g.textAlign = 'right'; g.fillText('Rata kanan', 566, 200);
    g.textAlign = 'center'; g.fillText('Teks Indonesia: é ñ ü ' + String.fromCharCode(8212) + ' Rp1.250.000', 288, 240);
    for (let i = 0; i <= 56; i++) { const xx = 10 + i * 10, hh = i % 5 === 0 ? 34 : 18; g.fillRect(xx, 270, 2, hh); }
    g.font = '700 20px "Plus Jakarta Sans", Arial'; g.fillText('Garis lurus, ujung kiri-kanan tidak terpotong', 288, 340);
    g.fillStyle = '#000'; g.fillRect(10, 370, 556, 48); g.fillStyle = '#fff'; g.font = '800 26px "Plus Jakarta Sans", Arial'; g.fillText('Blok hitam dengan teks putih', 288, 403);
    g.fillStyle = '#000'; g.font = '600 22px "Plus Jakarta Sans", Arial'; g.fillText('Jika semua terbaca, printer siap dipakai.', 288, 470);
    return c;
  }
  async function connect() {
    if (!needsLink(cfg.mode)) { toast('Mode ini tidak perlu dihubungkan.', 'info'); return; }
    try {
      await disconnect(true);
      const c = await (cfg.mode === 'usb' ? usbConnect(true) : cfg.mode === 'serial' ? serialConnect(true) : bleConnect(true));
      conn = c; syncUi();
      toast('Terhubung ke ' + c.label + '.', 'success');
    } catch (e) {
      if (e && e.name === 'NotFoundError') return;   // dialog pilih perangkat ditutup
      console.warn('kairo-printer connect', e);
      conn = null; syncUi();
      toast('Gagal menghubungkan: ' + (e && e.message ? e.message : e), true);
    }
  }
  async function disconnect(silent) { if (conn) { try { await conn.close(); } catch (_e) { /* */ } conn = null; } syncUi(); if (!silent) toast('Printer diputuskan.', 'info'); }
  const status = () => ({ mode: cfg.mode, connected: !!conn, label: conn ? conn.label : '', paper: cfg.paper, auto: !!cfg.auto });

  /* ---------------------------------------------------------- Settings card */
  function cardHtml() {
    return `<div class="card kp-card" id="kairo-printer-card">
      <div class="card-title">Printer Struk</div>
      <div class="page-sub">Berlaku di perangkat/browser ini saja. Struk dikirim sebagai gambar, jadi layout dan font tampil sama di printer apa pun.</div>
      <div class="kp-modes" role="radiogroup" aria-label="Cara cetak">${MODES.map(([id, name, desc]) => {
        const ok = support[id](), on = cfg.mode === id;
        return `<label class="kp-mode${on ? ' on' : ''}${ok ? '' : ' is-off'}"><input type="radio" name="kp-mode" value="${id}"${on ? ' checked' : ''}${ok ? '' : ' disabled'}><span><b>${esc(name)}</b><small>${esc(desc)}${ok ? '' : ' <em>Tidak didukung di browser/perangkat ini.</em>'}</small></span></label>`;
      }).join('')}</div>
      <div class="kp-row"><div class="kp-field"><span class="label">Lebar kertas</span><div class="kp-chips" id="kp-paper">${[58, 80].map(v => `<button type="button" data-paper="${v}" class="${cfg.paper === v ? 'on' : ''}">${v} mm</button>`).join('')}</div></div>
        <div class="kp-field"><span class="label">Jumlah salinan</span><input class="input kp-copies" id="kp-copies" type="number" min="1" max="5" value="${cfg.copies}"></div>
        <div class="kp-field" id="kp-baud-wrap"><span class="label">Kecepatan serial (baud)</span><select class="input" id="kp-baud">${[9600, 19200, 38400, 57600, 115200].map(b => `<option value="${b}"${Number(cfg.baud) === b ? ' selected' : ''}>${b}</option>`).join('')}</select></div></div>
      <label class="kp-check"><input type="checkbox" id="kp-cut"${cfg.cut ? ' checked' : ''}><span>Potong kertas otomatis (bila printer punya pemotong)</span></label>
      <label class="kp-check"><input type="checkbox" id="kp-drawer"${cfg.drawer ? ' checked' : ''}><span>Buka laci uang setelah cetak</span></label>
      <label class="kp-check"><input type="checkbox" id="kp-auto"${cfg.auto ? ' checked' : ''}><span>Cetak otomatis setelah pembayaran di Kasir (printer yang sudah terhubung)</span></label>
      <div class="kp-status" id="kp-status" aria-live="polite"></div>
      <div class="kp-actions"><button type="button" class="btn btn-green" id="kp-connect">Hubungkan Printer</button><button type="button" class="btn btn-light" id="kp-test">Tes Cetak</button><button type="button" class="btn btn-light" id="kp-disc">Putuskan</button></div>
      <div class="kp-note">Safari/iPhone belum bisa terhubung langsung: pakai <b>Printer biasa</b> (AirPrint). Printer jaringan (LAN) dan printer apa pun yang sudah muncul di dialog cetak komputer juga lewat <b>Printer biasa</b>. Printer 80 mm lebih lebar dan lebih jelas untuk layout desain.</div>
    </div>`;
  }
  function syncUi() {
    const card = document.getElementById('kairo-printer-card'); if (!card) return;
    const link = needsLink(cfg.mode);
    card.querySelector('#kp-connect').hidden = !link; card.querySelector('#kp-disc').hidden = !link || !conn;
    card.querySelector('#kp-baud-wrap').hidden = cfg.mode !== 'serial';
    card.querySelectorAll('.kp-mode').forEach(l => l.classList.toggle('on', l.querySelector('input').value === cfg.mode));
    const st = card.querySelector('#kp-status');
    st.className = 'kp-status' + (conn ? ' is-ok' : '');
    st.textContent = cfg.mode === 'system' ? 'Cetak lewat dialog cetak: pilih printer di dialog saat mencetak.'
      : cfg.mode === 'rawbt' ? 'Struk dikirim ke aplikasi RawBT; pilih printer Bluetooth di aplikasi itu.'
      : conn ? 'Terhubung: ' + conn.label : 'Belum terhubung. Tekan Hubungkan Printer lalu pilih perangkatnya.';
  }
  function mountCard() {
    const panel = document.querySelector('#settings [data-settings-panel="receipt"]');
    if (!panel || document.getElementById('kairo-printer-card')) return;
    panel.insertAdjacentHTML('beforeend', cardHtml());
    const card = document.getElementById('kairo-printer-card');
    card.addEventListener('change', e => {
      const t = e.target;
      if (t.name === 'kp-mode') { cfg.mode = t.value; disconnect(true); }
      else if (t.id === 'kp-copies') cfg.copies = Math.max(1, Math.min(5, Number(t.value) || 1));
      else if (t.id === 'kp-baud') cfg.baud = Number(t.value) || 9600;
      else if (t.id === 'kp-cut') cfg.cut = t.checked;
      else if (t.id === 'kp-drawer') cfg.drawer = t.checked;
      else if (t.id === 'kp-auto') cfg.auto = t.checked;
      save(); setPaperVars(); syncUi();
    });
    card.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.paper) { cfg.paper = Number(b.dataset.paper); save(); setPaperVars(); card.querySelectorAll('#kp-paper button').forEach(x => x.classList.toggle('on', x === b)); return; }
      if (b.id === 'kp-connect') { await connect(); return; }
      if (b.id === 'kp-disc') { await disconnect(false); return; }
      if (b.id === 'kp-test') { b.disabled = true; try { await document.fonts?.load?.('600 22px "Plus Jakarta Sans"'); const ok = await printCanvas(testCanvas()); if (ok && cfg.mode !== 'system') toast('Tes cetak dikirim.', 'success'); } finally { b.disabled = false; } }
    });
    syncUi();
  }
  function mountOrdersButton() {
    const copy = document.getElementById('copy-receipt');
    if (!copy || document.getElementById('print-receipt')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'print-receipt'; b.className = 'btn btn-light receipt-image-btn';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V4h10v4"/><rect x="4" y="8" width="16" height="9" rx="2"/><path d="M7 14h10v6H7z"/></svg><span>Cetak</span>';
    b.addEventListener('click', async () => { b.disabled = true; try { await printOrdersReceipt(); } finally { b.disabled = false; } });
    copy.insertAdjacentElement('afterend', b);
  }

  setPaperVars();
  const root = document.getElementById('app-shell') || document.body;
  new MutationObserver(() => { mountCard(); mountOrdersButton(); }).observe(root, { childList: true, subtree: true });
  new MutationObserver(() => mountOrdersButton()).observe(document.body, { childList: true });
  mountCard(); mountOrdersButton();
  // Sambungkan lagi otomatis ke printer USB/serial yang pernah diizinkan (tanpa dialog), supaya Cetak otomatis langsung jalan.
  if (needsLink(cfg.mode)) setTimeout(() => { ensureConn(false).catch(() => {}); }, 1500);

  window.kairoPrinter = { config: cfg, connect, disconnect, status, printCanvas, printDom, printOrdersReceipt, test: () => printCanvas(testCanvas()), _escpos: escpos, _rasterize: rasterize, _domToCanvas: domToCanvas, _setConn: c => { conn = c; syncUi(); } };
})();
