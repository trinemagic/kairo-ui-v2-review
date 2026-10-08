// Seed Online Shop: SEED dasar + transaksi produk fisik (channel marketplace, HPP, batal/retur).
module.exports = require('./seed.js') + `
(function(){
  const P=[['Kaos Polos Hitam',85000,40000],['Totebag Kanvas',65000,45000],['Topi Baseball',70000,30000],['Tumbler 500ml',120000,90000],['Gantungan Kunci',15000,0],['Hoodie Oversize',210000,120000]];
  const CH=['Shopee','Tokopedia','TikTok Shop','Shopee','WhatsApp','Toko Offline','Shopee','Lazada'];
  T.package_masters=P.map((p,i)=>({id:'sp'+i,workspace_id:'w1',code:'P'+(i+1),name:p[0],price:p[1],cost_price:p[2],is_active:true,stock_qty:[4,40,0,3,null,12][i],stock_min:[5,10,3,5,null,4][i]}));
  T.transactions=[];
  for(let i=0;i<36;i++){
    const d=now-i*0.6*86400000, p=P[(i*7+i%3)%P.length], q=1+(i%3), p2=P[(i+2)%P.length];
    const pi=P.indexOf(p),p2i=P.indexOf(p2);const items=[{id:'sp'+pi,name:p[0],code:p[0],qty:q,unit_price:p[1],subtotal:p[1]*q,cost_price:p[2],cost_subtotal:p[2]*q}];
    if(i%4===0)items.push({id:'sp'+p2i,name:p2[0],code:p2[0],qty:1,unit_price:p2[1],subtotal:p2[1],cost_price:p2[2],cost_subtotal:p2[2]});
    const total=items.reduce((s,x)=>s+x.subtotal,0);
    T.transactions.push({id:'tx'+i,workspace_id:'w1',transaction_date:iso(d),created_at:new Date(d).toISOString(),reading_started_at:new Date(d).toISOString(),reading_status:'done',customer_name:['Alya','Budi','Citra','Dimas','Eka'][i%5]+' '+i,platform:i%11===0?'':CH[i%CH.length],payment_method:'QRIS',package_code:p[0],package_qty:q,total_price:total,order_items:items,order_addons:[]});
  }
  T.order_returns=[
    {id:'r1',workspace_id:'w1',transaction_date:iso(now-86400000),kind:'batal',reason:'Pembeli batal',platform:'Shopee',total_price:85000},
    {id:'r2',workspace_id:'w1',transaction_date:iso(now-2*86400000),kind:'retur',reason:'Barang rusak/cacat',platform:'Shopee',total_price:210000,restocked:false,items:[{id:'sp3',name:'Tumbler 500ml',qty:2}]},
    {id:'r3',workspace_id:'w1',transaction_date:iso(now-3*86400000),kind:'retur',reason:'Salah kirim',platform:'Tokopedia',total_price:65000},
    {id:'r4',workspace_id:'w1',transaction_date:iso(now-4*86400000),kind:'batal',reason:'Stok habis',platform:'Shopee',total_price:120000}];
})();`;
