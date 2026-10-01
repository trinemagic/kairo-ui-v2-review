// Seller App Premium data on top of seed.js: SELLER_APP transactions with every order status,
// partial payments (Piutang Aktif) and durations that expire soon (Akan Expired).
module.exports = require('./seed.js') + `
const sellerProducts=[['Netflix','Sharing 1P','1 bulan',45000,30000],['Spotify','Individual','1 bulan',25000,15000],['Canva','Pro','7 hari',15000,5000],['YouTube','Family','1 bulan',35000,20000],['CapCut','Pro','14 hari',20000,8000]];
const stat=['new','on_progress','done'];
for(let i=0;i<14;i++){const d=now-i*2.3*86400000,[pr,va,du,price,cost]=sellerProducts[i%5],total=price*(1+(i%2));
 const paid=i%4===1?Math.round(total/2):total;
 T.transactions.unshift({id:'stx'+i,workspace_id:'w1',transaction_date:iso(d),created_at:new Date(d).toISOString(),reading_started_at:new Date(d).toISOString(),reading_status:i%3===2?'done':'on_progress',
  customer_name:['Nadia Putri','Rafi','Sekar','Tomi','Umi'][i%5],customer_id:'c'+(i%5),platform:plats[i%5],payment_method:['QRIS','TRANSFER','CASH'][i%3],
  device:i%2?'iPhone 13':'Android',admin_fh:i%3?'Admin A':null,warranty:i%2?'30 hari':null,
  package_code:'SELLER_APP',package_qty:1+(i%2),topic_name:'Seller App Premium',total_price:total,tip_amount:0,
  order_items:[{code:pr,name:pr+' · '+va+' · '+du,category:'Streaming',product:pr,variant:va,duration:du,qty:1+(i%2),unit_price:price,subtotal:total,cost_price:cost,cost_subtotal:cost*(1+(i%2)),seller_payment_received:paid,seller_payment_total:total,seller_order_status:stat[i%3]}],
  order_topics:[{name:'Seller App Premium'}],order_addons:[]});}
`;
