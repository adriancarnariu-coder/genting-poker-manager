const DB='genting-poker-imports-v1';
export function openStore() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('state');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(Error('Local storage unavailable. Existing data has not been overwritten.'));
  });
}
export function load(db) {
  return new Promise((resolve,reject)=>{
    const request=db.transaction('state').objectStore('state').get('workspace');
    request.onsuccess=()=>resolve(request.result || {revision:0,events:[],active:null});
    request.onerror=()=>reject(request.error);
  });
}
// Compare and write inside one transaction so stale tabs cannot overwrite data.
export function save(db,next,expectedRevision) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');let conflict=false;
    store.get('workspace').onsuccess=e=>{
      if((e.target.result?.revision || 0)!==expectedRevision){conflict=true;tx.abort();return;}
      store.put({...next,revision:expectedRevision+1},'workspace');
    };
    tx.oncomplete=()=>resolve({...next,revision:expectedRevision+1});
    tx.onabort=tx.onerror=()=>reject(Error(conflict?'Another tab changed this workspace. Reload before continuing.':'Save failed. Previous data is intact; check browser storage.'));
  });
}
