import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tournament, addFlight, savePlayer, ranking, csv } from '../public/model.js';
function fixture() { return addFlight(tournament('Main Event', '2026-11-02'), '1A'); }
test('tournament, flight, player and chip edit preserve identities', () => {
  let event = fixture();
  event = savePlayer(event, { name: ' Ana ', nationality: 'ro', chips: '125000', flightId: event.flights[0].id });
  const player = event.players[0];
  assert.equal(player.name, 'Ana'); assert.equal(player.nationality, 'RO');
  event = savePlayer(event, { ...player, chips: '230000' }, player.id);
  assert.equal(event.players.length, 1); assert.equal(event.players[0].chips, 230000); assert.equal(event.players[0].id, player.id);
});
test('ranking sorts descending, shares ranks and does not mutate source', () => {
  const players = [{name:'Z',chips:10},{name:'B',chips:20},{name:'A',chips:20},{name:'C',chips:0}];
  assert.deepEqual(ranking(players).map(p => [p.name,p.rank]), [['A',1],['B',1],['Z',3],['C',4]]);
  assert.equal(players[0].name, 'Z');
});
test('invalid stacks, flights and nationalities are rejected', () => {
  const event = fixture(), input = {name:'Ana',nationality:'RO',chips:'0',flightId:event.flights[0].id};
  for (const chips of ['', '-1', '1.5', 'NaN', '9007199254740992']) assert.throws(() => savePlayer(event, {...input,chips}));
  assert.throws(() => savePlayer(event, {...input,flightId:'missing'}));
  assert.throws(() => savePlayer(event, {...input,nationality:'Romania'}));
  assert.throws(() => addFlight(event,'1a'));
  assert.equal(savePlayer(event,input).players[0].chips,0);
});
test('CSV exports rank and flight, escapes quotes and spreadsheet formulas', () => {
  let event = fixture();
  event = savePlayer(event,{name:'=A"B',nationality:'GB',chips:'100',flightId:event.flights[0].id});
  const output = csv(event);
  assert.ok(output.startsWith('\uFEFF')); assert.ok(output.includes('"\'=A""B"')); assert.ok(output.includes('"1A","100"'));
});
test('tournaments isolate their flights and players', () => {
 const a=fixture(), b=fixture();
 const updated=savePlayer(a,{name:'Ana',nationality:'RO',chips:'100',flightId:a.flights[0].id});
 assert.equal(b.players.length,0); assert.equal(a.players.length,0); assert.equal(updated.players.length,1);
});
