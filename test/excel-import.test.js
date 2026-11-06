import {test} from 'node:test';
import assert from 'node:assert/strict';
import XLSX from '../dist/vendor/xlsx.full.min.cjs';
import {readFileSync} from 'node:fs';
import {parseWorkbook} from '../dist/model.js';
import {readBytes,readExcelFile} from '../dist/excel-import.js';
function workbook(type){const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Name','FLT','Chips','JPOT'],['Private Person','1 A',1380000,'N'],['Approved Person','1 B',150000,'Y']]),'Players');return XLSX.write(book,{bookType:type,type:'buffer'});}
const file=(name,bytes)=>({name,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
test('XLS and XLSX import without workers and without relying on MIME types',async()=>{
 for(const type of ['xls','xlsx']){const steps=[];const records=await readExcelFile(file('flight.'+type,workbook(type==='xls'?'biff8':'xlsx')),{WorkerClass:null,loadLibrary:async()=>XLSX,parse:parseWorkbook,progress:s=>steps.push(s)});assert.equal(records.length,2);assert.equal(records[0].chips,1380000);assert.equal(records[0].originalGdpr,'N');assert(steps.includes('Using compatible Excel reader'));}
});
test('worker constructor, runtime, message and timeout failures retry with the same bytes',async()=>{
 const cases=[class{constructor(){throw Error('blocked');}},class{postMessage(){this.onerror({});}terminate(){}},class{postMessage(){this.onmessageerror({});}terminate(){}},class{postMessage(){this.onmessage({data:{kind:'reader'}});}terminate(){}},class{postMessage(){}terminate(){}}];
 for(const WorkerClass of cases){const records=await readExcelFile(file('a.xlsx',workbook('xlsx')),{WorkerClass,workerTimeout:5,loadLibrary:async()=>XLSX});assert.equal(records.length,2);}
});
test('a parse error does not retry or discard it and a valid worker result needs no fallback',async()=>{
 let loaded=false;const options={loadLibrary:async()=>{loaded=true;return XLSX;},WorkerClass:class{postMessage(){this.onmessage({data:{error:'Missing chip count column',kind:'parse'}});}terminate(){}}};
 await assert.rejects(()=>readExcelFile(file('a.xlsx',workbook('xlsx')),options),/Missing chip count/);assert(!loaded);
 const records=await readExcelFile(file('a.xlsx',workbook('xlsx')),{...options,WorkerClass:class{postMessage(){this.onmessage({data:{records:[{chips:123}]}});}terminate(){}}});assert.equal(records[0].chips,123);assert(!loaded);
});
test('FileReader handles devices without arrayBuffer and a failed provider read',async()=>{
 const bytes=new Uint8Array([1,2,3]).buffer;class Reader{readAsArrayBuffer(){this.result=bytes;this.onload();}}
 assert.equal(await readBytes({},{Reader}),bytes);assert.equal(await readBytes({arrayBuffer:async()=>{throw Error('provider');}},{Reader}),bytes);
 class FailedReader{readAsArrayBuffer(){this.onerror();}}await assert.rejects(()=>readBytes({},{Reader:FailedReader}),/Files or Downloads/);
});
test('JPEG selections, empty and oversize files are actionable errors',async()=>{
 await assert.rejects(()=>readExcelFile({name:'leaderboard.jpg'}),/not a JPEG/);
 await assert.rejects(()=>readExcelFile(file('a.xls',Buffer.alloc(0))),/empty/);
 await assert.rejects(()=>readExcelFile({name:'a.xlsx',size:31*1024*1024}),/30 MB/);
});
test('real previously supplied reports import via the compatible reader',{skip:!process.env.GENTING_REAL_FIXTURES},async()=>{
 const base=process.env.GENTING_REAL_FIXTURES;let total=0;
 for(const name of ['Day 1 a.xlsx','day 1 a re.xlsx','day 1 d.xls','day 1 e.xls']){const bytes=readFileSync(base+'/'+name);const records=await readExcelFile(file(name,bytes),{WorkerClass:null,loadLibrary:async()=>XLSX});assert(records.length>0);total+=records.length;}
 assert.equal(total,37);
});
