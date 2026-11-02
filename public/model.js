export function tournament(name, date) {
  if (!name?.trim()) throw new Error('Introdu numele turneului.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new Error('Alege data turneului.');
  return { id: crypto.randomUUID(), name: name.trim(), date, flights: [], players: [] };
}
export function addFlight(event, name) {
  name = name.trim();
  if (!name) throw new Error('Introdu numele flight-ului.');
  if (event.flights.some(f => f.name.toLowerCase() === name.toLowerCase())) throw new Error('Acest flight există deja.');
  return { ...event, flights: [...event.flights, { id: crypto.randomUUID(), name }] };
}
export function savePlayer(event, input, id) {
  const name = input.name.trim();
  const nationality = input.nationality.trim().toUpperCase();
  const chips = Number(input.chips);
  if (!name) throw new Error('Introdu numele jucătorului.');
  if (!/^[A-Z]{2}$/.test(nationality)) throw new Error('Folosește codul țării din 2 litere, de exemplu RO.');
  if (!event.flights.some(f => f.id === input.flightId)) throw new Error('Alege un flight valid.');
  if (String(input.chips).trim() === '' || !Number.isSafeInteger(chips) || chips < 0) throw new Error('Stackul trebuie să fie un număr întreg pozitiv sau zero.');
  const player = { id: id || crypto.randomUUID(), name, nationality, flightId: input.flightId, chips };
  return { ...event, players: id ? event.players.map(p => p.id === id ? player : p) : [...event.players, player] };
}
export function ranking(players) {
  let lastChips, rank;
  return [...players].sort((a,b) => b.chips - a.chips || a.name.localeCompare(b.name, 'ro')).map((p,i) => {
    if (p.chips !== lastChips) rank = i + 1;
    lastChips = p.chips;
    return { ...p, rank };
  });
}
export function csv(event) {
  const cell = value => '"' + String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  return '\uFEFF' + [['Loc','Jucător','Țară','Flight','Jetoane'], ...ranking(event.players).map(p => [p.rank,p.name,p.nationality,event.flights.find(f => f.id === p.flightId)?.name || '',p.chips])].map(row => row.map(cell).join(',')).join('\r\n');
}
