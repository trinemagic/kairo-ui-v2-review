// Pixel-based contrast audit: hides all text, screenshots, then checks every text element's colour
// against the real pixels behind it (handles gradients, translucent cards, ornaments).
// viewport:true = only text the user can see right now (not clipped/covered), measured on a viewport screenshot.
// Use it for fixed overlays/dialogs: a fullPage screenshot re-centres them and the sampled pixels would be wrong.
async function pixAudit(page, rootSel, skipSel='', {viewport=false}={}){
  const items=await page.evaluate(([sel,skip,vp])=>{
    const out=[];document.querySelectorAll(sel+' *').forEach((el,i)=>{
      if(!el.offsetWidth||(skip&&el.closest(skip)))return;const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>0);if(!own)return;
      const cs=getComputedStyle(el);if(cs.visibility==='hidden'||+cs.opacity<.5)return;
      const r=el.getBoundingClientRect();
      // Skip text that is clipped by a scroll container or covered by another element (not visible to the user).
      const cx=r.x+r.width/2,cy=r.y+r.height/2,hit=document.elementFromPoint(cx,cy);
      if(vp&&(cx<0||cy<0||cx>innerWidth||cy>innerHeight||!hit||!(el.contains(hit)||hit.contains(el))))return;
      el.dataset.pa=i;
      out.push({i,text:el.textContent.trim().slice(0,28),color:cs.color,size:parseFloat(cs.fontSize),bold:+cs.fontWeight>=700,x:r.x,y:r.y,w:r.width,h:r.height});});
    const st=document.createElement('style');st.id='pa-hide';st.textContent='*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}';document.head.appendChild(st);return out;},[rootSel,skipSel,viewport]);
  const buf=await page.screenshot({fullPage:!viewport});
  await page.evaluate(()=>document.getElementById('pa-hide').remove());
  return page.evaluate(async({items,b64,viewport})=>{
    const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
    const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
    const sx=img.width/(viewport?innerWidth:document.documentElement.scrollWidth),oy=viewport?0:scrollY;
    const lum=(r,g,b)=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
    const res=[];
    for(const it of items){
      const nums=it.color.match(/[\d.]+/g).map(Number);const srgb=/^color\(srgb/.test(it.color);const m=srgb?[nums[0]*255,nums[1]*255,nums[2]*255,nums[3]??1]:nums;
      // sample the inner 70% of the box (where glyphs sit), so rounded corners/borders of badges don't count
      const ix=it.w*.15,iy=it.h*.15;const X=Math.round((it.x+ix)*sx),Y=Math.round((it.y+iy+oy)*sx),W=Math.max(1,Math.round((it.w-2*ix)*sx)),H=Math.max(1,Math.round((it.h-2*iy)*sx));
      const d=x.getImageData(X,Y,W,H).data;const ratios=[];
      for(let p=0;p<d.length;p+=4*7){const a=m[3]??1;const fr=m[0]*a+d[p]*(1-a),fg=m[1]*a+d[p+1]*(1-a),fb=m[2]*a+d[p+2]*(1-a);
        const L1=lum(fr,fg,fb),L2=lum(d[p],d[p+1],d[p+2]);ratios.push((Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05));}
      ratios.sort((a,b)=>a-b);const worst=ratios[Math.floor(ratios.length*.1)]||99;
      const need=(it.size>=18.66&&it.bold)||it.size>=24?3:4.5;
      if(worst<need)res.push(`${worst.toFixed(2)}<${need} "${it.text}"`);}
    return res;},{items,b64:buf.toString('base64'),viewport});
}
module.exports={pixAudit};
