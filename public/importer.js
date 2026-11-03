// Importing never assigns qualification from chips, sheet names, or entry records.
export const TYPES = ['Entries', 'Re-Entries', 'Qualified Players'];
export const FIELDS = ['playerId','name','chips','flight','nationality','nationalityVerified','publication'];
const aliases = {
  playerId: ['playerid','membershipnumber','membershipno','memberid','membernumber','customerid','cardnumber','cardno','id'],
  name: ['name','playername','fullname','player'],
  chips: ['chips','chipcount','stack','chipstack','day2chips','endofdaychips'],
  flight: ['flight','day1flight','startingflight'],
  nationality: ['nationality','country','countrycode'],
  nationalityVerified: ['nationalityverified','verifiednationality','countryverified'],
  publication: ['publicationpermission','publication','publish','consent','permissiontopublish']
};
const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g,'');
export const text = v => String(v ?? '').trim();
export function suggestMapping(headers) {
  return Object.fromEntries(FIELDS.map(field => {
    const matches = headers.flatMap((h,i) => aliases[field].includes(norm(h)) ? [i] : []);
    return [field, matches.length === 1 ? matches[0] : -1];
  }));
}
export function suggestHeader(rows) {
  let best = 0, score = 0;
  rows.slice(0,40).forEach((r,i) => {
    const m = suggestMapping(r), s = Object.values(m).filter(v => v >= 0).length;
    if (s > score) { score = s; best = i; }
  });
  return best;
}
export function permission(value) {
  const v = text(value).toLowerCase();
  if (['yes','y','true','1','allowed','granted'].includes(v)) return 'yes';
  if (['no','n','false','0','denied','refused'].includes(v)) return 'no';
  return 'unknown';
}
export function chipNumber(value) {
  const s = text(value);
  // Only unambiguous plain digits or correctly grouped thousands. No coercion of blanks, dates or exponents.
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?:[ \u00a0]\d{3})+)$/.test(s)) return null;
  const n = Number(s.replace(/[, \u00a0]/g,''));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
export function readWorkbook(XLSX, bytes, filename) {
  if (!/\.(xls|xlsx)$/i.test(filename)) throw Error('Choose an .xls or .xlsx workbook.');
  if (bytes.byteLength > 15 * 1024 * 1024) throw Error('Workbook exceeds the 15 MB limit. Split it before importing.');
  const magic = new Uint8Array(bytes).slice(0,8);
  const zip = magic[0] === 0x50 && magic[1] === 0x4b;
  const ole = [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((v,i) => magic[i] === v);
  if (!zip && !ole) throw Error('File is not an Excel binary workbook. Renaming CSV or HTML is not supported.');
  const wb = XLSX.read(bytes, {type:'array',cellText:true,cellFormula:true});
  const sheets = wb.SheetNames.map(name => {
    const sheet = wb.Sheets[name];
    if (sheet['!ref']) {
      const range = XLSX.utils.decode_range(sheet['!ref']);
      if (range.e.r > 50000 || range.e.c > 255) throw Error('Worksheet exceeds 50,000 rows or 256 columns. Split it before importing.');
    }
    return {name, rows:XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:'',blankrows:true}),
      formulas:Object.keys(sheet).filter(k=>!k.startsWith('!') && sheet[k].f).map(k=>({cell:k,formula:sheet[k].f}))};
  });
  if (!sheets.length) throw Error('Workbook contains no worksheets.');
  return sheets;
}
export function importRows({rows,headerIndex,mapping,type,flight,uploadId,sheetName,idFactory=()=>crypto.randomUUID()}) {
  if (!TYPES.includes(type)) throw Error('Select the upload category explicitly.');
  if (!flight) throw Error('Choose an existing flight.');
  if (!Number.isInteger(headerIndex) || headerIndex < 0 || headerIndex >= rows.length) throw Error('Choose a valid header row.');
  if (mapping.playerId < 0 || mapping.name < 0 || (type === 'Qualified Players' && mapping.chips < 0)) throw Error('Map player ID and name; qualified uploads also require a chip column.');
  const mapped = Object.values(mapping).filter(i=>i>=0);
  if (new Set(mapped).size !== mapped.length) throw Error('Each column may map to only one field.');
  const get = (r,f) => mapping[f] >= 0 ? text(r[mapping[f]]) : '';
  return rows.slice(headerIndex+1).flatMap((r,i) => {
    if (!r.some(v=>text(v))) return []; // Blank physical rows remain in the retained workbook.
    const original = {playerId:get(r,'playerId'),name:get(r,'name'),chips:get(r,'chips'),flight:get(r,'flight') || flight,
      nationality:get(r,'nationality'),nationalityVerified:permission(get(r,'nationalityVerified')) === 'yes',publication:permission(get(r,'publication'))};
    return [{key:idFactory(),uploadId,sheetName,sourceRow:headerIndex+i+2,type,assignedFlight:flight,
      original:{...original},...original,excluded:false,exclusionReason:'',audit:[]}];
  });
}
export function issuesFor(rows,flights) {
  const issues = new Map(rows.map(r=>[r.key,[]]));
  const active = rows.filter(r=>!r.excluded);
  const add = (r,message,blocking=true) => issues.get(r.key).push({message,blocking});
  for (const r of active) {
    if (!text(r.playerId)) add(r,'Missing player ID');
    if (!text(r.name)) add(r,'Missing name');
    if (r.type === 'Qualified Players' && chipNumber(r.chips) === null) add(r,'Invalid chip count: use a positive whole number');
    if (!flights.includes(r.flight)) add(r,'Unknown flight');
    if (r.flight !== r.assignedFlight) add(r,'Flight conflicts with upload assignment');
    if (r.nationality && !r.nationalityVerified) add(r,'Nationality unverified — omitted from leaderboard',false);
    if (r.publication === 'unknown') add(r,'Publication permission unknown',false);
  }
  const groups = new Map();
  for (const r of active) { const id = text(r.playerId).toUpperCase(); if(id) groups.set(id,[...(groups.get(id)||[]),r]); }
  for (const group of groups.values()) {
    if(group.length < 2) continue;
    const qualified = group.filter(r=>r.type === 'Qualified Players');
    for(const r of group) add(r,qualified.length > 1 ? 'Duplicate ID: multiple qualified records' : 'Duplicate ID: present in other source rows',qualified.length > 1);
    const distinct = field => new Set(group.map(r=>text(r[field]).toLowerCase()).filter(Boolean)).size > 1;
    if(distinct('name')) for(const r of group) add(r,'Conflicting names for this ID');
    const verified = group.filter(r=>r.nationalityVerified && r.nationality);
    if(new Set(verified.map(r=>text(r.nationality).toUpperCase())).size>1) for(const r of group) add(r,'Conflicting verified nationalities');
    if(new Set(group.map(r=>r.publication).filter(v=>v!=='unknown')).size>1) for(const r of group) add(r,'Conflicting publication permissions');
    if(new Set(qualified.map(r=>chipNumber(r.chips)).filter(v=>v!==null)).size>1) for(const r of qualified) add(r,'Conflicting qualified chip counts');
  }
  return issues;
}
export function sortedRows(rows) {
  return [...rows].sort((a,b)=>(chipNumber(b.chips) ?? -1)-(chipNumber(a.chips) ?? -1) || text(a.name).localeCompare(text(b.name)) || a.key.localeCompare(b.key));
}
export function leaderboard(rows,flights) {
  const issues = issuesFor(rows,flights);
  const qualified = sortedRows(rows.filter(r=>r.type==='Qualified Players' && !r.excluded));
  if(qualified.some(r=>issues.get(r.key).some(i=>i.blocking))) throw Error('Resolve all blocking issues in qualified records before exporting.');
  let previous,rank;
  return qualified.map((r,i)=>{
    const chips=chipNumber(r.chips); if(chips!==previous) rank=i+1; previous=chips;
    return {rank,playerId:r.playerId,name:r.name,chips,flight:r.flight,nationality:r.nationalityVerified?r.nationality:'',publication:r.publication};
  });
}
export function editRow(row,patch,reason,at=new Date().toISOString()) {
  if(!text(reason)) throw Error('Give a correction or exclusion reason.');
  const allowed = [...FIELDS,'excluded','exclusionReason'];
  if(Object.keys(patch).some(k=>!allowed.includes(k))) throw Error('Source metadata cannot be edited.');
  if(patch.excluded && !text(patch.exclusionReason)) throw Error('Give an exclusion reason.');
  return {...row,...patch,audit:[...row.audit,{at,reason,before:Object.fromEntries(Object.keys(patch).map(k=>[k,row[k]])),after:{...patch}}]};
}
export function leaderboardCsv(rows,flights) {
  const cell = v => '"'+String(v).replace(/^[\s]*[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  const fields=['rank','playerId','name','chips','flight','nationality','publication'];
  return '\uFEFF'+[fields,...leaderboard(rows,flights).map(r=>fields.map(f=>r[f]))].map(r=>r.map(cell).join(',')).join('\r\n');
}
