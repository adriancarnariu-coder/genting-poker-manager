import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawSocial,socialPages,SOCIAL_FORMATS} from '../dist/model.js';

const genting={naturalWidth:1440,naturalHeight:620},band={naturalWidth:2000,naturalHeight:107};
const players=n=>Array.from({length:n},(_,i)=>({rank:i+1,name:'Player '+String(i+1).padStart(2,'0'),flight:'A',chips:(n-i)*1000}));
function draw(rows,format,tournament={name:'BPS Main Event',date:'2026-11-24',time:'18:15'},page){
 const text=[],rects=[],images=[];
 const c={fillRect(x,y,w,h){rects.push({x,y,w,h,colour:this.fillStyle});},drawImage(...a){images.push(a);},save(){},restore(){},measureText(v){return {width:String(v).length*parseFloat(this.font.match(/[\d.]+px/)[0])*.55};},fillText(value,x,y,max){text.push({value:String(value),x,y,max,font:this.font});}};
 const canvas={getContext:()=>c};drawSocial(canvas,rows,genting,tournament,band,{page},format);
 return {canvas,text,rects,images};
}
const pageSet=(all,format)=>{const pages=socialPages(all,format);return pages.map((rows,i)=>({rows,page:pages.length>1?{number:i+1,total:pages.length,totalPlayers:all.length,measureRows:all}:undefined}));};

test('exact sizes: post 1080 × 1080 with 15 per page, Story 1080 × 1920 with 20 per page',()=>{
 assert.deepEqual([SOCIAL_FORMATS.square.width,SOCIAL_FORMATS.square.height,SOCIAL_FORMATS.square.perPage],[1080,1080,15]);
 assert.deepEqual([SOCIAL_FORMATS.story.width,SOCIAL_FORMATS.story.height,SOCIAL_FORMATS.story.perPage],[1080,1920,20]);
 assert.deepEqual(socialPages(players(40),SOCIAL_FORMATS.square).map(p=>p.length),[15,15,10]);
 assert.deepEqual(socialPages(players(40),SOCIAL_FORMATS.story).map(p=>p.length),[20,20]);
 for(const f of Object.values(SOCIAL_FORMATS)){const {canvas}=draw(players(f.perPage),f);assert.equal(canvas.width,f.width);assert.equal(canvas.height,f.height);}
});

test('every player of every page is drawn, inside the image and above the responsible gambling band',()=>{
 for(const f of Object.values(SOCIAL_FORMATS))for(const n of [1,7,f.perPage,f.perPage*3+4]){
  for(const {rows,page} of pageSet(players(n),f)){
   const r=draw(rows,f,{name:'BPS Main Event',date:'2026-11-24',time:'18:15',prizePool:'14250'},page);
   const names=r.text.filter(t=>t.value.startsWith('Player '));assert.equal(names.length,rows.length);
   const bandImage=r.images.find(a=>a[0]===band);assert(bandImage,'band drawn');
   const bandTop=bandImage[2];for(const t of names)assert(t.y<bandTop-10&&t.y>0,`n=${n}`);
   const edge=f.key==='story'?f.height-f.bottom:f.height,rowBottoms=r.rects.filter(x=>x.x===40&&x.h<100&&['#202124','#292A2D','#33301F'].includes(x.colour)).map(x=>x.y+x.h);
   assert(bandImage[2]+bandImage[4]<=edge+1,'band inside the image and above the Story safe zone');
   if(rows.length===f.perPage&&(!page||page.number===1)){const tableEnd=Math.max(...rowBottoms),above=bandImage[2]-tableEnd,below=edge-(bandImage[2]+bandImage[4]);assert(Math.abs(above-below)<=1,`equal gaps ${above} / ${below}`);assert(above>=23);const red=r.rects.find(x=>x.colour==='#cc1428'&&x.h===2);assert(red.y>0);}
  }
 }
});

test('Story keeps key content out of the top 230 px and the bottom 270 px',()=>{
 const f=SOCIAL_FORMATS.story,r=draw(players(20),f,{name:'BPS Main Event',date:'2026-11-24',time:'18:15',paid:'8',prizePool:'14250'});
 for(const t of r.text)assert(t.y>=230&&t.y<=1920-270,t.value);
 for(const i of r.images)assert(i.at(-3)>=230&&i.at(-3)+i.at(-1)<=1920-270+1);
});

test('chip leader, IN THE MONEY and page labels work in the social formats',()=>{
 const f=SOCIAL_FORMATS.square,all=players(40),pages=pageSet(all,f);
 const results=pages.map(({rows,page})=>draw(rows,f,{name:'BPS',time:'18:15',paid:'20'},page));
 assert.deepEqual(results.map(r=>r.rects.filter(x=>x.colour==='#33301F').length),[1,0,0]);assert(!results.some(r=>r.text.some(t=>/chip leader/i.test(t.value))));
 assert.deepEqual(results.map(r=>r.rects.filter(x=>x.colour==='#D4AF37'&&x.h===4).length),[0,1,0]);
 assert(!results.some(r=>r.text.some(t=>/ITM/.test(t.value))));
 results.forEach((r,i)=>assert(r.text.some(t=>t.value===`${i+1} / 3`)));
 assert(results.every(r=>r.text.some(t=>t.value==='18:15')&&r.text.some(t=>t.value==='40 qualified')));
 assert(results.every(r=>r.rects.filter(x=>x.colour==='#202124'||x.colour==='#292A2D'||x.colour==='#33301F').map(x=>x.h).filter(h=>h<100).every((h,_,a)=>h===a[0])),'same row height on every page');
});

test('a single page has no page label and too many rows for one page is refused',()=>{
 assert(!draw(players(5),SOCIAL_FORMATS.square).text.some(t=>/^\d+ \/ \d+$/.test(t.value)));
 assert.throws(()=>draw(players(16),SOCIAL_FORMATS.square),/Too many players/);
});

test('top 3 discs also appear in the post and Story formats, only on the page holding ranks 1-3',()=>{
 for(const f of Object.values(SOCIAL_FORMATS)){
  const all=players(f.perPage+5),pages=socialPages(all,f);
  const counts=pages.map((rows,i)=>{const discs=[];const c={fillRect(){},drawImage(){},beginPath(){},arc(){discs.push(this.fillStyle);},fill(){},measureText(v){return {width:String(v).length*10};},fillText(){}};drawSocial({getContext:()=>c},rows,genting,{time:''},band,{page:{number:i+1,total:pages.length,totalPlayers:all.length,measureRows:all}},f);return discs;});
  assert.deepEqual(counts,[['#D4AF37','#C9CDD2','#C88A4A'],[]]);
 }
});

test('big blinds appear next to every stack in the post and Story formats',()=>{
 for(const f of Object.values(SOCIAL_FORMATS)){
  const r=draw(players(10),f,{time:'',bb:'2000'});
  assert.deepEqual(r.text.filter(t=>t.value.endsWith(' BB')).map(t=>t.value),Array.from({length:10},(_,i)=>((10-i)*1000/2000).toLocaleString('en-GB',{maximumFractionDigits:1})+' BB'));
  assert(!draw(players(10),f,{time:''}).text.some(t=>t.value.endsWith(' BB')));
 }
});
