import {publicRows,staffRows,normalizeFlight,flightValue} from './model.js';
export const displayRows=(records,presentation=false)=>presentation?publicRows(records).map(row=>({...row,nationality:''})):staffRows(records);
export function loadedFlights(records){return [...new Set(records.map(row=>normalizeFlight(flightValue(row))).filter(Boolean))].sort().map(letter=>'Day 1'+letter);}
export const readyMessage=(count,pages=1)=>pages>1?`${pages} JPEG pages ready — includes all ${count} qualified players`:`JPEG ready — includes all ${count} qualified ${count===1?'player':'players'}`;
// A second file with an existing name is kept as "name (2).xlsx" instead of silently replacing the first.
export function uniqueFilename(name,existing){const taken=new Set(existing.map(n=>n.toLowerCase()));if(!taken.has(name.toLowerCase()))return name;const dot=name.lastIndexOf('.'),base=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';for(let i=2;;i++){const candidate=`${base} (${i})${ext}`;if(!taken.has(candidate.toLowerCase()))return candidate;}}
// V51 series presets: the details that repeat for a series (BPS, Monday Redtooth...), saved in this browser.
// Event-specific values (date, places paid, prize money) are never part of a preset.
export const PRESET_FIELDS=['name','time','flights','bb','gtd','format'];
export const PRESET_KEY='genting-series-presets-v1',PRESET_LIMIT=30;
const clean=value=>String(value??'').trim().slice(0,80);
export function makePreset(label,values={}){const id=clean(label);if(!id)throw Error('Enter a name for the preset.');return {label:id,values:Object.fromEntries(PRESET_FIELDS.map(field=>[field,clean(values[field])]))};}
export function parsePresets(raw){try{const list=JSON.parse(raw||'[]');return Array.isArray(list)?list.filter(p=>p&&typeof p.label==='string'&&p.label.trim()&&p.values&&typeof p.values==='object').map(p=>makePreset(p.label,p.values)).slice(0,PRESET_LIMIT):[];}catch{return [];}}
export function upsertPreset(list,preset){const rest=list.filter(p=>p.label.toLocaleLowerCase()!==preset.label.toLocaleLowerCase());return [...rest,preset].sort((a,b)=>a.label.localeCompare(b.label,'en-GB',{sensitivity:'base'})).slice(0,PRESET_LIMIT);}
export function removePreset(list,label){return list.filter(p=>p.label!==label);}
