import {publicRows,staffRows,normalizeFlight,flightValue} from './model.js';
export const displayRows=(records,presentation=false)=>presentation?publicRows(records).map(row=>({...row,nationality:''})):staffRows(records);
export function loadedFlights(records){return [...new Set(records.map(row=>normalizeFlight(flightValue(row))).filter(Boolean))].sort().map(letter=>'Day 1'+letter);}
export const readyMessage=count=>`JPEG ready — includes all ${count} qualified ${count===1?'player':'players'}`;
