import test from 'node:test';
import assert from 'node:assert/strict';
import {alphaBounds,visibleCrop,fitInZone,tournamentSlug,logoKeys,exportFilename,checkLogoFile,displayDate} from '../dist/branding.js';
import {createJpegArtifact} from '../dist/jpeg-actions.js';

const rgba=(w,h,box)=>{const d=new Uint8ClampedArray(w*h*4);for(let y=box.y;y<box.y+box.h;y++)for(let x=box.x;x<box.x+box.w;x++)d[(y*w+x)*4+3]=255;return d;};

test('alpha bounds find the visible part of a transparent PNG',()=>{
 assert.deepEqual(alphaBounds(rgba(100,50,{x:20,y:10,w:30,h:5}),100,50),{x:20,y:10,w:30,h:5});
 assert.equal(alphaBounds(new Uint8ClampedArray(40),10,1),null);
});

test('visible crop is expressed in original pixels and falls back to the full image when pixels cannot be read',()=>{
 const image={naturalWidth:2000,naturalHeight:1000};
 const canvas=()=>({width:0,height:0,getContext(){const self=this;return {drawImage(){},getImageData:()=>({data:rgba(self.width,self.height,{x:Math.round(self.width*.25),y:Math.round(self.height*.4),w:Math.round(self.width*.5),h:Math.round(self.height*.2)})})};}});
 const crop=visibleCrop(image,{createCanvas:canvas});
 assert(crop.x>=490&&crop.x<=500&&crop.w>=1000&&crop.w<=1012&&crop.y>=390&&crop.h<=212,JSON.stringify(crop));
 const tainted=visibleCrop(image,{createCanvas:()=>({getContext:()=>({drawImage(){},getImageData(){throw Error('tainted');}})})});
 assert.deepEqual(tainted,{x:0,y:0,w:2000,h:1000});
});

test('wide and tall logos fit the same zone with original proportions, aligned to the outer edge',()=>{
 const zone={x:100,y:20,w:400,h:172};
 const wide=fitInZone({x:0,y:0,w:2000,h:400},zone,'right'),tall=fitInZone({x:0,y:0,w:400,h:1200},zone,'right');
 assert.equal(wide.w,400);assert.equal(wide.x,100);assert(Math.abs(wide.w/wide.h-5)<1e-9);assert.equal(wide.y,20+(172-80)/2);
 assert.equal(tall.h,172);assert.equal(tall.x+tall.w,500);assert(Math.abs(tall.w/tall.h-1/3)<1e-9);
 const left=fitInZone({x:0,y:0,w:400,h:1200},zone,'left');assert.equal(left.x,100);
});

test('logos are stored per tournament name, with an optional override for one date',()=>{
 assert.equal(tournamentSlug('  BPS London  '),'bps-london');assert.equal(tournamentSlug('Ștefan Cup — Été'),'stefan-cup-ete');
 assert.deepEqual(logoKeys('BPS London','2026-11-24'),{series:'logo:series:bps-london',edition:'logo:edition:bps-london|2026-11-24'});
 assert.deepEqual(logoKeys('BPS London',''),{series:'logo:series:bps-london',edition:null});
 assert.equal(logoKeys('   ',''),null);
 assert.deepEqual(logoKeys('bps   LONDON','2026-11-24').series,logoKeys('BPS London','x').series);
});

test('export file names include tournament, date, content and size',()=>{
 assert.equal(exportFilename({name:'BPS London',date:'2026-11-24'},2480,3100),'BPS_London_2026-11-24_Day2_Leaderboard_2480x3100.jpg');
 assert.equal(exportFilename({name:'Été / Main Event!',date:''},100,50),'Ete_Main_Event_undated_Day2_Leaderboard_100x50.jpg');
 assert.equal(exportFilename({},1,1),'Genting_undated_Day2_Leaderboard_1x1.jpg');
 assert.equal(exportFilename({name:'Genting Poker Series Main Event London Championship Grand Final Weekend',date:'2026-11-24'},1,1),'Genting_Poker_Series_Main_Event_London_Championship_Grand_2026-11-24_Day2_Leaderboard_1x1.jpg');
 const artifact=createJpegArtifact({type:'image/jpeg',size:10},{URLApi:{createObjectURL:()=>'blob:x'},FileClass:class{constructor(_,name){this.name=name;}},navigatorApi:{},filename:'BPS_London_2026-11-24_Day2_Leaderboard_1x1.jpg'});
 assert.equal(artifact.file.name,'BPS_London_2026-11-24_Day2_Leaderboard_1x1.jpg');assert.equal(artifact.filename,artifact.file.name);
});

test('logo files: PNG, JPEG and WebP accepted; other or oversized files rejected before reading',()=>{
 for(const file of [{name:'a.png',type:'image/png',size:5},{name:'a.JPG',type:'',size:5},{name:'a.webp',type:'image/webp',size:5}])assert.doesNotThrow(()=>checkLogoFile(file));
 assert.throws(()=>checkLogoFile({name:'a.svg',type:'image/svg+xml',size:5}),/PNG, JPEG or WebP/);
 assert.throws(()=>checkLogoFile({name:'a.pdf',type:'application/pdf',size:5}),/PNG, JPEG or WebP/);
 assert.throws(()=>checkLogoFile({name:'a.png',type:'image/png',size:0}),/empty/);
 assert.throws(()=>checkLogoFile({name:'a.png',type:'image/png',size:11*1024*1024}),/10 MB/);
});

test('dates are shown in English as "24 Nov 2026" whatever the browser language',()=>{
 assert.equal(displayDate('2026-11-24'),'24 Nov 2026');assert.equal(displayDate('2026-09-03'),'03 Sep 2026');
 assert.equal(displayDate('2026-02-30'),'');assert.equal(displayDate(''),'');
});
