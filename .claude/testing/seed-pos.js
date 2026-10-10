// Seed Kasir / POS: kafe kecil, struk hari ini tersebar per jam, metode bayar dan tipe pesanan bervariasi.
module.exports = require('./seed.js') + `
(function(){
  const P=[['Kopi Susu',22000,8000],['Americano',18000,5000],['Roti Bakar Cokelat',20000,8000],['Nasi Goreng Spesial',28000,12000],['Es Teh Manis',8000,2000],['Matcha Latte',26000,11000]];
  const PAY=['Tunai','QRIS','QRIS','Debit','Tunai','QRIS'], TYPE=['Dine In','Take Away','Dine In','GrabFood','Dine In','Take Away'];
  const HRS=[8,9,9,10,10,10,11,11,12,12,12,12,13,13,13,13,13,14,14,15,15,16,17,17,17,18];
  T.package_masters=P.map((p,i)=>({id:'k'+i,workspace_id:'w1',code:'K'+(i+1),name:p[0],price:p[1],cost_price:p[2],is_active:true}));
  T.transactions=[];
  const today=new Date();
  HRS.forEach((h,i)=>{
    const d=new Date(today.getFullYear(),today.getMonth(),today.getDate(),h,(i*7)%60);
    const p=P[(i*5+i%4)%P.length], q=1+(i%3);
    const items=[{id:'k'+P.indexOf(p),name:p[0],code:p[0],qty:q,unit_price:p[1],subtotal:p[1]*q,cost_price:p[2],cost_subtotal:p[2]*q}];
    const total=items.reduce((s,x)=>s+x.subtotal,0);
    T.transactions.push({id:'tx'+i,workspace_id:'w1',transaction_date:iso(d),created_at:d.toISOString(),reading_started_at:d.toISOString(),reading_status:'done',customer_name:'Struk '+(i+1),platform:TYPE[i%TYPE.length],payment_method:PAY[i%PAY.length],package_code:p[0],order_items:items,order_topics:[],order_addons:[],total_price:total,tip_amount:0,price_adjustment_amount:0});
  });
})();`;
