import {mkdir,cp} from 'node:fs/promises';
await mkdir(new URL('./dist/',import.meta.url),{recursive:true});
await cp(new URL('./public/',import.meta.url),new URL('./dist/',import.meta.url),{recursive:true});
console.log('Static build ready in dist/');
