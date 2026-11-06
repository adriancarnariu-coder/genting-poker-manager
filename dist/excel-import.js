const maxBytes=30*1024*1024;
export function readBytes(file,{Reader=globalThis.FileReader,timeout=60000}={}){
 return new Promise((resolve,reject)=>{
  let done=false,reader;
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);};
  const timer=setTimeout(()=>{finish(Error('The file could not be opened in time. Download it to this device, then choose it from Files or Downloads.'));try{reader?.abort();}catch{}},timeout);
  const legacy=()=>{try{if(!Reader)throw Error('File reading is unavailable in this browser.');reader=new Reader();reader.onload=()=>finish(null,reader.result);reader.onerror=()=>finish(Error('The file could not be opened. Download it to this device, then choose it from Files or Downloads.'));reader.onabort=()=>finish(Error('File reading was cancelled.'));reader.readAsArrayBuffer(file);}catch(e){finish(e);}};
  if(typeof file.arrayBuffer==='function')Promise.resolve().then(()=>file.arrayBuffer()).then(v=>finish(null,v),legacy);else legacy();
 });
}
let library;
export function loadExcelLibrary(){
 if(globalThis.XLSX)return Promise.resolve(globalThis.XLSX);
 if(!library)library=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./vendor/xlsx.full.min.cjs',import.meta.url).href;const timer=setTimeout(()=>{script.remove();reject(Error('The Excel reader could not load. Check the connection and try again.'));},30000);script.onload=()=>{clearTimeout(timer);globalThis.XLSX?resolve(globalThis.XLSX):reject(Error('The Excel reader is unavailable.'));};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('The Excel reader could not load. Check the connection and try again.'));};document.head.append(script);}).catch(error=>{library=null;throw error;});
 return library;
}
export async function readExcelFile(file,{WorkerClass=globalThis.Worker,read=readBytes,loadLibrary=loadExcelLibrary,parse,progress=()=>{},workerTimeout=60000}={}){
 if(!/\.(xls|xlsx)$/i.test(file.name))throw Error('Choose an Excel .xls or .xlsx file, not a JPEG or another document.');
 if(file.size>maxBytes)throw Error('The file exceeds 30 MB.');
 progress('Opening file');const bytes=await read(file);
 if(!bytes?.byteLength)throw Error('The selected file is empty. Download the Excel file to this device and select it again.');
 if(bytes.byteLength>maxBytes)throw Error('The file exceeds 30 MB.');
 progress('Reading Excel');
 if(WorkerClass){
  const result=await new Promise(resolve=>{
   let worker,done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);worker?.terminate();resolve(value);};
   const timer=setTimeout(()=>finish({fallback:true}),workerTimeout);
   try{worker=new WorkerClass(new URL('./excel-worker.js',import.meta.url));worker.onmessage=e=>e.data.kind==='reader'?finish({fallback:true}):e.data.error?finish({error:e.data.error}):Array.isArray(e.data.records)?finish({records:e.data.records}):finish({fallback:true});worker.onerror=()=>finish({fallback:true});worker.onmessageerror=()=>finish({fallback:true});
    // Keep the buffer available if this browser needs the main-thread reader.
    worker.postMessage({bytes,filename:file.name});
   }catch{finish({fallback:true});}
  });
  if(result.error)throw Error(result.error);
  if(result.records)return result.records;
 }
 progress('Using compatible Excel reader');const XLSX=await loadLibrary();
 const parseWorkbook=parse||(await import('./model.js')).parseWorkbook;
 // Let the status paint before parsing when a mobile browser cannot run workers.
 await new Promise(resolve=>setTimeout(resolve,0));
 return parseWorkbook(XLSX,bytes,file.name);
}
