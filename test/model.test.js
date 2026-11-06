import {test} from 'node:test';import assert from 'node:assert/strict';import XLSX from '../dist/vendor/xlsx.full.min.cjs';import {readFileSync} from 'node:fs';
import {parseWorkbook,publicRows,staffRows,filterRows,invalidRecords,duplicateGroups,layout,drawLeaderboard,COLUMNS,JPEG_COLUMNS,needsConsentReload,normalizeFlight} from '../dist/model.js';
function parse(rows,name='Day 1 a.xlsx'){const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet(rows),'Sheet 1');return parseWorkbook(XLSX,XLSX.write(w,{type:'buffer',bookType:'xlsx'}),name);}
const headers=['PlayerId','Forename','Surname','ChipCount','FlightName','Status','GDPR','Nationality'];
test('real report structure: separate name fields, FlightName, Entered, entries and reentries',()=>{const r=parse([headers,[1,'John','Smith','1,380,000','A','Entered',' Yes ','British'],[2,'Élodie','García',200000,'B','Entered','NO','France']]);assert.equal(r.length,2);assert.equal(r[0].playerId,'1');assert.equal(r[0].originalGdpr,' Yes ');assert.deepEqual(publicRows(r).map(r=>[r.rank,r.name,r.flight,r.chips]),[[1,'John Smith','Day 1A',1380000],[2,'É. G.','Day 1B',200000]]);assert.deepEqual(publicRows(r).map(r=>r.nationality),['British','—']);});
test('fail closed except Y and YES consent, retain originals, consistent compound initials',()=>{for(const gdpr of ['Y','y',' Y ','YES','yes','Yes',' YES ','N','n','NO','no','UNKNOWN','UNKOWN','','missing','invalid',true,1,'true']){const row=[1,'Constantin-Adrian','Alexandrescu',100,'A','Entered',gdpr];const r=parse([headers,row]);assert.equal(publicRows(r)[0].name,typeof gdpr==='string'&&['y','yes'].includes(gdpr.trim().toLowerCase())?'Constantin-Adrian Alexandrescu':'C. A.');assert.equal(r[0].originalName,'Constantin-Adrian Alexandrescu');}const r=parse([headers.filter(h=>h!=='GDPR'),[1,'John','Smith',100,'A','Entered','British']]);assert.equal(publicRows(r)[0].name,'J. S.');});
test('invalid chips retained and block; zero/eliminated/withdrawn excluded without losing source records',()=>{const r=parse([headers,[1,'A','B','bad','A','Entered','NO'],[2,'C','D',0,'A','Entered','NO'],[3,'E','F',100,'A','Eliminated','NO'],[4,'G','H',100,'A','Withdrawn','NO']]);assert.equal(r.length,4);assert.equal(invalidRecords(r).length,1);assert.equal(publicRows(r).length,1);});
test('numeric sort, ranks, five-column public projection and duplicate initials',()=>{const r=parse([headers,[1,'Jane','Smith',900,'B','Entered','NO'],[2,'John','Smith',10000,'A','Entered','NO'],[3,'Jane','Smith',900,'B','Entered','NO']]);const p=publicRows(r);assert.deepEqual(p.map(r=>r.chips),[10000,900,900]);assert.deepEqual(p.map(r=>r.rank),[1,2,3]);assert.deepEqual(Object.keys(p[0]),['rank','name','nationality','flight','chips']);assert.equal(duplicateGroups(r).length,1);assert(p.every(r=>r.name==='J. S.'));});
test('one JPEG, every player, four columns without any nationality for irregular totals',()=>{for(const n of [9,29,66,79,118,147]){const drawn=[],c={fillRect(){},drawImage(){},fillText(v){drawn.push(String(v));},measureText(v){return {width:String(v).length*10};},save(){},restore(){},beginPath(){},ellipse(){},stroke(){},rect(){},clip(){}};const canvas={getContext:()=>c};drawLeaderboard(canvas,Array.from({length:n},(_,i)=>({rank:i+1,name:'J. S.',nationality:'DoNotExportNationality',flight:'A',chips:n-i})),{naturalWidth:1440,naturalHeight:620});assert.equal(drawn.filter(v=>v==='J. S.').length,n);assert.equal(drawn.filter(v=>v==='RANK').length,layout(n).sections);const filtered=drawn.filter(v=>COLUMNS.includes(v));assert.deepEqual(filtered,Array.from({length:layout(n).sections},()=>JPEG_COLUMNS).flat());assert(!drawn.includes('NATIONALITY'));assert(!drawn.includes('DoNotExportNationality'));}});
test('the two supplied real workbooks combine to 9 players and 6,905,000 chips',{skip:!process.env.GENTING_REAL_FIXTURES},()=>{const base=process.env.GENTING_REAL_FIXTURES;const all=['day 1 a re.xlsx','Day 1 a.xlsx'].flatMap(n=>parseWorkbook(XLSX,readFileSync(base+'/'+n),n));const p=publicRows(all);assert.equal(all.length,9);assert.equal(p.length,9);assert.equal(p.reduce((s,r)=>s+r.chips,0),6905000);assert.equal(p[0].chips,1515000);assert(p.every(r=>r.flight==='Day 1A'));assert.equal(invalidRecords(all).length,0);assert.equal(duplicateGroups(all).length,0);for(let i=1;i<p.length;i++)assert(p[i-1].chips>=p[i].chips);});

test('name and flight filters protect public names and preserve ranks',()=>{
 const source=parse([headers,[1,'Private','Surname',1380000,'A','Entered','NO'],[2,'Visible','Player',200000,'B','Entered','YES']]);
 const rows=publicRows(source);assert.equal(filterRows(rows,{name:'Private'}).rows.length,0);assert.equal(filterRows(rows,{name:'surname'}).rows.length,0);assert.equal(filterRows(rows,{name:'p. s.'}).rows.length,1);
 assert.equal(filterRows(rows,{name:'P. S.',flight:'a'}).rows.length,1);
 assert.equal(filterRows(rows,{name:'VISIBLE',flight:'b'}).rows[0].rank,2);
 assert.equal(filterRows(rows,{name:'VISIBLE',flight:'a'}).rows.length,0);assert.equal(filterRows(rows,{}).rows.length,2);

 assert.equal(rows.length,2);assert.deepEqual(COLUMNS,['RANK','PLAYER NAME','NATIONALITY','QUALIFIED FROM','CHIP COUNT']);
});


test('chip prefix combines with public filters, ignores separators, preserves descending order and ranks',()=>{
 const rows=publicRows([{qualified:true,originalName:'John Smith',originalGdpr:'NO',flight:'A',chips:1515000},{qualified:true,originalName:'Dwayne Ewart',originalGdpr:'YES',flight:'A',chips:1380000},{qualified:true,originalName:'Private Surname',originalGdpr:'NO',flight:'B',chips:1130000},{qualified:true,originalName:'Other Person',originalGdpr:'YES',flight:'A',chips:700000},{qualified:true,originalName:'Short Stack',originalGdpr:'YES',flight:'A',chips:150000}]);
 assert.deepEqual(filterRows(rows,{chipCount:'1'}).rows.map(r=>r.chips),[1515000,1380000,1130000,150000]);assert.deepEqual(filterRows(rows,{chipCount:'1'}).rows.map(r=>r.rank),[1,2,3,5]);
 for(const chipCount of ['138','1380000','1,380,000','1 380 000','1\u00a0380\u00a0000'])assert.deepEqual(filterRows(rows,{chipCount}).rows.map(r=>r.chips),[1380000]);
 assert.equal(filterRows(rows,{name:'dWaYnE',flight:'a',chipCount:'138'}).rows[0].rank,2);assert.equal(filterRows(rows,{name:'Private',chipCount:'1'}).rows.length,0);assert.equal(filterRows(rows,{name:'p. s.',flight:'b',chipCount:'113'}).rows.length,1);
 assert.equal(filterRows(rows,{chipCount:''}).rows.length,5);for(const chipCount of ['a','1.3','-1','1e6',', ,'])assert(filterRows(rows,{chipCount}).error);assert.equal(filterRows(rows,{chipCount:'999'}).rows.length,0);assert.equal(rows.length,5);
});

test('genuine BIFF XLS and OOXML XLSX, all header variants and mixed-format combination',()=>{
 const variants=[[' First Name ',' Last Name ',' Flight ',' Chip Count ',' GDPR Consent '],['Forename','Surname','FlightName','ChipCount','GDPR'],[' Player Name ',' Flight ',' Chips ',' GDPR '],['Full Name','Flight','Stack','GDPR'],['Name','Flight','ChipCount','GDPR']];
 const combined=[];
 for(const bookType of ['xls','biff5','biff2','xlsx'])for(const header of variants){const separated=header.length===5,legacy=['biff2','biff5'].includes(bookType),first=legacy?'Elodie-Anne':'Élodie-Anne',last=legacy?'Garcia-Lopez':'García-López',values=separated?[first,last,'A',1380000,' y ']:[first+' '+last,'A',1380000,' y '];const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([header,values]),'Players');const bytes=XLSX.write(w,{type:'buffer',bookType});const ext=bookType==='xlsx'?'xlsx':'xls';const r=parseWorkbook(XLSX,bytes,'test.'+ext);assert.equal(r[0].originalGdpr,' y ');assert.deepEqual(publicRows(r)[0],{rank:1,name:first+' '+last,nationality:'—',flight:'Day 1A',chips:1380000});combined.push(...r);}
 assert.equal(publicRows(combined).length,20);
});
test('unsupported and corrupt files, missing or ambiguous fields are explicit errors',()=>{
 assert.throws(()=>parseWorkbook(XLSX,Buffer.from('<html>renamed file</html>'),'fake.xls'),/valid/);
 assert.throws(()=>parseWorkbook(XLSX,Buffer.from([80,75,3,4,0,0]),'corrupt.xlsx'),/corrupt/);
 assert.throws(()=>parse([['Name','Chips'],['John Smith',100]]),/Flight/);
 assert.throws(()=>parse([['Name','Flight','Chips','Stack'],['John Smith','A',100,100]]),/ambiguous/);
 assert.equal(parse([['Name','Flight','Chips','GDPR','GDPR Consent'],['John Smith','A',100,'Y','NO']])[0].consentConflict,true);
 assert.throws(()=>parse([['Name','Forename','Surname','Flight','Chips'],['John Smith','Jane','Smith','A',100]]),/differs/);
});
test('NO and missing consent never leak into public filters or JPEG drawing',()=>{
 const r=parse([headers,[1,'Private','Surname',100,'A','Entered','NO'],[2,'Full','Approved',200,'B','Entered','Y']]);const publicList=publicRows(r);assert.equal(filterRows(publicList,{name:'Private'}).rows.length,0);assert.equal(filterRows(publicList,{name:'Full'}).rows.length,1);
 const drawn=[],c={fillRect(){},drawImage(){},fillText(v){drawn.push(String(v));},measureText(v){return {width:String(v).length*8};},save(){},restore(){},beginPath(){},ellipse(){},stroke(){},rect(){},clip(){}};drawLeaderboard({getContext:()=>c},publicList,{naturalWidth:1440,naturalHeight:620});assert(drawn.includes('P. S.'));assert(drawn.includes('Full Approved'));assert(!drawn.some(v=>v.includes('Private')||v.includes('Surname')));assert.equal(r[0].originalName,'Private Surname');assert.equal(r[0].originalGdpr,'NO');
});

test('the original failing XLS reports recognize FLT and use JPOT as fallback GDPR',{skip:!process.env.GENTING_REAL_FIXTURES},()=>{
 const base=process.env.GENTING_REAL_FIXTURES;
 const d=parseWorkbook(XLSX,readFileSync(base+'/day 1 d.xls'),'1 d.xls'),e=parseWorkbook(XLSX,readFileSync(base+'/day 1 e.xls'),'1E.xls');
 assert.equal(d.length,15);assert.equal(e.length,13);assert(d.every(r=>r.flight==='1D'));assert(e.every(r=>r.flight==='1E'));assert.equal(d.reduce((s,r)=>s+r.chips,0),11645000);assert.equal(e.reduce((s,r)=>s+r.chips,0),10740000);assert.equal(publicRows([...d,...e]).length,28);assert.equal(invalidRecords([...d,...e]).length,0);assert(e.every(r=>r.consentColumn==='JPOT'));assert(publicRows(e).some(r=>r.name.length>4));assert(e.some(r=>r.originalGdpr==='N'));assert(e.every(r=>r.consentSources.length===1));assert(publicRows(d).every(r=>r.name.length>4));
});
test('HTML and SpreadsheetML exports named XLS parse as inert data with GDPR',()=>{
 const html='<html><head><meta charset="utf-8"></head><body><table><tr><th>Name</th><th>FLT</th><th>Chip Count</th><th>GDPR</th></tr><tr><td>Élodie García</td><td>1D</td><td>1380000</td><td> y </td></tr><tr><td>Private Person</td><td>1E</td><td>150000</td><td>N</td></tr></table></body></html>';
 const parsed=parseWorkbook(XLSX,Buffer.from(html),'export.xls');assert.equal(parsed.length,2);assert.deepEqual(publicRows(parsed).map(r=>[r.name,r.flight,r.chips]),[['Élodie García','Day 1D',1380000],['P. P.','Day 1E',150000]]);
 const xml='<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Players"><Table><Row><Cell><Data ss:Type="String">Name</Data></Cell><Cell><Data ss:Type="String">FLT</Data></Cell><Cell><Data ss:Type="String">Chips</Data></Cell><Cell><Data ss:Type="String">GDPR</Data></Cell></Row><Row><Cell><Data ss:Type="String">Élodie García</Data></Cell><Cell><Data ss:Type="String">1E</Data></Cell><Cell><Data ss:Type="Number">1130000</Data></Cell><Cell><Data ss:Type="String">NO</Data></Cell></Row></Table></Worksheet></Workbook>';
 for(const data of [Buffer.from(xml),Buffer.concat([Buffer.from([255,254]),Buffer.from(xml,'utf16le')])])assert.deepEqual(publicRows(parseWorkbook(XLSX,data,'xml.xls')).map(r=>[r.name,r.flight,r.chips]),[['É. G.','Day 1E',1130000]]);
 assert.throws(()=>parseWorkbook(XLSX,Buffer.from('<script>alert(1)</script>'+html),'unsafe.xls'),/scripts/);assert.throws(()=>parseWorkbook(XLSX,Buffer.from('<!DOCTYPE Workbook [<!ENTITY x SYSTEM "https://example.com">]>'+xml),'unsafe.xls'),/entities/);
});

test('JPOT fallback preserves raw source and names, GDPR precedence, safe missing values and conflicts',()=>{
 for(const value of ['Y',' y ','YES','yes','N','NO','UNKNOWN','UNKOWN','UNKONW','','invalid']){const r=parse([['Forename','Surname',' fLt ','Chips',' JpOt '],['Constantin-Adrian','Alexandrescu','1E',100,value]])[0];assert.equal(r.consentColumn,' JpOt ');assert.equal(r.originalGdpr,value);assert.deepEqual(r.consentSources,[{column:' JpOt ',columnIndex:4,value}]);assert.equal(r.originalName,'Constantin-Adrian Alexandrescu');assert.equal(publicRows([r])[0].name,['Y','YES'].includes(value.trim().toUpperCase())?'Constantin-Adrian Alexandrescu':'C. A.');assert.equal(r.flight,'1E');}
 for(const [gdpr,jpot,conflict] of [['Y','YES',false],['NO','N',false],['Y','N',true],['N','Y',true],['','Y',true],['UNKNOWN','Y',true]]){const r=parse([['Name','FLT','Chips','JPOT','GDPR'],['John Smith','A',100,jpot,gdpr]])[0];assert.equal(r.consentColumn,'GDPR');assert.equal(r.originalGdpr,gdpr);assert.equal(r.consentSources.length,2);assert.equal(r.consentConflict,conflict);assert.equal(publicRows([r])[0].name,!conflict&&gdpr==='Y'?'John Smith':'J. S.');if(conflict)assert.equal(filterRows(publicRows([r]),{name:'John'}).rows.length,0);}
 const missing=parse([['Name','FLT','Chips'],['John Smith','A',100]])[0];assert.equal(missing.consentColumn,null);assert.equal(publicRows([missing])[0].name,'J. S.');assert.equal(needsConsentReload(missing),false);assert.equal(needsConsentReload({originalGdpr:undefined}),true);assert.equal(needsConsentReload({originalGdpr:'NO'}),false);
 const duplicate=parse([['Name','FLT','Chips','GDPR','GDPR Consent'],['John Smith','A',100,'Y','NO']])[0];assert(duplicate.consentConflict);assert.equal(publicRows([duplicate])[0].name,'J. S.');
});

test('flight normalization A-F handles original and existing records without mutating source or rank',()=>{
 for(const letter of ['A','B','C','D','E','F'])for(const raw of [letter,letter.toLowerCase(),'  '+letter+' ', '1'+letter,'1 '+letter.toLowerCase(),'Day 1 '+letter,'day1'+letter.toLowerCase(),'Flight '+letter,'FLIGHT 1 '+letter])assert.equal(normalizeFlight(raw),letter);
 for(const raw of ['',undefined,'G','1G','10D','Day 2 A','A/B','TEST','A1','1D1'])assert.equal(normalizeFlight(raw),null);
 const records=parse([headers,[1,'John','Smith',100,' 1 d ','Entered','YES'],[2,'Private','Name',200,'Day 1 E','Entered','NO']]);const saved=JSON.stringify(records);const rows=publicRows(records);assert.deepEqual(rows.map(r=>[r.rank,r.name,r.flight,r.chips]),[[1,'P. N.','Day 1E',200],[2,'John Smith','Day 1D',100]]);assert.equal(records[0].originalFlight,' 1 d ');assert.equal(records[0].flight,'1 d');assert.equal(JSON.stringify(records),saved);
 for(const query of ['D','d','1D','1 d','Flight D'])assert.equal(filterRows(rows,{flight:query}).rows[0].rank,2);
 const legacy={qualified:true,originalName:'John Smith',originalGdpr:'YES',flight:'1 F',chips:100};assert.equal(publicRows([legacy])[0].flight,'Day 1F');assert.equal(legacy.flight,'1 F');assert.equal(invalidRecords([{...legacy,flight:'ZZ'}]).length,1);assert.equal(publicRows([{...legacy,flight:'ZZ'}])[0].flight,'—');
 const drawn=[],c={fillRect(){},drawImage(){},fillText(v){drawn.push(String(v));},measureText(v){return {width:String(v).length*8};},save(){},restore(){},beginPath(){},ellipse(){},stroke(){},rect(){},clip(){}};drawLeaderboard({getContext:()=>c},rows,{naturalWidth:1440,naturalHeight:620});assert(drawn.includes('Day 1D'));assert(drawn.includes('Day 1E'));assert(!drawn.includes('1 d'));assert(!drawn.includes('Day 1 E'));
});
test('real D/E reports retain raw flights and export normalized D/E',{skip:!process.env.GENTING_REAL_FIXTURES},()=>{
 const base=process.env.GENTING_REAL_FIXTURES;const d=parseWorkbook(XLSX,readFileSync(base+'/day 1 d.xls'),'1 d.xls'),e=parseWorkbook(XLSX,readFileSync(base+'/day 1 e.xls'),'1E.xls');assert(d.every(r=>r.originalFlight==='1D'));assert(e.every(r=>r.originalFlight==='1E'));assert(publicRows(d).every(r=>r.flight==='Day 1D'));assert(publicRows(e).every(r=>r.flight==='Day 1E'));assert.equal(publicRows([...d,...e]).reduce((sum,r)=>sum+r.chips,0),22385000);
});


test('qualified-from aliases match exactly rather than every Day label',()=>{
 const rows=publicRows(['A','B','C','D','E','F'].map((flight,i)=>({qualified:true,originalName:'John Smith',originalGdpr:'Y',flight,chips:1000-i})));
 assert.deepEqual(rows.map(r=>r.flight),['Day 1A','Day 1B','Day 1C','Day 1D','Day 1E','Day 1F']);
 for(const letter of ['A','B','C','D','E','F'])for(const query of [letter,letter.toLowerCase(),'1'+letter,'Day 1'+letter,'day 1 '+letter.toLowerCase()]){const result=filterRows(rows,{flight:query}).rows;assert.equal(result.length,1);assert.equal(result[0].flight,'Day 1'+letter);}
 assert.equal(filterRows(rows,{flight:'G'}).rows.length,0);assert.equal(filterRows(rows,{}).rows.length,6);
});

test('nationality aliases, raw provenance, consent gating and conflict protection',()=>{
 for(const field of ['Nationality','Country',' Country Code ',' CTY\n'])for(const gdpr of ['Y',' y ','YES',' yes ','N','NO','UNKNOWN','UNKOWN','',undefined,'invalid']){const r=parse([['Name','FLT','Chips',field,'GDPR'],['John Smith','A',100,' Romania ',gdpr]])[0];assert.equal(r.originalNationality,' Romania ');assert.equal(r.nationalitySources[0].column,field);assert.equal(publicRows([r])[0].nationality,['Y','YES'].includes(String(gdpr).trim().toUpperCase())?'Romania':'—');}
 const missing=parse([['Name','FLT','Chips','Nationality'],['John Smith','A',100,'Romania']]);assert.equal(publicRows(missing)[0].nationality,'—');
 const jpot=parse([['Name','FLT','Chips','CTY','JPOT'],['John Smith','A',100,'British','Y']]);assert.equal(publicRows(jpot)[0].nationality,'British');
 const nationConflict=parse([['Name','FLT','Chips','Nationality','Country','GDPR'],['John Smith','A',100,'Romania','France','YES']]);assert(nationConflict[0].nationalityConflict);assert.equal(publicRows(nationConflict)[0].nationality,'—');assert.equal(publicRows(nationConflict)[0].name,'John Smith');
 const agreeing=parse([['Name','FLT','Chips','Nationality','Country','GDPR'],['John Smith','A',100,'Romania',' romania ','YES']]);assert(!agreeing[0].nationalityConflict);assert.equal(publicRows(agreeing)[0].nationality,'Romania');
 const consentConflict=parse([['Name','FLT','Chips','Nationality','GDPR','JPOT'],['John Smith','A',100,'Romania','Y','N']]);assert.equal(publicRows(consentConflict)[0].nationality,'—');
 for(const nationality of ['',undefined,'UNKNOWN','N/A',0,'???'])assert.equal(publicRows([{qualified:true,originalName:'John Smith',originalGdpr:'Y',flight:'A',chips:100,nationality}])[0].nationality,'—');
 const legacy={qualified:true,originalName:'John Smith',originalGdpr:'Y',flight:'1 A',chips:100,nationality:'Romania',nationalityVerified:false};assert.equal(publicRows([legacy])[0].nationality,'Romania');assert.equal(legacy.nationality,'Romania');assert.equal(publicRows([{...legacy,nationality:undefined}])[0].nationality,'—');
});
test('nationality searches only public values and combines with all existing filters',()=>{
 const r=parse([headers,[1,'Visible','Player',1380000,'A','Entered','Y','Romania'],[2,'Hidden','Player',900000,'B','Entered','NO','Secretcountry'],[3,'Missing','Consent',100000,'A','Entered','','Hiddenland']]);const rows=publicRows(r);
 assert.equal(filterRows(rows,{nationality:'rOmAn'}).rows.length,1);assert.equal(filterRows(rows,{nationality:'secretcountry'}).rows.length,0);assert.equal(filterRows(rows,{nationality:'hiddenland'}).rows.length,0);assert.equal(filterRows(rows,{nationality:'—'}).rows.length,2);
 const filtered=filterRows(rows,{name:'visible',nationality:'romania',flight:'Day 1 A',chipCount:'138'}).rows;assert.equal(filtered.length,1);assert.equal(filtered[0].rank,1);assert.equal(filterRows(rows,{}).rows.length,3);
 const drawn=[],c={fillRect(){},drawImage(){},fillText(v){drawn.push(String(v));},measureText(v){return {width:String(v).length*8};},save(){},restore(){},beginPath(){},ellipse(){},stroke(){},rect(){},clip(){}};drawLeaderboard({getContext:()=>c},rows,{naturalWidth:1440,naturalHeight:620});assert(!drawn.includes('NATIONALITY'));assert(!drawn.includes('Romania'));assert(!drawn.includes('Secretcountry'));assert(!drawn.includes('Hiddenland'));assert.equal(drawn.filter(v=>v==='—').length,0);
});
test('real CTY reports show nationality only with permitted GDPR or JPOT',{skip:!process.env.GENTING_REAL_FIXTURES},()=>{
 const base=process.env.GENTING_REAL_FIXTURES;const d=parseWorkbook(XLSX,readFileSync(base+'/day 1 d.xls'),'D.xls'),e=parseWorkbook(XLSX,readFileSync(base+'/day 1 e.xls'),'E.xls');assert(d.every(r=>r.nationalitySources[0].column.trim()==='CTY'));assert(publicRows(d).every(r=>r.nationality!=='—'));assert.equal(publicRows(e).filter(r=>r.nationality==='—').length,1);assert.equal(publicRows([...d,...e]).length,28);
});


test('staff sees full local names and countries for every consent while JPEG stays protected',()=>{
 const cases=[['Yes Approved','Y'],['Lower Approved',' yes '],['Private Surname','NO'],['Unknown Person','UNKNOWN'],['Blank Consent',''],['Missing Consent',undefined],['Invalid Consent','invalid'],['Conflict Consent','Y']];
 const source=cases.map(([originalName,originalGdpr],i)=>({key:String(i),qualified:true,originalName,originalGdpr,consentConflict:i===7,originalNationality:' France ',nationality:'France',flight:'1 A',chips:1000-i}));const snapshot=JSON.stringify(source),staff=staffRows(source),exportRows=publicRows(source);
 assert.deepEqual(staff.map(r=>r.name),cases.map(c=>c[0]));assert(staff.every(r=>r.nationality==='France'));assert.deepEqual(staff.map(r=>[r.rank,r.flight,r.chips]),exportRows.map(r=>[r.rank,r.flight,r.chips]));assert.deepEqual(exportRows.map(r=>r.name),['Yes Approved','Lower Approved','P. S.','U. P.','B. C.','M. C.','I. C.','C. C.']);
 const filtered=filterRows(staff,{name:'private surname',nationality:'france',flight:'A',chipCount:'998'}).rows;assert.equal(filtered.length,1);assert.equal(filtered[0].rank,3);assert.equal(filtered[0].name,'Private Surname');assert.equal(exportRows.length,8);
 assert.equal(staffRows([{...source[0],nationalityConflict:true}])[0].nationality,'—');assert.equal(staffRows([{...source[0],originalNationality:undefined,nationality:undefined}])[0].nationality,'—');assert.equal(staffRows([{...source[0],consentVersion:undefined,originalGdpr:undefined}])[0].name,'Yes Approved');
 const drawn=[],c={fillRect(){},drawImage(){},fillText(v){drawn.push(String(v));},measureText(v){return {width:String(v).length*8};},save(){},restore(){},beginPath(){},ellipse(){},stroke(){},rect(){},clip(){}};drawLeaderboard({getContext:()=>c},exportRows,{naturalWidth:1440,naturalHeight:620});assert(drawn.includes('8 QUALIFIED PLAYERS'));for(const r of exportRows)assert(drawn.includes(r.name));for(const [name] of cases.slice(2))assert(!drawn.includes(name));assert(!drawn.includes('France'));assert(!drawn.includes('NATIONALITY'));assert.equal(JSON.stringify(source),snapshot);
});

