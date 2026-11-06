import test from 'node:test';
import assert from 'node:assert/strict';
import {clockPoint,clockValueAt,clockDraft,clockDraftValue} from '../dist/clock-picker.js';
test('all 24 hours and every precise minute round trip at desktop and mobile sizes',()=>{
 for(const size of [240,290,320])for(const [mode,count] of [['hours',24],['minutes',60]])for(let value=0;value<count;value++){
  const point=clockPoint(value,mode,size);assert.equal(clockValueAt(point.x,point.y,size,mode),value,`${mode} ${value} at ${size}`);
 }
});
test('inner and outer rings distinguish midnight, noon and evening; centre does not select',()=>{
 assert.equal(clockValueAt(160,160-320*.265,320,'hours'),0);
 assert.equal(clockValueAt(160,160-320*.415,320,'hours'),12);
 assert.equal(clockValueAt(160,160,320,'hours'),null);
 assert.equal(clockValueAt(NaN,0,320,'minutes'),null);
});
test('existing colon and dot times preserve values; drafts do not change originals',()=>{
 for(const value of ['00:00','09:00','18:17','20:43','23:59','18.30'])assert.equal(clockDraftValue(clockDraft(value)),value.replace('.',':'));
 for(const value of ['',null,'24:00','23:60','9:00'])assert.equal(clockDraftValue(clockDraft(value)),'');
 const original='18:17',draft=clockDraft(original);draft.hour=20;draft.minute=43;assert.equal(original,'18:17');assert.equal(clockDraftValue(draft),'20:43');
});
