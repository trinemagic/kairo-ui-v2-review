/* Tes Scan Barcode (menu Produk Kasir/POS + Online Shop): kamera palsu Chromium memutar barcode EAN-13, uji kamera, ketik/alat scanner, kolom kode, izin kamera ditolak.
   Jalankan: cd .claude/testing && node test-barcode-scan.js (server lokal :8123 harus hidup). Tidak menguji kamera/Safari/HP asli. */
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const {bootApp}=require('./boot.js');
const T=__dirname+'/';
const fs=require('fs'),os=require('os'),path=require('path');
const SP=fs.mkdtempSync(path.join(os.tmpdir(),'kairo-bc-'))+'/';
const gen=require('./barcode-video.js');
const ean=b12=>{let s=0;for(let i=0;i<12;i++)s+=Number(b12[i])*(i%2?3:1);return b12+String((10-(s%10))%10)};
// Kamera palsu Chromium memutar video y4m berisi barcode EAN-13 (dibuat di sini), jadi pembacaan kamera diuji sungguhan.
for(const [n,c] of [['exist','899100110001'],['new','899990900001'],['field','899300330001']])gen(ean(c),SP+n+'.y4m');
gen(ean('899100110001'),SP+'vert.y4m',{vertical:true});gen(ean('899100110001'),SP+'small.y4m',{mod:2});
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('  GAGAL:',m)}else console.log('  ok:',m)};
const EXIST='8991001100016',NEW='8999909000018',FIELD='8993003300012';
const launch=file=>chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-video-capture='+SP+file]});
async function setup(b,tpl,opts={}){
  const seed=require(T+(tpl==='pos'?'seed-pos.js':'seed-shop.js'));
  const p=await bootApp(b,{template:tpl,seed,...opts});
  p.off=[];p.offMode='404';
  await p.route('**/world.openfoodfacts.org/**',async r=>{p.off.push(r.request().url());const m=p.offMode;
    if(m==='404')return r.fulfill({status:404,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({status:0,status_verbose:'product not found'})});
    if(m==='abort')return r.abort('failed');
    if(m==='hang'){return;}
    return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({status:1,product:m})});});
  await p.addInitScript?.(()=>{});
  await p.evaluate(code=>{window.__db.tables.package_masters[0].code=code;},EXIST);
  await p.evaluate(()=>{const o=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const s=await o(c);(window.__streams=window.__streams||[]).push(s);return s;};});
  await p.evaluate(async()=>{await loadMasters();});
  await p.waitForTimeout(400);
  return p;
}
const visible=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'},sel);
const openPage=async p=>{await p.evaluate(()=>window.kairoPosProduk.open());await p.waitForTimeout(500);};
const streamsEnded=p=>p.evaluate(()=>(window.__streams||[]).every(s=>s.getTracks().every(t=>t.readyState==='ended')));
async function waitFor(p,fn,ms=9000){try{await p.waitForFunction(fn,null,{timeout:ms});return true}catch(e){return false}}
(async()=>{
 for(const tpl of ['pos','shop']){
  console.log('=== Template',tpl,'===');
  // A) barcode produk yang sudah ada lewat kamera
  let b=await launch('exist.y4m');let p=await setup(b,tpl);
  const name0=await p.evaluate(()=>packages[0].name);
  await openPage(p);
  ok(await visible(p,'#pp-scan-open'),'tombol Scan Barcode tampil di halaman Produk');
  if(tpl==='shop'){ok(await p.evaluate(()=>!!document.querySelector('[data-tab="pos-products"]')),'menu Produk ada di sidebar Online Shop');}
    await p.click('#pp-scan-open');
  ok(await visible(p,'#pp-scan'),'jendela scan terbuka');
  const got=await waitFor(p,()=>!document.getElementById('pp-scan-result')?.hidden);
  ok(got,'kamera membaca barcode produk yang sudah ada');
  if(got){
    const txt=await p.innerText('#pp-scan-result');
    ok(txt.includes(name0)&&txt.includes(EXIST),'panel menyebut produk "'+name0+'" + barcode: '+txt.replace(/\s+/g,' ').slice(0,90));
    ok(await streamsEnded(p),'kamera dimatikan setelah barcode terbaca');
    await p.click('[data-sc="open"]');await p.waitForTimeout(400);
    ok(await visible(p,'#pp-sheet')&&await p.inputValue('#pp-name')===name0,'"Ubah produk" membuka lembar produk yang benar');
    ok(!(await visible(p,'#pp-scan')),'jendela scan tertutup');
  }
  ok(p.errs.filter(e=>!/ERR_TUNNEL|status of 404/.test(e)).length===0,'tanpa error JS '+JSON.stringify(p.errs.filter(e=>!/ERR_TUNNEL|status of 404/.test(e))));
  await b.close();

  // B) barcode baru -> lembar produk baru, kode terisi, simpan
  b=await launch('new.y4m');p=await setup(b,tpl);await openPage(p);
  const before=await p.evaluate(()=>window.__db.tables.package_masters.length);
  await p.click('#pp-scan-open');
  ok(await waitFor(p,()=>!!document.getElementById('pp-sheet')),'barcode baru langsung membuka lembar "Tambah produk"');
  ok(await p.inputValue('#pp-code')===NEW,'kolom kode/barcode terisi '+NEW);
  ok(await p.evaluate(()=>document.querySelector('#pp-sheet .pp-more').open),'bagian kode terbuka');
  ok(!(await visible(p,'#pp-scan')),'jendela scan tertutup');ok(await streamsEnded(p),'kamera mati');
  ok(/belum ada/i.test(await p.evaluate(()=>document.getElementById('toast').innerText)),'toast "Barcode ... belum ada" muncul');
  const ph=await p.getAttribute('#pp-name','placeholder');ok(tpl==='shop'?/Kaos/.test(ph):/Kopi/.test(ph),'contoh nama sesuai template: '+ph);
  const units=await p.evaluate(()=>[...document.querySelectorAll('#pp-units button')].map(x=>x.textContent).join(','));ok(tpl==='shop'?/pasang/.test(units)&&!/gelas/.test(units):/gelas/.test(units),'satuan sesuai template: '+units);
  await p.fill('#pp-name','Produk Hasil Scan');await p.fill('#pp-price','45000');await p.dispatchEvent('#pp-price','input');await p.fill('#pp-cost','20000');await p.dispatchEvent('#pp-cost','input');
  await p.click('[data-act="save"]');await p.waitForTimeout(900);
  const rows=await p.evaluate(c=>window.__db.tables.package_masters.filter(r=>r.code===c),NEW);
  ok(rows.length===1&&rows[0].name==='Produk Hasil Scan'&&rows[0].price===45000,'produk tersimpan dengan barcode (1 baris)');
  ok(await p.evaluate(()=>window.__db.tables.package_masters.length)===before+1,'jumlah produk +1');
  ok(p.errs.filter(e=>!/ERR_TUNNEL|status of 404/.test(e)).length===0,'tanpa error JS '+JSON.stringify(p.errs.filter(e=>!/ERR_TUNNEL|status of 404/.test(e))));
  await b.close();

  // C) scan dari kolom kode di lembar produk
  b=await launch('field.y4m');p=await setup(b,tpl);await openPage(p);
  await p.click('#pp-add');await p.waitForTimeout(300);
  await p.evaluate(()=>{document.querySelector('#pp-sheet .pp-more').open=true});
  ok(await visible(p,'#pp-code-scan'),'tombol Scan di kolom kode');
  await p.click('#pp-code-scan');
  ok(await waitFor(p,()=>document.getElementById('pp-code').value!==''),'kamera mengisi kolom kode');
  ok(await p.inputValue('#pp-code')===FIELD,'kode = '+FIELD);
  ok(await visible(p,'#pp-sheet')&&!(await visible(p,'#pp-scan')),'lembar tetap terbuka, jendela scan tertutup');ok(await streamsEnded(p),'kamera mati');
  await b.close();

  // F) barcode berdiri (vertikal) dan barcode kecil/jauh tetap terbaca
  for(const [f,label] of [['vert.y4m','barcode berdiri (vertikal)'],['small.y4m','barcode kecil (modul 2px)']]){
    b=await launch(f);p=await setup(b,tpl);await openPage(p);await p.click('#pp-scan-open');
    ok(await waitFor(p,()=>!document.getElementById('pp-scan-result')?.hidden,12000),'kamera membaca '+label);
    await b.close();
  }

  // D) ketik / alat scanner (Enter), produk ada vs baru, tanpa kamera
  b=await chromium.launch();p=await setup(b,tpl);await openPage(p);
  await p.click('#pp-scan-open');await p.waitForTimeout(600);
  ok(await visible(p,'#pp-scan-input'),'kolom scanner/ketik ada');
  await p.fill('#pp-scan-input',' '+EXIST+' ');await p.press('#pp-scan-input','Enter');await p.waitForTimeout(300);
  ok((await p.innerText('#pp-scan-result')).includes(name0),'ketik + Enter: produk yang ada ditemukan (spasi diabaikan)');
  await p.click('[data-sc="again"]');await p.waitForTimeout(500);
  ok(!(await visible(p,'#pp-scan-result')),'"Scan lagi" mengosongkan hasil');
  await p.fill('#pp-scan-input','ABC-9999');await p.click('[data-sc="ok"]');await p.waitForTimeout(400);
  ok(await visible(p,'#pp-sheet')&&await p.inputValue('#pp-code')==='ABC-9999','kode manual yang baru membuka lembar produk baru');
  ok(await p.evaluate(()=>{const c=document.getElementById('pp-code');return c.value;})==='ABC-9999','kode tersimpan di isian');
  // duplikat dari kolom kode
  await p.click('#pp-code-scan');await p.waitForTimeout(500);
  await p.fill('#pp-scan-input',EXIST);await p.press('#pp-scan-input','Enter');await p.waitForTimeout(300);
  ok(/sudah dipakai/i.test(await p.evaluate(()=>document.getElementById('toast').innerText)),'barcode yang sudah dipakai produk lain diperingatkan');
  await b.close();

  // E) kamera ditolak -> pesan jelas, input manual tetap jalan
  b=await chromium.launch();p=await setup(b,tpl);await openPage(p);
  await p.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(Object.assign(new Error('Permission denied'),{name:'NotAllowedError'}));});
  await p.click('#pp-scan-open');await p.waitForTimeout(1500);
  const msg=await p.innerText('#pp-scan-msg');ok(/Izin kamera ditolak/.test(msg),'pesan izin ditolak: '+msg);
  await p.fill('#pp-scan-input',EXIST);await p.press('#pp-scan-input','Enter');await p.waitForTimeout(300);
  ok((await p.innerText('#pp-scan-result')).includes(name0),'tetap bisa lewat ketik');
  await p.keyboard.press('Escape');await p.waitForTimeout(200);ok(!(await visible(p,'#pp-scan')),'Esc menutup jendela scan');
  await b.close();
 }

 // G) Nama produk dari barcode (Open Food Facts, dijawab tiruan karena sandbox tanpa internet)
 for(const tpl of ['pos','shop']){
  console.log('=== Cari nama dari barcode,',tpl,'===');
  const b=await chromium.launch();const p=await setup(b,tpl);await openPage(p);
  const scanType=async code=>{await p.click('#pp-scan-open');await p.waitForTimeout(500);await p.fill('#pp-scan-input',code);await p.press('#pp-scan-input','Enter');};
  const closeSheetBtn=async()=>{await p.evaluate(()=>document.querySelector('#pp-sheet [data-act="close"]')?.click());await p.waitForTimeout(200);};
  // ketemu + merek ditambahkan + takaran
  p.offMode={product_name:'Teh Botol',brands:'Sosro, Lain',quantity:'350 ml'};
  await scanType(NEW);
  ok(await waitFor(p,()=>!!document.getElementById('pp-sheet'),6000),'barcode baru + nama ketemu: lembar produk terbuka');
  ok(await p.inputValue('#pp-name')==='Sosro Teh Botol 350 ml','nama terisi dari database: '+await p.inputValue('#pp-name'));
  ok(await p.inputValue('#pp-code')===NEW,'barcode tetap terisi');
  ok(/database barcode publik/.test(await p.evaluate(()=>document.getElementById('toast').innerText)),'toast menyebut nama dari database publik');
  ok(p.off.length===1&&p.off[0].includes('/api/v2/product/'+NEW+'.json')&&/fields=/.test(p.off[0]),'1 permintaan, hanya angka barcode di alamat: '+p.off[0]);
  ok(!/cookie|workspace|user/i.test(p.off[0]),'alamat tidak membawa data akun');
  await p.fill('#pp-name','Nama Diubah');ok(await p.inputValue('#pp-name')==='Nama Diubah','nama masih bisa diubah');
  await closeSheetBtn();
  // cache: scan ulang kode yang sama tidak meminta lagi
  await scanType(NEW);await waitFor(p,()=>!!document.getElementById('pp-sheet'),6000);
  ok(p.off.length===1&&await p.inputValue('#pp-name')==='Sosro Teh Botol 350 ml','scan ulang memakai simpanan (tanpa permintaan baru)');
  await closeSheetBtn();
  // merek sudah ada di nama -> tidak dobel; nama Indonesia diutamakan
  p.offMode={product_name:'Indomie Fried',product_name_id:'Indomie Goreng',brands:'Indomie',quantity:''};
  await scanType('8998866200301');await waitFor(p,()=>!!document.getElementById('pp-sheet'),6000);
  ok(await p.inputValue('#pp-name')==='Indomie Goreng','merek tidak dobel, nama Indonesia diutamakan: '+await p.inputValue('#pp-name'));
  await closeSheetBtn();
  // 404 -> isian manual seperti biasa
  p.offMode='404';
  await scanType('8991111222233');
  ok(await waitFor(p,()=>!!document.getElementById('pp-sheet'),6000)&&await p.inputValue('#pp-name')==='','tidak ketemu (404): lembar terbuka, nama kosong');
  ok(/Isi nama dan harganya/.test(await p.evaluate(()=>document.getElementById('toast').innerText)),'pesan lama "Isi nama dan harganya"');
  await closeSheetBtn();
  // jaringan gagal
  p.offMode='abort';const t0=Date.now();
  await scanType('8991111222244');
  ok(await waitFor(p,()=>!!document.getElementById('pp-sheet'),6000)&&await p.inputValue('#pp-name')==='','jaringan gagal: lembar terbuka, nama kosong ('+(Date.now()-t0)+' ms)');
  await closeSheetBtn();
  // lambat -> menyerah sekitar 3,5 dtk
  p.offMode='hang';const t1=Date.now();
  await scanType('8991111222255');
  ok(/Mencari nama produk/.test(await p.innerText('#pp-scan-msg')),'tampil "Mencari nama produk…" selagi menunggu');
  ok(await waitFor(p,()=>!!document.getElementById('pp-sheet'),8000),'layanan lambat: lembar tetap terbuka');
  const dt=Date.now()-t1;ok(dt>3000&&dt<5500&&await p.inputValue('#pp-name')==='','menyerah sekitar 3,5 dtk ('+dt+' ms), nama kosong');
  await closeSheetBtn();
  // ditutup saat mencari -> tidak membuka lembar
  p.offMode='hang';await scanType('8991111222266');await p.waitForTimeout(500);
  await p.click('[data-sc="close"]');await p.waitForTimeout(4200);
  ok(!(await visible(p,'#pp-sheet'))&&!(await visible(p,'#pp-scan')),'jendela ditutup saat mencari: lembar tidak muncul sendiri');
  // produk sudah ada / kode bukan angka -> tidak ada permintaan
  const n0=p.off.length;p.offMode='404';
  await scanType(EXIST);await p.waitForTimeout(500);await p.click('[data-sc="close"]');
  await scanType('ABC-9999');await waitFor(p,()=>!!document.getElementById('pp-sheet'),4000);await closeSheetBtn();
  ok(p.off.length===n0,'produk yang sudah ada & kode bukan angka: 0 permintaan ke internet');
  // kolom kode di lembar: nama kosong -> diusulkan; nama sudah diisi -> tidak ditimpa & tidak ada permintaan
  p.offMode={product_name:'Kopi Bubuk',brands:'',quantity:'200 g'};
  await p.click('#pp-add');await p.waitForTimeout(300);await p.evaluate(()=>{document.querySelector('#pp-sheet .pp-more').open=true});await p.click('#pp-code-scan');await p.waitForTimeout(500);
  await p.fill('#pp-scan-input','8995555666677');await p.press('#pp-scan-input','Enter');
  ok(await waitFor(p,()=>document.getElementById('pp-name').value!=='',4000)&&await p.inputValue('#pp-name')==='Kopi Bubuk 200 g','scan di kolom kode: nama kosong diisi usulan');
  await closeSheetBtn();
  const n1=p.off.length;
  await p.click('#pp-add');await p.waitForTimeout(300);await p.fill('#pp-name','Nama Saya');await p.evaluate(()=>{document.querySelector('#pp-sheet .pp-more').open=true});
  await p.click('#pp-code-scan');await p.waitForTimeout(500);await p.fill('#pp-scan-input','8995555666688');await p.press('#pp-scan-input','Enter');await p.waitForTimeout(800);
  ok(await p.inputValue('#pp-name')==='Nama Saya'&&p.off.length===n1,'nama yang sudah diketik tidak ditimpa & tidak ada permintaan');
  ok(p.errs.filter(e=>!/ERR_TUNNEL|Failed to load resource|net::/.test(e)).length===0,'tanpa error JS '+JSON.stringify(p.errs.filter(e=>!/ERR_TUNNEL|Failed to load resource|net::/.test(e))));
  await b.close();
 }
 // Online Shop: lonceng stok tetap milik online-shop.js
 let b=await chromium.launch();let p=await setup(b,'shop');
 ok(/stockReady/.test(await p.evaluate(()=>String(window.kairoShopStockNotifications))),'Online Shop: penghitung lonceng stok tetap versi online-shop.js');
 await b.close();
 b=await chromium.launch();p=await setup(b,'pos');
 ok(!/stockReady/.test(await p.evaluate(()=>String(window.kairoShopStockNotifications))),'Kasir: penghitung lonceng stok tetap versi pos-produk.js');
 await b.close();
 console.log(fails?'TOTAL GAGAL '+fails:'SEMUA LULUS');
})();
