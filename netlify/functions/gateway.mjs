import {getStore} from '@netlify/blobs';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {createGateway} from '../../auth/gateway.mjs';
import {identityAdapter} from '../../auth/identity.mjs';
const manifest=JSON.parse(await readFile(resolve('docs/version49-manifest.json'),'utf8'));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
export default async function gateway(req){
 let db;const store=()=>db??=getStore({name:'genting-admin-sessions',consistency:'strong'});
 return createGateway({env:process.env,paths:new Set(manifest.files.map(f=>f.path)),identity:identityAdapter(process.env.APP_ORIGIN,fetch,{cookie:req.headers.get('cookie')||''}),store:{get:k=>store().get(k,{type:'json',consistency:'strong'}),set:(k,v)=>store().setJSON(k,v),delete:k=>store().delete(k)},asset:async file=>({body:await readFile(resolve(file)),type:types[extname(file)]||'application/octet-stream'})})(req);
}
// Exact private paths only: Netlify's reserved Identity endpoints are not shadowed.
export const config={path:['/','/index.html','/auth/session','/auth/logout','/auth/client.js','/auth/login.css','/app.js','/clock-picker.css','/clock-picker.js','/excel-import.js','/excel-worker.js','/jpeg-actions.js','/jpeg-save-as.js','/logo-ui.svg','/logo.jpg','/model.js','/responsible-gambling.png','/session-backup.js','/style.css','/theme.css','/view-mode.js','/vendor/LICENSE.sheetjs','/vendor/xlsx.full.min.cjs'],preferStatic:false,rateLimit:{windowLimit:120,windowSize:60,aggregateBy:['ip','domain']}};
