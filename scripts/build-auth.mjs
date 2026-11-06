import {build} from 'esbuild';
import {resolve} from 'node:path';
// Compile both function entry points for review; this does not deploy or bypass the guard.
await build({entryPoints:['netlify/functions/gateway.mjs','netlify/functions/login.mjs'].map(p=>resolve(p)),outdir:'.auth-build',bundle:true,platform:'node',format:'esm',target:'node24',packages:'external',tsconfigRaw:{},logLevel:'info'});
await import('@netlify/blobs');
console.log('Authentication functions compiled; deployment remains blocked.');
