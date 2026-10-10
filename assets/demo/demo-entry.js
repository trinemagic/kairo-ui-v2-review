/* KAIRO demo: tombol "Coba Demo" di landing -> pilih template -> buka dashboard contoh (alamat #demo-<template>). */
(function () {
  'use strict';
  const OPTIONS = [
    ['seller', 'Seller App Premium', 'Jual akun & aplikasi premium, pantau masa aktif langganan.'],
    ['jasa', 'Jasa Online', 'Desain, konsultasi, joki, dan jasa online lainnya.'],
    ['shop', 'Online Shop', 'Produk fisik: stok, platform marketplace, laba per produk.'],
    ['kasir', 'Kasir / POS', 'Kafe, warung, dan usaha dengan transaksi langsung di tempat.']
  ];
  let dialog = null, lastFocus = null;

  function close() {
    if (!dialog) return;
    dialog.remove(); dialog = null;
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function open() {
    if (dialog) return;
    lastFocus = document.activeElement;
    dialog = document.createElement('div');
    dialog.className = 'kairo-demo-picker';
    dialog.innerHTML = `<div class="kdp-card" role="dialog" aria-modal="true" aria-labelledby="kdp-title">
      <button type="button" class="kdp-x" aria-label="Tutup">×</button>
      <h2 id="kdp-title">Coba dashboard langsung</h2>
      <p>Pilih jenis usaha. Data contoh, tanpa daftar, dan tidak ada yang tersimpan.</p>
      <div class="kdp-grid">${OPTIONS.map(o => `<button type="button" class="kdp-option" data-demo="${o[0]}"><strong>${o[1]}</strong><span>${o[2]}</span></button>`).join('')}</div>
    </div>`;
    document.body.appendChild(dialog);
    document.addEventListener('keydown', onKey);
    dialog.addEventListener('click', e => {
      if (e.target === dialog || e.target.closest('.kdp-x')) return close();
      const o = e.target.closest('[data-demo]');
      if (o) { location.hash = '#demo-' + o.dataset.demo; location.reload(); }
    });
    dialog.querySelector('.kdp-option').focus();
  }

  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('[data-kairo-demo]')) { e.preventDefault(); open(); }
  });

  // Dari demo menekan "Daftar Gratis": landing dimuat ulang lalu form daftar langsung terbuka.
  window.addEventListener('load', () => {
    let flag = null;
    try { flag = sessionStorage.getItem('kairo_demo_signup'); sessionStorage.removeItem('kairo_demo_signup'); } catch (_e) { /* private mode */ }
    if (flag) setTimeout(() => document.querySelector('[data-v3-signup]')?.click(), 400);
  });
})();
