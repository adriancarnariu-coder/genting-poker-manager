importScripts('./vendor/xlsx.full.min.cjs');
onmessage=async e=>{let parseWorkbook;try{({parseWorkbook}=await import('./model.js'));}catch{postMessage({kind:'reader'});return;}try{postMessage({records:parseWorkbook(XLSX,e.data.bytes,e.data.filename)});}catch(error){postMessage({kind:'parse',error:error.message||'The file could not be read.'});}};
