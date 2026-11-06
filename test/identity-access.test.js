import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityAdapter,IdentityServiceError} from '../auth/identity.mjs';
import {createGateway} from '../auth/gateway.mjs';
import {readFile} from 'node:fs/promises';
const origin='https://synthetic-branch.example',edge='synthetic-netlify-access=synthetic-access-session';
const html=()=>new Response('<html>Netlify Login Redirect https://app.netlify.com/edge-access?domain=synthetic-branch.example</html>',{status:401,headers:{'Content-Type':'text/html'}});
function setup({cookie='',id='only-admin',confirmed=true,settings={disable_signup:true,autoconfirm:false,external:{email:true}},up=true}={}){
 const calls=[],sessions=new Map();
 const fetcher=async(url,options)=>{
  calls.push({url,options});assert.equal(new URL(url).origin,origin);assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  if(!up||options.headers.get('Cookie')!==edge)return html();
  if(url.endsWith('/settings'))return Response.json(settings);
  if(url.endsWith('/token')||url.endsWith('/verify'))return Response.json({access_token:'synthetic-provider-token',expires_in:3600});
  if(url.endsWith('/logout'))return new Response(null,{status:204});
  if(url.endsWith('/user'))return Response.json({id,confirmed_at:confirmed?'2026-11-06':null});
  throw Error('Unexpected upstream path');
 };
 const identity=identityAdapter(origin,fetcher,{cookie});
 const handler=createGateway({env:{APP_ORIGIN:origin,ADMIN_USER_ID:'only-admin',AUTH_SESSION_KEY:'a'.repeat(64)},identity,store:{get:async k=>sessions.get(k),set:async(k,v)=>sessions.set(k,v),delete:async k=>sessions.delete(k)},paths:new Set(['dist/index.html']),asset:async()=>({body:Buffer.from('<body>App</body>'),type:'text/html'})});
 const request=(path,method='POST',body={email:'synthetic@example.test',password:'synthetic-password',token:'i'.repeat(32)},headers={})=>handler(new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
 return {calls,sessions,identity,request};
}
test('regression: HTML access-protection 401 at settings blocks login and invitation before credentials are sent',async()=>{
 for(const path of ['/auth/login','/auth/accept-invite']){const s=setup(),r=await s.request(path);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'IDENTITY_ACCESS_PROTECTION'});assert.equal(s.calls.length,1);assert(s.calls[0].url.endsWith('/settings'));assert(!s.calls[0].options.body);assert.equal(s.sessions.size,0);assert(!r.headers.has('set-cookie'));}
});
test('authenticated same-origin protection cookie permits both flows while opaque app cookie is never forwarded',async()=>{
 for(const path of ['/auth/login','/auth/accept-invite']){
  const s=setup({cookie:edge+'; __Host-genting-session='+'f'.repeat(64)}),r=await s.request(path);assert.equal(r.status,200);assert.equal(s.sessions.size,1);assert.match(r.headers.get('set-cookie'),/HttpOnly/);
  assert(s.calls.every(c=>c.options.headers.get('Cookie')===edge));assert(s.calls.some(c=>c.url.endsWith(path==='/auth/login'?'/token':'/verify')));
  const ownCookie=r.headers.get('set-cookie').split(';')[0];assert.equal((await s.request('/auth/session','GET',null,{Cookie:ownCookie})).status,200);
  assert(s.calls.filter(c=>c.url.endsWith('/user')).every(c=>c.options.headers.get('Authorization')==='Bearer synthetic-provider-token'));
 }
});
test('an edge-access cookie never grants application access without approved confirmed admin credentials',async()=>{
 for(const options of [{id:'another-user'},{confirmed:false}]){const s=setup({cookie:edge,...options}),r=await s.request('/auth/login');assert.equal(r.status,401);assert.equal(s.sessions.size,0);assert(!r.headers.has('set-cookie'));}
 const s=setup({cookie:edge});assert.equal((await s.request('/','GET')).status,303);
});
test('settings validation stays mandatory: open signup, absent settings and external login providers deny both flows',async()=>{
 for(const settings of [{disable_signup:false,external:{email:true}}, {},{disable_signup:true,external:{email:true,google:true}}])for(const path of ['/auth/login','/auth/accept-invite']){
  const s=setup({cookie:edge,settings}),r=await s.request(path);assert.equal(r.status,503);assert.equal(s.calls.length,1);assert.equal(s.sessions.size,0);
 }
});
test('JSON settings denial remains fail-closed, distinct from invalid login credentials and malformed provider output',async()=>{
 for(const [path,status,expected] of [['/settings',401,503],['/token',400,401],['/verify',401,401]]){
  const api=identityAdapter(origin,async()=>Response.json({error:'private upstream detail'},{status}));
  await assert.rejects(()=>path==='/settings'?api.inviteOnly():path==='/token'?api.login('a','b'):api.invite('i','p'),e=>e instanceof IdentityServiceError&&e.status===expected&&!e.message.includes('private upstream detail'));
 }
 const api=identityAdapter(origin,async()=>Response.json({error:'revoked'},{status:401}));assert.equal(await api.user('synthetic'),null);
 const invalid=identityAdapter(origin,async()=>new Response('not-json',{headers:{'Content-Type':'application/json'}}));await assert.rejects(()=>invalid.inviteOnly(),/IDENTITY_PROVIDER_UNAVAILABLE/);
});
test('expired protection on an existing app session fails closed; logout still revokes the app session',async()=>{
 const s=setup({cookie:edge});const login=await s.request('/auth/login'),cookie=login.headers.get('set-cookie').split(';')[0];
 const locked=createGateway({env:{APP_ORIGIN:origin,ADMIN_USER_ID:'only-admin',AUTH_SESSION_KEY:'a'.repeat(64)},identity:identityAdapter(origin,async()=>html()),store:{get:async k=>s.sessions.get(k),set:async()=>{},delete:async k=>s.sessions.delete(k)},paths:new Set(),asset:async()=>{throw Error('Must not serve');}});
 const request=(path,method='GET')=>locked(new Request(origin+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})}));
 assert.equal((await request('/auth/session')).status,503);assert.equal((await request('/auth/logout','POST')).status,200);assert.equal(s.sessions.size,0);
});
test('no redirects, alternate host retries, admin bypass token or unsafe cookie forwarding',async()=>{
 let calls=0;for(const bad of ['http://synthetic.example','https://user:password@synthetic.example','https://synthetic.example/path']){
  await assert.rejects(()=>identityAdapter(bad,async()=>{calls++;}).login('a','b'),/IDENTITY_PROVIDER_UNAVAILABLE/);
 }
 for(const cookie of ['a\r\nb','a'.repeat(8193)])await assert.rejects(()=>identityAdapter(origin,async()=>{calls++;},{cookie}).inviteOnly(),/IDENTITY_PROVIDER_UNAVAILABLE/);
 assert.equal(calls,0);
 const api=identityAdapter(origin,async(_url,options)=>{calls++;assert.equal(options.redirect,'error');throw Error('private upstream token');},{cookie:edge});await assert.rejects(()=>api.inviteOnly(),/IDENTITY_PROVIDER_UNAVAILABLE/);assert.equal(calls,1);
});
test('Functions wire only incoming same-origin cookies and keep private publication/auth checks',async()=>{
 const source=await readFile('netlify/functions/gateway.mjs','utf8');assert(source.includes("cookie:req.headers.get('cookie')||''"));
 const config=await readFile('netlify.toml','utf8');assert(config.includes('publish = "private-publish"'));assert(config.includes('command = "npm run build:netlify"'));
 const client=await readFile('auth/client.js','utf8');assert(client.includes('Object.hasOwn(authErrors,problem.error)'));assert(!client.includes('problem.message'));
});
