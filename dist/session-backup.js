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
 // V51 optional details (older backups simply do not have them).
 for(const field of BACKUP_EXTRA_FIELDS)if(field in details&&(typeof details[field]!=='string'||details[field].length>40))fail('tournament '+field+' is invalid.');
 const ids=new Set(),keys=new Set();let total=0;
 for(const file of data.files){
  if(!plain(file)||typeof file.id!=='string'||!file.id||ids.has(file.id)||typeof file.filename!=='string'||!file.filename||!Array.isArray(file.records))fail('a file entry is invalid or duplicated.');ids.add(file.id);
  total+=file.records.length;if(total>100000)fail('too many records.');
  for(const r of file.records){
   if(!plain(r)||typeof r.key!=='string'||!r.key||keys.has(r.key)||typeof r.originalName!=='string'||typeof r.qualified!=='boolean'||!(r.chips===null||Number.isSafeInteger(r.chips)&&r.chips>=0)||!scalar(r.originalGdpr)||!scalar(r.originalFlight)||!scalar(r.flight)||!scalar(r.originalNationality))fail('a player record is invalid or duplicated.');keys.add(r.key);
   for(const flag of ['consentConflict','nationalityConflict'])if(r[flag]!==undefined&&typeof r[flag]!=='boolean')fail('a conflict flag is invalid.');
   if(r.duplicateStatus!==undefined&&!['keep','drop','distinct'].includes(r.duplicateStatus)||r.duplicateGroup!==undefined&&(typeof r.duplicateGroup!=='string'||r.duplicateGroup.length>200000))fail('a duplicate decision is invalid.');
   sources(r.consentSources,'Consent');sources(r.nationalitySources,'Nationality');
   // Recheck conflicts from retained raw sources, rather than trusting edited flags.
   if(r.consentSources?.length)Object.assign(r,consentData(r.consentSources));
   if(r.nationalitySources?.length)Object.assign(r,nationalityData(r.nationalitySources));
  }
 }
 const extras=Object.fromEntries(BACKUP_EXTRA_FIELDS.filter(field=>typeof details[field]==='string').map(field=>[field,details[field]]));
 return {files:data.files,tournament:{name:details.name,date:details.date,time:formatTournamentTime(details.time),...extras},createdAt:typeof data.createdAt==='string'?data.createdAt:''};
}
export const BACKUP_EXTRA_FIELDS=['paid','flights','bb','prizePool','firstPrize','minCash'];
export function serializeSessionBackup(files,tournament){
 const value=JSON.stringify({application:'genting-poker-manager',version:1,createdAt:new Date().toISOString(),tournament,files});
 parseSessionBackup(value);return value;
}
export function backupSummary(backup){const rows=backup.files.flatMap(f=>f.records);return {files:backup.files.length,records:rows.length,qualified:rows.filter(r=>r.qualified).length};}
// V51 tournament history: each saved tournament is a validated session backup kept in this browser.
// The index holds only what the list needs. Saving the same name and date again replaces that entry.
export const HISTORY_INDEX_KEY='history:index',HISTORY_LIMIT=50;
export const historyKey=id=>'history:'+id;
export function historyMeta(backup,{id,savedAt=new Date().toISOString()}={}){const t=backup.tournament||{},summary=backupSummary(backup);return {id,name:String(t.name||'').trim(),date:String(t.date||''),time:String(t.time||''),qualified:summary.qualified,files:summary.files,savedAt};}
export function sameTournament(a,b){return a.name.toLocaleLowerCase()===b.name.toLocaleLowerCase()&&a.date===b.date&&a.name!=='';}
export function upsertHistory(index,meta){const list=(Array.isArray(index)?index:[]).filter(entry=>entry&&typeof entry.id==='string');const existing=list.find(entry=>sameTournament(entry,meta));const entry={...meta,id:existing?existing.id:meta.id};const rest=list.filter(item=>item.id!==entry.id);const next=[entry,...rest].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.savedAt||'').localeCompare(a.savedAt||''));return {index:next.slice(0,HISTORY_LIMIT),replaced:!!existing,dropped:next.slice(HISTORY_LIMIT).map(item=>item.id),id:entry.id};}
export function removeHistory(index,id){return (Array.isArray(index)?index:[]).filter(entry=>entry.id!==id);}
