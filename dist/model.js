export const COLUMNS=['RANK','PLAYER NAME','NATIONALITY','QUALIFIED FROM','CHIP COUNT'];
export const JPEG_COLUMNS=['RANK','PLAYER NAME','QUALIFIED FROM','CHIP COUNT'];
export const text=v=>String(v??'').trim();
const norm=v=>text(v).toLowerCase().replace(/[^a-z0-9]/g,'');
export const yes=v=>typeof v==='string'&&v.trim().toUpperCase()==='YES';
export const nameConsent=v=>typeof v==='string'&&['Y','YES'].includes(v.trim().toUpperCase());
export function normalizeFlight(value){return text(value).toUpperCase().match(/^(?:(?:DAY\s*1|FLIGHT\s*(?:1\s*)?)\s*|1\s*)?([A-F])$/)?.[1]??null;}
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
export const invalidRecords=records=>records.filter(r=>r.qualified&&(!text(r.originalName)||r.chips===null||r.chips<=0||!normalizeFlight(flightValue(r))));
export function publicRows(records){return records.filter(r=>r.qualified).sort((a,b)=>(b.chips??-1)-(a.chips??-1)).map((r,i)=>({rank:i+1,name:!r.consentConflict&&nameConsent(r.originalGdpr)?text(r.originalName):initials(r.originalName),nationality:publicNationality(r),flight:qualifiedFrom(flightValue(r)),chips:r.chips}));}
export function staffRows(records){return records.filter(r=>r.qualified).sort((a,b)=>(b.chips??-1)-(a.chips??-1)).map((r,i)=>({rank:i+1,name:text(r.originalName)||'—',nationality:staffNationality(r),flight:qualifiedFrom(flightValue(r)),chips:r.chips}));}
// Search the supplied display projection; JPEG generation uses publicRows separately.
export function filterRows(rows,{name='',nationality='',flight='',chipCount=''}={}){
 const n=text(name).toLocaleLowerCase(),nation=text(nationality).toLocaleLowerCase(),flightQuery=text(flight),f=normalizeFlight(flightQuery),query=text(chipCount),prefix=query.replace(/[, \u00a0]/g,'');
 if(query&&(!/^[\d, \u00a0]+$/.test(query)||!/^\d+$/.test(prefix)))return {rows:[],error:'Use only digits, commas or spaces for chip count.'};
 return {rows:rows.filter(r=>(!n||r.name.toLocaleLowerCase().includes(n))&&(!nation||text(r.nationality).toLocaleLowerCase().includes(nation))&&(!flightQuery||f!==null&&normalizeFlight(r.flight)===f)&&(!prefix||r.chips!==null&&String(r.chips).startsWith(prefix))),error:''};
}
export function duplicateGroups(records){const groups=new Map();for(const r of records.filter(r=>r.qualified)){for(const key of [r.playerId?'id:'+r.playerId:null,text(r.originalName)?'name:'+text(r.originalName).toLocaleLowerCase():null].filter(Boolean))groups.set(key,[...(groups.get(key)||[]),r]);}const seen=new Set();return [...groups.values()].filter(g=>{const k=g.map(r=>r.key).sort().join('|');if(g.length<2||seen.has(k))return false;seen.add(k);return true;});}
export function layout(n){const sections=n<=29?1:n<=79?2:3;return {sections,rows:Math.ceil(n/sections),width:sections*1200+80,height:245+Math.ceil(n/sections)*58};}
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
const leaderboardDateFormat=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
function leaderboardDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
 const date=new Date(value+'T00:00:00Z');
 return Number.isNaN(date.valueOf())?'':leaderboardDateFormat.format(date).toUpperCase();
}
export function drawLeaderboard(canvas,rows,logo,tournament={},responsibleBand,pixelDensity=1){
 if(rows.some(r=>!normalizeFlight(r.flight)))throw Error('Check unrecognised flights before exporting.');
 if(!(logo?.naturalWidth>0)||!(logo?.naturalHeight>0))throw Error('The Genting logo could not be loaded. The JPEG was not generated.');
 const l=layout(rows.length);if(!rows.length)throw Error('There are no qualified players.');if(rows.some(r=>!Number.isSafeInteger(r.chips)||r.chips<=0))throw Error('Correct the ChipCount values before exporting.');
 if(!validTournamentTime(tournament.time))throw Error('Enter a time from 00:00 to 23:59 (HH:mm).');
 const c=canvas.getContext('2d');if(!c)throw Error('The image exceeds the browser’s capacity.');
 const bodyFont=27,lineHeight=34,padding=14,sectionGap=40;
 c.font=bodyFont+'px Arial';let nameWidth=580;const measuredNames=rows.map(r=>String(r.name));while(measuredNames.some(value=>wrapTournamentName(c,value,nameWidth-padding*2).length>2))nameWidth=Math.ceil(nameWidth*1.15);
 const textWidth=value=>c.measureText(String(value)).width;const rankWidth=Math.max(90,...rows.map(r=>textWidth(r.rank)+padding*2)),chipWidth=Math.max(230,...rows.map(r=>textWidth(r.chips.toLocaleString('en-GB'))+padding*2));
 c.font='bold 19px Arial';const widths=[Math.max(rankWidth,textWidth('RANK')+padding*2),nameWidth,Math.max(250,textWidth('QUALIFIED FROM')+padding*2),Math.max(chipWidth,textWidth('CHIP COUNT')+padding*2)],sectionWidth=widths.reduce((a,b)=>a+b,0);
 l.width=Math.ceil(80+l.sections*sectionWidth+(l.sections-1)*sectionGap);c.font=bodyFont+'px Arial';const playerLines=measuredNames.map(value=>wrapTournamentName(c,value,nameWidth-padding*2)),baseRowHeight=playerLines.some(lines=>lines.length>1)?86:58;
 const previousVerticalMargin=l.sections===1?64:l.sections===2?80:96,verticalMargin=l.sections===1?32:l.sections===2?40:44,previousFooterGap=l.sections===1?48:l.sections===2?64:72,footerGap=24,bottomMargin=14,rowHeight=baseRowHeight+Math.min(14,Math.floor((previousFooterGap-footerGap+previousVerticalMargin-bottomMargin+2*(previousVerticalMargin-verticalMargin))/l.rows));
 const innerWidth=l.width-80,headerGap=24;
 const oldSideWidth=innerWidth*(l.sections===3?.35:.29);
 const logoWidth=Math.min(390,oldSideWidth)*1.3;
 const logoHeight=logoWidth*logo.naturalHeight/logo.naturalWidth;
 const leftWidth=Math.max(innerWidth*.25,logoWidth),rightWidth=innerWidth*.25;
 const titleWidth=innerWidth-leftWidth-rightWidth-2*headerGap;
 const titleX=40+leftWidth+headerGap+titleWidth/2;
 const infoX=l.width-40;

 const name=text(tournament.name);
 const nameSize=l.sections===1?48:l.sections===2?62.4:70.2;
 const titleSize=nameSize*.8,countSize=titleSize*.8;
 c.font='bold '+nameSize+'px Arial';
 const nameLines=name?wrapTournamentName(c,name,titleWidth):[];
 c.font=titleSize+'px Arial';
 const titleLines=wrapTournamentName(c,'DAY 2 LEADERBOARD',titleWidth);
 const centreLines=[
  ...nameLines.map(value=>({value,size:nameSize,weight:800,colour:'#F2F2F4',tracking:'-0.015em'})),
  ...titleLines.map(value=>({value,size:titleSize,weight:400,colour:'#C5C8CE',tracking:'0.025em'})),
  {value:rows.length+' QUALIFIED '+(rows.length===1?'PLAYER':'PLAYERS'),size:countSize,weight:400,colour:'#C5C8CE'}
 ];
 const dateLabel=leaderboardDate(text(tournament.date));
 const time=formatTournamentTime(tournament.time);
 const rightLines=[
  ...(dateLabel?[{value:dateLabel,size:37.18*1.2,weight:500,colour:'#C5C8CE'}]:[]),
  ...(time?[{value:time,size:67.6*1.2,weight:700,colour:'#fff'}]:[])
 ];
 const lineGap=7;
 const blockHeight=lines=>lines.reduce((height,line)=>height+line.size,0)+Math.max(0,lines.length-1)*lineGap;
 const headerHeight=Math.max(logoHeight,blockHeight(centreLines),blockHeight(rightLines));
 const headerAxis=verticalMargin+headerHeight/2;
 const lineY=Math.ceil(verticalMargin+headerHeight+verticalMargin),tableY=lineY+48,rowsTop=tableY+24;
 const rowsBottom=rowsTop+l.rows*rowHeight-3;
 let imageHeight=Math.ceil(rowsTop+l.rows*rowHeight+footerGap+bottomMargin);
 let footer;
 if(responsibleBand){
  const {naturalWidth,naturalHeight}=responsibleBand;
  if(!(naturalWidth>0)||!(naturalHeight>0))throw Error('The responsible gambling image could not be loaded.');
  const aspect=naturalWidth/naturalHeight;
  const minimumWidth=64*aspect;
  const previousWidth=Math.min(innerWidth,Math.max(.8*Math.min(innerWidth,Math.max(.75*innerWidth,minimumWidth)),minimumWidth));
  const width=Math.min(innerWidth,Math.max(48*aspect,previousWidth*.4)*1.2);
  const height=width/aspect;
  const y=Math.ceil(rowsBottom+14);
  imageHeight=Math.ceil(y+height+8);
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
 c.fillStyle='#202124';
 c.fillRect(0,0,canvas.width,canvas.height);
 c.drawImage(logo,40,headerAxis-logoHeight/2,logoWidth,logoHeight);
 c.save();
 c.textBaseline='middle';
 const drawBlock=(lines,x,alignment,width)=>{
  let y=headerAxis-blockHeight(lines)/2;
  c.textAlign=alignment;
  for(const {value,size,weight,colour,tracking} of lines){
   c.font=weight+' '+size+'px Montserrat';
   c.letterSpacing=tracking ? parseFloat(tracking)*size+'px' : '0px';
   c.fillStyle=colour;
   c.fillText(value,x,y+size/2,width);
   y+=size+lineGap;
  }
 };
 drawBlock(centreLines,titleX,'center',titleWidth);
 drawBlock(rightLines,infoX,'right',rightWidth);
 c.restore();
 c.textAlign='left';
 c.fillStyle='#cc1428';
 c.fillRect(40,lineY,innerWidth,2);
 let offset=0;
 for(let section=0;section<l.sections;section++){const x=40+section*(sectionWidth+sectionGap),count=Math.floor(rows.length/l.sections)+(section<rows.length%l.sections?1:0);let dx=x;c.font='bold 19px Arial';c.fillStyle='#eee';c.textBaseline='alphabetic';JPEG_COLUMNS.forEach((label,i)=>{c.textAlign=i===0||i===3?'right':'left';c.fillText(label,dx+(i===0||i===3?widths[i]-padding:padding),tableY);dx+=widths[i];});
 for(let j=0;j<count;j++){const index=offset+j,r=rows[index],top=rowsTop+j*rowHeight,centre=top+rowHeight/2;c.fillStyle=j%2?'#292A2D':'#202124';c.fillRect(x,top,sectionWidth,rowHeight-3);let dx=x;c.font=bodyFont+'px Arial';c.textBaseline='middle';[String(r.rank),playerLines[index],qualifiedFrom(r.flight),r.chips.toLocaleString('en-GB')].forEach((value,i)=>{c.fillStyle='#fff';c.textAlign=i===0||i===3?'right':'left';const tx=dx+(i===0||i===3?widths[i]-padding:padding),lines=Array.isArray(value)?value:[value];lines.forEach((line,k)=>c.fillText(line,tx,centre+(k-(lines.length-1)/2)*lineHeight));dx+=widths[i];});}
 offset+=count;}
 if(footer){
  c.drawImage(responsibleBand,footer.x,footer.y,footer.width,footer.height);
 }
 return canvas;
}
