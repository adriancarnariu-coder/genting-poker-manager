import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import XLSX from '../dist/vendor/xlsx.full.min.cjs';
import {parseWorkbook,publicRows,staffRows} from '../dist/model.js';
import {parseSessionBackup,serializeSessionBackup,backupSummary} from '../dist/session-backup.js';
function files(){const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['Name','FLT','Chips','GDPR','JPOT','CTY'],['Élodie García','1 A',1380000,'NO','NO','France'],['Same Initials','1 B',150000,'YES','Y','Romania'],['Sample Identity','1 B',140000,'N','N','British']]),'Players');return [{id:'file-a',filename:'original-report.xlsx',records:parseWorkbook(XLSX,XLSX.write(w,{bookType:'xlsx',type:'buffer'}),'original-report.xlsx')}];}
const details={name:'Deep Stack',date:'2026-12-03',time:'18:30'};
test('backup round trip retains staff originals and identical consent-safe public output',()=>{
 const source=files(),snapshot=JSON.stringify(source),encoded=serializeSessionBackup(source,details),restored=parseSessionBackup(encoded);
 assert.deepEqual(restored.files,source);assert.deepEqual(restored.tournament,details);assert.deepEqual(staffRows(restored.files[0].records),staffRows(source[0].records));assert.deepEqual(publicRows(restored.files[0].records),publicRows(source[0].records));assert.equal(JSON.stringify(source),snapshot);assert.deepEqual(backupSummary(restored),{files:1,records:3,qualified:3});assert(encoded.includes('Élodie García'));assert(encoded.includes('originalGdpr'));assert(!encoded.includes('blob:'));
});
test('corrupt, unsupported, duplicate and malformed backups fail before restoration',()=>{
 assert.throws(()=>parseSessionBackup('{bad'),/valid JSON/);
 const base=JSON.parse(serializeSessionBackup(files(),details));
 for(const change of [b=>b.version=99,b=>b.files.push(b.files[0]),b=>b.files[0].records.push(b.files[0].records[0]),b=>b.files[0].records[0].qualified='yes',b=>b.files[0].records[0].chips='1380000',b=>b.files[0].records[0].originalName={},b=>b.tournament.time='24.00',b=>b.tournament.date='2026-02-30',b=>b.files[0].records[0].consentSources=[{column:'GDPR',value:{bad:true}}]]){const altered=structuredClone(base);change(altered);assert.throws(()=>parseSessionBackup(JSON.stringify(altered)),/Invalid session backup/);}
});
test('restored raw consent conflicts are recomputed and source names are never used as export names',()=>{
 const b=JSON.parse(serializeSessionBackup(files(),details)),r=b.files[0].records[1];r.consentSources=[{column:'GDPR',value:'YES'},{column:'JPOT',value:'N'}];r.consentConflict=false;
 const restored=parseSessionBackup(JSON.stringify(b));assert(restored.files[0].records[1].consentConflict);assert.equal(publicRows(restored.files[0].records)[1].name,'S. I.');
});
test('older colon time is normalised and an empty session is a valid portable backup',()=>{
 const restored=parseSessionBackup(serializeSessionBackup([],{...details,time:'18.30'}));assert.equal(restored.tournament.time,'18:30');assert.equal(restored.files.length,0);
});
test('real imported flights survive transfer without losing players, chips or GDPR',{skip:!process.env.GENTING_REAL_FIXTURES},()=>{
 const base=process.env.GENTING_REAL_FIXTURES,source=['Day 1 a.xlsx','day 1 a re.xlsx','day 1 d.xls','day 1 e.xls'].map((name,i)=>({id:'real-'+i,filename:name,records:parseWorkbook(XLSX,readFileSync(base+'/'+name),name)}));
 const restored=parseSessionBackup(serializeSessionBackup(source,details));assert.equal(backupSummary(restored).qualified,37);assert.deepEqual(publicRows(restored.files.flatMap(f=>f.records)),publicRows(source.flatMap(f=>f.records)));
});
