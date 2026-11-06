import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {File} from 'node:buffer';
import {createJpegArtifact,retireJpegArtifact,shareJpegArtifact,jpegFilename,jpegDataUrl} from '../dist/jpeg-actions.js';
const bytes=readFileSync(new URL('../dist/logo.jpg',import.meta.url));
const blob=new Blob([bytes],{type:'image/jpeg'});
function create(navigatorApi={}){let received;const artifact=createJpegArtifact(blob,{FileClass:File,URLApi:{createObjectURL(value){received=value;return 'blob:local-image';}},navigatorApi});return {artifact,received};}
test('preview URL, download JPEG and shared file use the same bytes and generic filename',async()=>{
 let shared;const api={canShare:()=>true,share:async value=>{shared=value;}};const {artifact,received}=create(api);
 assert.equal(received,blob);assert(artifact.canShare);assert.equal(artifact.file.name,jpegFilename);assert.equal(artifact.file.type,'image/jpeg');assert.deepEqual(Buffer.from(await artifact.file.arrayBuffer()),bytes);
 const result=await shareJpegArtifact(artifact,api);assert.equal(shared.files[0],artifact.file);assert.equal(result.state,'shared');assert(!result.message.includes('Downloaded successfully'));
});
test('file sharing stays unavailable when unsupported, denied or canShare throws',()=>{
 for(const api of [{},{share(){}},{share(){},canShare:()=>false},{share(){},canShare(){throw Error('policy');}}])assert.equal(create(api).artifact.canShare,false);
});
test('sharing cancellation differs from a concrete browser error and leaves the image available',async()=>{
 const {artifact}=create({share(){},canShare:()=>true});
 const cancelled=await shareJpegArtifact(artifact,{share:async()=>{throw Object.assign(Error('cancel'),{name:'AbortError'});}});assert.equal(cancelled.state,'cancelled');assert.equal(artifact.url,'blob:local-image');
 const failed=await shareJpegArtifact(artifact,{share:async()=>{throw Object.assign(Error('Blocked by permissions policy'),{name:'NotAllowedError'});}});assert.equal(failed.state,'error');assert.match(failed.message,/NotAllowedError.*Blocked by permissions policy/);
});
test('URLs passed to download or open remain alive during invalidation grace period',()=>{
 const revoked=[],scheduled=[];const options={URLApi:{revokeObjectURL:url=>revoked.push(url)},schedule:(fn,delay)=>scheduled.push({fn,delay})};
 const {artifact}=create();artifact.handedOff=true;retireJpegArtifact(artifact,options);assert.deepEqual(revoked,[]);assert(scheduled[0].delay>=60000);scheduled[0].fn();assert.deepEqual(revoked,[artifact.url]);
 const fresh=create().artifact;retireJpegArtifact(fresh,options);assert.equal(revoked.length,2);
});
test('empty or non-JPEG exports are rejected',()=>{
 for(const value of [null,new Blob([],{type:'image/jpeg'}),new Blob(['text'],{type:'text/plain'})])assert.throws(()=>createJpegArtifact(value),/valid JPEG/);
});
test('manual-save data image preserves the exact JPEG bytes without creating another image',async()=>{
 class Reader{async readAsDataURL(value){this.result='data:'+value.type+';base64,'+Buffer.from(await value.arrayBuffer()).toString('base64');this.onload();}}
 const result=await jpegDataUrl(blob,{Reader});assert(result.startsWith('data:image/jpeg;base64,'));assert.deepEqual(Buffer.from(result.split(',')[1],'base64'),bytes);
});
test('manual image preparation reports errors and timeouts without hanging',async()=>{
 class Failed{readAsDataURL(){this.onerror();}}class Invalid{readAsDataURL(){this.result='data:text/plain;base64,WA==';this.onload();}}class Stalled{readAsDataURL(){}abort(){}}
 await assert.rejects(()=>jpegDataUrl(blob,{Reader:Failed}),/could not be prepared/);await assert.rejects(()=>jpegDataUrl(blob,{Reader:Invalid}),/not a JPEG/);await assert.rejects(()=>jpegDataUrl(blob,{Reader:Stalled,timeout:5}),/too long/);await assert.rejects(()=>jpegDataUrl(null),/valid JPEG/);
});
