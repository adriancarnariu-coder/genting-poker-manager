import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawLeaderboard,leaderboardPages,layout,placesPaid,headerText,exportChecks,flightCount,flightsToPlay,prizePool,bigBlind,bbLabel,COLUMN_MAX,PAGE_MAX,PLANNED_MAX} from '../dist/model.js';
import {exportFilename} from '../dist/branding.js';
import {readyMessage} from '../dist/view-mode.js';

const genting={naturalWidth:1440,naturalHeight:620};
const players=n=>Array.from({length:n},(_,i)=>({rank:i+1,name:'Player '+String(i+1).padStart(2,'0'),flight:'A',chips:(n-i)*1000}));
function render(rows,page){
 const text=[],styles=[],rects=[];
 const c={fillRect(x,y,w,h){rects.push({x,y,w,h,colour:this.fillStyle});},drawImage(){},save(){},restore(){},setTransform(){},measureText(v){return {width:Array.from(String(v)).length*parseFloat(this.font.match(/[\d.]+px/)[0])*.6};},fillText(value,x,y){text.push(String(value));styles.push({value:String(value),font:this.font,x,y});}};
 const canvas={getContext:()=>c};drawLeaderboard(canvas,rows,genting,{name:'BPS Main Event',date:'2026-11-24',time:'18:15'},undefined,1,{page});
 return {canvas,text,styles,rects};
}
const drawnColumns=(rows,page)=>page?(rows.length<=COLUMN_MAX?1:2):layout(rows.length).sections;
function render2(rows,page,details){const text=[];const c={fillRect(){},drawImage(){},save(){},restore(){},setTransform(){},measureText(v){return {width:String(v).length*10};},fillText(value){text.push(String(value));}};const canvas={getContext:()=>c};drawLeaderboard(canvas,rows,genting,details,undefined,1,{page});return {text,canvas};}
function pageOptions(all){
 const pages=leaderboardPages(all),first=layout(pages[0].length);
 return pages.map((rows,i)=>({rows,page:pages.length>1?{number:i+1,total:pages.length,totalPlayers:all.length,measureRows:all,sections:first.sections,rows:first.rows}:undefined}));
}

test('limits are 20 players per column and 40 per page',()=>{
 assert.equal(COLUMN_MAX,20);assert.equal(PAGE_MAX,40);
 for(const n of [1,12,20])assert.equal(layout(n).sections,1);
 for(const n of [21,29,33,40])assert.equal(layout(n).sections,2);
});

test('pages are filled to 40 in rank order; 120 is three pages, 160 is four, every player appears once',()=>{
 assert.equal(PLANNED_MAX,160);
 const expected={1:[1],20:[20],21:[21],40:[40],41:[40,1],50:[40,10],54:[40,14],80:[40,40],81:[40,40,1],118:[40,40,38],120:[40,40,40],121:[40,40,40,1],147:[40,40,40,27],160:[40,40,40,40],175:[40,40,40,40,15]};
 for(const [n,sizes] of Object.entries(expected)){
  const pages=leaderboardPages(players(Number(n)));
  assert.deepEqual(pages.map(p=>p.length),sizes,`n=${n}`);
  assert.deepEqual(pages.flat().map(r=>r.rank),Array.from({length:Number(n)},(_,i)=>i+1));
  for(const p of pages)assert(p.length<=PAGE_MAX);
 }
 assert.deepEqual(leaderboardPages([]),[]);
});

test('every column on every page holds at most 20 players',()=>{
 for(const n of [20,21,40,41,50,54,79,118,120,121,147,160]){
  for(const {rows,page} of pageOptions(players(n))){
   const sections=drawnColumns(rows,page);
   assert(Math.ceil(rows.length/sections)<=COLUMN_MAX,`n=${n}`);
   const {text}=render(rows,page);
   assert.equal(text.filter(v=>v==='RANK').length,sections);
   assert.equal(text.filter(v=>v.startsWith('Player ')).length,rows.length);
  }
 }
});

test('all pages of one leaderboard have the same size, total count and a page label',()=>{
 for(const n of [41,50,118,120,147,160]){
  const rendered=pageOptions(players(n)).map(({rows,page})=>render(rows,page));
  assert(rendered.length>1);
  for(const r of rendered){
   assert.equal(r.canvas.width,rendered[0].canvas.width,`width n=${n}`);
   assert.equal(r.canvas.height,rendered[0].canvas.height,`height n=${n}`);
   assert(r.text.includes(n+' qualified'));
  }
  rendered.forEach((r,i)=>assert(r.text.includes(`${i+1} / ${rendered.length}`)));
 }
});

test('a single page has no page label',()=>{
 const {text}=render(players(33));
 assert(!text.some(v=>/^\d+ \/ \d+$/.test(v)));
 assert(text.includes('33 qualified'));
});

test('page filenames are numbered and single files keep the old name',()=>{
 const details={name:'BPS Main Event',date:'2026-11-24'};
 assert.equal(exportFilename(details,2560,2000),'BPS_Main_Event_2026-11-24_Day2_Leaderboard_2560x2000.jpg');
 assert.equal(exportFilename(details,2560,2000,{number:2,total:3}),'BPS_Main_Event_2026-11-24_Day2_Leaderboard_2of3_2560x2000.jpg');
 assert.equal(exportFilename(details,2560,2000,{number:1,total:1}),'BPS_Main_Event_2026-11-24_Day2_Leaderboard_2560x2000.jpg');
});

test('ready message mentions the number of pages',()=>{
 assert.equal(readyMessage(54,2),'2 JPEG pages ready — includes all 54 qualified players');
 assert.equal(readyMessage(18,1),'JPEG ready — includes all 18 qualified players');
});

test('a short last page keeps exactly the same type, row height and image size, in one centred column',()=>{
 for(const n of [50,121,147]){
  const opts=pageOptions(players(n)),full=render(opts[0].rows,opts[0].page),last=render(opts.at(-1).rows,opts.at(-1).page);
  assert.equal(last.canvas.width,full.canvas.width);assert.equal(last.canvas.height,full.canvas.height);
  const fonts=r=>new Set(r.styles.filter(s=>!/^\d+ \/ \d+$/.test(s.value)).map(s=>s.font));
  for(const font of fonts(last))assert(fonts(full).has(font),`n=${n} ${font}`);
  const nameFont=r=>r.styles.find(s=>s.value.startsWith('Player ')).font;assert.equal(nameFont(last),nameFont(full));
  const rowH=r=>r.rects.find(x=>x.colour==='#202124'&&x.y>0&&x.w<r.canvas.width).h;assert.equal(rowH(last),rowH(full));
  if(opts.at(-1).rows.length<=20){
   assert.equal(last.text.filter(v=>v==='RANK').length,1);
   const row=last.rects.find(x=>x.colour==='#202124'&&x.y>0&&x.w<last.canvas.width);
   assert(Math.abs(row.x+row.w/2-last.canvas.width/2)<=1,'single column is centred');
  }
 }
});

test('up to 160 players: four pages of at most 40, two columns of at most 20',()=>{
 const opts=pageOptions(players(160));assert.equal(opts.length,4);
 opts.forEach(({rows,page},i)=>{assert.equal(rows.length,40);const r=render(rows,page);assert.equal(r.text.filter(v=>v==='RANK').length,2);assert(r.text.includes(`${i+1} / 4`));});
});

test('chip leader: gold frame on the highest stack row only, no chip leader text in the image',()=>{
 const opts=pageOptions(players(120));
 opts.forEach(({rows,page},i)=>{
  const r=render(rows,page),tags=r.text.filter(v=>/chip leader/i.test(v)).length,gold=r.rects.filter(x=>x.colour==='#D4AF37'&&(x.w===3||x.h===3)).length,fill=r.rects.filter(x=>x.colour==='#33301F').length;
  assert.equal(tags,0);assert.equal(gold,i===0?4:0);assert.equal(fill,i===0?1:0);
  assert(!r.text.includes('CHIP LEADER'));if(i===0){assert.equal(r.styles.find(s=>s.value==='Player 01').font,r.styles.find(s=>s.value==='Player 02').font);}
 });
});

test('chip leader: an exact tie marks every leader; a single page marks the top stack',()=>{
 const rows=players(10);rows[1].chips=rows[0].chips;
 const r=render(rows);assert.equal(r.rects.filter(x=>x.colour==='#33301F').length,2);
 assert.equal(render(players(1)).rects.filter(x=>x.colour==='#33301F').length,1);
});

test('places paid: empty or invalid draws no line; the line sits under the last paid place only',()=>{
 for(const v of ['','0','-3','abc','1.5',undefined])assert.equal(placesPaid(v),0);
 assert.equal(placesPaid(' 15 '),15);
 const draw=(rows,paid,page)=>{const text=[],rects=[];const c={fillRect(x,y,w,h){rects.push({x,y,w,h,colour:this.fillStyle});},drawImage(){},save(){},restore(){},setTransform(){},measureText(v){return {width:String(v).length*10};},fillText(value,x,y){text.push({value:String(value),x,y});}};drawLeaderboard({getContext:()=>c},rows,genting,{paid},undefined,1,{page});return {text,rects};};
 const lines=r=>r.rects.filter(x=>x.colour==='#D4AF37'&&x.h===4);
 assert.equal(lines(draw(players(30),'')).length,0);
 assert.equal(lines(draw(players(30),'30')).length,0,'everyone paid: no line');
 const r=draw(players(30),'12'),labels=lines(r).map(x=>({y:x.y+2}));assert.equal(labels.length,1);
 assert(!r.text.some(t=>/IN THE MONEY/.test(t.value)),'no text on the gold line');
 assert(!r.text.some(t=>/ITM/.test(t.value)),'places paid is not written in the header');
 const rowOf=rank=>{const t=r.text.find(x=>x.value===String(rank));return r.rects.find(x=>x.x>=40&&x.h<300&&['#202124','#292A2D','#33301F'].includes(x.colour)&&t.y>=x.y&&t.y<=x.y+x.h&&t.x>=x.x&&t.x<=x.x+x.w);};
 const row12=rowOf(12),row13=rowOf(13);assert(labels[0].y>row12.y+row12.h-1&&labels[0].y<row13.y+1,'between place 12 and 13');
});

test('places paid across pages: only the page holding the last paid place shows the line',()=>{
 const all=players(120),opts=pageOptions(all);
 const counts=opts.map(({rows,page})=>{const text=[],rects=[];const c={fillRect(x,y,w,h){rects.push({x,y,w,h,colour:this.fillStyle});},drawImage(){},save(){},restore(){},setTransform(){},measureText(v){return {width:String(v).length*10};},fillText(value){text.push(String(value));}};drawLeaderboard({getContext:()=>c},rows,genting,{paid:'45'},undefined,1,{page});return rects.filter(x=>x.colour==='#D4AF37'&&x.h===4).length;});
 assert.deepEqual(counts,[0,1,0]);
});

test('top 3: gold, silver and bronze discs behind ranks 1-3 only, with dark bold numbers',()=>{
 const discs=[],text=[];
 const c={fillRect(){},drawImage(){},save(){},restore(){},setTransform(){},beginPath(){},arc(x,y,r){discs.push({x,y,r,colour:this.fillStyle});},fill(){},measureText(v){return {width:String(v).length*10};},fillText(value,x,y){text.push({value:String(value),font:this.font,colour:this.fillStyle});}};
 drawLeaderboard({getContext:()=>c},players(30),genting,{},undefined,1,{});
 assert.deepEqual(discs.map(d=>d.colour),['#D4AF37','#C9CDD2','#C88A4A']);
 for(const rank of ['1','2','3']){const t=text.find(x=>x.value===rank);assert.equal(t.colour,'#202124');assert.match(t.font,/^700 /);}
 const four=text.find(x=>x.value==='4');assert.equal(four.colour,'#fff');assert.doesNotMatch(four.font,/^700/);
});

test('big blinds: optional; each stack shows its BB count, rounded, one decimal under 10 BB',()=>{
 for(const v of ['','0','abc','-4000',undefined])assert.equal(bigBlind(v),0);
 assert.equal(bigBlind('4,000'),4000);
 assert.equal(bbLabel(900000,4000),'225 BB');assert.equal(bbLabel(30000,4000),'7.5 BB');assert.equal(bbLabel(1234567,1000),'1,235 BB');assert.equal(bbLabel(1000,0),'');
 const draw=bb=>{const text=[];const c={fillRect(){},drawImage(){},save(){},restore(){},setTransform(){},measureText(v){return {width:String(v).length*10};},fillText(value,x){text.push({value:String(value),x,font:this.font});}};const canvas={getContext:()=>c};drawLeaderboard(canvas,players(30),genting,{bb},undefined,1,{});return {text,canvas};};
 const without=draw(''),withBB=draw('1000');
 assert(!without.text.some(t=>t.value.endsWith(' BB')));
 const labels=withBB.text.filter(t=>t.value.endsWith(' BB'));assert.equal(labels.length,30);assert.equal(labels[0].value,'30 BB');
 assert(labels.every(t=>t.font==='500 23px Montserrat'),'BB text is 85% of the name size');
 assert(withBB.canvas.width>=without.canvas.width,'the chip column never shrinks');
 for(const l of labels){const chips=withBB.text.find(t=>t.value===(Number(l.value.replace(' BB',''))*1000).toLocaleString('en-GB'));assert(l.x<chips.x,'BB sits before the chips');}
});

test('header: date line, then "N qualified · £X prize pool"; prize pool optional; same on every page',()=>{
 assert.equal(prizePool('14250'),'£14,250');assert.equal(prizePool('£1,234.5'),'£1,234.50');assert.equal(prizePool('1.234'),null);assert.equal(prizePool(''),null);
 const h=headerText({name:'BPS Main Event',date:'2026-11-24',time:'18:15',prizePool:'14250'},players(54),{number:2,total:2,totalPlayers:54});
 assert.equal(h.title,'BPS Main Event · Day 2');assert.equal(h.info,'24 Nov 2026 · 18:15');
 assert.deepEqual(h.sub,[{text:'54 qualified'},{text:'£14,250 prize pool',highlight:true}]);assert.equal(h.pageLabel,'2 / 2');
 assert.deepEqual(headerText({},players(3)).sub,[{text:'3 qualified'}]);
 const all=players(54),opts=pageOptions(all),details={name:'BPS Main Event',date:'2026-11-24',time:'18:15',prizePool:'14250'};
 const draws=opts.map(({rows,page})=>render2(rows,page,details));
 draws.forEach(d=>{for(const v of ['24 Nov 2026 · 18:15','54 qualified','£14,250 prize pool'])assert(d.text.includes(v),v);assert(!d.text.some(v=>/entries|avg stack|chip leader/i.test(v)));assert.equal(d.canvas.height,draws[0].canvas.height);});
});

test('table centred: same gap above the table, between the table and the band, and under the band',()=>{
 const band={naturalWidth:2000,naturalHeight:107};
 for(const n of [10,18,40]){
  const rects=[],images=[];const c={fillRect(x,y,w,h){rects.push({x,y,w,h,colour:this.fillStyle});},drawImage(...a){images.push(a);},save(){},restore(){},setTransform(){},measureText(v){return {width:String(v).length*10};},fillText(){}};
  const canvas={getContext:()=>c};drawLeaderboard(canvas,players(n),genting,{name:'BPS',prizePool:'100'},band,1,{});
  const red=rects.find(x=>x.colour==='#cc1428'&&x.h===2),logoBottom=Math.max(...images.filter(a=>a[0]!==band).map(a=>a[6]+a[8]));
  const b=images.find(a=>a[0]===band),rowBottom=Math.max(...rects.filter(x=>x.x>=40&&x.h<200&&['#202124','#292A2D','#33301F'].includes(x.colour)).map(x=>x.y+x.h));
  const above=b[2]-rowBottom,below=canvas.height-(b[2]+b[4]);
  assert(Math.abs(above-below)<=1.5,`n=${n} ${above}/${below}`);assert(red.y-logoBottom>=38,`header gap n=${n}`);
 }
});

test('header prize line: "1st place £X" under the qualified line, each part optional; places paid not in the header',()=>{
 assert.deepEqual(headerText({paid:'18',firstPrize:'4015'},players(40)).extra,[{text:'1st place £4,015',highlight:true}]);
 assert.deepEqual(headerText({paid:'18'},players(40)).extra,[]);
 assert.deepEqual(headerText({firstPrize:'4,015.50'},players(40)).extra,[{text:'1st place £4,015.50',highlight:true}]);
 assert.deepEqual(headerText({paid:'abc',firstPrize:''},players(40)).extra,[]);
 const r=render2(players(30),undefined,{name:'BPS',date:'2026-11-24',time:'18:15',prizePool:'14250',paid:'12',firstPrize:'4015'});
 for(const v of ['30 qualified','£14,250 prize pool','1st place £4,015'])assert(r.text.includes(v),v);assert(!r.text.includes('12 ITM'));
 const plain=render2(players(30),undefined,{name:'BPS',date:'2026-11-24',time:'18:15'});assert(!plain.text.some(v=>/ITM|1st place/.test(v)));
});

test('header prize line includes the optional min cash',()=>{
 assert.deepEqual(headerText({paid:'18',firstPrize:'4015',minCash:'150'},players(40)).extra,[{text:'1st place £4,015',highlight:true},{text:'min cash £150'}]);
 assert.deepEqual(headerText({minCash:'£95.50'},players(40)).extra,[{text:'min cash £95.50'}]);
 assert.deepEqual(headerText({minCash:'abc'},players(40)).extra,[]);
 const r=render2(players(30),undefined,{name:'BPS',paid:'12',firstPrize:'4015',minCash:'150'});
 for(const v of ['1st place £4,015','min cash £150'])assert(r.text.includes(v),v);
});

test('checks before export: clear warnings, none when everything is consistent',()=>{
 const rows=players(30);
 assert.deepEqual(exportChecks({name:'BPS',date:'2026-11-24',paid:'12',bb:'1000',prizePool:'14250',firstPrize:'4015',minCash:'150'},rows),[]);
 const all=exportChecks({paid:'40',bb:'abc',prizePool:'1,000',firstPrize:'4015',minCash:'5000'},rows).join(' | ');
 for(const part of ['No tournament name','No date','Day 2 big blind is not a whole number','Places paid (40) is not lower than the 30 qualified players','1st place prize is higher than the prize pool','Min cash is higher than the 1st place prize','Min cash × places paid is more than the prize pool'])assert(all.includes(part),part);
 assert(exportChecks({name:'X',date:'2026-11-24',bb:'5000'},rows).some(m=>/stacks are below 1 big blind/.test(m)));
 assert(exportChecks({name:'X',date:'2026-11-24',prizePool:'12.345'},rows).some(m=>/Prize pool is not a valid amount/.test(m)));
});

test('flights: count 1-8, flights still to play, header line and checks',()=>{
 for(const v of ['','0','9','abc','2.5',undefined])assert.equal(flightCount(v),0);
 assert.equal(flightCount('8'),8);
 const rows=['A','B','C','D','E'].map((f,i)=>({rank:i+1,name:'P'+i,flight:'Day 1'+f,chips:1000-i}));
 assert.deepEqual(flightsToPlay(8,rows),['F','G','H']);assert.deepEqual(flightsToPlay(5,rows),[]);assert.deepEqual(flightsToPlay(0,rows),[]);
 assert.deepEqual(headerText({flights:'8'},rows).flights,[{text:'5 of 8 flights played · to play: 1F, 1G, 1H'}]);
 assert.deepEqual(headerText({flights:'6'},rows).flights,[{text:'5 of 6 flights played · to play: 1F'}]);
 assert.deepEqual(headerText({flights:'5'},rows).flights,[{text:'All 5 flights played'}]);assert.deepEqual(headerText({},rows).flights,[{text:'Flights played: 1A–1E'}]);
 assert.deepEqual(headerText({},[rows[0],rows[2]]).flights,[{text:'Flights played: 1A, 1C'}]);assert.deepEqual(headerText({},[]).flights,[]);
 assert.deepEqual(headerText({flights:'8',firstPrize:'100'},rows).lines.map(l=>l[0].text),['5 qualified','5 of 8 flights played · to play: 1F, 1G, 1H','1st place £100'],'flights line right under the prize line');
 assert.equal(headerText({flights:'8',firstPrize:'100'},rows).lines.length,3);
 const r=render2(players(20).map(p=>({...p,flight:'A'})),undefined,{name:'BPS',flights:'3',prizePool:'1000'});
 assert(r.text.includes('1 of 3 flights played · to play: 1B, 1C'));
 const g=[{rank:1,name:'X',flight:'Day 1G',chips:10}];
 assert(exportChecks({name:'X',date:'2026-11-24',flights:'6'},g).some(m=>/Day 1G, but the event is set to 6 flights/.test(m)));
 assert(!exportChecks({name:'X',date:'2026-11-24',flights:'8'},g).some(m=>/event is set to/.test(m)));
});

test('ties: equal stacks share the place, listed alphabetically; the next place skips (1, 2, 2, 4)',async()=>{
 const {publicRows,staffRows}=await import('../dist/model.js');
 const rec=(key,name,chips,gdpr='Y')=>({key,qualified:true,originalName:name,originalGdpr:gdpr,flight:'A',chips});
 const records=[rec('1','Zoe Young',874000),rec('2','Adam Brown',874000),rec('3','Lee Chen',900000),rec('4','Mia Ford',500000),rec('5','Ben Hall',874000,'N')];
 const p=publicRows(records),s=staffRows(records);
 assert.deepEqual(p.map(r=>[r.rank,r.chips]),[[1,900000],[2,874000],[2,874000],[2,874000],[5,500000]]);
 assert.deepEqual(s.map(r=>r.name),['Lee Chen','Adam Brown','Ben Hall','Zoe Young','Mia Ford']);
 assert.deepEqual(p.map(r=>r.name),['Lee Chen','Adam Brown','B. H.','Zoe Young','Mia Ford'],'public order follows the full names, initials shown');
 assert.deepEqual(p.map(r=>r.rank),s.map(r=>r.rank));
 const again=publicRows([...records].reverse());assert.deepEqual(again,p,'import order does not matter');
});

test('summary before export: players and chips per flight, full names vs initials',async()=>{
 const {exportSummary}=await import('../dist/model.js');
 const rec=(key,name,flight,chips,gdpr)=>({key,qualified:true,originalName:name,originalGdpr:gdpr,flight,chips});
 const s=exportSummary([rec('1','Ann Lee','B',500,'Y'),rec('2','Bob Ray','A',300,'N'),rec('3','Cy Doe','A',200,'YES'),{...rec('4','Out','A',100,'Y'),qualified:false}]);
 assert.deepEqual(s.flights,[{flight:'Day 1A',players:2,chips:500},{flight:'Day 1B',players:1,chips:500}]);
 assert.equal(s.players,3);assert.equal(s.chips,1000);assert.equal(s.fullNames,2);assert.equal(s.initials,1);
 assert.deepEqual(exportSummary([]),{flights:[],players:0,chips:0,fullNames:0,initials:0});
});

test('flags: country names, demonyms and codes map to flags; shown only with a country, room kept for the flag',async()=>{
 const {countryCode,FLAG_CODES,drawFlag}=await import('../dist/model.js');
 for(const [v,code] of [['British','GB'],['GBR','GB'],['England','GB'],['Romania','RO'],['ROU','RO'],['china','CN'],['Brazilian','BR'],['Saint Kitts And Nevis','KN'],['Hong Kong','HK'],['—',''],['',''],['Atlantis','']])assert.equal(countryCode(v),code,v);
 for(const code of ['GB','RO','CN','IN','AU','JM','IR','VN','MY','PL','UA','BR','TR','MX','SK','TW','NL','HK','IL','LV','MT','PT','KN','NO','GE','IT','NG','ES','FI'])assert(FLAG_CODES.includes(code),code);
 const ops=[];const c={save(){},restore(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},closePath(){},arc(){},fill(){ops.push('fill');},fillRect(x,y,w,h){ops.push(this.fillStyle);}};
 for(const code of FLAG_CODES){ops.length=0;drawFlag(c,code,0,0,30,20);assert(ops.length>=5,code);}
 const draw=(nat,flags)=>{const text=[],rects=[];const ctx={fillRect(x,y,w,h){rects.push({x,y,w,h,colour:this.fillStyle});},drawImage(){},save(){},restore(){},setTransform(){},measureText(v){return {width:String(v).length*10};},fillText(value,x){text.push({value:String(value),x});}};drawLeaderboard({getContext:()=>ctx},[{rank:1,name:'Ann Lee',nationality:nat,flight:'Day 1A',chips:100}],genting,{},undefined,1,{flags});return {text,rects};};
 const withFlag=draw('Romania'),noCountry=draw('—'),off=draw('Romania',false);
 const x=r=>r.text.find(t=>t.value==='Ann Lee').x;
 assert(x(withFlag)>x(noCountry),'name moves right to make room for the flag');assert.equal(x(off),x(noCountry),'flags can be switched off');
 assert(withFlag.rects.some(r=>r.colour==='#002B7F'),'Romanian blue drawn');assert(!withFlag.text.some(t=>/Romania|ROU/.test(t.value)),'no country text, only the flag');
});

test('guarantee: "£15,000 of £100,000 GTD", GTD alone, plain prize pool without GTD; works with the flights line',()=>{
 const rows=['A','B'].flatMap((f,k)=>Array.from({length:3},(_,i)=>({rank:k*3+i+1,name:'P'+f+i,flight:'Day 1'+f,chips:1000-k*3-i})));
 assert.deepEqual(headerText({prizePool:'15000',gtd:'100000'},rows).sub,[{text:'6 qualified'},{text:'£15,000 of £100,000 GTD',highlight:true}]);
 assert.deepEqual(headerText({gtd:'100,000'},rows).sub,[{text:'6 qualified'},{text:'£100,000 GTD',highlight:true}]);
 assert.deepEqual(headerText({prizePool:'15000'},rows).sub,[{text:'6 qualified'},{text:'£15,000 prize pool',highlight:true}]);
 const h=headerText({prizePool:'15000',gtd:'100000',flights:'8'},rows);
 assert.deepEqual(h.flights,[{text:'2 of 8 flights played · to play: 1C, 1D, 1E, 1F, 1G, 1H'}]);assert.equal(h.lines.length,2);
 const r=render2(rows,undefined,{name:'BPS',prizePool:'15000',gtd:'100000',flights:'8'});
 for(const v of ['6 qualified','£15,000 of £100,000 GTD','2 of 8 flights played · to play: 1C, 1D, 1E, 1F, 1G, 1H'])assert(r.text.includes(v),v);
 assert(exportChecks({name:'X',date:'2026-11-24',gtd:'lots'},rows).some(m=>/Guarantee \(GTD\) is not a valid amount/.test(m)));
});
