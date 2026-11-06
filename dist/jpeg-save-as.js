export const supportsSaveAs=host=>typeof host?.showSaveFilePicker==='function';
export async function saveJpegAs(artifact,{host=globalThis,isCurrent=()=>true}={}){
 if(!artifact?.blob||artifact.blob.type!=='image/jpeg'||!artifact.blob.size)return {state:'error',message:'Generate a valid JPEG before saving.'};
 if(!supportsSaveAs(host))return {state:'unavailable',message:'Folder selection is not available in this browser. Use Download or Save & Share.'};
 let writable,picking=true;
 try{
  // The picker is called immediately from the user's click, before any await.
  const handle=await host.showSaveFilePicker({suggestedName:'genting-leaderboard.jpg',types:[{description:'JPEG image',accept:{'image/jpeg':['.jpg','.jpeg']}}],excludeAcceptAllOption:true});picking=false;
  if(!isCurrent())return {state:'stale',message:'The JPEG changed. Generate it again before saving.'};
  writable=await handle.createWritable();
  if(!isCurrent()){await writable.abort();return {state:'stale',message:'The JPEG changed. Generate it again before saving.'};}
  await writable.write(artifact.blob);
  if(!isCurrent()){await writable.abort();return {state:'stale',message:'The JPEG changed. Generate it again before saving.'};}
  await writable.close();return {state:'saved',message:'JPEG saved to your selected location.'};
 }catch(error){
  if(writable)try{await writable.abort();}catch{}
  if(picking&&error?.name==='AbortError')return {state:'cancelled',message:'Saving cancelled. The JPEG is still available.'};
  return {state:'error',message:`Could not save the JPEG${error?.name?' ('+error.name+')':''}: ${error?.message||'saving was rejected'}. Use Download or Save & Share.`};
 }
}
