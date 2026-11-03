import {FIELDS,TYPES,text,readWorkbook,suggestHeader,suggestMapping,importRows,issuesFor,chipNumber,sortedRows,leaderboardCsv,editRow} from './importer.js';
import {openStore,load,save} from './store.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], fmt=n=>new Intl.NumberFormat('en-GB').format(n);
let db,state={revision:0,events:[],active:null},category='Qualified Players',pending=null,editing=null,busy=false;
const current=()=>state.events.find(e=>e.id===state.active);
const el=(tag,value,cls)=>{const node=document.createElement(tag);if(value!==undefined)node.textContent=value;if(cls)node.className=cls;return node;};
const opt=(value,label=value)=>new Option(label,value);
function notice(message){$('#notice').textContent=message;}
function download(data,name,type='application/octet-stream'){
  const url=URL.createObjectURL(new Blob([data],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function commit(next){
  if(!db)throw Error('Storage unavailable. Reload after enabling browser storage.');
  if(busy)throw Error('A save is in progress. Try again when it completes.');
  busy=true;
  try{state=await save(db,next,state.revision);notice('');render();}finally{busy=false;}
}
const update=event=>commit({...state,events:state.events.map(e=>e.id===event.id?event:e)});
function showDialog(id){const d=$('#'+id);d.querySelector('form')?.reset();const error=d.querySelector('.form-error');if(error)error.textContent='';d.showModal();}
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
const openEvent=()=>{showDialog('event-dialog');const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());$('#event-form').elements.date.value=d.toISOString().slice(0,10);};
$('#new-event').onclick=$('#first-event').onclick=openEvent;
$('#add-flight').onclick=()=>showDialog('flight-dialog');
async function formAction(event,action){event.preventDefault();const button=event.target.querySelector('button.primary');button.disabled=true;try{await action();event.target.closest('dialog').close();}catch(e){event.target.querySelector('.form-error').textContent=e.message;}finally{button.disabled=false;}}
$('#event-form').onsubmit=e=>formAction(e,async()=>{
  const data=Object.fromEntries(new FormData(e.target));if(!data.name.trim())throw Error('Enter a tournament name.');
  const event={id:crypto.randomUUID(),name:data.name.trim(),date:data.date,flights:[],rows:[],uploads:[]};
  await commit({...state,events:[...state.events,event],active:event.id});
});
$('#flight-form').onsubmit=e=>formAction(e,async()=>{
  const flight=text(new FormData(e.target).get('flight')).toUpperCase();if(!flight)throw Error('Enter a flight label.');
  if(current().flights.includes(flight))throw Error('This flight already exists.');
  await update({...current(),flights:[...current().flights,flight]});
});
$('#event-select').onchange=async e=>{try{await commit({...state,active:e.target.value});}catch(error){notice(error.message);render();}};
function render(){
  const event=current();$('#empty').hidden=!!event;$('#workspace').hidden=!event;
  if(!event)return;
  $('#event-select').replaceChildren(...state.events.map(e=>opt(e.id,e.name)));$('#event-select').value=event.id;
  $('#flight-list').replaceChildren(...event.flights.map(f=>el('span',f,'flight-chip')));
  for(const id of ['upload-flight','filter-flight']){
    const selected=$('#'+id).value;$('#'+id).replaceChildren(...(id==='filter-flight'?[opt('','All flights')]:[]),...event.flights.map(f=>opt(f)));
    if(event.flights.includes(selected))$('#'+id).value=selected;
  }
  $('#upload').disabled=!event.flights.length;$('#upload').closest('label').title=event.flights.length?'':'Add a flight first';
  const q=event.rows.filter(r=>r.type==='Qualified Players'&&!r.excluded),issues=issuesFor(event.rows,event.flights);
  $('#stat-qualified').textContent=fmt(q.length);$('#stat-chips').textContent=fmt(q.reduce((s,r)=>s+(chipNumber(r.chips)||0),0));
  $('#stat-issues').textContent=fmt(q.filter(r=>issues.get(r.key).some(i=>i.blocking)).length);$('#stat-uploads').textContent=fmt(event.uploads.length);
  renderRows();renderArchive();
}
function renderRows(){
  const event=current();if(!event)return;const issues=issuesFor(event.rows,event.flights),search=$('#search').value.toLowerCase().trim(),flight=$('#filter-flight').value;
  const base=sortedRows(event.rows.filter(r=>category==='Excluded'?r.excluded:!r.excluded&&r.type===category));
  const rows=base.filter(r=>(!search||`${r.playerId} ${r.name}`.toLowerCase().includes(search))&&(!flight||r.flight===flight)&&(!$('#issues-only').checked||issues.get(r.key).some(i=>i.blocking)));
  $('#row-count').textContent=base.length;$('#rows').replaceChildren();
  for(const r of rows){
    const tr=el('tr'),cell=(v,cls)=>{const td=el('td',v,cls);tr.append(td);return td;};
    cell(String(base.indexOf(r)+1).padStart(2,'0'));
    const name=cell();name.append(el('strong',r.name||'Missing name'),el('small',r.playerId||'Missing ID'));
    cell(chipNumber(r.chips)===null?(r.chips||'—'):fmt(chipNumber(r.chips)));cell(r.flight);
    const nation=cell(r.nationalityVerified?(r.nationality||'—'):'—');if(r.nationality&&!r.nationalityVerified)nation.append(el('small',`Unverified: ${r.nationality}`));
    cell(r.publication==='yes'?'Allowed':r.publication==='no'?'Not allowed':'Unknown');
    const validation=cell(),list=issues.get(r.key),blocking=list.some(i=>i.blocking);
    validation.append(el('span',r.excluded?'Excluded':blocking?'Needs review':'Checked',`badge ${blocking?'error':'ok'}`));
    if(r.excluded)validation.append(el('div',r.exclusionReason,'issue-text'));
    else for(const i of list)validation.append(el('div',i.message,`issue-text ${i.blocking?'':'info'}`));
    const button=el('button','Review','row-review');button.setAttribute('aria-label',`Review ${r.name||r.playerId||'unnamed record'}`);button.onclick=()=>openEdit(r);cell().append(button);
    $('#rows').append(tr);
  }
  if(!rows.length){const tr=el('tr'),td=el('td',base.length?'No records match these filters.':'No records yet. Import a report to get started.');td.colSpan=8;tr.append(td);$('#rows').append(tr);}
  $('#table-footer').textContent=`${rows.length} of ${base.length} records · ${category}`;
  const qualified=event.rows.filter(r=>r.type==='Qualified Players'&&!r.excluded),blocked=qualified.filter(r=>issues.get(r.key).some(i=>i.blocking)).length;
  $('#export').disabled=!qualified.length||blocked>0;
  $('#export-status').textContent=blocked?`${blocked} qualified record(s) need attention before export. No players are automatically merged or removed.`:qualified.length?'Ready for internal review. CSV includes permission status; it is not a public publication.':'Upload Qualified Players to prepare the Day 2 leaderboard.';
}
$$('[data-type]').forEach(b=>b.onclick=()=>{category=b.dataset.type;$$('[data-type]').forEach(x=>x.classList.toggle('active',x===b));renderRows();});
$('#search').oninput=renderRows;$('#filter-flight').onchange=$('#issues-only').onchange=renderRows;
$('#export').onclick=()=>{try{download(leaderboardCsv(current().rows,current().flights),`day-2-internal-${current().date}.csv`,'text/csv;charset=utf-8');}catch(e){notice(e.message);}};
function renderArchive(){
  $('#archive').replaceChildren();const event=current();
  if(!event.uploads.length){$('#archive').append(el('p','No workbooks uploaded yet.','archive-item muted'));return;}
  for(const upload of event.uploads){
    const item=el('div',undefined,'archive-item'),desc=el('div');desc.append(el('strong',upload.filename),el('p',`${upload.type} · ${upload.flight} · ${upload.sheetName} · ${upload.rowCount} rows · ${new Date(upload.at).toLocaleString('en-GB')}`));item.append(desc);
    const review=el('button','Review source');review.onclick=()=>{showDialog('source-dialog');$('#source-title').textContent=upload.filename;$('#source-data').textContent=JSON.stringify({mapping:upload.mapping,headerRow:upload.headerIndex+1,sheets:upload.sheets},null,2);};
    const original=el('button','Download original ↓');original.onclick=()=>download(upload.bytes,upload.filename);item.append(review,original);$('#archive').append(item);
  }
}
$('#upload').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{
    if(!current()?.flights.length)throw Error('Add a flight first.');
    if(file.size>15*1024*1024)throw Error('Workbook exceeds the 15 MB limit.');
    if(!window.XLSX)throw Error('The Excel parser failed to load. Reload the application.');
    const bytes=await file.arrayBuffer(),sheets=readWorkbook(window.XLSX,bytes,file.name);
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    pending={eventId:current().id,filename:file.name,bytes,sheets,hash,type:$('#upload-type').value,flight:$('#upload-flight').value};
    showDialog('import-dialog');$('#sheet').replaceChildren(...sheets.map((s,i)=>opt(i,s.name)));selectSheet();
  }catch(error){notice(error.message);}
};
function selectSheet(){const sheet=pending.sheets[Number($('#sheet').value)];$('#header-row').value=suggestHeader(sheet.rows)+1;$('#header-row').max=sheet.rows.length||1;renderMapping();}
$('#sheet').onchange=selectSheet;$('#header-row').oninput=renderMapping;
function renderMapping(){
  const sheet=pending.sheets[Number($('#sheet').value)],h=Number($('#header-row').value)-1,headers=sheet.rows[h]||[],mapping=suggestMapping(headers);
  $('#mapping').replaceChildren();
  for(const field of FIELDS){const label=el('label',({playerId:'Player ID *',name:'Player name *',chips:'Chip count',flight:'Flight in file',nationality:'Nationality',nationalityVerified:'Nationality verified',publication:'Publication permission'})[field]),select=el('select');select.dataset.field=field;
    select.replaceChildren(opt(-1,'Not available'),...headers.map((v,i)=>opt(i,`${i+1}: ${v||'(blank header)'}`)));select.value=mapping[field];label.append(select);$('#mapping').append(label);}
  const repeated=current().uploads.some(u=>u.hash===pending.hash&&u.sheetName===sheet.name&&u.type===pending.type);
  $('#import-description').textContent=`${pending.filename} → ${pending.type} / ${pending.flight}`;
  $('#source-preview').textContent=JSON.stringify(sheet.rows.slice(Math.max(0,h),h+7),null,2);
  const count=sheet.rows.slice(h+1).filter(r=>r.some(v=>text(v))).length;
  $('#import-summary').textContent=`${count} nonblank source rows will be retained as records. Other sheets remain in the archive; import them separately with their correct category.${repeated?' Warning: this worksheet has already been imported. Re-imports are retained and duplicates flagged.':''}${sheet.formulas.length?' Formula cells use their stored Excel values; review and recalculate the original workbook if needed.':''}`;
}
$('#import-form').onsubmit=e=>formAction(e,async()=>{
  if(current().id!==pending.eventId)throw Error('The active tournament changed. Select the file again.');
  const sheet=pending.sheets[Number($('#sheet').value)],headerIndex=Number($('#header-row').value)-1,mapping=Object.fromEntries($$('#mapping select').map(s=>[s.dataset.field,Number(s.value)])),id=crypto.randomUUID();
  const rows=importRows({rows:sheet.rows,headerIndex,mapping,type:pending.type,flight:pending.flight,uploadId:id,sheetName:sheet.name});
  if(!rows.length)throw Error('No data rows were found after the selected header.');
  const upload={...pending,id,sheetName:sheet.name,headerIndex,mapping,rowCount:rows.length,at:new Date().toISOString()};
  await update({...current(),rows:[...current().rows,...rows],uploads:[...current().uploads,upload]});pending=null;
});
function openEdit(row){
  editing=row.key;showDialog('edit-dialog');const form=$('#edit-form');
  form.elements.flight.replaceChildren(...[...new Set([...current().flights,row.flight])].map(f=>opt(f)));
  for(const f of ['playerId','name','chips','flight','nationality','publication'])form.elements[f].value=row[f];
  for(const f of ['nationalityVerified','excluded'])form.elements[f].checked=row[f];
  $('#edit-source').textContent=`${row.type} · ${row.sheetName}, Excel row ${row.sourceRow} · Assigned flight ${row.assignedFlight}`;
  $('#original-record').textContent=JSON.stringify({original:row.original,audit:row.audit},null,2);
}
$('#edit-form').onsubmit=e=>formAction(e,async()=>{
  const form=e.target,data=Object.fromEntries(new FormData(form)),row=current().rows.find(r=>r.key===editing);
  const patch=Object.fromEntries(['playerId','name','chips','flight','nationality','publication'].map(f=>[f,text(data[f])]));
  patch.nationalityVerified=form.elements.nationalityVerified.checked;patch.excluded=form.elements.excluded.checked;patch.exclusionReason=patch.excluded?text(data.reason):'';
  const next=editRow(row,patch,text(data.reason));await update({...current(),rows:current().rows.map(r=>r.key===editing?next:r)});
});
$('#backup').onclick=()=>{
  const event=current(),backup={schema:1,exportedAt:new Date().toISOString(),event:{...event,uploads:event.uploads.map(u=>{let binary='';for(const b of new Uint8Array(u.bytes))binary+=String.fromCharCode(b);return {...u,bytes:undefined,originalBase64:btoa(binary)};})}};
  download(JSON.stringify(backup,null,2),`genting-backup-${event.date}.json`,'application/json');
};
async function sample(){
  try{
    if(!window.XLSX)throw Error('Excel parser unavailable. Reload first.');
    const event={id:crypto.randomUUID(),name:'Sample · Genting Main Event',date:'2026-11-03',flights:['1A','1B','1C'],rows:[],uploads:[]};
    for(const [filename,type,flight] of [['qualified-1a.xlsx','Qualified Players','1A'],['qualified-1b.xlsx','Qualified Players','1B'],['entries-1a.xls','Entries','1A'],['reentries-1a.xlsx','Re-Entries','1A']]){
      const response=await fetch('samples/'+filename);if(!response.ok)throw Error('Sample workbook unavailable.');
      const bytes=await response.arrayBuffer(),sheets=readWorkbook(window.XLSX,bytes,filename),sheet=sheets[0],mapping=suggestMapping(sheet.rows[0]),id=crypto.randomUUID();
      const rows=importRows({rows:sheet.rows,headerIndex:0,mapping,type,flight,uploadId:id,sheetName:sheet.name});event.rows.push(...rows);event.uploads.push({id,filename,type,flight,bytes,sheets,sheetName:sheet.name,headerIndex:0,mapping,rowCount:rows.length,at:new Date().toISOString(),hash:''});
    }
    await commit({...state,events:[...state.events,event],active:event.id});
  }catch(e){notice(e.message);}
}
$('#load-sample').onclick=$('#sample-footer').onclick=sample;
try{db=await openStore();state=await load(db);if(!Array.isArray(state.events))throw Error('Saved workspace has an unexpected format. No data was overwritten.');render();
  if(localStorage.getItem('genting-poker-manager-v1'))notice('An earlier manual-entry workspace exists in this browser and is preserved. It is not imported as qualified players. Use the earlier version to export it for review.');
}catch(e){notice(e.message);$('#new-event').disabled=$('#first-event').disabled=$('#load-sample').disabled=$('#sample-footer').disabled=true;}
