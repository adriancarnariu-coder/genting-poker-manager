importScripts('./vendor/xlsx.full.min.cjs');
self.onmessage=async event=>{
  try{
    const {readWorkbook}=await import('./importer.js');
    self.postMessage({sheets:readWorkbook(self.XLSX,event.data.bytes,event.data.filename)});
  }catch(error){self.postMessage({error:error.message || 'The workbook could not be opened. Save a fresh .xlsx copy and try again.'});}
};
