// Render 3D hero landing (laptop + HP di desk pad, statis) -> render-wide.png (2400x1350) & render-tall.png (1200x1200).
// Siapkan: cd .claude/testing/hero3d && npm pack three@0.170.0 && mkdir -p pkg && tar xzf three-0.170.0.tgz -C pkg   (tidak di-commit)
// Layar memakai hero-laptop.webp & hero-phone.webp di folder ini (buat ulang dengan ../shoot-hero.js bila dashboard berubah).
// Jalankan: python3 -m http.server 8123 (root repo), lalu `node render.js` di folder ini; ubah ke WebP (PIL, quality 86)
// jadi assets/landing/hero-desk.webp dan hero-desk-hp.webp.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const SM=process.env.SMALL==='1';for(const [v,w,h] of (SM?[['wide',1200,675],['tall',600,600]]:[['wide',4800,2700],['tall',2400,2400]])){const p=await b.newPage({viewport:{width:w,height:h}});p.on('console',m=>console.log('console',m.text()));p.on('pageerror',e=>console.log('err',e.message));
await p.goto(`http://localhost:8123/.claude/testing/hero3d/scene.html?v=${v}&w=${w}&h=${h}`,{waitUntil:'commit'});await p.waitForFunction(()=>window.__done,null,{timeout:600000});
const data=await p.evaluate(()=>(document.getElementById('final')||document.querySelector('canvas')).toDataURL('image/png'));require('fs').writeFileSync(`render-${v}.png`,Buffer.from(data.split(',')[1],'base64'));console.log('ok',v);await p.close()}
await b.close()})();
