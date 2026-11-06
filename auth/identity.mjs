// REST operations verified against @netlify/identity 2.0.0 and its official GoTrue client.
// Deliberately no browser SDK, JWT fallback, refresh token storage or JS-readable auth cookies.
export function identityAdapter(origin,fetcher=fetch){
 async function call(path,options={}){const r=await fetcher(origin+'/.netlify/identity'+path,{...options,redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Identity request failed');return r.status===204?{}:r.json();}
 return {
  inviteOnly:async()=>{const s=await call('/settings');return s.disable_signup===true&&!!s.external?.email&&!Object.entries(s.external||{}).some(([k,v])=>k!=='email'&&v);},
  login:(email,password)=>call('/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'password',username:email,password})}),
  invite:(token,password)=>call('/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'signup',token,password})}),
  user:token=>call('/user',{headers:{Authorization:'Bearer '+token}}),
  logout:token=>call('/logout',{method:'POST',headers:{Authorization:'Bearer '+token}})
 };
}
