// REST operations verified against @netlify/identity 2.0.0 and its official GoTrue client.
// Deliberately no browser SDK, JWT fallback, refresh token storage or JS-readable auth cookies.
export class IdentityServiceError extends Error {
 constructor(code,status=503){super(code);this.name='IdentityServiceError';this.code=code;this.status=status;}
}
const unavailable=()=>new IdentityServiceError('IDENTITY_PROVIDER_UNAVAILABLE');
function accessCookies(value){
 if(typeof value!=='string'||value.length>8192||/[\r\n\0]/.test(value))throw unavailable();
 // Reuse the caller's existing same-origin Netlify access session, never an admin
 // token/bypass secret. The application's own opaque session is not needed upstream.
 return value.split(';').map(s=>s.trim()).filter(s=>s&&!s.startsWith('__Host-genting-session=')).join('; ');
}
export function identityAdapter(origin,fetcher=fetch,{cookie=''}={}){
 async function call(path,options={}){
  let base;try{base=new URL(origin);if(base.protocol!=='https:'||base.origin!==origin)throw Error();}catch{throw unavailable();}
  const headers=new Headers(options.headers),forward=accessCookies(cookie);if(forward)headers.set('Cookie',forward);
  let r;try{r=await fetcher(origin+'/.netlify/identity'+path,{...options,headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});}catch{throw unavailable();}
  const html=r.headers.get('content-type')?.toLowerCase().includes('text/html');
  // Private-project protection responds before Identity, with HTML rather than JSON.
  if(html)throw new IdentityServiceError('IDENTITY_ACCESS_PROTECTION');
  if(!r.ok){
   if(path==='/user'&&(r.status===401||r.status===403))return null;
   if((path==='/token'||path==='/verify')&&(r.status===400||r.status===401||r.status===403||r.status===422))throw new IdentityServiceError('AUTHENTICATION_REJECTED',401);
   throw new IdentityServiceError(path==='/settings'?'IDENTITY_SETTINGS_UNAVAILABLE':'IDENTITY_PROVIDER_UNAVAILABLE');
  }
  if(r.status===204)return {};
  try{return await r.json();}catch{throw unavailable();}
 }
 return {
  inviteOnly:async()=>{const s=await call('/settings');return s.disable_signup===true&&!!s.external?.email&&!Object.entries(s.external||{}).some(([k,v])=>k!=='email'&&v);},
  login:(email,password)=>call('/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'password',username:email,password})}),
  invite:(token,password)=>call('/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'signup',token,password})}),
  user:token=>call('/user',{headers:{Authorization:'Bearer '+token}}),
  logout:token=>call('/logout',{method:'POST',headers:{Authorization:'Bearer '+token}})
 };
}
