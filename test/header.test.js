import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawLeaderboard,validTournamentTime,formatTournamentTime,JPEG_COLUMNS,layout} from '../dist/model.js';
function render(n,details){
 const text=[],rects=[],images=[],ellipses=[];
 const c={fillRect(...r){rects.push({r,colour:this.fillStyle});},drawImage(...r){images.push(r);},save(){},restore(){},beginPath(){},ellipse(...r){ellipses.push(r);},stroke(){},rect(...r){ellipses.push([r[0]+r[2]/2,r[1]+r[3]/2,r[2]/2,r[3]/2]);},clip(){},measureText(v){return {width:Array.from(v).length*parseFloat(this.font.match(/[\d.]+px/)[0])*.6};},fillText(value,x,y,maxWidth=Infinity){text.push({value:String(value),x,y,align:this.textAlign,font:this.font,colour:this.fillStyle,width:Math.min(maxWidth,this.measureText(String(value)).width)});}};
 const canvas={getContext:()=>c};drawLeaderboard(canvas,Array.from({length:n},(_,i)=>({rank:i+1,name:'J. S.',flight:'A',chips:n-i})),{naturalWidth:1440,naturalHeight:620},details);
 return {canvas,text,rects,images,ellipses};
}
test('JPEG header keeps the logo, tournament stack and date stack aligned without collisions',()=>{
 for(const n of [5,9,20,40,80,118,150]){
  for(const name of ['Deep Stack',('A very long tournament name with accents É and an unbroken word '+'W'.repeat(180)+' ').repeat(2)]){
   const {canvas,text,rects,images,ellipses}=render(n,{name,date:'2026-12-03',time:'16:15'});
   const count=text.find(t=>t.value===n+' QUALIFIED PLAYERS');
   const title=text.filter(t=>['DAY 2 LEADERBOARD','DAY 2','LEADERBOARD'].includes(t.value));
   const names=text.filter(t=>t.x===count.x&&t.y<title[0].y);
   const right=text.filter(t=>['03 DEC 2026','16:15'].includes(t.value));
   const [date,time]=right;
   const [,x,y,w,h]=images[0];
   const line=rects.find(r=>r.colour==='#cc1428'&&r.r[3]===2).r;
   const centre=[...names,...title,count],fontSize=t=>parseFloat(t.font.match(/[\d.]+px/)[0]);
   const midpoint=lines=>(lines[0].y-fontSize(lines[0])/2+lines.at(-1).y+fontSize(lines.at(-1))/2)/2;
   assert.equal(title.map(t=>t.value).join(' '),'DAY 2 LEADERBOARD');
   assert.equal(names.map(t=>t.value).join('').replace(/\s/g,''),name.replace(/\s/g,''));
   assert(names.every(t=>fontSize(t)>fontSize(title[0])));
   assert(count.y>title.at(-1).y);
   assert(names.every(t=>t.colour==='#F2F2F4'&&t.font.startsWith('800 ')));
   assert([...title,count].every(t=>t.colour==='#C5C8CE'&&t.font==='400 '+fontSize(t)+'px Montserrat'));
   assert.equal(fontSize(title[0]),fontSize(names[0])*.8);
   assert.equal(fontSize(count),fontSize(title[0])*.8);
   assert(!text.some(t=>t.value==='STARTS AT'));
   assert(date.y<time.y&&fontSize(time)>fontSize(date));
   assert.equal(fontSize(date),37.18*1.2);
   assert.equal(date.font,'500 '+(37.18*1.2)+'px Montserrat');
   assert.equal(date.colour,'#C5C8CE');
   assert.equal(time.font,'700 '+(67.6*1.2)+'px Montserrat');
   assert(right.every(t=>t.align==='right'&&t.x===canvas.width-40));
   assert(centre.every(t=>t.align==='center'&&t.x-t.width/2>x+w&&t.x+t.width/2<Math.min(...right.map(t=>t.x-t.width))));
   assert(Math.abs(midpoint(centre)-(y+h/2))<1e-8);
   assert(Math.abs(midpoint(right)-(y+h/2))<1e-8);
   assert.equal(w,1.3*Math.min(390,(canvas.width-80)*(layout(n).sections===3?.35:.29)));
   assert(Math.abs(w/h-1440/620)<1e-10);
   assert.equal(ellipses.length,0);
   assert(line[1]>count.y&&line[1]>time.y);
   assert.equal(text.filter(t=>t.value==='J. S.').length,n);
   assert.deepEqual(text.filter(t=>JPEG_COLUMNS.includes(t.value)).map(t=>t.value),Array.from({length:layout(n).sections},()=>JPEG_COLUMNS).flat());
  }
 }
});
test('optional header fields leave no stray separators or invented values',()=>{
 const empty=render(1,{}),date=render(1,{date:'2026-12-03'}),time=render(1,{time:'00:00'}),both=render(1,{date:'2026-12-03',time:'23:59'});
 assert(!empty.text.some(t=>t.value.includes(' · ')));assert(date.text.some(t=>t.value==='03 DEC 2026'));assert(time.text.some(t=>t.value.endsWith('00:00')));assert(both.text.some(t=>t.value==='03 DEC 2026'));assert(both.text.some(t=>t.value.endsWith('23:59')));assert(!both.text.some(t=>t.value.includes(' · ')));assert(empty.canvas.height<=both.canvas.height);
});
test('invalid entered times block export and valid 24-hour boundaries work',()=>{
 for(const value of ['', '00:00','18:30','23:59','00.00','18.30','23.59'])assert(validTournamentTime(value));
 for(const value of ['24.00','12.60','24:00','12:60','1:30','18:3','abc','18:30 ']){assert(!validTournamentTime(value));assert.throws(()=>render(1,{time:value}),/00:00 to 23:59/);}
});

test('saved colon times and newly entered dot times display identically without changing the time',()=>{for(const [input,expected] of [['18:30','18:30'],['00:00','00:00'],['23:59','23:59'],['18.30','18:30'],['',''],['24.00','24.00']])assert.equal(formatTournamentTime(input),expected);});
