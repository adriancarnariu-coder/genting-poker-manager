import {publicRows,staffRows,normalizeFlight,flightValue} from './model.js';
export const displayRows=(records,presentation=false)=>presentation?publicRows(records).map(row=>({...row,nationality:''})):staffRows(records);
export function loadedFlights(records){return [...new Set(records.map(row=>normalizeFlight(flightValue(row))).filter(Boolean))].sort().map(letter=>'Day 1'+letter);}
export const readyMessage=count=>`JPEG ready — includes all ${count} qualified ${count===1?'player':'players'}`;
// A second file with an existing name is kept as "name (2).xlsx" instead of silently replacing the first.
export function uniqueFilename(name,existing){const taken=new Set(existing.map(n=>n.toLowerCase()));if(!taken.has(name.toLowerCase()))return name;const dot=name.lastIndexOf('.'),base=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';for(let i=2;;i++){const candidate=`${base} (${i})${ext}`;if(!taken.has(candidate.toLowerCase()))return candidate;}}
