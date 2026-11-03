// Parsing runs off the UI thread; original bytes stay available for the archive.
export function parseInWorker(bytes, filename) {
  return new Promise((resolve,reject)=>{
    let worker;
    const finish=(error,value)=>{clearTimeout(timer);worker?.terminate();error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(Error('Reading this workbook took too long. Try saving a fresh .xlsx copy in Excel.')),60000);
    try {
      worker=new Worker(new URL('./excel-worker.js',import.meta.url));
      worker.onmessage=e=>e.data.error?finish(Error(e.data.error)):finish(null,e.data.sheets);
      worker.onerror=()=>finish(Error('The Excel reader could not start. Reload the page and try again.'));
      worker.postMessage({bytes,filename});
    } catch(error){finish(error);}
  });
}
export async function prepareUpload(file,context,{parse=parseInWorker,progress=()=>{},digest=b=>crypto.subtle.digest('SHA-256',b)}={}) {
  if(!context.eventId || !context.flight)throw Error('Add and select a tournament flight before choosing a file.');
  if(!/\.(xls|xlsx)$/i.test(file.name))throw Error('Choose an .xls or .xlsx file.');
  if(!file.size)throw Error('This file is empty. Choose a workbook containing player data.');
  if(file.size>15*1024*1024)throw Error('Workbook exceeds 15 MB. Split it before importing.');
  progress(`Reading ${file.name}…`);
  let bytes;
  try{bytes=await file.arrayBuffer();}catch{throw Error('The selected file could not be read. Download it to this device, then choose it again.');}
  progress(`Opening worksheets in ${file.name}…`);
  const sheets=await parse(bytes,file.name);
  if(!sheets.some(s=>s.rows.some(r=>r.some(v=>String(v??'').trim()))))throw Error('This workbook contains no readable data.');
  const hash=[...new Uint8Array(await digest(bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  return {...context,filename:file.name,bytes,sheets,hash};
}
