import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {drawLeaderboard} from '../dist/model.js';
const png=readFileSync(new URL('../dist/responsible-gambling.png',import.meta.url));
const band={naturalWidth:png.readUInt32BE(16),naturalHeight:png.readUInt32BE(20)};
test('original PNG footer appears once below every player centred at a readable reduced width and original proportions',()=>{
 for(const n of [1,9,29,66,79,118,147]){
  const images=[],rects=[],text=[];const c={fillRect(...r){rects.push({r,colour:this.fillStyle});},drawImage(...r){images.push(r);},save(){},restore(){},beginPath(){},ellipse(){},stroke(){},rect(){},clip(){},measureText(s){return {width:String(s).length*12};},fillText(value,x,y){text.push({value,y});}};
  const canvas={getContext:()=>c};drawLeaderboard(canvas,Array.from({length:n},(_,i)=>({rank:i+1,name:'J. S.',flight:'A',chips:n-i})),{naturalWidth:1440,naturalHeight:620},{},band);
  const drawn=images.filter(i=>i[0]===band);assert.equal(drawn.length,1);const [,x,y,w,h]=drawn[0],line=rects.find(r=>r.colour==='#cc1428').r;
  assert.equal(w,Math.min(line[2],Math.max(.8*Math.min(line[2],Math.max(line[2]*.75,64*band.naturalWidth/band.naturalHeight)),64*band.naturalWidth/band.naturalHeight)));assert.equal(x,canvas.width-(x+w));assert(Math.abs(w/h-band.naturalWidth/band.naturalHeight)<1e-9);assert(y>Math.max(...text.map(t=>t.y))+30);assert(canvas.height>=y+h+14);assert.equal(text.filter(t=>t.value==='J. S.').length,n);
  assert(rects.some(r=>r.colour==='#202124'&&r.r[0]===0&&r.r[1]<=y&&r.r[1]+r.r[3]>=y+h));
  const margin=n<=29?32:n<=79?40:44,logo=images[0];
  if(n>29)assert(Math.abs(logo[2]-(line[1]-(logo[2]+logo[4])))<1e-9);
  assert(logo[2]>=margin);const rowRects=rects.filter(r=>r.r[0]>=40&&['#202124','#292A2D'].includes(r.colour)),footerTop=Math.max(...rowRects.map(r=>r.r[1]+r.r[3])),topGap=y-footerTop,bottomGap=canvas.height-y-h;assert(topGap>=14&&bottomGap>=14);assert(Math.abs(topGap-bottomGap)<1e-9);const pitch=rowRects[0].r[3]+3,oldY=Math.ceil(footerTop+3+24),oldHeight=Math.ceil(oldY+h+14);assert.equal(canvas.height,oldHeight);
 }
});
test('unavailable footer image is an explicit export error',()=>{
 assert.throws(()=>drawLeaderboard({getContext:()=>({font:'',measureText:()=>({width:1})})},[{rank:1,name:'J. S.',flight:'A',chips:1}],{naturalWidth:1440,naturalHeight:620},{},{naturalWidth:0,naturalHeight:0}),/responsible gambling image could not be loaded/);
});
test('missing Genting logo prevents an incomplete export',()=>{
 assert.throws(()=>drawLeaderboard({},[{rank:1,name:'J. S.',flight:'A',chips:1}],{naturalWidth:0,naturalHeight:0}),/Genting logo could not be loaded/);
});
