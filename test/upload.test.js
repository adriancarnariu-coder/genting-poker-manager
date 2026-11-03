import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import XLSX from '../public/vendor/xlsx.full.min.cjs';
import {prepareUpload} from '../public/upload.js';
import {readWorkbook} from '../public/importer.js';
const context={eventId:'tournament-a',flight:'1A',type:'Entries'};
const file=(name,bytes)=>({name,size:bytes.byteLength,arrayBuffer:async()=>bytes});
test('upload reports progress, retains original bytes, category and tournament context for both Excel formats',async()=>{
  for(const name of ['qualified-1a.xlsx','entries-1a.xls']){
    const buffer=await readFile(new URL('../public/samples/'+name,import.meta.url)),bytes=Uint8Array.from(buffer).buffer,status=[];
    const result=await prepareUpload(file(name,bytes),context,{parse:(b,n)=>readWorkbook(XLSX,b,n),progress:s=>status.push(s)});
    assert.equal(status.length,2);assert.match(status[0],/Reading/);assert.match(status[1],/Opening worksheets/);
    assert.equal(result.bytes,bytes);assert.equal(result.eventId,context.eventId);assert.equal(result.type,'Entries');assert.equal(result.hash.length,64);assert.ok(result.sheets[0].rows.length>1);
  }
});
test('unsupported, empty, oversized or unassigned files fail with actionable messages before parsing',async()=>{
  for(const [input,c,pattern] of [[file('x.csv',new ArrayBuffer(1)),context,/xls/],[file('x.xlsx',new ArrayBuffer(0)),context,/empty/],[{name:'x.xlsx',size:16*1024*1024},context,/15 MB/],[file('x.xlsx',new ArrayBuffer(1)),{},/flight/]]){
    await assert.rejects(prepareUpload(input,c,{parse:()=>{throw Error('Should not parse');}}),pattern);
  }
});
test('file read errors, corrupt workbooks and workbooks without data do not return a pending import',async()=>{
  await assert.rejects(prepareUpload({name:'x.xlsx',size:1,arrayBuffer:async()=>{throw Error('NotReadableError');}},context),/could not be read/);
  await assert.rejects(prepareUpload(file('x.xlsx',new ArrayBuffer(1)),context,{parse:()=>{throw Error('Corrupt workbook');}}),/Corrupt workbook/);
  await assert.rejects(prepareUpload(file('x.xlsx',new ArrayBuffer(1)),context,{parse:()=>[{name:'Empty',rows:[[]]}]}),/no readable data/);
});
