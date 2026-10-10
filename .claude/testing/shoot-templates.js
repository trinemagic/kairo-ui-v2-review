// Admin › Template previews (admin/previews/*.webp): main Dashboard of each template, desktop + phone.
// Run: python3 -m http.server 8123 (repo root), then `node shoot-templates.js` here.
const { chromium, bootApp } = require('./boot.js');
const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'../../admin/previews');fs.mkdirSync(OUT,{recursive:true});
async function toWebp(page,buf,name,width){
  const data='data:image/png;base64,'+buf.toString('base64');
  const webp=await page.evaluate(async({data,width})=>{const img=new Image();img.src=data;await img.decode();const w=Math.min(width,img.naturalWidth),h=Math.round(img.naturalHeight*w/img.naturalWidth);const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(img,0,0,w,h);return c.toDataURL('image/webp',0.8)},{data,width});
  fs.writeFileSync(`${OUT}/${name}.webp`,Buffer.from(webp.split(',')[1],'base64'));console.log(name,fs.statSync(`${OUT}/${name}.webp`).size);
}
(async()=>{const b=await chromium.launch();
for(const [tpl,seed,name] of [['','./seed.js','jasa-online'],['seller','./seed-seller.js','seller-app-premium'],['shop','./seed-shop.js','online-shop'],['pos','./seed-pos.js','kasir']]){
  for(const [w,h,mobile,suffix,outW] of [[1440,900,false,'desktop',960],[390,844,true,'mobile',390]]){
    const p=await bootApp(b,{seed:require(seed),plan:'pro',width:w,height:h,mobile,template:tpl,workspaceName:'Toko Demo',dsf:mobile?2:1});
    await p.evaluate(async()=>{try{hydrateSaasUi()}catch(e){}openAppPage('dashboard');await loadPageData('dashboard',{force:true})});
    await p.addStyleTag({content:'*{caret-color:transparent!important} .kairo-toast-stack{display:none!important}'});
    await p.waitForTimeout(1500);await p.evaluate(()=>window.scrollTo(0,0));
    await toWebp(p,await p.screenshot(),`${name}-${suffix}`,outW);
    if(p.errs.length)console.log(name,suffix,p.errs);
    await p.context().close();
  }
}
await b.close();})();
