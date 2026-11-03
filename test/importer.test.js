import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import XLSX from '../public/vendor/xlsx.full.min.cjs';
import {suggestMapping,suggestHeader,importRows,issuesFor,chipNumber,sortedRows,leaderboard,leaderboardCsv,editRow,readWorkbook,permission} from '../public/importer.js';
const headers=['Player ID','Player Name','Chip Count','Flight','Nationality','Nationality Verified','Publication Permission'];
let n=0;
function rows(data,type='Qualified Players',flight='1A'){
  return importRows({rows:[headers,...data],headerIndex:0,mapping:suggestMapping(headers),type,flight,uploadId:'upload',sheetName:'Report',idFactory:()=>String(++n)});
}
test('real BIFF .xls and OOXML .xlsx parse correctly, preserving formatted IDs and source row numbers',async()=>{
  for(const [file,type,count] of [['entries-1a.xls','Entries',3],['qualified-1a.xlsx','Qualified Players',5]]){
    const bytes=await readFile(new URL('../public/samples/'+file,import.meta.url));
    const sheets=readWorkbook(XLSX,bytes,file);assert.equal(sheets[0].rows.length,count+1);
    const imported=importRows({rows:sheets[0].rows,headerIndex:0,mapping:suggestMapping(sheets[0].rows[0]),type,flight:'1A',uploadId:'x',sheetName:'Report'});
    assert.equal(imported.length,count);assert.equal(imported[0].playerId,'S001');assert.equal(imported[0].sourceRow,2);
  }
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([headers,[123,'Zero padded',2000]]);ws.A2.z='000000';XLSX.utils.book_append_sheet(wb,ws,'P');
  const sheets=readWorkbook(XLSX,XLSX.write(wb,{type:'array',bookType:'xlsx'}),'p.xlsx');assert.equal(sheets[0].rows[1][0],'000123');
});
test('Entries and Re-Entries never become qualified even when they have large chip counts',()=>{
  const data=[...rows([['01','Entry',999999]],'Entries'),...rows([['02','Reentry',888888]],'Re-Entries'),...rows([['03','Qualifier',10]])];
  assert.deepEqual(leaderboard(data,['1A']).map(r=>r.name),['Qualifier']);
});
test('missing IDs and names, bad chips, flight mismatch, duplicates and conflicts are flagged without losing rows',()=>{
  const data=rows([['01','A','100'],['01','B','200'],['','',-10],['02','C',100,'1B']]);
  const issues=issuesFor(data,['1A','1B']);assert.equal(data.length,4);
  for(const row of data)assert.ok(issues.get(row.key).some(i=>i.blocking));
  assert.ok(issues.get(data[0].key).some(i=>/Conflicting names/.test(i.message)));
  assert.ok(issues.get(data[0].key).some(i=>/Conflicting qualified chip/.test(i.message)));
  assert.throws(()=>leaderboard(data,['1A','1B']),/Resolve/);
});
test('matching IDs across entry and qualification are visible but do not block a valid qualifier',()=>{
  const data=[...rows([['01','A',200]]),...rows([['01','A','']],'Entries')];
  assert.ok(issuesFor(data,['1A']).get(data[0].key).some(i=>/Duplicate/.test(i.message)&&!i.blocking));assert.equal(leaderboard(data,['1A']).length,1);
});
test('conflicting verified nationality or explicit permission across sources blocks export',()=>{
  for(const other of [['01','A','','1A','IE','yes','yes'],['01','A','','1A','GB','yes','no']]){
    const data=[...rows([['01','A',200,'1A','GB','yes','yes']]),...rows([other],'Entries')];assert.throws(()=>leaderboard(data,['1A']));
  }
});
test('unknown nationality and permissions are not invented, verified nationality only is exported',()=>{
  const data=rows([['01','A',100,'1A','GB','','maybe'],['02','B',90,'1A','IE','yes','no']]);
  const board=leaderboard(data,['1A']);assert.equal(board[0].nationality,'');assert.equal(board[0].publication,'unknown');assert.equal(board[1].nationality,'IE');assert.equal(board[1].publication,'no');assert.equal(permission(''),'unknown');
});
test('strict chips reject ambiguous, nonpositive, unsafe and fractional values',()=>{
  for(const v of ['',0,-1,'1.5','1e3','0x10','10,00','NaN','9007199254740992','1.000','1 00'])assert.equal(chipNumber(v),null,String(v));
  for(const v of ['1234','1,234','1 234','1\u00a0234'])assert.equal(chipNumber(v),1234);
});
test('sort is descending and stable, ties share rank, input is unchanged',()=>{
  const data=rows([['01','B',100],['02','C',200],['03','A',200]]),before=JSON.stringify(data);
  assert.deepEqual(sortedRows(data).map(r=>r.name),['A','C','B']);assert.deepEqual(leaderboard(data,['1A']).map(r=>r.rank),[1,1,3]);assert.equal(JSON.stringify(data),before);
});
test('corrections and explicit exclusions retain originals, provenance, history and all rows',()=>{
  const data=rows([['01','A',100],['01','A',100]]),original=structuredClone(data[1]);
  assert.throws(()=>editRow(data[1],{name:'B'},''));assert.throws(()=>editRow(data[1],{original:{}},'bad'));
  const corrected=editRow(data[1],{excluded:true,exclusionReason:'Duplicate upload confirmed'},'Checked source');
  assert.deepEqual(corrected.original,original.original);assert.equal(corrected.sourceRow,3);assert.equal(corrected.audit.length,1);assert.equal(data[1].excluded,false);
  assert.equal(leaderboard([data[0],corrected],['1A']).length,1);
});
test('CSV neutralizes formulas and escapes quotes without mutating names',()=>{
  const data=rows([['01','=A"B',100]]),csv=leaderboardCsv(data,['1A']);assert.ok(csv.includes('"\'=A""B"'));assert.equal(data[0].name,'=A"B');
});
test('mapping is explicit, ambiguous headers are not guessed and blank physical rows are retained by source',()=>{
  assert.equal(suggestMapping(['ID','Player ID']).playerId,-1);assert.equal(suggestHeader([['Title'],headers]),1);
  assert.throws(()=>importRows({rows:[headers],headerIndex:0,mapping:{playerId:-1,name:1,chips:2},type:'Qualified Players',flight:'1A'}));
  assert.throws(()=>importRows({rows:[headers],headerIndex:0,mapping:{playerId:0,name:0,chips:2},type:'Qualified Players',flight:'1A'}));
  const source=[headers,['01','A',10],[],['02','',20],['Totals','','30']];
  const data=importRows({rows:source,headerIndex:0,mapping:suggestMapping(headers),type:'Qualified Players',flight:'1A',uploadId:'x',sheetName:'P'});assert.equal(data.length,3);assert.equal(source.length,5);assert.equal(data[1].sourceRow,4);assert.equal(data[2].name,'');
});
test('all worksheets and formulas are available for source review; disguised non-Excel files are rejected',()=>{
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,['01','A',100]]),'Qualified');
  const ws=XLSX.utils.aoa_to_sheet([['Other report'],[2]]);ws.A2.f='1+1';XLSX.utils.book_append_sheet(wb,ws,'Other');
  const bytes=XLSX.write(wb,{bookType:'xlsx',type:'array'}),sheets=readWorkbook(XLSX,bytes,'report.xlsx');assert.equal(sheets.length,2);assert.equal(sheets[1].formulas[0].formula,'1+1');
  assert.throws(()=>readWorkbook(XLSX,new TextEncoder().encode('id,name\n1,Player'),'bad.xlsx'),/not an Excel/);
  assert.throws(()=>readWorkbook(XLSX,bytes,'bad.csv'),/Choose/);
});
