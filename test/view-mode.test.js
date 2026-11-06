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
