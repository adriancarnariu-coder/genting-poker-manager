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

test('JPEG header: Genting top-left and tournament logo top-right in equal zones with symmetric margins',()=>{
 for(const n of [5,9,40,80,118,150])for(const image of [wide,tall,genting]){
  const {canvas,header,text,rects}=render(n,{name:'BPS London',date:'2026-11-24',time:'18:15'},{tournamentLogo:{image}});
  assert.equal(header.length,2);const [left,right]=header;
  assert.equal(left.image,genting);assert.equal(right.image,image);
  assert.equal(left.x,40);assert(Math.abs(right.x+right.w-(canvas.width-40))<1e-9);
  // Both logos are vertically centred on the same axis and keep their original proportions.
  assert(Math.abs((left.y+left.h/2)-(right.y+right.h/2))<1e-9);
  assert(Math.abs(right.w/right.h-image.naturalWidth/image.naturalHeight)<1e-9);
  assert(Math.abs(left.w/left.h-1440/620)<1e-9);
  // Equal zone size: the Genting logo fills its zone, the tournament logo fits inside one of the same size.
  assert(right.w<=left.w+1e-9&&right.h<=left.h+1);
  const title=text.find(t=>t.value==='BPS London'),date=text.find(t=>t.value==='24 Nov 2026 · 18:15');
  assert(title&&date);assert.equal(title.align,'center');assert.equal(title.x,canvas.width/2);assert.equal(date.x,canvas.width/2);
  assert(title.y-size(title)/2>Math.max(left.y+left.h,right.y+right.h));
  assert(date.y>title.y);assert(!text.some(t=>t.y>title.y&&t.y<date.y));
  const line=rects.find(r=>r.colour==='#cc1428'&&r.r[3]===2).r;assert(line[1]>date.y+size(date)/2);
  assert.deepEqual(text.filter(t=>JPEG_COLUMNS.includes(t.value)).map(t=>t.value),Array.from({length:layout(n).sections},()=>JPEG_COLUMNS).flat());
 }
});

test('without a tournament logo Genting stays top-left and the right zone stays empty',()=>{
 const {header,text}=render(20,{name:'Deep Stack',date:'2026-12-03',time:'16:15'});
 assert.equal(header.length,1);assert.equal(header[0].image,genting);assert.equal(header[0].x,40);
 assert(text.some(t=>t.value==='DAY 2 LEADERBOARD'));assert(text.some(t=>t.value==='20 QUALIFIED PLAYERS'));
});

test('the visible crop of each logo is used as the source rectangle, so transparent margins are ignored',()=>{
 const crop={x:100,y:50,w:800,h:200};
 const {header}=render(10,{name:'X'},{gentingCrop:{x:10,y:20,w:1400,h:560},tournamentLogo:{image:wide,crop}});
 assert.deepEqual(header[0].crop,{x:10,y:20,w:1400,h:560});assert.deepEqual(header[1].crop,crop);
 assert(Math.abs(header[1].w/header[1].h-4)<1e-9);
});

test('long titles use at most two lines, shrinking first, and never touch the logo row',()=>{
 for(const name of ['A very long tournament name with accents É and an unbroken word '+'W'.repeat(180),('Genting Poker Series Main Event London Championship ').repeat(6)]){
  const {text,header,canvas}=render(60,{name,date:'2026-11-24',time:'18:15'},{tournamentLogo:{image:wide}});
  const title=text.filter(t=>t.font.startsWith('800 '));
  assert(title.length>=1&&title.length<=2);
  assert(title.every(t=>t.width<=(canvas.width-80)*.86+1e-9&&t.align==='center'));
  assert(title.every(t=>t.y-size(t)/2>Math.max(...header.map(h=>h.y+h.h))));
  assert(text.some(t=>t.value==='24 Nov 2026 · 18:15'));
 }
});

test('optional header fields leave no stray separators or invented values',()=>{
 const empty=render(1,{}),date=render(1,{date:'2026-12-03'}),time=render(1,{time:'00:00'}),both=render(1,{date:'2026-12-03',time:'23:59'});
 assert(!empty.text.some(t=>t.value.includes(' · ')));
 assert(date.text.some(t=>t.value==='03 Dec 2026'));assert(!date.text.some(t=>t.value.includes(' · ')));
 assert(time.text.some(t=>t.value==='00:00'));
 assert(both.text.some(t=>t.value==='03 Dec 2026 · 23:59'));
 assert(empty.canvas.height<=both.canvas.height);
 assert(!render(1,{date:'2026-02-30'}).text.some(t=>/Feb|Mar/.test(t.value)));
});

test('invalid entered times block export and valid 24-hour boundaries work',()=>{
 for(const value of ['', '00:00','18:30','23:59','00.00','18.30','23.59'])assert(validTournamentTime(value));
 for(const value of ['24.00','12.60','24:00','12:60','1:30','18:3','abc','18:30 ']){assert(!validTournamentTime(value));assert.throws(()=>render(1,{time:value}),/00:00 to 23:59/);}
});

test('saved colon times and newly entered dot times display identically without changing the time',()=>{for(const [input,expected] of [['18:30','18:30'],['00:00','00:00'],['23:59','23:59'],['18.30','18:30'],['',''],['24.00','24.00']])assert.equal(formatTournamentTime(input),expected);});
