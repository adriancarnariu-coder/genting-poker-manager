import {formatTournamentTime,validTournamentTime,consentData,nationalityData} from './model.js';
export const backupFilename='genting-session-backup.json';
export const backupLimit=30*1024*1024;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const scalar=v=>v===null||v===undefined||['string','number','boolean'].includes(typeof v);
const fail=message=>{throw Error('Invalid session backup: '+message);};
function sources(value,label){if(value===undefined)return;if(!Array.isArray(value)||value.length>50||value.some(s=>!plain(s)||typeof s.column!=='string'||!scalar(s.value)))fail(label+' source columns are invalid.');}
export function parseSessionBackup(value){
 if(typeof value!=='string'||new TextEncoder().encode(value).byteLength>backupLimit)fail('the file exceeds 30 MB.');
 let data;try{data=JSON.parse(value);}catch{fail('the file is not valid JSON.');}
 if(!plain(data)||data.application!=='genting-poker-manager'||data.version!==1)fail('this file is not a supported Genting session backup.');
 if(!Array.isArray(data.files)||data.files.length>1000||!plain(data.tournament))fail('files or tournament details are missing.');
 const details=data.tournament;for(const field of ['name','date','time'])if(typeof details[field]!=='string')fail('tournament '+field+' is invalid.');
 if(details.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(details.date)||!Number.isFinite(Date.parse(details.date))||new Date(details.date).toISOString().slice(0,10)!==details.date))fail('the tournament date is invalid.');
 if(!validTournamentTime(details.time))fail('the tournament time is invalid.');
 const ids=new Set(),keys=new Set();let total=0;
 for(const file of data.files){
  if(!plain(file)||typeof file.id!=='string'||!file.id||ids.has(file.id)||typeof file.filename!=='string'||!file.filename||!Array.isArray(file.records))fail('a file entry is invalid or duplicated.');ids.add(file.id);
  total+=file.records.length;if(total>100000)fail('too many records.');
  for(const r of file.records){
   if(!plain(r)||typeof r.key!=='string'||!r.key||keys.has(r.key)||typeof r.originalName!=='string'||typeof r.qualified!=='boolean'||!(r.chips===null||Number.isSafeInteger(r.chips)&&r.chips>=0)||!scalar(r.originalGdpr)||!scalar(r.originalFlight)||!scalar(r.flight)||!scalar(r.originalNationality))fail('a player record is invalid or duplicated.');keys.add(r.key);
   for(const flag of ['consentConflict','nationalityConflict'])if(r[flag]!==undefined&&typeof r[flag]!=='boolean')fail('a conflict flag is invalid.');
   sources(r.consentSources,'Consent');sources(r.nationalitySources,'Nationality');
   // Recheck conflicts from retained raw sources, rather than trusting edited flags.
   if(r.consentSources?.length)Object.assign(r,consentData(r.consentSources));
   if(r.nationalitySources?.length)Object.assign(r,nationalityData(r.nationalitySources));
  }
 }
 return {files:data.files,tournament:{name:details.name,date:details.date,time:formatTournamentTime(details.time)},createdAt:typeof data.createdAt==='string'?data.createdAt:''};
}
export function serializeSessionBackup(files,tournament){
 const value=JSON.stringify({application:'genting-poker-manager',version:1,createdAt:new Date().toISOString(),tournament,files});
 parseSessionBackup(value);return value;
}
export function backupSummary(backup){const rows=backup.files.flatMap(f=>f.records);return {files:backup.files.length,records:rows.length,qualified:rows.filter(r=>r.qualified).length};}
