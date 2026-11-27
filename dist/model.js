import {fitInZone,displayDate} from './branding.js';
export const COLUMNS=['RANK','PLAYER NAME','NATIONALITY','QUALIFIED FROM','CHIP COUNT'];
export const JPEG_COLUMNS=['RANK','PLAYER NAME','QUALIFIED FROM','CHIP COUNT'];
export const text=v=>String(v??'').trim();
const norm=v=>text(v).toLowerCase().replace(/[^a-z0-9]/g,'');
export const yes=v=>typeof v==='string'&&v.trim().toUpperCase()==='YES';
export const nameConsent=v=>typeof v==='string'&&['Y','YES'].includes(v.trim().toUpperCase());
// V51: flights A to H (Day 1A ... Day 1H).
export const FLIGHT_LETTERS='ABCDEFGH';
export function normalizeFlight(value){return text(value).toUpperCase().match(/^(?:(?:DAY\s*1|FLIGHT\s*(?:1\s*)?)\s*|1\s*)?([A-H])$/)?.[1]??null;}
// Number of Day 1 flights in the event (1-8), typed by staff; 0 when not set.
export function flightCount(value){const s=text(value);return /^[1-8]$/.test(s)?Number(s):0;}
// Flights of the event that have no qualified player yet, e.g. ['F','G','H'].
export function flightsToPlay(total,rows=[]){const played=new Set(rows.map(r=>normalizeFlight(r.flight)).filter(Boolean));return [...FLIGHT_LETTERS.slice(0,total)].filter(letter=>!played.has(letter));}
export function qualifiedFrom(value){const letter=normalizeFlight(value);return letter?`Day 1${letter}`:'—';}
export const flightValue=r=>r.originalFlight??r.flight;
const consentMeaning=v=>nameConsent(v)?'yes':['N','NO'].includes(text(v).toUpperCase())?'no':'unknown';
export function consentData(sources){
 const gdpr=sources.filter(s=>norm(s.column)!=='jpot'),selected=(gdpr.length?gdpr:sources)[0];
 return {originalGdpr:selected?.value,consentColumn:selected?.column??null,consentSources:sources,consentConflict:new Set(sources.map(s=>consentMeaning(s.value))).size>1,consentVersion:1};
}
export const needsConsentReload=r=>r.consentVersion!==1&&r.originalGdpr===undefined;
export function nationalityData(sources){const populated=sources.filter(s=>text(s.value)),selected=populated[0]??sources[0];return {originalNationality:selected?.value,nationality:text(selected?.value),nationalitySources:sources,nationalityConflict:new Set(populated.map(s=>text(s.value).toLocaleLowerCase())).size>1};}
export function publicNationality(r){
 if(r.consentConflict||!nameConsent(r.originalGdpr))return '—';
 return staffNationality(r);
}
export function staffNationality(r){
 if(r.nationalityConflict)return '—';
 const raw=r.originalNationality??r.nationality,value=text(raw);
 if(typeof raw!=='string'||!value||['unknown','unkown','unkonw','n/a','na','none','null','undefined','not available','not specified'].includes(value.toLocaleLowerCase())||(value.match(/\p{L}/gu)||[]).length<2)return '—';
 return value;
}
export function initials(name){const p=text(name).split(/\s+/u).filter(Boolean);return (p.length>1?[p[0],p.at(-1)]:p).map(s=>Array.from(s)[0]+'.').join(' ')||'—';}
export function chips(value){if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0?value:null;const s=text(value);if(!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?:[ \u00a0]\d{3})+)$/.test(s))return null;const n=Number(s.replace(/[, \u00a0]/g,''));return Number.isSafeInteger(n)?n:null;}
const aliases={first:['forename','firstname'],last:['surname','lastname'],name:['playername','fullname','name'],id:['playerid','membershipnumber'],flight:['flightname','flight','flt'],chips:['chipcount','chips','stack'],gdpr:['gdpr','gdprconsent','consent'],jpot:['jpot'],nationality:['nationality','country','countrycode','cty'],verified:['nationalityverified','verifiednationality','countryverified'],status:['status'],eliminated:['eliminateddate'],withdrawn:['withdrawndate'],qualified:['qualified','qualification','qualifiedforday2']};
function decodeExport(bytes){
 const b=new Uint8Array(bytes);let encoding=b[0]===255&&b[1]===254?'utf-16le':b[0]===254&&b[1]===255?'utf-16be':b[0]===60&&b[1]===0?'utf-16le':b[0]===0&&b[1]===60?'utf-16be':null;
 if(encoding)return new TextDecoder(encoding).decode(b);
 try{const decoded=new TextDecoder('utf-8',{fatal:true}).decode(b);const charset=decoded.slice(0,4096).match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];return charset&&/^(windows-1252|iso-8859-1)$/i.test(charset)?new TextDecoder(charset).decode(b):decoded;}catch{return new TextDecoder('windows-1252').decode(b);}
}
export function parseWorkbook(XLSX,bytes,filename){
 if(!/\.(xlsx|xls)$/i.test(filename))throw Error('Choose an .xls or .xlsx file.');
 if(bytes.byteLength>30*1024*1024)throw Error('The file exceeds 30 MB.');
 const sig=new Uint8Array(bytes),zip=sig[0]===80&&sig[1]===75,ole=[208,207,17,224,161,177,26,225].every((n,i)=>sig[i]===n),biff=sig[0]===9&&[0,2,4,8].includes(sig[1]);
 let exportedText=null;
 if(!zip&&!ole&&!biff){
  if(!/\.xls$/i.test(filename))throw Error('The file is not a valid Excel .xlsx workbook.');
  exportedText=decodeExport(bytes).replace(/^\uFEFF/,'').trimStart();
  const html=/<table\b[\s\S]*<\/(?:[\w-]+:)?table\s*>/i.test(exportedText),xml=/<(?:[\w-]+:)?Workbook\b/i.test(exportedText)&&/urn:schemas-microsoft-com:office:spreadsheet/i.test(exportedText);
  if(!html&&!xml)throw Error('The .xls file does not contain a valid Excel workbook, HTML table or compatible XML Spreadsheet.');
  if(/<!\s*(?:DOCTYPE[^>]*\[|ENTITY\b)/i.test(exportedText)||/<\s*(?:script|iframe|object|embed)\b/i.test(exportedText))throw Error('The HTML/XML export contains scripts or external entities and cannot be imported. Save it as an Excel .xlsx workbook.');
 }
 let wb;try{wb=exportedText!==null?XLSX.read(exportedText,{type:'string',cellFormula:true,raw:true}):XLSX.read(bytes,{type:'array',cellFormula:true,bookFiles:true});
  if(zip&&!(wb.keys||[]).includes('xl/workbook.xml'))throw Error('unsupported');
  if(ole&&!(wb.cfb?.FullPaths||[]).some(p=>/\/(Workbook|Book)$/i.test(p)))throw Error('unsupported');
  if(!wb.SheetNames?.length||!wb.Sheets)throw Error('empty');
 }catch{throw Error('The workbook is corrupt, protected or incompatible. Open it in Excel, save it as .xls or .xlsx, then try again.');}
 const records=[];
 for(const sheetName of wb.SheetNames){const ws=wb.Sheets[sheetName];if(!ws['!ref'])continue;const range=XLSX.utils.decode_range(ws['!ref']);if(range.e.r>50000||range.e.c>255)throw Error('The worksheet exceeds the limit of 50,000 rows or 256 columns.');
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:'',blankrows:true});if(!rows.some(r=>r.some(v=>text(v))))continue;
  let h=-1,m;
  for(let i=0;i<Math.min(rows.length,40);i++){const headers=rows[i].map(norm);const map=Object.fromEntries(Object.entries(aliases).map(([k,values])=>[k,headers.flatMap((v,j)=>values.includes(v)?[j]:[])]));if((map.name.length||map.first.length&&map.last.length)&&map.chips.length){h=i;m=map;break;}}
  if(h<0)throw Error(`Worksheet ${sheetName}: Forename + Surname (or Player Name) and ChipCount are required.`);
  for(const field of ['first','last','name','flight','chips','status','qualified'])if(m[field].length>1)throw Error(`Worksheet ${sheetName}: ambiguous columns for ${field}.`);
  if(!m.flight.length)throw Error(`Worksheet ${sheetName}: the FlightName, Flight or FLT column is missing.`);
  const get=(row,k)=>k==='id'?row[m.id[0]]:m[k].length===1?row[m[k][0]]:undefined;
  rows.slice(h+1).forEach((row,index)=>{if(!row.some(v=>text(v)))return;
   const first=String(get(row,'first')??''),last=String(get(row,'last')??''),originalName=m.name.length===1?String(get(row,'name')??''):[text(first),text(last)].filter(Boolean).join(' ');
   if(m.name.length&&m.first.length&&m.last.length&&norm(originalName)!==norm([text(first),text(last)].filter(Boolean).join(' ')))throw Error(`Worksheet ${sheetName}, row ${h+index+2}: the full name differs from Forename + Surname.`);
   const consent=consentData([...m.gdpr,...m.jpot].map(index=>({column:String(rows[h][index]),columnIndex:index,value:row[index]}))),count=chips(get(row,'chips')),status=norm(get(row,'status'));
   const out=['eliminated','withdrawn','cancelled','canceled','disqualified'].includes(status)||!!text(get(row,'eliminated'))||!!text(get(row,'withdrawn'));
   const explicit=get(row,'qualified');const qualifier=m.qualified.length?yes(explicit)||['qualified','true','1'].includes(norm(explicit)):!out&&count!==0;
   const nation=nationalityData(m.nationality.map(index=>({column:String(rows[h][index]),columnIndex:index,value:row[index]})));
   records.push({key:crypto.randomUUID(),sourceRow:h+index+2,sheet:sheetName,originalName,originalForename:first,originalSurname:last,...consent,...nation,playerId:text(get(row,'id')),rawChips:get(row,'chips'),chips:count,originalFlight:get(row,'flight'),flight:text(get(row,'flight')),nationalityVerified:yes(get(row,'verified')),status:text(get(row,'status')),qualified:!out&&qualifier});
  });
 }
 if(!records.length)throw Error('The file contains no player records.');return records;
}
export const invalidRecords=records=>{const dropped=droppedKeys(records);return records.filter(r=>r.qualified&&!dropped.has(r.key)&&(!text(r.originalName)||r.chips===null||r.chips<=0||!normalizeFlight(flightValue(r))));};
// V51 ties: equal stacks share the same place (e.g. 1, 2, 3, 3, 5) and are listed alphabetically by name,
// so the order never depends on which file was imported first. Staff and public views use the same order.
function ranked(records){const dropped=droppedKeys(records);const list=records.filter(r=>r.qualified&&!dropped.has(r.key)).sort((a,b)=>(b.chips??-1)-(a.chips??-1)||text(a.originalName).localeCompare(text(b.originalName),'en-GB',{sensitivity:'base'})||String(a.key??'').localeCompare(String(b.key??'')));let rank=0;return list.map((r,i)=>{if(i===0||r.chips!==list[i-1].chips||r.chips===null)rank=i+1;return {r,rank};});}
export function publicRows(records){return ranked(records).map(({r,rank})=>({rank,name:!r.consentConflict&&nameConsent(r.originalGdpr)?text(r.originalName):initials(r.originalName),nationality:publicNationality(r),flight:qualifiedFrom(flightValue(r)),chips:r.chips}));}
// V51 summary before export: qualified players and chips per flight, and how many names the JPEG shows in full
// (GDPR consent) or as initials. Public and staff rows share the same order, so they can be compared row by row.
export function exportSummary(records){
 const pub=publicRows(records),staff=staffRows(records),byFlight=new Map();
 for(const r of pub){const f=byFlight.get(r.flight)||{flight:r.flight,players:0,chips:0};f.players++;f.chips+=r.chips??0;byFlight.set(r.flight,f);}
 const flights=[...byFlight.values()].sort((a,b)=>a.flight.localeCompare(b.flight));
 const initials=pub.filter((r,i)=>r.name!==staff[i].name).length;
 return {flights,players:pub.length,chips:pub.reduce((s,r)=>s+(r.chips??0),0),fullNames:pub.length-initials,initials};
}
export function staffRows(records){return ranked(records).map(({r,rank})=>({rank,name:text(r.originalName)||'—',nationality:staffNationality(r),flight:qualifiedFrom(flightValue(r)),chips:r.chips}));}
// Search the supplied display projection; JPEG generation uses publicRows separately.
export function filterRows(rows,{name='',nationality='',flight='',chipCount=''}={}){
 const n=text(name).toLocaleLowerCase(),nation=text(nationality).toLocaleLowerCase(),flightQuery=text(flight),f=normalizeFlight(flightQuery),query=text(chipCount),prefix=query.replace(/[, \u00a0]/g,'');
 if(query&&(!/^[\d, \u00a0]+$/.test(query)||!/^\d+$/.test(prefix)))return {rows:[],error:'Use only digits, commas or spaces for chip count.'};
 return {rows:rows.filter(r=>(!n||r.name.toLocaleLowerCase().includes(n))&&(!nation||text(r.nationality).toLocaleLowerCase().includes(nation))&&(!flightQuery||f!==null&&normalizeFlight(r.flight)===f)&&(!prefix||r.chips!==null&&String(r.chips).startsWith(prefix))),error:''};
}
// Duplicate review: overlapping Player ID / name matches form one group. A staff decision is
// stored on each record with the exact group membership, so any later file change re-opens review.
const duplicateName=r=>text(r.originalName).toLocaleLowerCase().replace(/\s+/gu,' ');
export function duplicateGroups(records){
 const list=records.filter(r=>r.qualified),parent=list.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i])),seen=new Map();
 list.forEach((r,i)=>{for(const key of [text(r.playerId)?'id:'+text(r.playerId):null,duplicateName(r)?'name:'+duplicateName(r):null].filter(Boolean)){if(seen.has(key))parent[find(i)]=find(seen.get(key));else seen.set(key,i);}});
 const groups=new Map();list.forEach((r,i)=>{const root=find(i);groups.set(root,[...(groups.get(root)||[]),r]);});
 return [...groups.values()].filter(g=>g.length>1);
}
export const duplicateGroupKey=group=>group.map(r=>r.key).sort().join('|');
// Resolved: every member carries the current group key, at least one record is kept, and
// either all are 'distinct' (different players) or each is an explicit keep/drop.
export function duplicateResolved(group){
 const key=duplicateGroupKey(group);if(!group.every(r=>r.duplicateGroup===key))return false;
 const status=group.map(r=>r.duplicateStatus);
 return status.every(v=>v==='distinct')||status.every(v=>v==='keep'||v==='drop')&&status.includes('keep');
}
export function droppedKeys(records){const out=new Set();for(const g of duplicateGroups(records))if(duplicateResolved(g))for(const r of g)if(r.duplicateStatus==='drop')out.add(r.key);return out;}
export const unresolvedDuplicates=records=>duplicateGroups(records).filter(g=>!duplicateResolved(g));
// Highest valid stack wins; on an exact tie the first imported record is kept.
export const highestStack=group=>group.reduce((best,r)=>(r.chips??-1)>(best.chips??-1)?r:best);
// Mixed groups (e.g. same name, two Player IDs): keep the highest stack of each Player ID.
// Only offered when every record has a Player ID and there are at least two different IDs.
export function highestPerPlayerId(group){
 if(group.some(r=>!text(r.playerId)))return null;
 const best=new Map();for(const r of group){const id=text(r.playerId),current=best.get(id);if(!current||(r.chips??-1)>(current.chips??-1))best.set(id,r);}
 return best.size>1?new Set([...best.values()].map(r=>r.key)):null;
}
export function sharedPlayerId(group){const ids=new Set(group.map(r=>text(r.playerId)));return ids.size===1&&!ids.has('')?[...ids][0]:'';}
// action: 'highest' | 'per-id' | 'select' (with keepKeys) | 'distinct' | 'reset'.
// Returns record key -> fields to store on that record.
export function duplicateDecision(group,action,keepKeys=[]){
 const key=duplicateGroupKey(group);
 if(action==='reset')return new Map(group.map(r=>[r.key,{duplicateStatus:undefined,duplicateGroup:undefined}]));
 if(action==='distinct')return new Map(group.map(r=>[r.key,{duplicateStatus:'distinct',duplicateGroup:key}]));
 const keep=action==='highest'?new Set([highestStack(group).key]):action==='per-id'?highestPerPlayerId(group):action==='select'?new Set(keepKeys):null;
 if(!keep||!group.some(r=>keep.has(r.key)))throw Error('Choose at least one record to keep.');
 return new Map(group.map(r=>[r.key,{duplicateStatus:keep.has(r.key)?'keep':'drop',duplicateGroup:key}]));
}
// V51: at most 20 players per column and 40 per JPEG page; longer leaderboards become several pages.
export const COLUMN_MAX=20,PAGE_MAX=40;
// Full pages of 40 in rank order (120 -> 40 + 40 + 40, 50 -> 40 + 10). Designed for up to 160 players (4 pages);
// more players still export, on further pages of 40, so nobody is ever left out.
export const PLANNED_MAX=160;
export function leaderboardPages(rows){const out=[];for(let i=0;i<rows.length;i+=PAGE_MAX)out.push(rows.slice(i,i+PAGE_MAX));return out;}
export function layout(n){const sections=n<=COLUMN_MAX?1:n<=PAGE_MAX?2:3;return {sections,rows:Math.ceil(n/sections),width:sections*1200+80,height:245+Math.ceil(n/sections)*58};}
export function validTournamentTime(value){return !value||/^([01]\d|2[0-3])[.:][0-5]\d$/.test(value);}
export function formatTournamentTime(value){const time=String(value??'');return validTournamentTime(time)?time.replace('.',':'):time;}
function wrapTournamentName(c,value,width){const lines=[];let line='';for(const word of value.split(/\s+/)){const candidate=line?line+' '+word:word;if(c.measureText(candidate).width<=width){line=candidate;continue;}if(line){lines.push(line);line='';}for(const char of Array.from(word)){if(line&&c.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}}if(line)lines.push(line);return lines;}
let leaderboardFont;
export function loadLeaderboardFont(){
 if(!leaderboardFont){
  const source=new URL('./vendor/montserrat-variable.ttf',import.meta.url);
  const face=new FontFace('Montserrat',`url("${source.href}")`,{weight:'100 900'});
  leaderboardFont=face.load().then(font=>document.fonts.add(font)).catch(()=>{
   leaderboardFont=undefined;
   throw Error('Could not load Montserrat. The JPEG was not generated.');
  });
 }
 return leaderboardFont;
}
// branding: {gentingCrop, tournamentLogo:{image,crop}} — optional; crops are source rectangles in natural pixels.
// V51 chip leader: the highest stack of the whole leaderboard gets a gold frame, gold rank and chips and a CHIP LEADER tag
// (on an exact tie every leader is marked). Player names keep the normal font.
// V51 places paid: optional, set once all flights have finished. A gold line with IN THE MONEY · TOP N is drawn
// under the last paid place (nothing when empty, invalid or when every player is paid).
export function placesPaid(value){const s=String(value??'').trim();if(!/^\d{1,4}$/.test(s))return 0;const n=Number(s);return n>=1?n:0;}
export const ITM={gold:'#D4AF37',ink:'#202124',font:'700 17px Montserrat',label:n=>'IN THE MONEY · TOP '+n};
// V51 prize pool (optional, typed by staff), shown under the date as "£14,250 prize pool".
export function prizePool(value){const s=String(value??'').replace(/[£,\s]/g,'');if(!/^\d{1,9}(\.\d{1,2})?$/.test(s))return null;const n=Number(s);return '£'+n.toLocaleString('en-GB',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2});}
// V51 top 3: rank 1, 2 and 3 sit in a gold, silver and bronze disc (number in dark bold).
export const MEDALS={1:'#D4AF37',2:'#C9CDD2',3:'#C88A4A'},MEDAL_INK='#202124';
function drawMedal(c,x,y,r,colour){c.fillStyle=colour;if(typeof c.arc==='function'&&typeof c.fill==='function'){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}else c.fillRect(x-r,y-r,r*2,r*2);}
// V51 stack in big blinds: optional Day 2 big blind; each stack then shows e.g. "225 BB" in grey before the chips.
export function bigBlind(value){const s=String(value??'').replace(/[,\s]/g,'');return /^\d{1,9}$/.test(s)&&Number(s)>0?Number(s):0;}
export function bbLabel(chips,bb){return bb?bbCount(chips,bb)+' BB':'';}
// Big blinds as a whole number, from the exact chip count (e.g. 915,000 / 4,000 -> 229).
export const bbCount=(chips,bb)=>bb?Math.round(chips/bb).toLocaleString('en-GB'):'';
export const BB_STYLE={colour:'#AEB3B9',scale:.85};
// V51 header text shared by every format: "<name> · Day 2", the date line, then "N qualified · £X prize pool".
export function headerText(tournament={},all=[],page){
 const name=text(tournament.name),total=page?.totalPlayers??all.length,pool=prizePool(tournament.prizePool);
 const title=name?name+' · Day 2':'Day 2 Leaderboard';
 const info=[displayDate(text(tournament.date)),formatTournamentTime(tournament.time)].filter(Boolean).join(' · ');
 const flightTotal=flightCount(tournament.flights),toPlay=flightsToPlay(flightTotal,all);
 const span=letters=>{const out=[];for(let i=0;i<letters.length;){let j=i;while(j+1<letters.length&&letters[j+1].charCodeAt(0)===letters[j].charCodeAt(0)+1)j++;out.push(j-i>=2?'1'+letters[i]+'–1'+letters[j]:letters.slice(i,j+1).map(l=>'1'+l).join(', '));i=j+1;}return out.join(', ');};
 // Prize line: "£17,585 collected · 18% of GTD" (amount in gold, share of the guarantee in light grey, rounded to
 // the nearest whole percent; no percent without a guarantee). Guarantee only: "£100,000 GTD".
 const gtd=prizePool(tournament.gtd),amount=v=>Number(String(v??'').replace(/[£,\s]/g,'')),gtdValue=gtd?amount(tournament.gtd):0;
 // Every flight played: the counts are final ("Final prize pool", "All flights complete", FINAL CHIP COUNTS).
 const final=!!flightTotal&&!toPlay.length;
 const prizeLine=pool?[{text:pool+' collected',highlight:true},...(gtdValue>0?[{text:Math.round(amount(tournament.prizePool)/gtdValue*100)+'% of GTD',colour:'#C5C8CE'}]:[])]:gtdValue>0?[{text:gtd+' GTD',colour:'#C5C8CE'}]:[];
 // Players line: "29 qualified · 1C–1H left" (flights only while some are still to play).
 const flights=flightTotal&&toPlay.length?[{text:span(toPlay)+' left'}]:[];
 const sub=[{text:total+' qualified'},...flights,...(final?[{text:'All flights complete'}]:[])];
 // Optional Day 2 start as typed, e.g. "Sat 29 Nov · 12:00": by the page label on a single page, else on the last line.
 const day2Start=text(tournament.day2Start).slice(0,40),day2OnLine=!!day2Start&&page?.total>1;
 // Optional line: first prize and min cash, e.g. "1st place £4,015 · min cash £150".
 const first=prizePool(tournament.firstPrize),minCash=prizePool(tournament.minCash);
 const startBB=bigBlind(tournament.bb);
 // Starting BB sits above the table, next to the chip counts label (startBB), not in the header lines.
 const extra=[...(day2OnLine?[{text:'Day 2 starts '+day2Start}]:[]),...(first?[{text:'1st place '+first,highlight:true}]:[]),...(minCash?[{text:'min cash '+minCash}]:[])];
 const lines=[prizeLine,sub,extra].filter(line=>line.length);
 return {name,title,info,prizeLine,sub,extra,flights,final,day2Start,startBB,lines,pageShort:page?.total>1?page.number+'/'+page.total:'',pageLabel:page?.total>1?page.number+' / '+page.total:''};
}
// When "<name> · Day 2" does not fit on one line, "Day 2" gets its own line (never a dangling " ·").
function titleLines(c,head,width){const lines=wrapTournamentName(c,head.title,width);return lines.length<2||!head.name?lines:[...wrapTournamentName(c,head.name,width),'Day 2'];}
function drawSegments(c,segments,cx,y,font,max){
 c.font=font;c.letterSpacing='0px';c.textBaseline='middle';c.textAlign='left';
 const parts=[];segments.forEach((s,i)=>{if(i)parts.push({text:'  ·  ',colour:'#9AA0A6'});parts.push({text:s.text,colour:s.colour||(s.highlight?LEADER.text:'#E8EAED')});});
 const widths=parts.map(part=>c.measureText(part.text).width),total=widths.reduce((a,b)=>a+b,0),scale=total>max?max/total:1;
 let x=cx-total*scale/2;parts.forEach((part,i)=>{c.fillStyle=part.colour;c.fillText(part.text,x,y,widths[i]*scale);x+=widths[i]*scale;});
}
// A thin line under the last row marks the end of the table, so the gap to the band reads as equal.
// V52 short chip counts for Instagram: 874,500 -> "874.5K", 1,250,000 -> "1.25M".
export function shortChips(n){if(!Number.isFinite(n))return '';const trim=(v,d)=>String(Number(v.toFixed(d)));if(n>=1e6||Number((n/1e3).toFixed(1))>=1000)return trim(n/1e6,2)+'M';if(n>=1e3)return trim(n/1e3,1)+'K';return String(n);}
// British Poker Series text colours for the post and Story: ivory text, BPS gold for DAY 2 and the chip leader,
// warm grey for secondary text, dark gold rule above the table. The page and row background is the day theme
// (matched to the tournament logo); page and rowB are not used for it.
export const BPS_PALETTE={page:'#11100E',rowB:'#1B1813',ivory:'#F4F0E7',gold:'#D6B46D',grey:'#BCB4A6',dim:'#8E8678',rule:'#7B6237'};
export const DAY_GOLD=BPS_PALETTE.gold;
export const BAND_GAP=40,TABLE_EDGE='#5F6368';
// V51: with only a few players the responsible gambling band is drawn smaller (64% at 1 player, full size from 10),
// so it does not dominate a short leaderboard.
export const bandScale=n=>n>=10?1:.6+.04*Math.max(1,n);
// V51: one typeface for the whole JPEG. The table uses Montserrat (already bundled for the header) instead of Arial.
const TABLE_FONT=(size,weight=500)=>weight+' '+size+'px Montserrat';
// Measured on the exported JPEGs (Montserrat, middle baseline): capitals reach 0.52 em above the middle line, descenders 0.45 em below.
const CAP=.52,DESC=.45;
// V51 checks before export: plain-language warnings shown above GENERATE. They never block the export.
const money=v=>{const s=String(v??'').replace(/[£,\s]/g,'');return /^\d{1,9}(\.\d{1,2})?$/.test(s)?Number(s):null;};
export function exportChecks(t={},rows=[]){
 const out=[],n=rows.length,typed=v=>String(v??'').trim()!=='',paid=placesPaid(t.paid),bb=bigBlind(t.bb),pool=money(t.prizePool),first=money(t.firstPrize),min=money(t.minCash);
 if(!text(t.name))out.push('No tournament name: the title will read "Day 2 Leaderboard".');
 if(!text(t.date))out.push('No date: the date line will be left out.');
 if(typed(t.paid)&&!paid)out.push('Places paid is not a whole number, so it will not be shown.');
 if(typed(t.bb)&&!bb)out.push('Day 2 big blind is not a whole number, so BB will not be shown.');
 for(const [key,label] of [['prizePool','Prize pool'],['gtd','Guarantee (GTD)'],['firstPrize','1st place prize'],['minCash','Min cash']])if(typed(t[key])&&money(t[key])===null)out.push(label+' is not a valid amount, so it will not be shown.');
 if(paid&&n&&paid>=n)out.push(`Places paid (${paid}) is not lower than the ${n} qualified players, so no gold line is drawn.`);
 if(pool!==null&&first!==null&&first>pool)out.push('1st place prize is higher than the prize pool.');
 if(first!==null&&min!==null&&min>first)out.push('Min cash is higher than the 1st place prize.');
 if(pool!==null&&min!==null&&paid&&min*paid>pool)out.push('Min cash × places paid is more than the prize pool.');
 {const total=flightCount(t.flights),beyond=total?[...new Set(rows.map(r=>normalizeFlight(r.flight)).filter(letter=>letter&&FLIGHT_LETTERS.indexOf(letter)>=total))]:[];if(beyond.length)out.push(`Players qualified from Day 1${beyond.join(', Day 1')}, but the event is set to ${total} ${total===1?'flight':'flights'}.`);}
 if(bb&&n){const short=rows.filter(r=>r.chips<bb).length;if(short)out.push(`${short} ${short===1?'stack is':'stacks are'} below 1 big blind: check the Day 2 big blind.`);}
 return out;
}
// V51 day backgrounds matched to the tournament logo: seven variants (Monday to Sunday) built from the logo's
// hue, always dark so white text stays readable. Without a logo palette the JPEG keeps the Genting dark grey.
export const DAY_NAMES=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function dayIndex(date){const s=String(date??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return 0;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())?(d.getUTCDay()+6)%7:0;}
export function dayTheme(palette,date){
 if(!palette)return null;
 const h=palette.hue,s=Math.round(Math.min(palette.sat,.45)*100),hsl=(l,a=1)=>`hsla(${h},${s}%,${l}%,${a})`,day=dayIndex(date);
 const [ar,ag,ab]=palette.accent,accent=a=>`rgba(${ar},${ag},${ab},${a})`;
 const linear=(c,x0,y0,x1,y1,stops)=>{const g=c.createLinearGradient(x0,y0,x1,y1);stops.forEach(([o,col])=>g.addColorStop(o,col));return g;};
 const radial=(c,x,y,r,stops)=>{const g=c.createRadialGradient(x,y,0,x,y,r);stops.forEach(([o,col])=>g.addColorStop(o,col));return g;};
 const variants=[
  (c,w,H)=>hsl(8),
  (c,w,H)=>linear(c,0,0,0,H,[[0,hsl(13)],[1,hsl(5)]]),
  (c,w,H)=>linear(c,0,0,w,H,[[0,hsl(5)],[1,hsl(14)]]),
  (c,w,H)=>radial(c,w/2,0,Math.max(w,H)*.9,[[0,hsl(16)],[1,hsl(5)]]),
  (c,w,H)=>radial(c,w/2,H/2,Math.max(w,H)*.75,[[0,hsl(13)],[1,hsl(4)]]),
  (c,w,H)=>linear(c,0,0,w,0,[[0,hsl(5)],[.5,hsl(13)],[1,hsl(5)]]),
  (c,w,H)=>radial(c,w/2,H,Math.max(w,H)*.9,[[0,hsl(15)],[1,hsl(5)]])
 ];
 return {day,dayName:DAY_NAMES[day],base:hsl(5),rowA:'rgba(0,0,0,0)',rowB:accent(.07),paint(c,w,H){c.fillStyle=variants[day](c,w,H);c.fillRect(0,0,w,H);c.fillStyle=accent(.55);c.fillRect(0,0,w,3);c.fillRect(0,H-3,w,3);c.fillRect(0,0,3,H);c.fillRect(w-3,0,3,H);}};
}
// V51 country flags next to names. Countries come from the Excel nationality column and are shown only when the
// player gave GDPR consent (same rule as the full name). Flags are drawn here (no emoji, no downloaded images) in a
// simplified form that stays recognisable at small sizes. Unknown countries show a small grey code tag.
const COUNTRY_ALIASES={
 GB:['british','united kingdom','uk','gb','gbr','great britain','england','english','scotland','scottish','wales','welsh','northern ireland','britain'],
 IE:['ireland','irish','ie','irl','republic of ireland'],RO:['romania','romanian','ro','rou','rom'],CN:['china','chinese','cn','chn'],IN:['india','indian','in','ind'],
 AU:['australia','australian','au','aus'],JM:['jamaica','jamaican','jm','jam'],IR:['iran','iranian','ir','irn','persian'],VN:['vietnam','viet nam','vietnamese','vn','vnm'],
 MY:['malaysia','malaysian','my','mys'],PL:['poland','polish','pl','pol'],UA:['ukraine','ukrainian','ua','ukr'],BR:['brazil','brazilian','br','bra'],TR:['turkey','turkiye','turkish','tr','tur'],
 MX:['mexico','mexican','mx','mex'],SK:['slovakia','slovak','sk','svk'],TW:['taiwan','taiwanese','tw','twn'],NL:['netherlands','dutch','holland','nl','nld'],HK:['hong kong','hk','hkg'],
 IL:['israel','israeli','il','isr'],LV:['latvia','latvian','lv','lva'],MT:['malta','maltese','mt','mlt'],PT:['portugal','portuguese','pt','prt'],KN:['saint kitts and nevis','st kitts and nevis','kn','kna'],
 NO:['norway','norwegian','no','nor'],GE:['georgia','georgian','ge','geo'],IT:['italy','italian','it','ita'],NG:['nigeria','nigerian','ng','nga'],ES:['spain','spanish','es','esp'],FI:['finland','finnish','fi','fin'],
 FR:['france','french','fr','fra'],DE:['germany','german','de','deu','ger'],BE:['belgium','belgian','be','bel'],AT:['austria','austrian','at','aut'],CH:['switzerland','swiss','ch','che'],
 SE:['sweden','swedish','se','swe'],DK:['denmark','danish','dk','dnk'],HU:['hungary','hungarian','hu','hun'],BG:['bulgaria','bulgarian','bg','bgr'],LT:['lithuania','lithuanian','lt','ltu'],
 EE:['estonia','estonian','ee','est'],GR:['greece','greek','gr','grc'],US:['united states','united states of america','usa','us','american'],CA:['canada','canadian','ca','can'],
 NZ:['new zealand','nz','nzl'],JP:['japan','japanese','jp','jpn'],KR:['south korea','korea','korean','kr','kor'],TH:['thailand','thai','th','tha'],PK:['pakistan','pakistani','pk','pak'],
 BD:['bangladesh','bangladeshi','bd','bgd'],CZ:['czech republic','czechia','czech','cz','cze'],RU:['russia','russian','ru','rus'],CY:['cyprus','cypriot','cy','cyp'],AL:['albania','albanian','al','alb']
};
const COUNTRY_LOOKUP=new Map(Object.entries(COUNTRY_ALIASES).flatMap(([code,names])=>names.map(n=>[n,code])));
export function countryCode(value){const v=text(value).toLocaleLowerCase().replace(/[._]/g,' ').replace(/\s+/g,' ').trim();if(!v||v==='—')return '';return COUNTRY_LOOKUP.get(v)||'';}
export const FLAG_CODES=Object.keys(COUNTRY_ALIASES);
export function drawFlag(c,code,x,y,w,h,outline=true){
 const R=(col,x0=0,y0=0,w0=1,h0=1)=>{c.fillStyle=col;c.fillRect(x+x0*w,y+y0*h,w0*w,h0*h);};
 const H=(cols,ws=cols.map(()=>1))=>{const t=ws.reduce((a,b)=>a+b,0);let o=0;cols.forEach((col,i)=>{R(col,0,o/t,1,ws[i]/t);o+=ws[i];});};
 const V=(cols,ws=cols.map(()=>1))=>{const t=ws.reduce((a,b)=>a+b,0);let o=0;cols.forEach((col,i)=>{R(col,o/t,0,ws[i]/t,1);o+=ws[i];});};
 const shapes=typeof c.beginPath==='function'&&typeof c.lineTo==='function'&&typeof c.arc==='function'&&typeof c.fill==='function';
 const poly=(col,pts)=>{if(!shapes)return;c.fillStyle=col;c.beginPath();pts.forEach(([px,py],i)=>i?c.lineTo(x+px*w,y+py*h):c.moveTo(x+px*w,y+py*h));c.closePath();c.fill();};
 const circ=(col,cx,cy,r)=>{if(!shapes)return;c.fillStyle=col;c.beginPath();c.arc(x+cx*w,y+cy*h,r*h,0,Math.PI*2);c.fill();};
 const star=(col,cx,cy,r,n=5)=>{const pts=[];for(let i=0;i<n*2;i++){const a=-Math.PI/2+i*Math.PI/n,rr=(i%2?r*.42:r)*h;pts.push([cx+Math.cos(a)*rr/w,cy+Math.sin(a)*rr/h]);}poly(col,pts);};
 const band=(col,width,x0,y0,x1,y1)=>{const dx=(x1-x0)*w,dy=(y1-y0)*h,len=Math.hypot(dx,dy),nx=-dy/len*width*h/2/w,ny=dx/len*width*h/2/h;poly(col,[[x0+nx,y0+ny],[x1+nx,y1+ny],[x1-nx,y1-ny],[x0-nx,y0-ny]]);};
 const nordic=(bg,outer,inner,vx=.32,vw=.14,hy=.43,hh=.14)=>{R(bg);if(inner){R(outer,vx-vw*.35,0,vw*1.7,1);R(outer,0,hy-hh*.35,1,hh*1.7);R(inner,vx,0,vw,1);R(inner,0,hy,1,hh);}else{R(outer,vx,0,vw,1);R(outer,0,hy,1,hh);}};
 const draw={
  GB(){R('#012169');band('#fff',.32,0,0,1,1);band('#fff',.32,1,0,0,1);band('#C8102E',.11,0,0,1,1);band('#C8102E',.11,1,0,0,1);R('#fff',.389,0,.222,1);R('#fff',0,1/3,1,1/3);R('#C8102E',.433,0,.133,1);R('#C8102E',0,.4,1,.2);},
  IE(){V(['#169B62','#fff','#FF883E']);},RO(){V(['#002B7F','#FCD116','#CE1126']);},IT(){V(['#009246','#fff','#CE2B37']);},FR(){V(['#0055A4','#fff','#EF4135']);},BE(){V(['#000','#FDDA24','#EF3340']);},
  NG(){V(['#008751','#fff','#008751']);},MX(){V(['#006847','#fff','#CE1126']);circ('#8C5A2B',.5,.5,.13);},CA(){V(['#D52B1E','#fff','#D52B1E'],[1,2,1]);star('#D52B1E',.5,.52,.3,11);},
  MT(){V(['#fff','#CF142B']);R('#A0A0A0',.1,.12,.12,.05);R('#A0A0A0',.135,.08,.05,.13);},PT(){V(['#006600','#FF0000'],[2,3]);circ('#FFE000',.4,.5,.22);circ('#FF0000',.4,.5,.13);},
  PL(){H(['#fff','#DC143C']);},UA(){H(['#0057B7','#FFD700']);},NL(){H(['#AE1C28','#fff','#21468B']);},DE(){H(['#000','#DD0000','#FFCE00']);},LV(){H(['#9E3039','#fff','#9E3039'],[2,1,2]);},
  ES(){H(['#AA151B','#F1BF00','#AA151B'],[1,2,1]);},HU(){H(['#CE2939','#fff','#477050']);},BG(){H(['#fff','#00966E','#D62612']);},LT(){H(['#FDB913','#006A44','#C1272D']);},EE(){H(['#0072CE','#000','#fff']);},
  AT(){H(['#ED2939','#fff','#ED2939']);},RU(){H(['#fff','#0039A6','#D52B1E']);},SK(){H(['#fff','#0B4EA2','#EE1C25']);poly('#fff',[[.24,.22],[.46,.22],[.46,.6],[.35,.74],[.24,.6]]);poly('#EE1C25',[[.26,.25],[.44,.25],[.44,.59],[.35,.7],[.26,.59]]);},
  IN(){H(['#FF9933','#fff','#138808']);circ('#000080',.5,.5,.11);circ('#fff',.5,.5,.075);circ('#000080',.5,.5,.03);},IR(){H(['#239F40','#fff','#DA0000']);circ('#DA0000',.5,.5,.08);},
  TH(){H(['#A51931','#F4F5F8','#2D2A4A','#F4F5F8','#A51931'],[1,1,2,1,1]);},CN(){R('#DE2910');star('#FFDE00',.17,.27,.17);for(const [sx,sy] of [[.33,.1],[.4,.2],[.4,.35],[.33,.45]])star('#FFDE00',sx,sy,.055);},
  VN(){R('#DA251D');star('#FFFF00',.5,.52,.32);},TR(){R('#E30A17');circ('#fff',.4,.5,.25);circ('#E30A17',.45,.5,.2);star('#fff',.6,.5,.12);},
  JM(){R('#009B3A');poly('#000',[[0,0],[.5,.5],[0,1]]);poly('#000',[[1,0],[.5,.5],[1,1]]);band('#FED100',.16,0,0,1,1);band('#FED100',.16,1,0,0,1);},
  BR(){R('#009C3B');poly('#FFDF00',[[.5,.1],[.92,.5],[.5,.9],[.08,.5]]);circ('#002776',.5,.5,.22);},
  MY(){for(let i=0;i<14;i++)R(i%2?'#fff':'#CC0001',0,i/14,1,1/14);R('#010066',0,0,.5,8/14);circ('#FFCC00',.2,.29,.2);circ('#010066',.24,.29,.16);star('#FFCC00',.37,.29,.1,14);},
  TW(){R('#FE0000');R('#000095',0,0,.5,.5);circ('#fff',.25,.25,.12);},HK(){R('#DE2910');for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5;circ('#fff',.5+Math.cos(a)*.1,.5+Math.sin(a)*.15,.1);}circ('#DE2910',.5,.5,.04);},
  IL(){R('#fff');R('#0038B8',0,.1,1,.15);R('#0038B8',0,.75,1,.15);poly('#0038B8',[[.5,.3],[.62,.6],[.38,.6]]);poly('#0038B8',[[.5,.7],[.62,.4],[.38,.4]]);poly('#fff',[[.5,.38],[.57,.56],[.43,.56]]);poly('#fff',[[.5,.62],[.57,.44],[.43,.44]]);},
  KN(){poly('#009E49',[[0,0],[1,0],[0,1]]);poly('#CE1126',[[1,0],[1,1],[0,1]]);band('#FCD116',.42,0,1,1,0);band('#000',.28,0,1,1,0);star('#fff',.38,.6,.08);star('#fff',.62,.4,.08);},
  NO(){nordic('#BA0C2F','#fff','#00205B',.318,.091,.4375,.125);},FI(){nordic('#fff','#002F6C',null,.278,.166,.364,.272);},SE(){nordic('#006AA7','#FECC02',null,.3125,.125,.4,.2);},DK(){nordic('#C8102E','#fff',null,.32,.12,.43,.14);},
  GE(){R('#fff');R('#FF0000',.44,0,.12,1);R('#FF0000',0,.42,1,.16);for(const [cx,cy] of [[.22,.2],[.78,.2],[.22,.8],[.78,.8]]){R('#FF0000',cx-.02,cy-.1,.04,.2);R('#FF0000',cx-.06,cy-.03,.12,.06);}},
  CH(){R('#D52B1E');R('#fff',.44,.22,.12,.56);R('#fff',.33,.42,.34,.16);},GR(){for(let i=0;i<9;i++)R(i%2?'#fff':'#0D5EAF',0,i/9,1,1/9);R('#0D5EAF',0,0,.37,5/9);R('#fff',.15,0,.07,5/9);R('#fff',0,2/9,.37,1/9);},
  US(){for(let i=0;i<13;i++)R(i%2?'#fff':'#B22234',0,i/13,1,1/13);R('#3C3B6E',0,0,.4,7/13);for(let r=0;r<4;r++)for(let k=0;k<5;k++)circ('#fff',.04+k*.08,.07+r*.13,.025);},
  AU(){R('#012169');drawFlag(c,'GB',x,y,w/2,h/2,false);star('#fff',.25,.75,.13,7);for(const [sx,sy] of [[.75,.22],[.62,.48],[.75,.82],[.87,.43]])star('#fff',sx,sy,.06,7);},
  NZ(){R('#012169');drawFlag(c,'GB',x,y,w/2,h/2,false);for(const [sx,sy] of [[.75,.22],[.65,.45],[.83,.42],[.75,.78]])star('#CC142B',sx,sy,.07);},
  JP(){R('#fff');circ('#BC002D',.5,.5,.3);},KR(){R('#fff');circ('#CD2E3A',.5,.5,.25);poly('#0047A0',Array.from({length:25},(_,i)=>{const a=i/24*Math.PI;return [.5+Math.cos(a)*.25*h/w,.5+Math.sin(a)*.25];}));for(const [bx,by] of [[.18,.2],[.82,.2],[.18,.8],[.82,.8]])R('#000',bx-.04,by-.08,.08,.16);},
  PK(){R('#01411C');R('#fff',0,0,.25,1);circ('#fff',.62,.5,.27);circ('#01411C',.67,.45,.24);star('#fff',.72,.36,.08);},BD(){R('#006A4E');circ('#F42A41',.45,.5,.3);},
  CZ(){H(['#fff','#D7141A']);poly('#11457E',[[0,0],[.5,.5],[0,1]]);},CY(){R('#fff');poly('#D57800',[[.3,.45],[.5,.35],[.72,.42],[.6,.55],[.38,.55]]);},AL(){R('#E41E20');circ('#000',.5,.5,.22);}
 };
 c.save?.();
 if(typeof c.beginPath==='function'&&typeof c.rect==='function'&&typeof c.clip==='function'){c.beginPath();c.rect(x,y,w,h);c.clip();}
 if(draw[code])draw[code]();else{R('#5F6368');}
 c.restore?.();
 if(outline){c.fillStyle='rgba(255,255,255,0.35)';c.fillRect(x,y,w,1);c.fillRect(x,y+h-1,w,1);c.fillRect(x,y,1,h);c.fillRect(x+w-1,y,1,h);}
}
export const LEADER={label:'CHIP LEADER',gold:'#D4AF37',text:'#F3D27A',fill:'#33301F',font:'700 17px Montserrat'};
export function drawLeaderboard(canvas,rows,logo,tournament={},responsibleBand,pixelDensity=1,branding={}){
 if(rows.some(r=>!normalizeFlight(r.flight)))throw Error('Check unrecognised flights before exporting.');
 if(!(logo?.naturalWidth>0)||!(logo?.naturalHeight>0))throw Error('The Genting logo could not be loaded. The JPEG was not generated.');
 const page=branding.page,measureRows=page?.measureRows||rows,showFlags=branding.flags!==false&&measureRows.some(r=>countryCode(r.nationality)),bb=bigBlind(tournament.bb),topChips=Math.max(...measureRows.map(r=>r.chips)),paid=placesPaid(tournament.paid),lastPaidIndex=paid?measureRows.findLastIndex(r=>Number(r.rank)<=paid):-1,bubbleRow=lastPaidIndex>=0&&lastPaidIndex<measureRows.length-1?measureRows[lastPaidIndex]:null,bubbles=[],l=layout(rows.length);if(page?.sections){l.sections=page.sections;l.rows=Math.max(page.rows||0,Math.ceil(rows.length/l.sections));}if(!rows.length)throw Error('There are no qualified players.');if(rows.some(r=>!Number.isSafeInteger(r.chips)||r.chips<=0))throw Error('Correct the ChipCount values before exporting.');
 if(!validTournamentTime(tournament.time))throw Error('Enter a time from 00:00 to 23:59 (HH:mm).');
 const c=canvas.getContext('2d');if(!c)throw Error('The image exceeds the browser’s capacity.');
 const bodyFont=27,lineHeight=34,padding=14,sectionGap=40,flagW=Math.round(bodyFont*1.15),flagH=Math.round(flagW*2/3),flagSpace=showFlags?flagW+12:0;
 c.font=TABLE_FONT(bodyFont);let nameWidth=580;const measuredNames=measureRows.map(r=>String(r.name));while(measuredNames.some(value=>wrapTournamentName(c,value,nameWidth-padding*2-flagSpace).length>2))nameWidth=Math.ceil(nameWidth*1.15);
 const textWidth=value=>c.measureText(String(value)).width;const rankWidth=Math.max(90,...measureRows.map(r=>textWidth(r.rank)+padding*2)),chipWidth=Math.max(230,...measureRows.map(r=>textWidth(r.chips.toLocaleString('en-GB'))+padding*2+(bb?textWidth(bbLabel(r.chips,bb))*BB_STYLE.scale+16:0)));
 c.font=TABLE_FONT(19,700);const widths=[Math.max(rankWidth,textWidth('RANK')+padding*2),nameWidth,Math.max(250,textWidth('QUALIFIED FROM')+padding*2),Math.max(chipWidth,textWidth('CHIP COUNT')+padding*2)],sectionWidth=widths.reduce((a,b)=>a+b,0);
 l.width=Math.ceil(80+l.sections*sectionWidth+(l.sections-1)*sectionGap);c.font=TABLE_FONT(bodyFont);const playerLines=rows.map(r=>wrapTournamentName(c,String(r.name),nameWidth-padding*2-flagSpace)),baseRowHeight=measuredNames.map(value=>wrapTournamentName(c,value,nameWidth-padding*2-flagSpace)).some(lines=>lines.length>1)?86:58;
 const previousVerticalMargin=l.sections===1?64:l.sections===2?80:96,verticalMargin=l.sections===1?32:l.sections===2?40:44,previousFooterGap=l.sections===1?48:l.sections===2?64:72,footerGap=24,bottomMargin=14,rowHeight=baseRowHeight+Math.min(14,Math.floor((previousFooterGap-footerGap+previousVerticalMargin-bottomMargin+2*(previousVerticalMargin-verticalMargin))/l.rows));
 const innerWidth=l.width-80;
 const nameSize=l.sections===1?48:l.sections===2?62.4:70.2,k=nameSize/48;
 const titleSize=nameSize*.8,countSize=titleSize*.8,dateSize=titleSize;
 // Two equal logo zones at the same height with symmetric 40px outer margins:
 // Genting top-left, tournament logo top-right (left empty when there is no tournament logo).
 const zoneW=Math.round(Math.min(innerWidth*.28,620)),zoneH=Math.round(zoneW*620/1440),zoneY=BAND_GAP;
 const leftZone={x:40,y:zoneY,w:zoneW,h:zoneH},rightZone={x:l.width-40-zoneW,y:zoneY,w:zoneW,h:zoneH};
 const gentingCrop=branding.gentingCrop||{x:0,y:0,w:logo.naturalWidth,h:logo.naturalHeight};
 const gentingBox=fitInZone(gentingCrop,leftZone,'left');
 const brandImage=branding.tournamentLogo?.image,hasBrand=brandImage?.naturalWidth>0&&brandImage?.naturalHeight>0;
 const brandCrop=hasBrand?(branding.tournamentLogo.crop||{x:0,y:0,w:brandImage.naturalWidth,h:brandImage.naturalHeight}):null;
 const brandBox=hasBrand?fitInZone(brandCrop,rightZone,'right'):null;
 const headerGap=Math.round(24*k),middleWidth=Math.max(120,innerWidth-2*zoneW-2*headerGap),lineGap=Math.round(8*k);
 const measureFont=(weight,size)=>weight+' '+size+'px Montserrat';
 const fitLine=(value,size,weight,width=middleWidth)=>{c.font=measureFont(weight,size);const w=c.measureText(value).width;return w>width?size*width/w:size;};
 // V51 header between the logos: "<name> · Day 2" (at most two lines, shrinking first, then shortened),
 // the date line, then "N qualified · £X prize pool". Same header on every page.
 const head=headerText(tournament,measureRows,page),titleWidth=middleWidth;let titleFont=nameSize,nameLines=[];
 for(;;){c.font=measureFont(800,titleFont);nameLines=titleLines(c,head,titleWidth);if(nameLines.length<=2||titleFont<=nameSize*.6)break;titleFont=Math.max(nameSize*.6,titleFont*.92);}
 if(nameLines.length>2){let rest=nameLines.slice(1).join(' ');while(rest.length>1&&c.measureText(rest+'…').width>titleWidth)rest=rest.slice(0,-1);nameLines=[nameLines[0],rest.trimEnd()+'…'];}
 const titleLineHeight=titleFont*1.12,infoSize=head.info?fitLine(head.info,dateSize*.75,600):0,lineSize=Math.min(...head.lines.map(line=>fitLine(line.map(s=>s.text).join('  ·  '),dateSize*.75,600)));
 const infoBlock=head.info?lineGap+infoSize*1.2:0,infoRel=nameLines.length*titleLineHeight+lineGap+infoSize*.6,firstLineRel=nameLines.length*titleLineHeight+infoBlock+lineGap+lineSize*.6,lineStep=lineSize*1.2+lineGap,lastLineRel=firstLineRel+(head.lines.length-1)*lineStep;
 // Visible extent: cap height of the first title line to the descenders of the qualified / prize pool line.
 const visTop=titleLineHeight/2-titleFont*CAP,middleHeight=lastLineRel+lineSize*DESC-visTop;
 const headerRowHeight=Math.max(zoneH,middleHeight),titleTop=zoneY+(headerRowHeight-middleHeight)/2-visTop,logoShift=(headerRowHeight-zoneH)/2;
 const infoY=titleTop+infoRel;
 // The table is centred: the same gap (BAND_GAP) above it, between it and the band, and under the band.
 const spare=0,lineY=Math.ceil(zoneY+headerRowHeight+BAND_GAP),tableY=lineY+48,rowsTop=tableY+24;
 const rowsBottom=rowsTop+spare+l.rows*rowHeight-3;
 let imageHeight=Math.ceil(rowsTop+spare+l.rows*rowHeight+footerGap+bottomMargin);
 let footer;
 if(responsibleBand){
  const {naturalWidth,naturalHeight}=responsibleBand;
  if(!(naturalWidth>0)||!(naturalHeight>0))throw Error('The responsible gambling image could not be loaded.');
  const aspect=naturalWidth/naturalHeight;
  const minimumWidth=64*aspect;
  const previousWidth=Math.min(innerWidth,Math.max(.8*Math.min(innerWidth,Math.max(.75*innerWidth,minimumWidth)),minimumWidth));
  const width=Math.min(innerWidth,Math.max(48*aspect,previousWidth*.4)*1.2)*bandScale(measureRows.length);
  const height=width/aspect;
  // V51: the band sits centred between the table and the bottom edge (same gap above and below).
  const y=Math.ceil(rowsBottom+BAND_GAP);
  imageHeight=Math.ceil(y+height+BAND_GAP);
  footer={x:(l.width-width)/2,y,width,height};
 }
 // Increase output density within a bounded pixel budget, keeping layout units stable.
 const referenceSize=rows.length===118&&l.width===3610&&imageHeight<=2918;
 if(referenceSize)imageHeight=2918;
 const scale=referenceSize?1:Math.max(1,Math.min(pixelDensity,Math.sqrt(16000000/(l.width*imageHeight)),4096/Math.max(l.width,imageHeight)));
 const pixelWidth=Math.floor(l.width*scale),pixelHeight=Math.floor(imageHeight*scale);
 canvas.width=pixelWidth;
 canvas.height=pixelHeight;
 if(canvas.width!==pixelWidth||canvas.height!==pixelHeight)throw Error('The image exceeds the browser’s capacity.');
 if(scale!==1)c.setTransform(scale,0,0,scale,0,0);
 c.imageSmoothingEnabled=true;
 c.imageSmoothingQuality='high';
 const rowTheme=branding.theme;
 if(rowTheme)rowTheme.paint(c,l.width,imageHeight);else{c.fillStyle='#202124';c.fillRect(0,0,canvas.width,canvas.height);}
 c.drawImage(logo,gentingCrop.x,gentingCrop.y,gentingCrop.w,gentingCrop.h,gentingBox.x,gentingBox.y+logoShift,gentingBox.w,gentingBox.h);
 if(hasBrand)c.drawImage(brandImage,brandCrop.x,brandCrop.y,brandCrop.w,brandCrop.h,brandBox.x,brandBox.y+logoShift,brandBox.w,brandBox.h);
 c.save();
 c.textBaseline='middle';
 const drawLine=({value,size,weight,colour,tracking},x,y,alignment,width)=>{
  c.textAlign=alignment;c.font=measureFont(weight,size);
  c.letterSpacing=tracking ? parseFloat(tracking)*size+'px' : '0px';
  c.fillStyle=colour;c.fillText(value,x,y,width);
 };
 nameLines.forEach((value,i)=>drawLine({value,size:titleFont,weight:800,colour:'#F2F2F4',tracking:'-0.015em'},l.width/2,titleTop+i*titleLineHeight+titleLineHeight/2,'center',titleWidth));
 if(head.info)drawLine({value:head.info,size:infoSize,weight:600,colour:'#C5C8CE'},l.width/2,infoY,'center',middleWidth);
 head.lines.forEach((line,i)=>drawSegments(c,line,l.width/2,titleTop+firstLineRel+i*lineStep,measureFont(600,lineSize),middleWidth));
 c.restore();
 c.textAlign='left';
 c.fillStyle='#cc1428';
 c.fillRect(40,lineY,innerWidth,2);
 let offset=0;
 // Pages keep the first page's size and type sizes; a page with 20 players or fewer uses one centred column.
 const drawSections=page?.sections?Math.min(l.sections,rows.length<=COLUMN_MAX?1:2):l.sections,startX=40+(l.sections-drawSections)*(sectionWidth+sectionGap)/2;
 for(let section=0;section<drawSections;section++){const x=startX+section*(sectionWidth+sectionGap),count=Math.floor(rows.length/drawSections)+(section<rows.length%drawSections?1:0);let dx=x;c.font=TABLE_FONT(19,700);c.fillStyle='#eee';c.textBaseline='alphabetic';JPEG_COLUMNS.forEach((label,i)=>{c.textAlign=i===0||i===3?'right':'left';c.fillText(label,dx+(i===0||i===3?widths[i]-padding:padding),tableY);dx+=widths[i];});
 for(let j=0;j<count;j++){const index=offset+j,r=rows[index],top=rowsTop+j*rowHeight,centre=top+rowHeight/2,leader=r.chips===topChips;if(r===bubbleRow)bubbles.push({x,y:top+rowHeight-1.5,w:sectionWidth});c.fillStyle=leader?LEADER.fill:j%2?(rowTheme?.rowB||'#292A2D'):(rowTheme?.rowA||'#202124');c.fillRect(x,top,sectionWidth,rowHeight-3);if(j===count-1){c.fillStyle=TABLE_EDGE;c.fillRect(x,top+rowHeight-5,sectionWidth,2);}if(leader){const b=3,h=rowHeight-3;c.fillStyle=LEADER.gold;c.fillRect(x,top,sectionWidth,b);c.fillRect(x,top+h-b,sectionWidth,b);c.fillRect(x,top,b,h);c.fillRect(x+sectionWidth-b,top,b,h);}let dx=x;c.font=TABLE_FONT(bodyFont);c.textBaseline='middle';[String(r.rank),playerLines[index],qualifiedFrom(r.flight),r.chips.toLocaleString('en-GB')].forEach((value,i)=>{c.fillStyle='#fff';c.textAlign=i===0||i===3?'right':'left';const tx=dx+(i===0||i===3?widths[i]-padding:padding)+(i===1?flagSpace:0),lines=Array.isArray(value)?value:[value];if(i===1&&flagSpace){const code=countryCode(r.nationality);if(code)drawFlag(c,code,tx-flagSpace,centre-flagH/2,flagW,flagH);c.fillStyle='#fff';}if(leader&&(i===0||i===3))c.fillStyle=LEADER.text;const medal=i===0?MEDALS[Number(r.rank)]:null;if(medal){c.font=TABLE_FONT(bodyFont,700);drawMedal(c,tx-c.measureText(lines[0]).width/2,centre,Math.round(bodyFont*.8),medal);c.fillStyle=MEDAL_INK;c.textAlign='right';}lines.forEach((line,k)=>c.fillText(line,tx,centre+(k-(lines.length-1)/2)*lineHeight));if(medal)c.font=TABLE_FONT(bodyFont);if(i===3&&bb){const used=c.measureText(lines[0]).width;c.font=TABLE_FONT(Math.round(bodyFont*BB_STYLE.scale));c.fillStyle=leader?LEADER.gold:BB_STYLE.colour;c.textAlign='right';c.fillText(bbLabel(r.chips,bb),tx-used-14,centre);c.font=TABLE_FONT(bodyFont);}dx+=widths[i];});}
 offset+=count;}
 // Drawn after every row so the next row cannot cover the label.
 for(const b of bubbles){c.fillStyle=ITM.gold;c.fillRect(b.x,b.y-2,b.w,4);}
 if(footer){
  c.drawImage(responsibleBand,footer.x,footer.y,footer.width,footer.height);
 }
 // Page number small, bottom right, level with the responsible gambling band.
 if(head.pageLabel){c.font=measureFont(700,nameSize*.45);c.letterSpacing='0px';c.textAlign='right';c.textBaseline='middle';c.fillStyle='#9AA0A6';c.fillText(head.pageLabel,l.width-40,footer?footer.y+footer.height/2:imageHeight-24);}
 return canvas;
}
// V51 social formats: exact 1080 × 1080 (Instagram / Facebook post) and 1080 × 1920 (Story) pages, one column,
// same colours, logos, chip leader, IN THE MONEY line and summary strip as the full leaderboard.
// Story keeps the top 230 px and bottom 270 px clear of key content (Instagram profile bar and reply box).
export const SOCIAL_FORMATS={
 square:{key:'square',width:1080,height:1080,top:0,bottom:0,perPage:20,maxRow:64,band:26.4},
 story:{key:'story',width:1080,height:1920,top:250,bottom:250,perPage:20,maxRow:60,band:44}
};
// Pages are always filled with 20 players in turn (29 = 20 + 9, 153 = 7 x 20 + 13); up to 20 in total fit on one page
// laid out bigger and centred. balanceLast (not used now) would split the remainder over the last two pages.
export function pageSizes(n,per,balanceLast=false){if(n<=0)return [];const pages=Math.ceil(n/per);if(pages===1)return [n];if(!balanceLast)return Array.from({length:pages},(_,i)=>Math.min(per,n-i*per));const rest=n-per*(pages-2);return [...Array(pages-2).fill(per),Math.ceil(rest/2),Math.floor(rest/2)];}
export function socialPages(rows,format){const out=[];let i=0;for(const size of pageSizes(rows.length,format.perPage,!!format.balanceLast)){out.push(rows.slice(i,i+size));i+=size;}return out;}
export function drawSocial(canvas,rows,logo,tournament={},responsibleBand,branding={},format=SOCIAL_FORMATS.square){
 if(!rows.length)throw Error('There are no qualified players.');
 if(rows.some(r=>!normalizeFlight(r.flight)))throw Error('Check unrecognised flights before exporting.');
 if(!(logo?.naturalWidth>0)||!(logo?.naturalHeight>0))throw Error('The Genting logo could not be loaded. The JPEG was not generated.');
 if(rows.some(r=>!Number.isSafeInteger(r.chips)||r.chips<=0))throw Error('Correct the ChipCount values before exporting.');
 if(!validTournamentTime(tournament.time))throw Error('Enter a time from 00:00 to 23:59 (HH:mm).');
 if(rows.length>format.perPage)throw Error('Too many players for one page in this format.');
 if(responsibleBand&&!(responsibleBand.naturalWidth>0&&responsibleBand.naturalHeight>0))throw Error('The responsible gambling image could not be loaded.');
 const W=format.width,H=format.height,M=40,page=branding.page,all=page?.measureRows||rows;
 canvas.width=W;canvas.height=H;
 const c=canvas.getContext('2d');if(!c)throw Error('The image exceeds the browser’s capacity.');
 c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
 const P=BPS_PALETTE,rowTheme=branding.theme;if(rowTheme)rowTheme.paint(c,W,H);else{c.fillStyle='#202124';c.fillRect(0,0,W,H);}
 const put=(value,x,y,{size,weight=400,colour=P.ivory,align='center',max=W-2*M,arial=false,tracking=0})=>{
  c.font=arial?TABLE_FONT(size,weight>=600?700:500):weight+' '+size+'px Montserrat';
  c.letterSpacing=tracking?tracking*size+'px':'0px';c.textAlign=align;c.textBaseline='middle';c.fillStyle=colour;c.fillText(value,x,y,max);
 };
 const fit=(value,size,weight,max)=>{c.font=weight+' '+size+'px Montserrat';const w=c.measureText(value).width;return w>max?size*max/w:size;};
 // Frame: the same gap above the header, between the header and the table, between the table and the band and
 // under the band. The Post uses the whole image; the Story keeps 250 px clear at the top and bottom for Instagram.
 const zoneW=270,zoneH=Math.round(zoneW*620/1440),head=headerText(tournament,all,page);
 // The header text sits in the real space between the drawn Genting and tournament logos: centred on that gap,
 // 24 px clear of each logo (without a tournament logo the space mirrors the Genting side).
 const gentingCrop=branding.gentingCrop||{x:0,y:0,w:logo.naturalWidth,h:logo.naturalHeight},gBox=fitInZone(gentingCrop,{x:M,y:0,w:zoneW,h:zoneH},'left');
 const brandImage=branding.tournamentLogo?.image,brandCrop=brandImage?.naturalWidth>0&&brandImage?.naturalHeight>0?branding.tournamentLogo.crop||{x:0,y:0,w:brandImage.naturalWidth,h:brandImage.naturalHeight}:null,bBox=brandCrop?fitInZone(brandCrop,{x:W-M-zoneW,y:0,w:zoneW,h:zoneH},'right'):null;
 const textLeft=gBox.x+gBox.w+24,textRight=(bBox?bBox.x:W-gBox.x-gBox.w)-24,middleW=textRight-textLeft,cx=(textLeft+textRight)/2;
 // Three header lines between the logos: tournament name (ivory, capitals), DAY 2 (BPS gold, letter-spaced), then
 // "29 Nov · 16:30 · 29 qualified" in warm grey (empty parts and their separators left out).
 const titleText=(head.name||'Leaderboard').toLocaleUpperCase('en-GB'),dayGold=branding.dayColour||P.gold;
 let tsize=38;c.font='800 '+tsize+'px Montserrat';let tlines=wrapTournamentName(c,titleText,middleW);
 while(tlines.length>2&&tsize>24){tsize-=2;c.font='800 '+tsize+'px Montserrat';tlines=wrapTournamentName(c,titleText,middleW);}
 if(tlines.length>2)tlines=[tlines[0],tlines.slice(1).join(' ')];
 const dsize=Math.round(tsize*.66),qualified=page?.totalPlayers??all.length;
 const info=[displayDate(text(tournament.date)).replace(/ \d{4}$/,''),formatTournamentTime(tournament.time),qualified+' qualified'].filter(Boolean).join(' · ');
 const isize=fit(info,22,600,middleW),visTop=tsize*.56-tsize*CAP;
 const blockH=tlines.length*tsize*1.12+dsize*1.3+8+isize*.6+isize*DESC-visTop,rowHead=Math.max(zoneH,blockH);
 // Above the table, the same on every page of the export (worked out from all players, not just this page):
 // - flights set and some without imported results: CHIP COUNTS SO FAR · 4 flights remaining (count in smaller warm grey);
 // - every scheduled flight imported (e.g. 1A-1H for BPS200): FINAL CHIP COUNTS;
 // - number of flights not set: CHIP COUNTS SO FAR without a count. PAGE 1 OF 6 on the right.
 const left=head.flights.length?flightsToPlay(flightCount(tournament.flights),all).length:0,statusText=head.final?'FINAL CHIP COUNTS':'CHIP COUNTS SO FAR',remainingText=left?`  ·  ${left} flight${left===1?'':'s'} remaining`:'',pageText=page?.total>1?`PAGE ${page.number} OF ${page.total}`:'',labelRow=30;
 // Columns: rank number / medal (no RANK label), flag, PLAYER, BB (when a Day 2 big blind is set), CHIPS.
 // Columns: rank, flag, name, the flight each player qualified from ("Day 1C", no heading), BB, chips.
 const bb=bigBlind(tournament.bb),rankW=78,nameX=M+rankW+10,chipX=W-M-14,chipW=170,bbX=chipX-chipW-28,bbW=bb?90:0,flightEnd=(bb?bbX-bbW:chipX-chipW)-14;
 let band=null;
 if(responsibleBand){const aspect=responsibleBand.naturalWidth/responsibleBand.naturalHeight,bh=(format.band||44)*bandScale(all.length),bw=Math.min(W-2*M,bh*aspect);band={x:(W-bw)/2,y:0,w:bw,h:bw/aspect};}
 const area=H-format.top-format.bottom,fixed=41+labelRow,bandH=band?band.h:0,gaps=band?4:3;
 // A single page with fewer players than a full page is laid out for its own rows: bigger rows and text (up to
 // 84 px rows, 34 px text) and the whole block centred with equal gaps. Several pages keep one layout for all.
 const slots=page?format.perPage:Math.max(1,rows.length),few=slots<format.perPage;
 const rowH=Math.min(few?84:format.maxRow,Math.floor((area-rowHead-bandH-gaps*24-fixed)/slots)),size=Math.max(18,Math.min(few?34:28,Math.round(rowH*.5)));
 // The flag space is kept on every row (also without a flag) so all names start at the same place.
 const showFlags=branding.flags!==false&&all.some(r=>countryCode(r.nationality)),fw=Math.round(size*1.15),fh=Math.round(fw*2/3),fGap=Math.max(0,Math.round(size*.3)-6),fSpace=showFlags?fw+10:0;
 const gap=(area-rowHead-bandH-fixed-slots*rowH)/gaps;
 let y=format.top+gap;
 const g=fitInZone(gentingCrop,{x:M,y:y+(rowHead-zoneH)/2,w:zoneW,h:zoneH},'left');
 c.drawImage(logo,gentingCrop.x,gentingCrop.y,gentingCrop.w,gentingCrop.h,g.x,g.y,g.w,g.h);
 if(brandCrop){const crop=brandCrop,b=fitInZone(crop,{x:W-M-zoneW,y:y+(rowHead-zoneH)/2,w:zoneW,h:zoneH},'right');c.drawImage(brandImage,crop.x,crop.y,crop.w,crop.h,b.x,b.y,b.w,b.h);}
 // Measured on the JPEG: the block reads 2 px low against the logos (descender of "qualified"), so it moves up 2 px.
 let my=y+(rowHead-blockH)/2-visTop-2;
 for(const t of tlines){put(t,cx,my+tsize*.56,{size:tsize,weight:800,tracking:-.015,max:middleW});my+=tsize*1.12;}
 put('DAY 2',cx,my+dsize*.62,{size:dsize,weight:800,colour:dayGold,tracking:.14,max:middleW});my+=dsize*1.3;
 put(info,cx,my+8+isize*.6,{size:isize,weight:600,colour:P.grey,max:middleW});
 y+=rowHead+gap;
 const label={size:14,weight:700,colour:P.grey,tracking:.1};
 // Three zones on one row: status on the left, prize pool centred on the poster, PAGE X OF Y on the right.
 const ly=y+10,pageStyle={...label,size:13,weight:600,colour:P.dim,align:'right'};
 put(statusText,M,ly,{...label,align:'left'});let leftEnd=M+c.measureText(statusText).width;
 if(remainingText){put(remainingText,leftEnd,ly,{size:12,weight:600,colour:P.dim,tracking:.04,align:'left'});leftEnd+=c.measureText(remainingText).width;}
 let rightStart=W-M;if(pageText){put(pageText,W-M,ly,pageStyle);rightStart-=c.measureText(pageText).width;}
 // Centre: provisional "PRIZE POOL £17,585" in warm grey followed by a small open-circle loading mark (drawn, not a
 // font glyph: still in progress); final: PRIZE POOL and the confirmed amount (at least the guarantee) in BPS gold.
 // Empty when no prize pool is entered.
 const poolValue=prizePool(tournament.prizePool)?Number(String(tournament.prizePool).replace(/[£,\s]/g,'')):0,gtdValue=prizePool(tournament.gtd)?Number(String(tournament.gtd).replace(/[£,\s]/g,'')):0;
 if(poolValue>0){const room=Math.max(0,2*Math.min(W/2-leftEnd,rightStart-W/2)-32);
  if(head.final){const amountText=prizePool(String(Math.max(poolValue,gtdValue))),lab={size:13,weight:700,colour:P.gold,tracking:.1},amt={size:17,weight:800,colour:P.gold};
   c.font=lab.weight+' '+lab.size+'px Montserrat';c.letterSpacing=lab.tracking*lab.size+'px';const lw=c.measureText('PRIZE POOL').width;c.font=amt.weight+' '+amt.size+'px Montserrat';c.letterSpacing='0px';const aw=c.measureText(amountText).width,total=lw+10+aw,k=total>room?room/total:1;
   const x0=W/2-total*k/2;put('PRIZE POOL',x0,ly,{...lab,align:'left',max:lw*k});put(amountText,x0+(lw+10)*k,ly,{...amt,align:'left',max:aw*k});}
  else{const amountText=prizePool(String(poolValue)),lab={size:13,weight:700,colour:P.grey,tracking:.1},amt={size:16,weight:700,colour:P.grey},rad=6;
   c.font=lab.weight+' '+lab.size+'px Montserrat';c.letterSpacing=lab.tracking*lab.size+'px';const lw=c.measureText('PRIZE POOL').width;c.font=amt.weight+' '+amt.size+'px Montserrat';c.letterSpacing='0px';
   const aw=c.measureText(amountText).width,total=lw+10+aw+8+2*rad,k=total>room?room/total:1,x0=W/2-total*k/2;
   put('PRIZE POOL',x0,ly,{...lab,align:'left',max:lw*k});put(amountText,x0+(lw+10)*k,ly,{...amt,align:'left',max:aw*k});const cx=x0+(lw+10+aw+8)*k+rad,start=-Math.PI/2;
   c.beginPath();c.arc(cx,ly,rad,start+.35*Math.PI,start+2*Math.PI);c.strokeStyle=P.grey;c.lineWidth=2;c.lineCap='round';c.stroke();}
 }
 y+=labelRow;
 // Red rule above the table, picking up the Genting logo red.
 c.fillStyle='#cc1428';c.fillRect(M,y,W-2*M,2);y+=12;
 const headStyle={size:15,weight:700,arial:true,colour:P.grey};
 // FLIGHT column: heading "FLIGHT", short codes "1D" in the row text size and colour, both centred in a column as wide
 // as the wider of the two, ending 14 px before the BB values; names stop 18 px before it.
 c.font=TABLE_FONT(15,700);c.letterSpacing='0px';const headW=c.measureText('FLIGHT').width;c.font=TABLE_FONT(size);const flightW=Math.ceil(Math.max(headW,c.measureText('1W').width)),flightX=flightEnd-flightW,flightMid=flightX+flightW/2,nameMax=flightX-nameX-18;
 put('PLAYER',nameX+fGap+fSpace,y+14,{...headStyle,align:'left'});put('FLIGHT',flightMid,y+14,{...headStyle,align:'center'});put('CHIPS',chipX,y+14,{...headStyle,align:'right'});
 // BB heading: only "BB", in the same font and size as the values under it (one step bolder), centred over the
 // column of values (right-aligned digits, width of the widest value in the whole export, so every page matches).
 // The starting blind is not shown; it is only used to work out the BB values.
 if(bb){const bsize=Math.round(size*BB_STYLE.scale);c.font=TABLE_FONT(bsize);c.letterSpacing='0px';const valuesW=Math.max(...all.map(r=>c.measureText(bbCount(r.chips,bb)).width));put('BB',bbX-valuesW/2,y+14,{size:bsize,weight:600,colour:P.grey,align:'center'});}
 y+=32;
 if(band)band.y=y+slots*rowH-3+gap;
 const topChips=Math.max(...all.map(r=>r.chips)),paid=placesPaid(tournament.paid),lastPaid=paid?all.findLastIndex(r=>Number(r.rank)<=paid):-1,bubbleRow=lastPaid>=0&&lastPaid<all.length-1?all[lastPaid]:null;let bubble=null;
 rows.forEach((r,j)=>{const top=y+j*rowH,mid=top+(rowH-3)/2,leader=r.chips===topChips;
  c.fillStyle=j%2?(rowTheme?.rowB||'#292A2D'):(rowTheme?.rowA||'#202124');c.fillRect(M,top,W-2*M,rowH-3);if(j===rows.length-1){c.fillStyle=P.rule;c.fillRect(M,top+rowH-4,W-2*M,1);}
  const strong=leader?P.gold:P.ivory;
  const medal=MEDALS[Number(r.rank)];if(medal){c.font=TABLE_FONT(size,700);drawMedal(c,M+rankW-12-c.measureText(String(r.rank)).width/2,mid,Math.round(size*.8),medal);}
  put(String(r.rank),M+rankW-12,mid,{size,arial:true,weight:medal?700:400,colour:medal?MEDAL_INK:strong,align:'right'});
  if(fSpace){const code=countryCode(r.nationality);if(code)drawFlag(c,code,nameX+fGap,mid-fh/2,fw,fh);}
  // A name too long for its space gets a smaller font (down to 75%) before it is squeezed.
  {const room=nameMax-fSpace-fGap,name=String(r.name);c.font=TABLE_FONT(size);c.letterSpacing='0px';const w=c.measureText(name).width,nsize=w>room?Math.max(Math.round(size*.75),Math.floor(size*room/w)):size;put(name,nameX+fGap+fSpace,mid,{size:nsize,arial:true,colour:P.ivory,align:'left',max:room});}
  const flightLetter=normalizeFlight(r.flight);if(flightLetter)put('1'+flightLetter,flightMid,mid,{size,arial:true,colour:P.ivory,align:'center',max:flightW});
  put(r.chips.toLocaleString('en-GB'),chipX,mid,{size,arial:true,colour:strong,align:'right',max:chipW-10});
  if(bb)put(bbCount(r.chips,bb),bbX,mid,{size:Math.round(size*BB_STYLE.scale),arial:true,colour:P.grey,align:'right',max:bbW});
  if(r===bubbleRow)bubble=top+rowH-1.5;
 });
 if(bubble!==null){c.fillStyle=ITM.gold;c.fillRect(M,bubble-2,W-2*M,4);}
 // The band (white on transparent) sits directly on the page background, so the background stays one style.
 if(band)c.drawImage(responsibleBand,band.x,band.y,band.w,band.h);
 return canvas;
}
