import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawLeaderboard,validTournamentTime,formatTournamentTime,JPEG_COLUMNS,layout} from '../dist/model.js';
const genting={naturalWidth:1440,naturalHeight:620};
function render(n,details,branding){
 const text=[],rects=[],images=[];
 const c={fillRect(...r){rects.push({r,colour:this.fillStyle});},drawImage(...r){images.push(r);},save(){},restore(){},beginPath(){},ellipse(){},stroke(){},rect(){},clip(){},setTransform(){},measureText(v){return {width:Array.from(v).length*parseFloat(this.font.match(/[\d.]+px/)[0])*.6};},fillText(value,x,y,maxWidth=Infinity){text.push({value:String(value),x,y,align:this.textAlign,font:this.font,colour:this.fillStyle,width:Math.min(maxWidth,this.measureText(String(value)).width)});}};
 const canvas={getContext:()=>c};drawLeaderboard(canvas,Array.from({length:n},(_,i)=>({rank:i+1,name:'J. S.',flight:'A',chips:n-i})),genting,details,undefined,1,branding);
 // Header images use the 9-argument form: image, source rectangle, destination rectangle.
 const header=images.map(([image,sx,sy,sw,sh,x,y,w,h])=>({image,crop:{x:sx,y:sy,w:sw,h:sh},x,y,w,h}));
 return {canvas,text,rects,header};
}
const size=t=>parseFloat(t.font.match(/[\d.]+px/)[0]);
const wide={naturalWidth:2000,naturalHeight:400},tall={naturalWidth:400,naturalHeight:1200};

test('JPEG header: Genting top-left, tournament logo top-right in equal zones, compact title between them',()=>{
 for(const n of [5,9,40,80,118,150])for(const image of [wide,tall,genting]){
  const {canvas,header,text,rects}=render(n,{name:'BPS London',date:'2026-11-24',time:'18:15'},{tournamentLogo:{image}});
  assert.equal(header.length,2);const [left,right]=header;
  assert.equal(left.image,genting);assert.equal(right.image,image);
  assert.equal(left.x,40);assert(Math.abs(right.x+right.w-(canvas.width-40))<1e-9);
  assert(Math.abs((left.y+left.h/2)-(right.y+right.h/2))<1e-9);
  assert(Math.abs(right.w/right.h-image.naturalWidth/image.naturalHeight)<1e-9);
  assert(Math.abs(left.w/left.h-1440/620)<1e-9);
  assert(right.w<=left.w+1e-9&&right.h<=left.h+1);
  // "<name> · Day 2" sits between the logos (one line, or the name with "Day 2" on its own line).
  const title=text.filter(t=>t.font.startsWith('800 '));
  assert(['BPS London · Day 2','BPS London Day 2'].includes(title.map(t=>t.value).join(' ')),title.map(t=>t.value).join('|'));
  assert(title.every(t=>t.align==='center'&&t.x===canvas.width/2&&t.x-t.width/2>left.x+left.w&&t.x+t.width/2<right.x));
  const info=text.find(t=>t.value==='24 Nov 2026 · 18:15');assert(text.some(t=>t.value===n+' qualified'&&t.y>info.y));
  assert(info);assert(info.y>title.at(-1).y);assert(title[0].y<Math.max(left.y+left.h,right.y+right.h));
  const line=rects.find(r=>r.colour==='#cc1428'&&r.r[3]===2).r;assert(line[1]>info.y+size(info)/2);
  assert(!text.some(t=>/QUALIFIED PLAYER|DAY 2 LEADERBOARD/.test(t.value)));
  assert.deepEqual(text.filter(t=>JPEG_COLUMNS.includes(t.value)).map(t=>t.value),Array.from({length:layout(n).sections},()=>JPEG_COLUMNS).flat());
 }
});

test('without a tournament logo Genting stays top-left and the right zone stays empty',()=>{
 const {header,text}=render(20,{name:'Deep Stack',date:'2026-12-03',time:'16:15'});
 assert.equal(header.length,1);assert.equal(header[0].image,genting);assert.equal(header[0].x,40);
 assert(['Deep Stack · Day 2','Deep Stack Day 2'].includes(text.filter(t=>t.font.startsWith('800 ')).map(t=>t.value).join(' ')));
 assert(text.some(t=>t.value==='03 Dec 2026 · 16:15'));assert(text.some(t=>t.value==='20 qualified'));
 assert(!text.some(t=>/chip leader/i.test(t.value)));
});

test('the visible crop of each logo is used as the source rectangle, so transparent margins are ignored',()=>{
 const crop={x:100,y:50,w:800,h:200};
 const {header}=render(10,{name:'X'},{gentingCrop:{x:10,y:20,w:1400,h:560},tournamentLogo:{image:wide,crop}});
 assert.deepEqual(header[0].crop,{x:10,y:20,w:1400,h:560});assert.deepEqual(header[1].crop,crop);
 assert(Math.abs(header[1].w/header[1].h-4)<1e-9);
});

test('long titles use at most two lines, shrinking first, and stay between the logos above the table',()=>{
 for(const name of ['A very long tournament name with accents É and an unbroken word '+'W'.repeat(180),('Genting Poker Series Main Event London Championship ').repeat(6)]){
  const {text,header,canvas,rects}=render(60,{name,date:'2026-11-24',time:'18:15'},{tournamentLogo:{image:wide}});
  const title=text.filter(t=>t.font.startsWith('800 '));
  assert(title.length>=1&&title.length<=2);
  const [left,right]=header;
  assert(title.every(t=>t.align==='center'&&t.x-t.width/2>=left.x+left.w-1e-6&&t.x+t.width/2<=right.x+1e-6));
  const line=rects.find(r=>r.colour==='#cc1428'&&r.r[3]===2).r;assert(title.every(t=>t.y<line[1]));
  assert(text.some(t=>t.value==='24 Nov 2026 · 18:15'));assert(text.some(t=>t.value==='60 qualified'));
 }
});

test('optional header fields leave no stray separators or invented values',()=>{
 const info=r=>r.text.filter(t=>t.font.startsWith('600 ')&&!/qualified|prize pool|[Ff]lights? played|^ +· +$/.test(t.value)).map(t=>t.value);
 assert.deepEqual(info(render(1,{})),[]);
 assert.deepEqual(info(render(1,{date:'2026-12-03'})),['03 Dec 2026']);
 assert.deepEqual(info(render(1,{time:'00:00'})),['00:00']);
 assert.deepEqual(info(render(1,{date:'2026-12-03',time:'23:59'})),['03 Dec 2026 · 23:59']);
 assert(render(1,{}).text.some(t=>t.value==='1 qualified'));
 assert.equal(render(1,{}).text.filter(t=>t.font.startsWith('800 ')).map(t=>t.value).join(' '),'Day 2 Leaderboard','no name: generic title');
 for(const r of [render(1,{}),render(1,{date:'2026-12-03'})])assert(!r.text.some(t=>/^ ·|· $|·  ·/.test(t.value)));
 assert(!render(1,{date:'2026-02-30'}).text.some(t=>/Feb|Mar/.test(t.value)));
});

test('invalid entered times block export and valid 24-hour boundaries work',()=>{
 for(const value of ['', '00:00','18:30','23:59','00.00','18.30','23.59'])assert(validTournamentTime(value));
 for(const value of ['24.00','12.60','24:00','12:60','1:30','18:3','abc','18:30 ']){assert(!validTournamentTime(value));assert.throws(()=>render(1,{time:value}),/00:00 to 23:59/);}
});

test('saved colon times and newly entered dot times display identically without changing the time',()=>{for(const [input,expected] of [['18:30','18:30'],['00:00','00:00'],['23:59','23:59'],['18.30','18:30'],['',''],['24.00','24.00']])assert.equal(formatTournamentTime(input),expected);});

test('flights line appears under the qualified line even without the number of flights',()=>{
 const r=render(3,{date:'2026-12-03'});
 const qualified=r.text.find(t=>t.value==='3 qualified'),flights=r.text.find(t=>t.value==='Flights played: 1A');
 assert(qualified&&flights);assert(flights.y>qualified.y);
});
