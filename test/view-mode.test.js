import test from 'node:test';
import assert from 'node:assert/strict';
import {displayRows,loadedFlights,readyMessage} from '../dist/view-mode.js';
import {filterRows,publicRows} from '../dist/model.js';
const records=[{qualified:true,originalName:'Private Person',originalGdpr:'NO',originalNationality:'France',originalFlight:'1 D',chips:900},{qualified:true,originalName:'Visible Player',originalGdpr:'YES',originalFlight:'A',chips:1000},{qualified:true,originalName:'Conflict Name',originalGdpr:'Y',consentConflict:true,originalFlight:'Day 1A',chips:100}];
test('presentation hides countries and unapproved names; staff restoration and JPEG remain unchanged',()=>{
 const before=structuredClone(records),jpeg=publicRows(records),rows=displayRows(records,true);
 assert.deepEqual(rows.map(r=>r.name),['Visible Player','P. P.','C. N.']);assert(rows.every(r=>r.nationality===''));
 assert.equal(filterRows(rows,{name:'Private'}).rows.length,0);assert.equal(filterRows(rows,{nationality:'France'}).rows.length,0);
 assert.equal(filterRows(rows,{name:'P. P.',flight:'D',chipCount:'9'}).rows[0].rank,2);
 assert.equal(displayRows(records,false)[1].name,'Private Person');assert.deepEqual(records,before);assert.deepEqual(publicRows(records),jpeg);
});
test('flight summary is sorted, deduplicated and recomputes after removing a source',()=>{
 assert.deepEqual(loadedFlights(records),['Day 1A','Day 1D']);assert.deepEqual(loadedFlights(records.filter(r=>r.originalFlight!=='1 D')),['Day 1A']);assert.deepEqual(loadedFlights([]),[]);
});
test('ready message uses complete total with singular and plural',()=>{
 assert.equal(readyMessage(118),'JPEG ready — includes all 118 qualified players');assert.equal(readyMessage(1),'JPEG ready — includes all 1 qualified player');
});

test('series presets: only repeatable details, update by name, sorted, bad storage ignored',async()=>{
 const {makePreset,parsePresets,upsertPreset,removePreset,PRESET_FIELDS}=await import('../dist/view-mode.js');
 assert.deepEqual(PRESET_FIELDS,['name','time','flights','bb','format']);
 const bps=makePreset(' BPS ',{name:'BPS Main Event',time:'18:15',flights:'8',bb:'4000',format:'square',date:'2026-11-24',prizePool:'14250'});
 assert.deepEqual(bps,{label:'BPS',values:{name:'BPS Main Event',time:'18:15',flights:'8',bb:'4000',format:'square'}},'date and prize money are not stored');
 assert.throws(()=>makePreset('  ',{}),/Enter a name/);
 let list=upsertPreset([],bps);list=upsertPreset(list,makePreset('Monday Redtooth',{name:'Monday Redtooth'}));list=upsertPreset(list,makePreset('bps',{name:'BPS High Roller'}));
 assert.deepEqual(list.map(p=>[p.label,p.values.name]),[['bps','BPS High Roller'],['Monday Redtooth','Monday Redtooth']]);
 assert.deepEqual(removePreset(list,'bps').map(p=>p.label),['Monday Redtooth']);
 assert.deepEqual(parsePresets('not json'),[]);assert.deepEqual(parsePresets('{"a":1}'),[]);
 assert.deepEqual(parsePresets(JSON.stringify([{label:'X',values:{name:'Y',evil:'<b>'}},{label:'',values:{}},null])),[{label:'X',values:{name:'Y',time:'',flights:'',bb:'',format:''}}]);
});
