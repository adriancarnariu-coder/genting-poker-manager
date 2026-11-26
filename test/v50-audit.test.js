import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
import {publicRows,staffRows,invalidRecords,duplicateGroups,duplicateResolved,unresolvedDuplicates,duplicateDecision,highestStack,sharedPlayerId} from '../dist/model.js';
import {uniqueFilename} from '../dist/view-mode.js';
import {parseSessionBackup,serializeSessionBackup} from '../dist/session-backup.js';

// Synthetic records only: no real player data.
let n=0;
const rec=(name,id,flight,chips,extra={})=>({key:'k'+(++n),originalName:name,playerId:id,originalFlight:flight,flight,chips,qualified:true,originalGdpr:'Y',consentVersion:1,...extra});
const apply=(records,decision)=>records.map(r=>decision.has(r.key)?{...r,...decision.get(r.key)}:r);

test('same Player ID qualifying twice: keep highest stack removes the lower stack from every projection',()=>{
 const a=rec('Alex Stone','P1','1A',300000),b=rec('Alex Stone','P1','1C',450000),c=rec('Sam Vale','P2','1B',200000);
 let all=[a,b,c];const groups=duplicateGroups(all);
 assert.equal(groups.length,1);assert.equal(groups[0].length,2);assert.equal(sharedPlayerId(groups[0]),'P1');assert.equal(highestStack(groups[0]).key,b.key);
 assert.equal(unresolvedDuplicates(all).length,1);
 all=apply(all,duplicateDecision(groups[0],'highest'));
 assert(duplicateResolved(duplicateGroups(all)[0]));assert.equal(unresolvedDuplicates(all).length,0);
 assert.deepEqual(publicRows(all).map(r=>r.chips),[450000,200000]);assert.deepEqual(publicRows(all).map(r=>r.rank),[1,2]);
 assert.equal(staffRows(all).length,2);
});

test('different players with the same name can all be kept; undo re-opens the review',()=>{
 const a=rec('Jo Reed','P10','1A',100000),b=rec('Jo Reed','P11','1B',90000);
 let all=[a,b];const g=duplicateGroups(all)[0];assert.equal(sharedPlayerId(g),'');
 all=apply(all,duplicateDecision(g,'distinct'));assert.equal(unresolvedDuplicates(all).length,0);assert.equal(publicRows(all).length,2);
 all=apply(all,duplicateDecision(duplicateGroups(all)[0],'reset'));assert.equal(unresolvedDuplicates(all).length,1);assert.equal(publicRows(all).length,2);
});

test('a later file that changes group membership re-opens review and removes nobody silently',()=>{
 const a=rec('Kim Lane','P20','1A',500000),b=rec('Kim Lane','P20','1B',400000);
 let all=apply([a,b],duplicateDecision(duplicateGroups([a,b])[0],'highest'));assert.equal(publicRows(all).length,1);
 all=[...all,rec('Kim Lane','P20','1D',600000)];
 assert.equal(unresolvedDuplicates(all).length,1);assert.equal(publicRows(all).length,3);
 all=apply(all,duplicateDecision(duplicateGroups(all)[0],'highest'));assert.deepEqual(publicRows(all).map(r=>r.chips),[600000]);
});

test('overlapping ID and name matches form one group; exact ties keep the first import; dropped invalid rows do not block export',()=>{
 const a=rec('Lee Hart','P30','1A',250000),b=rec('Lee Hart','','1B',250000),c=rec('Lee  Hart','P30','1C',null);
 const groups=duplicateGroups([a,b,c]);assert.equal(groups.length,1);assert.equal(groups[0].length,3);assert.equal(highestStack(groups[0]).key,a.key);
 assert.equal(invalidRecords([a,b,c]).length,1);
 const all=apply([a,b,c],duplicateDecision(groups[0],'highest'));assert.equal(invalidRecords(all).length,0);assert.equal(publicRows(all).length,1);
});

test('a second file with the same name gets a distinct name instead of replacing the first',()=>{
 assert.equal(uniqueFilename('Entries.xlsx',[]),'Entries.xlsx');
 assert.equal(uniqueFilename('Entries.xlsx',['entries.xlsx']),'Entries (2).xlsx');
 assert.equal(uniqueFilename('Entries.xlsx',['Entries.xlsx','Entries (2).xlsx']),'Entries (3).xlsx');
 assert.equal(uniqueFilename('report',['report']),'report (2)');
});

test('session backups keep duplicate decisions and reject malformed ones',()=>{
 const a=rec('Ana Frost','P40','1A',300000),b=rec('Ana Frost','P40','1B',200000);
 const records=apply([a,b],duplicateDecision(duplicateGroups([a,b])[0],'highest'));
 const tournament={name:'Synthetic',date:'2026-11-26',time:'18:15'};
 const restored=parseSessionBackup(serializeSessionBackup([{id:'f1',filename:'x.xlsx',records}],tournament));
 assert.equal(publicRows(restored.files[0].records).length,1);
 for(const bad of [{duplicateStatus:'maybe'},{duplicateGroup:42}]){
  const value=JSON.stringify({application:'genting-poker-manager',version:1,tournament,files:[{id:'f1',filename:'x.xlsx',records:[{...records[0],...bad}]}]});
  assert.throws(()=>parseSessionBackup(value),/duplicate decision/);
 }
});

test('no application file links to the old public copy of the app',async()=>{
 for(const dir of ['dist','auth'])for(const name of await readdir(dir)){
  if(!/\.(js|html|css|mjs)$/.test(name))continue;
  assert(!(await readFile(dir+'/'+name,'utf8')).includes('chatgpt.site'),dir+'/'+name);
 }
});

// Runs the real auth/client.js in a minimal fake browser.
async function runClient({hash='',fetchImpl,login=false}){
 const replaced=[],deleted=[],posted=[];const element=()=>({style:{},hidden:false,textContent:'',disabled:false,elements:{password:{value:''},email:{value:''}},setAttribute(){},append(){},querySelector:()=>element()});
 const form=login?element():null;
 const context={console,setTimeout,clearTimeout,setInterval:()=>0,URLSearchParams,JSON,Object,Error,Math,Date,Promise,
  BroadcastChannel:class{postMessage(m){posted.push(m);}},
  history:{replaceState(){}},
  location:{hash,origin:'https://app.example',replace:u=>replaced.push(u)},
  localStorage:{removeItem(){}},
  indexedDB:{deleteDatabase:name=>{deleted.push(name);const r={};setTimeout(()=>r.onsuccess?.(),0);return r;}},
  document:{body:{style:{},append(){}},hidden:false,addEventListener(){},createElement:()=>element(),createTextNode:t=>t,querySelector:s=>s==='#login'?form:element()},
  window:{addEventListener(){}},
  fetch:fetchImpl};
 vm.runInNewContext(await readFile('auth/client.js','utf8'),context);
 await new Promise(r=>setTimeout(r,20));
 return {replaced,deleted,posted};
}

test('a network failure during the session check never signs out or clears data',async()=>{
 const {replaced,deleted}=await runClient({fetchImpl:async()=>{throw Error('offline');}});
 assert.deepEqual(replaced,[]);assert.deepEqual(deleted,[]);
 const unavailable=await runClient({fetchImpl:async()=>({status:503,ok:false})});
 assert.deepEqual(unavailable.replaced,[]);
});

test('an expired session goes to sign-in and keeps local data; only sign-out clears it',async()=>{
 const {replaced}=await runClient({fetchImpl:async()=>({status:401,ok:false})});
 assert.deepEqual(replaced,['/auth/login#reason=expired']);
 const expiredLogin=await runClient({login:true,hash:'#reason=expired',fetchImpl:async()=>({})});
 assert.deepEqual(expiredLogin.deleted,[]);assert.deepEqual(expiredLogin.posted,[]);
 const plainLogin=await runClient({login:true,fetchImpl:async()=>({})});
 assert.deepEqual(plainLogin.deleted,[]);
 const signedOut=await runClient({login:true,hash:'#reason=signed-out',fetchImpl:async()=>({})});
 assert.deepEqual(signedOut.deleted,['genting-manager-rebuilt']);
});
