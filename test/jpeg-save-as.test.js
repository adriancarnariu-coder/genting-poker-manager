import test from 'node:test';
import assert from 'node:assert/strict';
import {saveJpegAs,supportsSaveAs} from '../dist/jpeg-save-as.js';
const artifact={blob:new Blob(['same JPEG bytes'],{type:'image/jpeg'})};
test('picker starts synchronously with JPEG name/type; saved only after the exact blob is written and closed',async()=>{
 const calls=[];let finish;const closed=new Promise(resolve=>finish=resolve);let options;
 const host={showSaveFilePicker(value){calls.push('picker');options=value;return Promise.resolve({createWritable:async()=>({write:async blob=>{assert.equal(blob,artifact.blob);calls.push('write');},close:()=>{calls.push('close');return closed;},abort:async()=>calls.push('abort')})});}};
 const pending=saveJpegAs(artifact,{host});assert.deepEqual(calls,['picker']);assert.equal(options.suggestedName,'genting-leaderboard.jpg');assert.deepEqual(options.types[0].accept,{'image/jpeg':['.jpg','.jpeg']});
 let complete=false;pending.then(()=>complete=true);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,['picker','write','close']);assert.equal(complete,false);finish();assert.equal((await pending).state,'saved');
});
test('unsupported, picker cancellation, blocked permission and write failure are distinguished',async()=>{
 assert.equal(supportsSaveAs({}),false);assert.equal((await saveJpegAs(artifact,{host:{}})).state,'unavailable');
 const error=name=>Object.assign(Error(name),{name});assert.equal((await saveJpegAs(artifact,{host:{showSaveFilePicker(){throw error('AbortError');}}})).state,'cancelled');
 assert.equal((await saveJpegAs(artifact,{host:{showSaveFilePicker(){throw error('SecurityError');}}})).state,'error');
 let aborted=false;const result=await saveJpegAs(artifact,{host:{showSaveFilePicker:async()=>({createWritable:async()=>({write:async()=>{throw error('QuotaExceededError');},abort:async()=>aborted=true})})}});assert.equal(result.state,'error');assert(result.message.includes('QuotaExceededError'));assert(aborted);
});
test('invalidating during picker or writing prevents a stale JPEG from being committed',async()=>{
 let current=true,wrote=false,closed=false,aborted=false;
 const host={showSaveFilePicker:async()=>({createWritable:async()=>({write:async()=>{wrote=true;current=false;},close:async()=>closed=true,abort:async()=>aborted=true})})};
 assert.equal((await saveJpegAs(artifact,{host,isCurrent:()=>current})).state,'stale');assert(wrote&&aborted&&!closed);
 wrote=false;current=false;assert.equal((await saveJpegAs(artifact,{host,isCurrent:()=>current})).state,'stale');assert.equal(wrote,false);
});
