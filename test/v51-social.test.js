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

test('exact sizes: post 1080 × 1080 with 20 per page, Story 1080 × 1920 with 20 per page',()=>{
 assert.deepEqual([SOCIAL_FORMATS.square.width,SOCIAL_FORMATS.square.height,SOCIAL_FORMATS.square.perPage],[1080,1080,20]);
 assert.deepEqual([SOCIAL_FORMATS.story.width,SOCIAL_FORMATS.story.height,SOCIAL_FORMATS.story.perPage],[1080,1920,20]);
 assert.deepEqual(socialPages(players(29),SOCIAL_FORMATS.square).map(p=>p.length),[20,9],'29 players: 1-20 then 21-29');
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
 const f=SOCIAL_FORMATS.square,all=players(50),pages=pageSet(all,f);
 const results=pages.map(({rows,page})=>draw(rows,f,{name:'BPS',time:'18:15',paid:'30'},page));
 assert.deepEqual(results.map(r=>r.rects.filter(x=>x.colour==='#33301F'||(x.colour==='#D4AF37'&&(x.w===3||x.h===3))).length),[0,0,0],'no gold frame or tint on the leader row');assert(!results.some(r=>r.text.some(t=>/chip leader/i.test(t.value))));
 assert.deepEqual(results.map(r=>r.rects.filter(x=>x.colour==='#D4AF37'&&x.h===4).length),[0,1,0]);
 assert(!results.some(r=>r.text.some(t=>/ITM/.test(t.value))));
 results.forEach((r,i)=>{assert(r.text.some(t=>t.value.endsWith(`Day 2 · ${i+1}/3`)),'page indicator next to the title');assert(!r.text.some(t=>/^\d+ \/ \d+$/.test(t.value)),'no corner page label on the post');});
 assert(results.every(r=>r.text.some(t=>t.value==='18:15')&&r.text.some(t=>t.value==='50 qualified')));
 assert(results.every(r=>r.rects.filter(x=>x.colour==='#202124'||x.colour==='#292A2D'||x.colour==='#33301F').map(x=>x.h).filter(h=>h<100).every((h,_,a)=>h===a[0])),'same row height on every page');
});

test('a single page has no page label and too many rows for one page is refused',()=>{
 assert(!draw(players(5),SOCIAL_FORMATS.square).text.some(t=>/^\d+ \/ \d+$/.test(t.value)));
 assert.throws(()=>draw(players(21),SOCIAL_FORMATS.square),/Too many players/);
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
  assert(r.text.some(t=>t.value==='BB'),'BB heading');for(let i=0;i<10;i++)assert(r.text.some(t=>t.value===String(Math.round((10-i)*1000/2000))),'whole BB '+i);
  assert(!draw(players(10),f,{time:''}).text.some(t=>t.value==='BB'),'no BB column without a big blind');
 }
});


test('logo palette and day backgrounds: gold logo gives a warm palette, seven variants, Genting grey without a palette',async()=>{
 const {logoPalette}=await import('../dist/branding.js');const {dayTheme,dayIndex,DAY_NAMES}=await import('../dist/model.js');
 const px=(rgb,n)=>{const a=[];for(let i=0;i<n;i++)a.push(...rgb,255);return a;};
 const gold=logoPalette([...px([0,0,0],500),...px([201,169,106],200),...px([255,255,255],100)]);
 assert.deepEqual(gold.accent,[201,169,106]);assert(gold.hue>=35&&gold.hue<=45,String(gold.hue));
 assert.equal(logoPalette([...px([0,0,0],500),...px([255,255,255],500),...px([128,128,128],500)]),null,'no clear colour');
 assert.deepEqual(['2026-11-23','2026-11-24','2026-11-25','2026-11-26','2026-11-27','2026-11-28','2026-11-29'].map(dayIndex),[0,1,2,3,4,5,6]);
 assert.equal(dayIndex(''),0);assert.equal(DAY_NAMES[dayIndex('2026-11-27')],'Friday');
 assert.equal(dayTheme(null,'2026-11-27'),null);
 const calls=[];const ctx={createLinearGradient(){return {addColorStop(o,c){calls.push(c);}};},createRadialGradient(){return {addColorStop(o,c){calls.push(c);}};},fillRect(){},set fillStyle(v){calls.push(v);}};
 for(let day=0;day<7;day++){const t=dayTheme(gold,'2026-11-'+String(23+day));assert.equal(t.day,day);t.paint(ctx,100,100);}
 assert(calls.filter(c=>typeof c==='string').every(c=>!/hsla\(\d+,\d+%,(1[7-9]|[2-9]\d)%/.test(c)),'backgrounds stay dark (lightness under 17%)');
 assert(calls.some(c=>typeof c==='string'&&c.startsWith('hsla('+gold.hue+',')),'uses the logo hue');
 const rects=[];const c2={createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};},fillRect(x,y,w,h){rects.push({x,y,w,h,colour:this.fillStyle});},drawImage(){},beginPath(){},arc(){},fill(){},measureText(v){return {width:String(v).length*10};},fillText(){}};
 drawSocial({getContext:()=>c2},players(5),genting,{time:''},band,{theme:dayTheme(gold,'2026-11-23')},SOCIAL_FORMATS.square);
 assert.equal(rects[0].w,1080);assert(rects.some(r=>r.colour==='rgba(201,169,106,0.07)'),'alternate rows tinted with the logo colour');
});

test('few players: the responsible gambling band is smaller (64% at 1 player, full size from 10)',async()=>{
 const {bandScale}=await import('../dist/model.js');
 assert.equal(bandScale(1),.64);assert.equal(bandScale(5),.8);assert.equal(bandScale(10),1);assert.equal(bandScale(150),1);
 const h=n=>{let bh=0;const c={fillRect(){},drawImage(...a){if(a[0]===band)bh=a[4];},beginPath(){},arc(){},fill(){},measureText(v){return {width:String(v).length*10};},fillText(){}};drawSocial({getContext:()=>c},players(n),genting,{time:''},band,{},SOCIAL_FORMATS.square);return bh;};
 assert(h(2)<h(12));assert(Math.abs(h(12)-26.4)<1e-9,'post band: half of the previous 44 px, then +20%');
});

test('a short single page is laid out for its own rows: bigger rows, block centred with equal gaps',()=>{
 const f=SOCIAL_FORMATS.square,rowsOf=r=>r.rects.filter(x=>x.x===40&&x.h<120&&['#202124','#292A2D','#33301F'].includes(x.colour));
 const few=draw(players(4),f,{time:'18:15',name:'BPS'}),full=draw(players(15),f,{time:'18:15',name:'BPS'});
 assert(rowsOf(few)[0].h>rowsOf(full)[0].h,'rows are taller with few players');
 const b=few.images.find(a=>a[0]===band),tableEnd=Math.max(...rowsOf(few).map(x=>x.y+x.h)),above=b[2]-tableEnd,below=1080-(b[2]+b[4]);
 assert(Math.abs(above-below)<=1,`${above}/${below}`);
 const sizes=r=>new Set(r.text.filter(t=>t.value.startsWith('Player ')).map(t=>t.font));
 assert.notDeepEqual([...sizes(few)],[...sizes(full)],'bigger text for few players');
});

test('post template: RANK | PLAYER | BB | CHIPS headings on every page, exact chips, no flight column',()=>{
 const f=SOCIAL_FORMATS.square,all=players(29).map(p=>({...p,chips:p.chips*1000+500})),pages=pageSet(all,f);
 pages.forEach(({rows,page})=>{const r=draw(rows,f,{time:'18:15',bb:'2000'},page);
  for(const h of ['RANK','PLAYER','BB','CHIPS'])assert(r.text.some(t=>t.value===h),h+' heading on page '+page.number);
  assert(!r.text.some(t=>/^Day 1[A-H]$/.test(t.value)),'no qualified-from column');
  const bbText=r.text.find(t=>t.value==='BB'),chips=r.text.find(t=>t.value==='CHIPS');assert(chips.x-bbText.x>=150,'BB and CHIPS columns well apart');
 });
 const r=draw(pages[0].rows,f,{time:'18:15'},pages[0].page);
 assert(r.text.some(t=>t.value===all[0].chips.toLocaleString('en-GB'))&&all[0].chips.toLocaleString('en-GB').includes(','),'exact chips with thousands separator');assert(!r.text.some(t=>t.value==='BB'),'no BB heading without a big blind');
});

test('logo background: thin gold frame on all four sides, every day',async()=>{
 const {dayTheme}=await import('../dist/model.js');
 const palette={accent:[201,169,106],hue:40,sat:.5};
 for(let d=23;d<=29;d++){const rects=[];const c={createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};},fillRect(x,y,w,h){rects.push([x,y,w,h,this.fillStyle]);}};
  dayTheme(palette,'2026-11-'+d).paint(c,1080,1080);const gold=rects.filter(r=>String(r[4]).startsWith('rgba(201,169,106'));
  assert.deepEqual(gold.map(r=>r.slice(0,4)),[[0,0,1080,3],[0,1077,1080,3],[0,0,3,1080],[1077,0,3,1080]],'day '+d);}
});
