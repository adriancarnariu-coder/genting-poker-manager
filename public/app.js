import { tournament, addFlight, savePlayer, ranking, csv } from './model.js';
const $ = selector => document.querySelector(selector);
const key = 'genting-poker-manager-v1';
let state = { events: [], active: null }, editing = null, storageUnavailable = false;
try {
  const stored = localStorage.getItem(key);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed.events) || !parsed.events.every(e => typeof e.id === 'string' && typeof e.name === 'string' && typeof e.date === 'string' && Array.isArray(e.players) && Array.isArray(e.flights))) throw new Error();
    state = parsed;
  }
} catch { storageUnavailable = true; $('#notice').textContent = 'Datele locale nu pot fi citite. Salvarea este blocată pentru a le proteja. Verifică permisiunile browserului și reîncarcă pagina.'; }
const current = () => state.events.find(e => e.id === state.active);
const format = value => new Intl.NumberFormat('ro-RO').format(value);
function commit(next) {
  if (storageUnavailable) throw new Error('Salvarea locală nu este disponibilă. Datele existente nu au fost suprascrise.');
  try { localStorage.setItem(key, JSON.stringify(next)); } catch { throw new Error('Salvarea a eșuat. Verifică spațiul și permisiunile browserului.'); }
  state = next;
  render();
}
function update(event) { commit({ ...state, events: state.events.map(e => e.id === event.id ? event : e) }); }
function option(value, label) { return new Option(label, value); }
function render() {
  const event = current();
  $('#event-select').replaceChildren(...state.events.map(e => option(e.id, e.name)));
  $('#event-select').value = event?.id || '';
  $('.toolbar').hidden = !state.events.length;
  $('#empty').hidden = !!event;
  $('#workspace').hidden = !event;
  if (!event) return;
  $('#event-date').textContent = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'long' }).format(new Date(event.date + 'T12:00:00'));
  const chips = event.players.reduce((sum,p) => sum + p.chips, 0);
  $('#player-count').textContent = format(event.players.length);
  $('#chip-total').textContent = format(chips);
  $('#chip-average').textContent = format(event.players.length ? Math.round(chips / event.players.length) : 0);
  $('#flight-count').textContent = format(event.flights.length);
  const selected = $('#flight-filter').value;
  $('#flight-filter').replaceChildren(option('', 'Toate flight-urile'), ...event.flights.map(f => option(f.id, f.name)));
  $('#flight-filter').value = event.flights.some(f => f.id === selected) ? selected : '';
  $('#new-player').disabled = !event.flights.length;
  $('#new-player').title = event.flights.length ? '' : 'Adaugă mai întâi un flight';
  $('#export').disabled = !event.players.length;
  renderPlayers();
}
function renderPlayers() {
  const event = current(); if (!event) return;
  const search = $('#search').value.trim().toLocaleLowerCase('ro');
  const filtered = ranking(event.players).filter(p => p.name.toLocaleLowerCase('ro').includes(search) && (!$('#flight-filter').value || p.flightId === $('#flight-filter').value));
  $('#players').replaceChildren();
  for (const player of filtered) {
    const row = document.createElement('tr');
    const values = [String(player.rank).padStart(2,'0'), player.name, player.nationality, event.flights.find(f => f.id === player.flightId)?.name || '—', format(player.chips)];
    for (const [i,value] of values.entries()) { const cell = document.createElement('td'); cell.textContent = value; if (i === 1) cell.className = 'player-name'; if (i === 4) cell.className = 'number'; row.append(cell); }
    const actions = document.createElement('td'); const group = document.createElement('div'); group.className = 'row-actions';
    for (const [label,action] of [['Editează', () => openPlayer(player)], ['Șterge', () => {
      if (confirm(`Ștergi jucătorul ${player.name}?`)) { try { update({ ...current(), players: current().players.filter(p => p.id !== player.id) }); } catch(e) { $('#notice').textContent = e.message; } }
    }]]) { const button = document.createElement('button'); button.textContent = label; button.setAttribute('aria-label', `${label}: ${player.name}`); button.onclick = action; group.append(button); }
    actions.append(group); row.append(actions); $('#players').append(row);
  }
  if (!filtered.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 6; cell.textContent = event.players.length ? 'Niciun jucător pentru filtrele selectate.' : event.flights.length ? 'Adaugă primul jucător și stackul său pentru Ziua 2.' : 'Adaugă primul flight pentru a putea înregistra jucători.'; row.append(cell); $('#players').append(row); }
  $('#table-footer').textContent = `${filtered.length} din ${event.players.length} jucători · Salvare automată în acest browser`;
}
function openDialog(name) { const dialog = $(`#${name}-dialog`); dialog.querySelector('form').reset(); dialog.querySelector('.form-error').textContent = ''; dialog.showModal(); }
function openEvent() { openDialog('event'); const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); $('#event-form').elements.date.value = d.toISOString().slice(0,10); }
function openPlayer(player) {
  editing = player?.id || null;
  openDialog('player');
  $('#player-title').textContent = player ? 'Editează jucătorul' : 'Adaugă un jucător';
  const form = $('#player-form');
  form.elements.flightId.replaceChildren(...current().flights.map(f => option(f.id, f.name)));
  if (player) for (const field of ['name','nationality','flightId','chips']) form.elements[field].value = player[field];
}
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => button.closest('dialog').close();
$('#new-tournament').onclick = openEvent; $('#first-tournament').onclick = openEvent;
$('#new-flight').onclick = () => openDialog('flight');
$('#new-player').onclick = () => openPlayer();
$('#search').oninput = renderPlayers; $('#flight-filter').onchange = renderPlayers;
$('#event-select').onchange = e => { try { $('#search').value = ''; $('#flight-filter').value = ''; commit({ ...state, active: e.target.value }); } catch(error) { $('#notice').textContent = error.message; render(); } };
for (const name of ['event','flight','player']) $(`#${name}-form`).onsubmit = e => {
  e.preventDefault(); const form = e.target; const data = Object.fromEntries(new FormData(form));
  try {
    if (name === 'event') { const event = tournament(data.name, data.date); $('#search').value = ''; $('#flight-filter').value = ''; commit({ events: [...state.events, event], active: event.id }); }
    if (name === 'flight') update(addFlight(current(), data.name));
    if (name === 'player') update(savePlayer(current(), data, editing));
    form.closest('dialog').close();
  } catch(error) { form.querySelector('.form-error').textContent = error.message; }
};
$('#export').onclick = () => { const url = URL.createObjectURL(new Blob([csv(current())], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `clasament-${current().date}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
window.addEventListener('storage', e => { if (e.key === key) { storageUnavailable = true; $('#notice').textContent = 'Datele au fost modificate într-o altă filă. Reîncarcă pagina înainte de a continua.'; } });
render();
