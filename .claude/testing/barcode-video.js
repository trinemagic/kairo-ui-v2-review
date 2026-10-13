// Membuat video y4m berisi barcode EAN-13 (untuk kamera palsu Chromium).
const fs = require('fs');
const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const PAR=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
function bits(code){const d=code.split('').map(Number),p=PAR[d[0]];let b='101';for(let i=0;i<6;i++)b+=(p[i]==='L'?L:G)[d[i+1]];b+='01010';for(let i=0;i<6;i++)b+=R[d[i+7]];return b+'101';}
module.exports=function gen(code,file,{w=640,h=480,mod=4}={}){
  const b=bits(code),Y=Buffer.alloc(w*h,235),bw=b.length*mod,x0=Math.floor((w-bw)/2),y0=Math.floor(h*0.25),y1=Math.floor(h*0.75);
  for(let y=y0;y<y1;y++)for(let i=0;i<b.length;i++)if(b[i]==='1')for(let k=0;k<mod;k++)Y[y*w+x0+i*mod+k]=16;
  const U=Buffer.alloc(w*h/4,128),parts=[Buffer.from(`YUV4MPEG2 W${w} H${h} F10:1 Ip A1:1 C420jpeg\n`)];
  for(let f=0;f<10;f++)parts.push(Buffer.from('FRAME\n'),Y,U,U);
  fs.writeFileSync(file,Buffer.concat(parts));return file;
};
