// Only auth metadata/credentials are sent. Excel, player records and JPEGs are never sent.
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('genting-admin-auth'):null;
const authErrors=Object.freeze({IDENTITY_ACCESS_PROTECTION:'Netlify project access protection blocked Identity. Sign in to this private project through Netlify, then reload.',IDENTITY_SETTINGS_UNAVAILABLE:'Identity settings could not be verified. Access remains blocked; contact the project owner.',IDENTITY_PROVIDER_UNAVAILABLE:'Identity is unavailable. Please try again later.'});
async function clearPrivate(){
 try{localStorage.removeItem('genting-tournament-details-v1');localStorage.removeItem('genting-poker-manager-v1');}catch{}
 try{await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('genting-manager-rebuilt');r.onsuccess=resolve;r.onerror=reject;r.onblocked=()=>{document.querySelector('#message')?.replaceChildren(document.createTextNode('Close other Genting tabs to clear local private data before signing in.'));};});}catch{throw Error('Could not clear local data. Clear this site’s browser storage before signing in.');}
}
const login=document.querySelector('#login');
async function locked(announce=true){document.body.style.visibility='hidden';if(announce)channel?.postMessage('locked');location.replace('/auth/login');}
if(login){
 const message=document.querySelector('#message');login.querySelector('button').disabled=true;
 channel?.postMessage('locked');clearPrivate().then(()=>login.querySelector('button').disabled=false).catch(e=>message.textContent=e.message);
 const params=new URLSearchParams(location.hash.slice(1)),invite=params.get('invite_token');history.replaceState(null,'','/auth/login');
 if(invite){document.querySelector('h1').textContent='Accept administrator invitation';login.elements.password.autocomplete='new-password';login.querySelector('button').textContent='Set password';}
 login.onsubmit=async e=>{e.preventDefault();login.querySelector('button').disabled=true;message.textContent='Please wait…';try{const r=await fetch(invite?'/auth/accept-invite':'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:login.elements.email.value,password:login.elements.password.value,...(invite?{token:invite}:{})})});if(!r.ok){const problem=await r.json().catch(()=>({}));throw Error(Object.hasOwn(authErrors,problem.error)?authErrors[problem.error]:'Sign-in failed or access is unavailable. Check your details and try again.');}location.replace('/');}catch(e){message.textContent=e.message;login.querySelector('button').disabled=false;}finally{login.elements.password.value='';}};
}else{
 // Keep the existing Android help links on this protected origin, not the old public Site.
 for(const id of ['export-chrome','viewer-chrome']){const link=document.getElementById(id);if(link)link.href=location.origin+'/';}
 channel&&(channel.onmessage=e=>{if(e.data==='locked')locked(false);});
 let expiryTimer;
 async function check(){try{const r=await fetch('/auth/session',{cache:'no-store'});if(!r.ok)return locked();const s=await r.json();clearTimeout(expiryTimer);expiryTimer=setTimeout(locked,Math.max(0,s.expires-Date.now()));document.body.style.visibility='';}catch{locked();}}
 const button=document.createElement('button');button.type='button';button.textContent='Log out';button.onclick=async()=>{button.disabled=true;try{const r=await fetch('/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error();await locked();}catch{button.disabled=false;button.textContent='Retry logout';}};
 document.querySelector('footer').append(document.createElement('br'),button);
 check();setInterval(check,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});window.addEventListener('pagehide',()=>document.body.style.visibility='hidden');window.addEventListener('pageshow',e=>{if(e.persisted)check();});
}
