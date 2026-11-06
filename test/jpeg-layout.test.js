import test from 'node:test';
import assert from 'node:assert/strict';
import {drawLeaderboard,layout} from '../dist/model.js';
function render(n,name){
 const texts=[],rects=[];const c={font:'',beginPath(){},rect(){},ellipse(){},stroke(){},fillRect(x,y,w,h){rects.push({x,y,w,h,colour:this.fillStyle});},drawImage(){},save(){},restore(){},measureText(v){return {width:Array.from(String(v)).length*parseFloat(this.font.replace('bold ',''))*.6};},fillText(v,x,y){texts.push({value:String(v),x,y,font:this.font,align:this.textAlign,width:this.measureText(v).width});}};
 const canvas={getContext:()=>c};drawLeaderboard(canvas,Array.from({length:n},(_,i)=>({rank:i+1,name,flight:'Day 1A',chips:1000000+n-i})),{naturalWidth:1440,naturalHeight:620},{name:'Deep Stack',time:'18:17'},{naturalWidth:7070,naturalHeight:379});return {canvas,texts,rects};
}
test('balanced equal-width sections retain rank order and aligned outer margins for every required total',()=>{
 for(const n of [1,9,29,66,79,118,147]){
  const {canvas,texts,rects}=render(n,'Player Name'),ranks=texts.filter(t=>/^\d+$/.test(t.value)&&Number(t.value)<=n),columns=[...new Set(ranks.map(r=>r.x))],counts=columns.map(x=>ranks.filter(r=>r.x===x).length);
  assert.deepEqual(ranks.map(t=>Number(t.value)),Array.from({length:n},(_,i)=>i+1));assert.equal(columns.length,layout(n).sections);assert(Math.max(...counts)-Math.min(...counts)<=1);
  const bands=rects.filter(r=>['#292A2D','#202124'].includes(r.colour)&&r.x>=40);assert.equal(bands.length,n);assert(bands.every(r=>r.w===bands[0].w&&r.h===bands[0].h));assert.equal(bands[0].x,40);assert.equal(Math.round(bands.at(-1).x+bands.at(-1).w),canvas.width-40);
  assert(ranks.every(r=>r.align==='right'));assert(texts.filter(t=>t.value.includes(',')).every(t=>t.align==='right'));
 }
});
test('long names wrap to at most two complete lines at a uniform font and row height, widening instead of clipping',()=>{
 const short=render(9,'Player Name');
 for(const name of ['Constantin-Adrian Alexandrescu '+ 'Alexandrescu '.repeat(5),'É'+ 'W'.repeat(190)+'-Ș']){
  const {canvas,texts,rects}=render(118,name),names=texts.filter(t=>t.font==='27px Arial'&&t.align==='left'&&t.value!=='Day 1A'),rowRects=rects.filter(r=>['#292A2D','#202124'].includes(r.colour)&&r.x>=40);
  assert(names.length>=118&&names.length<=236);const lines=names.slice(0,names.length/118);assert.equal(lines.map(t=>t.value).join('').replace(/\s/g,''),name.replace(/\s/g,''));assert(names.every(t=>t.font==='27px Arial'));assert(rowRects.every(r=>r.h===rowRects[0].h));assert(rowRects[0].h>short.rects.find(r=>r.colour==='#202124'&&r.x>=40).h);
  for(const t of names){const row=rowRects.find(r=>t.y>=r.y&&t.y<=r.y+r.h&&t.x>=r.x&&t.x<r.x+r.w);assert(row);assert(t.x+t.width<row.x+row.w);assert(t.y<canvas.height);}
 }
});
