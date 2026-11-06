import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createGateway,COOKIE,TTL} from '../auth/gateway.mjs';
import {identityAdapter} from '../auth/identity.mjs';
function fixture(){
 let time=1700000000000,allowed=true,up=true,id='admin-id',confirmed=true,settings=true,providerLogoutFail=false;const records=new Map(),calls=[],assets=[];
 const env={APP_ORIGIN:'https://app.example',ADMIN_USER_ID:'admin-id',AUTH_SESSION_KEY:'a'.repeat(64)};
 const identity={inviteOnly:async()=>settings,login:async(e,p)=>{calls.push([e,p]);return {access_token:'secret-provider-token',expires_in:3600};},invite:async()=>({access_token:'secret-provider-token',expires_in:3600}),user:async token=>{if(!up)throw Error('upstream private detail');if(!allowed)return null;assert.equal(token,'secret-provider-token');return {id,confirmed_at:confirmed?'2026-01-01':null};},logout:async()=>{if(providerLogoutFail)throw Error('offline');}};
 const store={get:async k=>records.get(k),set:async(k,v)=>records.set(k,structuredClone(v)),delete:async k=>records.delete(k)};
 const handler=createGateway({env,identity,store,now:()=>time,paths:new Set(['dist/index.html','dist/app.js','dist/vendor/xlsx.full.min.cjs']),asset:async path=>{assets.push(path);return {body:Buffer.from('<body>Original application</body>'),type:'text/html'};}});
 const request=(path='/',{method='GET',body,session,origin=env.APP_ORIGIN,headers={}}={})=>handler(new Request('https://app.example'+path,{method,headers:{...(method==='POST'?{'Content-Type':'application/json',...(origin?{Origin:origin}:{})}:{}),...(session?{Cookie:session}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})}));
 const login=async()=>{const r=await request('/auth/login',{method:'POST',body:{email:'admin@example.test',password:'fake-test-password'}});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 return {env,records,calls,assets,request,login,advance:n=>time+=n,set:(k,v)=>{if(k==='allowed')allowed=v;if(k==='up')up=v;if(k==='id')id=v;if(k==='confirmed')confirmed=v;if(k==='settings')settings=v;if(k==='logoutFail')providerLogoutFail=v;}};
}
test('unauthenticated app and direct assets never return private content',async()=>{
 const f=fixture();for(const path of ['/','/index.html','/app.js','/vendor/xlsx.full.min.cjs','/.netlify/functions/gateway','/dist/app.js']){const r=await f.request(path);assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/auth/login');assert(!await r.text());}assert.equal(f.assets.length,0);
});
test('one verified immutable user ID only; matching email or role cannot grant access',async()=>{
 for(const [key,value] of [['id','second-admin'],['allowed',false],['confirmed',false]]){const f=fixture();f.set(key,value);const r=await f.request('/auth/login',{method:'POST',body:{email:'admin@example.test',password:'fake'}});assert.equal(r.status,401);assert.equal(f.records.size,0);assert(!r.headers.has('set-cookie'));}
});
test('login rotates opaque session; provider tokens are encrypted server-side and absent from the response',async()=>{
 const f=fixture(),cookie=await f.login();assert.match(cookie,new RegExp('^'+COOKIE+'=[a-f0-9]{64}$'));const r=await f.request('/auth/login',{method:'POST',session:cookie,body:{email:'admin@example.test',password:'fake'}});const value=r.headers.get('set-cookie');for(const flag of ['Secure','HttpOnly','SameSite=Strict','Path=/','Max-Age=1800'])assert(value.includes(flag));assert(!value.includes('Domain='));assert.notEqual(value.split(';')[0],cookie);assert.equal(f.records.size,1);assert(!JSON.stringify([...f.records]).includes('secret-provider-token'));assert(!await r.text().then(t=>t.includes('token')));assert.equal((await f.request('/',{session:cookie})).status,303);
});
test('server-side session expiry cannot be extended by browser requests',async()=>{
 const f=fixture(),session=await f.login();assert.equal((await f.request('/auth/session',{session})).status,200);f.advance(TTL*1000);assert.equal((await f.request('/auth/session',{session})).status,401);assert.equal((await f.request('/app.js',{session})).status,303);
});
test('logout revokes replay even when Identity logout is unavailable',async()=>{
 const f=fixture(),session=await f.login();f.set('logoutFail',true);const r=await f.request('/auth/logout',{method:'POST',session,body:{}});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);assert.match(r.headers.get('clear-site-data'),/storage/);assert.equal(f.records.size,0);assert.equal((await f.request('/auth/session',{session})).status,401);
});
test('cross-origin, missing-origin and cross-site POSTs are rejected before authentication',async()=>{
 const f=fixture();for(const origin of ['https://evil.example','null',null])for(const path of ['/auth/login','/auth/logout','/auth/accept-invite'])assert.equal((await f.request(path,{method:'POST',origin,body:{}})).status,403);assert.equal((await f.request('/auth/login',{method:'POST',body:{},headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);assert.equal(f.calls.length,0);
});
test('missing configuration, non-HTTPS origin and open signup fail closed',async()=>{
 for(const key of ['ADMIN_USER_ID','AUTH_SESSION_KEY','APP_ORIGIN']){const f=fixture();f.env[key]='';assert.equal((await f.request('/')).status,503);}const f=fixture();f.env.APP_ORIGIN='http://app.example';assert.equal((await f.request('/')).status,503);const g=fixture();g.set('settings',false);assert.equal((await g.request('/auth/login',{method:'POST',body:{email:'a',password:'fake'}})).status,503);assert.equal(g.calls.length,0);
});
test('unreachable Identity or changed user denies an existing session without JWT fallback',async()=>{
 const f=fixture(),session=await f.login();f.set('up',false);const r=await f.request('/app.js',{session});assert.equal(r.status,503);assert(!await r.text().then(t=>t.includes('private detail')));f.set('up',true);f.set('id','other-id');assert.equal((await f.request('/app.js',{session})).status,303);
});
test('forged, duplicated and tampered sessions cannot access assets',async()=>{
 const f=fixture();assert.equal((await f.request('/app.js',{session:COOKIE+'='+'f'.repeat(64)})).status,303);const session=await f.login();assert.equal((await f.request('/app.js',{session:session+'; '+session})).status,303);[...f.records.values()][0].token='tampered';assert.equal((await f.request('/app.js',{session})).status,503);assert.equal(f.assets.length,0);
});
test('registration, player uploads and unknown authenticated routes are unavailable',async()=>{
 const f=fixture(),session=await f.login();for(const path of ['/auth/signup','/api/players','/upload','/.netlify/functions/anything'])assert.equal((await f.request(path,{method:'POST',session,body:{name:'not sent'}})).status,404);assert.equal((await f.request('/secrets.env',{session})).status,404);assert.equal((await f.request('/app.js',{method:'PUT',session})).status,405);assert.equal((await f.request('/%2fapp.js',{session})).status,404);
});
test('private responses forbid caching and framing; HTML gets only auth integration',async()=>{
 const f=fixture(),session=await f.login(),r=await f.request('/',{session});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('netlify-cdn-cache-control'),/no-store/);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(await r.text(),'<body>Original application<script src="/auth/client.js" defer></script></body>');
});
test('invitation acceptance still requires the sole confirmed admin ID',async()=>{
 const f=fixture();let r=await f.request('/auth/accept-invite',{method:'POST',body:{token:'a'.repeat(32),password:'fake-password'}});assert.equal(r.status,200);f.set('id','another-user');r=await f.request('/auth/accept-invite',{method:'POST',body:{token:'a'.repeat(32),password:'fake-password'}});assert.equal(r.status,401);
});
test('oversized and non-JSON login requests do not reach the provider',async()=>{
 const f=fixture();assert.equal((await f.request('/auth/login',{method:'POST',body:{password:'a'.repeat(9000)}})).status,503);assert.equal((await f.request('/auth/login',{method:'POST',body:{password:'fake'},headers:{'Content-Type':'text/plain'}})).status,503);assert.equal(f.calls.length,0);
});
test('Identity adapter uses only the fixed HTTPS provider, refuses redirects and validates invite-only settings',async()=>{
 const requests=[];const api=identityAdapter('https://app.example',async(url,options)=>{requests.push({url,options});return Response.json(url.endsWith('/settings')?{disable_signup:true,external:{email:true}}:{id:'admin-id'});});assert(await api.inviteOnly());await api.login('a@example.test','fake');await api.user('private');await api.logout('private');await api.invite('invite-token','fake');assert(requests.every(r=>r.url.startsWith('https://app.example/.netlify/identity/')&&r.options.redirect==='error'));assert(!requests.some(r=>r.url.endsWith('/signup')));assert.equal(requests.find(r=>r.url.endsWith('/token')).options.body.get('grant_type'),'password');for(const bad of [{disable_signup:false,external:{email:true}},{disable_signup:true,external:{email:true,google:true}},{}])assert(!await identityAdapter('https://app.example',async()=>Response.json(bad)).inviteOnly());
});
test('private asset route coverage, empty public directory and deployment blocker remain enforced',async()=>{
 const manifest=JSON.parse(await readFile('docs/version49-manifest.json','utf8')),source=await readFile('netlify/functions/gateway.mjs','utf8');for(const f of manifest.files)assert(source.includes("'"+f.path.slice(4)+"'"));assert.deepEqual(await readdir('private-publish'),['404.html']);const config=await readFile('netlify.toml','utf8');assert(config.includes('publish = "private-publish"'));assert(config.includes('command = "npm run build:netlify"'));assert((await readFile('scripts/netlify-review-guard.mjs','utf8')).includes('process.exit(1)'));assert(!(await readFile('auth/client.js','utf8')).includes('JSON.stringify(state)'));
});
