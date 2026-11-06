export const jpegFilename='genting-leaderboard.jpg';
export function jpegDataUrl(blob,{Reader=globalThis.FileReader,timeout=15000}={}){
 return new Promise((resolve,reject)=>{
  if(!blob||blob.type!=='image/jpeg'||!blob.size){reject(Error('A valid JPEG is required for manual saving.'));return;}
  let reader,done=false;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(result);};
  const timer=setTimeout(()=>{finish(Error('Preparing the image for manual saving took too long.'));try{reader?.abort();}catch{}},timeout);
  try{reader=new Reader();reader.onload=()=>typeof reader.result==='string'&&reader.result.startsWith('data:image/jpeg;base64,')?finish(null,reader.result):finish(Error('The manual image is not a JPEG.'));reader.onerror=()=>finish(Error('The JPEG could not be prepared for manual saving.'));reader.onabort=()=>finish(Error('Preparing the manual image was cancelled.'));reader.readAsDataURL(blob);}catch(error){finish(Error('Manual image preparation is unavailable: '+error.message));}
 });
}
export function createJpegArtifact(blob,{URLApi=globalThis.URL,FileClass=globalThis.File,navigatorApi=globalThis.navigator}={}){
 if(!blob||blob.type!=='image/jpeg'||!blob.size)throw Error('A valid JPEG was not generated. Generate the leaderboard again.');
 let file=null,canShare=false;
 try{if(FileClass)file=new FileClass([blob],jpegFilename,{type:'image/jpeg'});if(file&&typeof navigatorApi?.share==='function'&&typeof navigatorApi.canShare==='function')canShare=!!navigatorApi.canShare({files:[file]});}catch{canShare=false;}
 return {blob,file,canShare,url:URLApi.createObjectURL(blob),handedOff:false};
}
export function retireJpegArtifact(artifact,{URLApi=globalThis.URL,schedule=globalThis.setTimeout}={}){
 if(!artifact)return;
 // Give a download or newly opened image time to consume its URL after an edit.
 if(artifact.handedOff)schedule(()=>URLApi.revokeObjectURL(artifact.url),300000);
 else URLApi.revokeObjectURL(artifact.url);
}
export async function shareJpegArtifact(artifact,navigatorApi=globalThis.navigator){
 if(!artifact?.file||!artifact.canShare)return {state:'unavailable',message:'File sharing is unavailable. Use DOWNLOAD JPEG or OPEN JPEG.'};
 try{
  // Invoke directly in the click gesture, without awaiting preparation or fetching.
  await navigatorApi.share({files:[artifact.file]});
  return {state:'shared',message:'JPEG passed to system sharing. Saving depends on the destination you selected.'};
 }catch(error){
  if(error?.name==='AbortError')return {state:'cancelled',message:'Sharing cancelled. The JPEG is still available.'};
  return {state:'error',message:`Could not share the JPEG${error?.name?' ('+error.name+')':''}: ${error?.message||'the browser rejected file sharing'}. Use OPEN JPEG to save it manually.`};
 }
}
