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
  const aspect=band.naturalWidth/band.naturalHeight;
  const minimumWidth=64*aspect;
  const previousWidth=Math.min(line[2],Math.max(.8*Math.min(line[2],Math.max(line[2]*.75,minimumWidth)),minimumWidth));
  assert(Math.abs(w-Math.min(line[2],Math.max(previousWidth*.4,48*aspect)*1.2))<1e-9);
  assert.equal(x,(canvas.width-w)/2);
  assert(Math.abs(w/h-aspect)<1e-9);
  assert.equal(text.filter(t=>t.value==='J. S.').length,n);
  assert.deepEqual(rects[0],{colour:'#202124',r:[0,0,canvas.width,canvas.height]});
  const rowsBottom=Math.max(...rects.filter(r=>r.r[0]>=40&&['#202124','#292A2D'].includes(r.colour)).map(r=>r.r[1]+r.r[3]));
  assert.equal(y,Math.ceil(rowsBottom+14));
  const naturalHeight=Math.ceil(y+h+8);
  assert.equal(canvas.height,n===118&&canvas.width===3610?Math.max(2918,naturalHeight):naturalHeight);
  assert(rects.filter(r=>r.r[1]>=rowsBottom).length===0);


 }
});
test('unavailable footer image is an explicit export error',()=>{
 assert.throws(()=>drawLeaderboard({getContext:()=>({font:'',measureText:()=>({width:1})})},[{rank:1,name:'J. S.',flight:'A',chips:1}],{naturalWidth:1440,naturalHeight:620},{},{naturalWidth:0,naturalHeight:0}),/responsible gambling image could not be loaded/);
});
test('missing Genting logo prevents an incomplete export',()=>{
 assert.throws(()=>drawLeaderboard({},[{rank:1,name:'J. S.',flight:'A',chips:1}],{naturalWidth:0,naturalHeight:0}),/Genting logo could not be loaded/);
});
