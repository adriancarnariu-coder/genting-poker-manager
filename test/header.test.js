import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawLeaderboard,validTournamentTime,formatTournamentTime,JPEG_COLUMNS,layout} from '../dist/model.js';
function render(n,details){
 const text=[],rects=[],images=[],ellipses=[];
 const c={fillRect(...r){rects.push({r,colour:this.fillStyle});},drawImage(...r){images.push(r);},save(){},restore(){},beginPath(){},ellipse(...r){ellipses.push(r);},stroke(){},rect(...r){ellipses.push([r[0]+r[2]/2,r[1]+r[3]/2,r[2]/2,r[3]/2]);},clip(){},measureText(v){return {width:Array.from(v).length*parseFloat(this.font.replace('bold ',''))*.6};},fillText(value,x,y){text.push({value:String(value),x,y,align:this.textAlign,font:this.font,width:this.measureText(String(value)).width});}};
 const canvas={getContext:()=>c};drawLeaderboard(canvas,Array.from({length:n},(_,i)=>({rank:i+1,name:'J. S.',flight:'A',chips:n-i})),{naturalWidth:1440,naturalHeight:620},details);
 return {canvas,text,rects,images,ellipses};
}
test('centred title, larger tournament name and time outline avoid overlaps across all image sizes',()=>{
 for(const n of [1,9,29,66,79,118,147])for(const name of ['Deep Stack',('A very long tournament name with accents É and an unbroken word '+ 'W'.repeat(180)+' ').repeat(2)]){
 const {canvas,text,rects,images,ellipses}=render(n,{name,date:'2026-12-03',time:'18:30'}),count=text.find(t=>t.value===n+' QUALIFIED '+(n===1?'PLAYER':'PLAYERS')),title=text.filter(t=>['DAY 2 LEADERBOARD','DAY 2','LEADERBOARD'].includes(t.value)),date=text.find(t=>t.value==='03/12/2026'),time=text.find(t=>t.value==='18:30');
 assert.equal(title.map(t=>t.value).join(' '),'DAY 2 LEADERBOARD');assert(title.every(t=>t.x===canvas.width/2&&t.align==='center'));assert.equal(count.x,canvas.width/2);assert(count.y>title.at(-1).y);assert(time.font.startsWith('bold '));assert(time.y>date.y);
 const image=images[0],metadata=text.filter(t=>t.x===date.x),line=rects.find(r=>r.colour==='#cc1428'&&r.r[3]===2).r,oval=ellipses[0];
 assert.equal(image[3],.92*Math.min(480,(canvas.width-80)*.32));assert.equal(image[1],40);assert(Math.abs(image[3]/image[4]-1440/620)<1e-10);assert(metadata.every(t=>t.x-t.width/2>image[1]+image[3]&&t.x+t.width/2<=canvas.width-40));assert(metadata.some(t=>t.font==='bold 49px Arial'));
 assert.equal(ellipses.length,1);assert.equal(oval[0],time.x);assert.equal(oval[1],time.y);assert(oval[2]>time.width/2);assert(!rects.some(r=>r.colour==='#cc1428'&&r.r[3]===52));assert(text.some(t=>t.value==='STARTS AT'));
 if(layout(n).sections===1){assert(title[0].y-51>Math.max(image[2]+image[4],time.y+26));}else{const titleRight=Math.max(...title.map(t=>t.x+t.width/2),count.x+count.width/2),titleLeft=Math.min(...title.map(t=>t.x-t.width/2),count.x-count.width/2);assert(image[1]+image[3]<titleLeft);assert(metadata.every(t=>t.x-t.width/2>titleRight));}
 assert.equal(line[0],canvas.width-(line[0]+line[2]));assert(line[1]>count.y&&line[1]>time.y);assert(text.find(t=>t.value==='RANK').y>line[1]);assert.equal(text.filter(t=>t.value==='J. S.').length,n);assert.deepEqual(text.filter(t=>JPEG_COLUMNS.includes(t.value)).map(t=>t.value),Array.from({length:layout(n).sections},()=>JPEG_COLUMNS).flat());assert(text.every(t=>t.y<canvas.height));
 }
});
test('optional header fields leave no stray separators or invented values',()=>{
 const empty=render(1,{}),date=render(1,{date:'2026-12-03'}),time=render(1,{time:'00:00'}),both=render(1,{date:'2026-12-03',time:'23:59'});
 assert(!empty.text.some(t=>t.value.includes(' · ')));assert(date.text.some(t=>t.value==='03/12/2026'));assert(time.text.some(t=>t.value==='00:00'));assert(both.text.some(t=>t.value==='03/12/2026'));assert(both.text.some(t=>t.value==='23:59'));assert(!both.text.some(t=>t.value.includes(' · ')));assert(empty.canvas.height<=both.canvas.height);
});
test('invalid entered times block export and valid 24-hour boundaries work',()=>{
 for(const value of ['', '00:00','18:30','23:59','00.00','18.30','23.59'])assert(validTournamentTime(value));
 for(const value of ['24.00','12.60','24:00','12:60','1:30','18:3','abc','18:30 ']){assert(!validTournamentTime(value));assert.throws(()=>render(1,{time:value}),/00:00 to 23:59/);}
});

test('saved colon times and newly entered dot times display identically without changing the time',()=>{for(const [input,expected] of [['18:30','18:30'],['00:00','00:00'],['23:59','23:59'],['18.30','18:30'],['',''],['24.00','24.00']])assert.equal(formatTournamentTime(input),expected);});
