import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const manifest=JSON.parse(await readFile('docs/version49-manifest.json','utf8'));
const expected=new Set(manifest.files.map(f=>f.path));
async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(dir+'/'+e.name):dir+'/'+e.name))).flat();}
for(const file of await walk('dist'))if(!expected.has(file))throw Error('Unexpected public file: '+file);
for(const file of manifest.files){
 const data=await readFile(file.path),hash=createHash('sha256').update(data).digest('hex');
 if(hash!==file.sha256)throw Error('Version 49 integrity mismatch: '+file.path);
}
const html=await readFile('dist/index.html','utf8');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
 const path=match[1].split('?')[0];if(/^(?:https?:|data:|blob:)/.test(path))continue;
 if(!resolve('dist',path).startsWith(resolve('dist')+'/')&&!resolve('dist',path).startsWith(resolve('dist')+'\\'))throw Error('Invalid local asset path');
 await stat(resolve('dist',path));
}
console.log(`Verified Version ${manifest.version}: ${manifest.files.length} unchanged assets in dist/. No compilation or network dependency required.`);
