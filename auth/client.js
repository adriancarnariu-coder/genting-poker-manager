// Only auth metadata/credentials are sent. Excel, player records and JPEGs are never sent.
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('genting-admin-auth'):null;
const authErrors=Object.freeze({IDENTITY_ACCESS_PROTECTION:'Netlify project access protection blocked Identity. Sign in to this private project through Netlify, then reload.',IDENTITY_SETTINGS_UNAVAILABLE:'Identity settings could not be verified. Access remains blocked; contact the project owner.',IDENTITY_PROVIDER_UNAVAILABLE:'Identity is unavailable. Please try again later.'});
async function clearPrivate(){
 try{localStorage.removeItem('genting-tournament-details-v1');localStorage.removeItem('genting-poker-manager-v1');}catch{}
 try{await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('genting-manager-rebuilt');r.onsuccess=resolve;r.onerror=reject;r.onblocked=()=>{document.querySelector('#message')?.replaceChildren(document.createTextNode('Close other Genting tabs to clear local private data before signing in.'));};});}catch{throw Error('Could not clear local data. Clear this site’s browser storage before signing in.');}
}
const login=document.querySelector('#login');
async function locked(reason='expired',announce=true){reason=reason==='signed-out'?'signed-out':'expired';document.body.style.visibility='hidden';if(announce)channel?.postMessage('locked:'+reason);location.replace('/auth/login#reason='+reason);}
if(login){
 const message=document.querySelector('#message');
 const params=new URLSearchParams(location.hash.slice(1)),invite=params.get('invite_token'),reason=params.get('reason');history.replaceState(null,'','/auth/login');
 // Imported files stay in this browser after a session expiry or network problem; only sign-out clears them.
 if(reason==='signed-out'){login.querySelector('button').disabled=true;channel?.postMessage('locked:signed-out');clearPrivate().then(()=>{login.querySelector('button').disabled=false;message.textContent='Signed out. Local player data was cleared from this browser.';}).catch(e=>message.textContent=e.message);}
 else if(reason==='expired')message.textContent='Your session ended. Imported files are still on this device; sign in to continue.';
 if(invite){document.querySelector('h1').textContent='Accept administrator invitation';login.elements.password.autocomplete='new-password';login.querySelector('button').textContent='Set password';}
 login.onsubmit=async e=>{e.preventDefault();login.querySelector('button').disabled=true;message.textContent='Please wait…';try{const r=await fetch(invite?'/auth/accept-invite':'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:login.elements.email.value,password:login.elements.password.value,...(invite?{token:invite}:{})})});if(!r.ok){const problem=await r.json().catch(()=>({}));throw Error(Object.hasOwn(authErrors,problem.error)?authErrors[problem.error]:'Sign-in failed or access is unavailable. Check your details and try again.');}location.replace('/');}catch(e){message.textContent=e.message;login.querySelector('button').disabled=false;}finally{login.elements.password.value='';}};
}else{
 channel&&(channel.onmessage=e=>{if(typeof e.data==='string'&&e.data.startsWith('locked'))locked(e.data.split(':')[1],false);});
 let expiryTimer,warningTimer;
 const notice=document.createElement('p');notice.setAttribute('role','status');notice.hidden=true;notice.style.position='fixed';notice.style.left='16px';notice.style.right='16px';notice.style.bottom='16px';notice.style.zIndex='1000';notice.style.margin='0';notice.style.padding='12px 16px';notice.style.borderRadius='10px';notice.style.background='#292a2d';notice.style.border='1px solid #cc1428';notice.style.color='#f1f3f4';document.body.append(notice);
 const show=text=>{notice.textContent=text;notice.hidden=!text;};
 // A failed check (Wi-Fi drop, provider hiccup) never signs out; only a 401 or the known expiry time does.
 async function check(){let r;try{r=await fetch('/auth/session',{cache:'no-store'});}catch{show('Connection problem. Your files are safe on this device; reconnecting…');return;}if(r.status===401)return locked('expired');if(!r.ok){show('Sign-in service unavailable. Your files are safe on this device; retrying…');return;}try{const s=await r.json();clearTimeout(expiryTimer);clearTimeout(warningTimer);const left=Math.max(0,s.expires-Date.now());expiryTimer=setTimeout(()=>locked('expired'),left);warningTimer=setTimeout(()=>show('Your session ends in 5 minutes. Your files stay on this device; you will only need to sign in again.'),Math.max(0,left-300000));show(left<=300000?'Your session ends in less than 5 minutes. Your files stay on this device; you will only need to sign in again.':'');document.body.style.visibility='';}catch{show('Connection problem. Your files are safe on this device; reconnecting…');}}
 const button=document.createElement('button');button.type='button';button.textContent='Log out';button.onclick=async()=>{button.disabled=true;try{const r=await fetch('/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error();await locked('signed-out');}catch{button.disabled=false;button.textContent='Retry logout';}};
 document.querySelector('footer').append(document.createElement('br'),button);
 check();setInterval(check,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});window.addEventListener('pagehide',()=>document.body.style.visibility='hidden');window.addEventListener('pageshow',e=>{if(e.persisted)check();});
}
