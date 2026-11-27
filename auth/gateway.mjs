import {randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {IdentityServiceError} from './identity.mjs';
export const COOKIE='__Host-genting-session',TTL=1800;
const hash=s=>createHash('sha256').update(s).digest('hex');
const cookie=(id,age=TTL)=>`${COOKIE}=${id}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
const common={'Cache-Control':'no-store, private','Netlify-CDN-Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
function crypt(value,key,decrypt=false){
 if(decrypt){const b=Buffer.from(value,'base64url');const c=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString();}
 const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),out=Buffer.concat([c.update(value),c.final()]);return Buffer.concat([iv,c.getAuthTag(),out]).toString('base64url');
}
function config(env){const origin=new URL(env.APP_ORIGIN);if(origin.protocol!=='https:'||origin.origin!==env.APP_ORIGIN||!/^\S{1,128}$/.test(env.ADMIN_USER_ID||'')||!/^[a-f0-9]{64}$/i.test(env.AUTH_SESSION_KEY||''))throw Error('Configuration unavailable');return {origin:origin.origin,id:env.ADMIN_USER_ID,key:Buffer.from(env.AUTH_SESSION_KEY,'hex')};}
async function json(req){if(req.headers.get('content-type')?.split(';')[0]!=='application/json')throw Error('Invalid request');const reader=req.body?.getReader();const decoder=new TextDecoder();let b='',size=0;if(!reader)throw Error('Invalid request');for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>8192){await reader.cancel();throw Error('Invalid request');}b+=decoder.decode(r.value,{stream:true});}return JSON.parse(b+decoder.decode());}
export function createGateway({env,store,identity,asset,paths,now=()=>Date.now()}){
 return async function handle(req){
  const response=(body,status=200,headers={})=>new Response(req.method==='HEAD'?null:body,{status,headers:{...common,...headers}});
  let cfg;try{cfg=config(env);}catch{return response('Authentication is not configured.',503);}
  const url=new URL(req.url),path=url.pathname;
  if(url.origin!==cfg.origin)return response('Forbidden',403);
  if(!['GET','HEAD','POST'].includes(req.method))return response('Method not allowed',405);
  if(path.includes('%')||path.includes('\\')||path.includes('//'))return response('Not found',404);
  const sidMatches=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));
  const sid=sidMatches.length===1?sidMatches[0].slice(COOKIE.length+1):'';
  const validSid=/^[a-f0-9]{64}$/.test(sid),sessionKey=validSid?'session/'+hash(sid):null;
  async function session(){
   if(!sessionKey)return null;const s=await store.get(sessionKey);
   if(!s)return null;
   if(s.user!==cfg.id||!Number.isFinite(s.created)||!Number.isFinite(s.expires)||s.expires<=now()||s.created>now()||s.expires<=s.created||s.expires-s.created>TTL*1000){await store.delete(sessionKey);return null;}
   const token=crypt(s.token,cfg.key,true),user=await identity.user(token);
   return user?.id===cfg.id&&user.confirmed_at?{...s,token}:null;
  }
  if(req.method==='POST'&&(req.headers.get('origin')!==cfg.origin||req.headers.get('sec-fetch-site')==='cross-site'))return response('Forbidden',403);
  try{
   if(['/auth/login','/auth/accept-invite'].includes(path)&&req.method==='POST'){
    const input=await json(req);if(typeof input.password!=='string'||input.password.length<1||input.password.length>1024)return response('Unable to sign in.',401);
    if(!await identity.inviteOnly())return response('Invite-only access is not configured.',503);
    let result;
    if(path==='/auth/accept-invite'){
     if(typeof input.token!=='string'||input.token.length<16||input.token.length>2048)return response('Invalid invitation.',400);
     result=await identity.invite(input.token,input.password);
    }else{
     if(typeof input.email!=='string'||input.email.length>254)return response('Unable to sign in.',401);
     result=await identity.login(input.email.trim(),input.password);
    }
    const user=await identity.user(result.access_token);
    if(user?.id!==cfg.id||!user.confirmed_at){await identity.logout(result.access_token).catch(()=>{});return response('Unable to sign in.',401);}
    if(!Number.isFinite(result.expires_in)||result.expires_in<=0||typeof result.access_token!=='string')return response('Unable to sign in.',401);
    const age=Math.min(TTL,Math.floor(result.expires_in)),id=randomBytes(32).toString('hex');
    if(sessionKey)await store.delete(sessionKey);
    const created=now();
    await store.set('session/'+hash(id),{user:cfg.id,created,expires:created+age*1000,token:crypt(result.access_token,cfg.key)});
    return response('{}',200,{'Content-Type':'application/json','Set-Cookie':cookie(id,age)});
   }
   if(path==='/auth/logout'&&req.method==='POST'){
    await json(req);let saved=sessionKey?await store.get(sessionKey):null;
    if(sessionKey)await store.delete(sessionKey); // Revoke before contacting Identity; no session resurrection.
    if(saved)try{await identity.logout(crypt(saved.token,cfg.key,true));}catch{}
    return response('{}',200,{'Content-Type':'application/json','Set-Cookie':cookie('',0),'Clear-Site-Data':'"cache", "storage"'});
   }
   if(req.method==='POST')return response('Not found',404); // No upload, registration or player API.
   const publicAssets={'/auth/login':'auth/login.html','/auth/client.js':'auth/client.js','/auth/login.css':'auth/login.css'};
   if(publicAssets[path])return await serve(publicAssets[path]);
   const s=await session();
   if(!s)return path==='/auth/session'?response('{}',401,{'Content-Type':'application/json','Set-Cookie':cookie('',0)}):response(null,303,{Location:'/auth/login','Set-Cookie':cookie('',0)});
   if(path==='/auth/session')return response(JSON.stringify({expires:s.expires}),200,{'Content-Type':'application/json'});
   const file=path==='/'?'dist/index.html':'dist'+path;
   if(!paths.has(file))return response('Not found',404);
   return await serve(file);
  }catch(error){
   if(error instanceof IdentityServiceError)return response(JSON.stringify({error:error.code}),error.status,{'Content-Type':'application/json'});
   return response('Authentication service unavailable. Please sign in again.',503);
  }
  async function serve(file){const {body,type}=await asset(file);let content=body;
   if(file==='dist/index.html')content=body.toString().replace('</body>','<script src="/auth/client.js" defer></script></body>');
   return response(content,200,{'Content-Type':type});
  }
 };
}
