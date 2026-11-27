// Tournament branding helpers: visible-area detection, logo fitting, storage keys and file names.
// Pure functions only at import time, so model.js (also loaded by the Excel worker) can use them.
export const LOGO_TYPES=['image/png','image/jpeg','image/webp'];
export const LOGO_MAX_BYTES=10*1024*1024;

// Bounding box of pixels whose alpha is above the threshold; null when fully transparent.
export function alphaBounds(data,width,height,threshold=10){
 let minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++){const row=y*width*4;for(let x=0;x<width;x++)if(data[row+x*4+3]>threshold){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}
 return maxX<0?null:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
}

// Visible part of an image in its own natural pixel units (transparent PNG/WebP margins removed).
// The scan uses a reduced copy; export still draws from the original image with this source rectangle.
export function visibleCrop(image,{createCanvas=()=>document.createElement('canvas'),maxScan=1024}={}){
 const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height,full={x:0,y:0,w,h};
 if(!(w>0&&h>0))return null;
 const k=Math.min(1,maxScan/Math.max(w,h)),sw=Math.max(1,Math.round(w*k)),sh=Math.max(1,Math.round(h*k));
 let bounds=null;
 try{const canvas=createCanvas();canvas.width=sw;canvas.height=sh;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0,sw,sh);bounds=alphaBounds(c.getImageData(0,0,sw,sh).data,sw,sh);}catch{return full;}
 if(!bounds)return full;
 // One scan pixel of padding keeps anti-aliased edges intact.
 const x=Math.max(0,(bounds.x-1)/k),y=Math.max(0,(bounds.y-1)/k),x2=Math.min(w,(bounds.x+bounds.w+1)/k),y2=Math.min(h,(bounds.y+bounds.h+1)/k);
 return {x,y,w:x2-x,h:y2-y};
}

// Largest size that fits the zone with original proportions; aligned to the zone's outer edge.
export function fitInZone(crop,zone,align='left'){
 const s=Math.min(zone.w/crop.w,zone.h/crop.h),w=crop.w*s,h=crop.h*s;
 return {x:align==='right'?zone.x+zone.w-w:align==='center'?zone.x+(zone.w-w)/2:zone.x,y:zone.y+(zone.h-h)/2,w,h};
}

const plain=value=>String(value??'').normalize('NFKD').replace(/[̀-ͯ]/g,'');
export function tournamentSlug(name){return plain(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
const isoDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'');

// A series logo follows the tournament name (recurring events); an edition logo overrides it for one date.
export function logoKeys(name,date){
 const slug=tournamentSlug(name);if(!slug)return null;
 return {series:'logo:series:'+slug,edition:isoDate(date)?'logo:edition:'+slug+'|'+date:null};
}

export function exportFilename({name,date}={},width,height,page){
 let part=plain(name).replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
 // Long names are shortened at a word boundary.
 if(part.length>60){part=part.slice(0,61);part=part.slice(0,part.lastIndexOf('_')>20?part.lastIndexOf('_'):60);}
 part=part||'Genting';
 const pagePart=page?.total>1?`_${page.number}of${page.total}`:'';
 return `${part}_${isoDate(date)?date:'undated'}_Day2_Leaderboard${pagePart}_${width}x${height}.jpg`;
}

export function checkLogoFile(file){
 if(!file)throw Error('No file was selected.');
 if(!LOGO_TYPES.includes(file.type)&&!/\.(png|jpe?g|webp)$/i.test(file.name||''))throw Error('Choose a PNG, JPEG or WebP image.');
 if(!file.size)throw Error('The image file is empty.');
 if(file.size>LOGO_MAX_BYTES)throw Error('The logo exceeds 10 MB.');
}

const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// "24 Nov 2026" in English, independent of the browser locale.
export function displayDate(value){
 if(!isoDate(value))return '';
 const [y,m,d]=value.split('-').map(Number),check=new Date(Date.UTC(y,m-1,d));
 return check.getUTCMonth()===m-1&&check.getUTCDate()===d?`${String(d).padStart(2,'0')} ${months[m-1]} ${y}`:'';
}
