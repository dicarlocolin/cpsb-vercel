const {test} = require('node:test');
const assert = require('node:assert/strict');

test('browser history persists across reloads, skips inactive duplicates and records final changes', async () => {
  const {createObservations} = await import('../public/observations.mjs');
  let saved;
  const storage = {getItem: () => saved, setItem: (_, value) => {saved = value;}};
  const stamp = 1800000000;
  const history = createObservations(storage, () => stamp * 1000);
  const rows = score => [{team_number: '19-a', ccs_score: score}, {team_number: 'unfollowed', ccs_score: 20}];
  history.record(rows(20), ['19-a'], stamp, ['19-a']);
  history.record(rows(20), ['19-a'], stamp + 1, ['19-a']);
  history.record(rows(20), [], stamp + 2, ['19-a']);
  history.record(rows(30), [], stamp + 3, ['19-a']);
  history.record(rows(40), [], stamp + 3, ['19-a']);
  assert.deepEqual(history.get('19-a'), [[stamp, 20], [stamp + 1, 20], [stamp + 3, 30]]);
  assert.deepEqual(history.get('unfollowed'), []);
  const reloaded = createObservations(storage, () => stamp * 1000);
  assert.deepEqual(reloaded.get('19-a'), history.get('19-a'));
  reloaded.record([], [], stamp + 4, []); assert.deepEqual(reloaded.get('19-a'), []);
});

test('activity counters count distinct polls, pause after three unchanged clocks, and recover', async () => {
  const {createObservations} = await import('../public/observations.mjs');
  const history = createObservations();
  const row = [{team_number: '19-a', play_time: '00:10:00'}];
  const poll = stamp => history.effectiveActivity(row, ['19-a'], stamp);
  assert.deepEqual(poll(1), ['19-a']);
  for (let i = 0; i < 5; i++) assert.deepEqual(poll(1), ['19-a']);
  assert.deepEqual(poll(2), ['19-a']); assert.deepEqual(poll(3), ['19-a']);
  assert.deepEqual(poll(4), []);
  assert.equal(history.effectiveActivity(row, null, 5), null);
  row[0].play_time = '00:10:05'; assert.deepEqual(poll(6), ['19-a']);
});

test('history handles corrupt or unavailable storage and bounds retained samples', async () => {
  const {createObservations} = await import('../public/observations.mjs');
  const stamp = 1800000000;
  const storage = {getItem: () => JSON.stringify({'19-a': [[stamp - 8*86400, 1], [stamp, 2], ['bad', 3]]}), setItem: () => {throw Error('quota');}};
  const history = createObservations(storage, () => stamp*1000);
  assert.deepEqual(history.get('19-a'), [[stamp, 2]]);
  for (let i = 1; i <= 3001; i++) history.record([{team_number: '19-a', ccs_score: i}], ['19-a'], stamp + i, ['19-a']);
  assert.equal(history.get('19-a').length, 3000);
  assert.equal(history.get('19-a').at(-1)[1], 3001);
  const broken = createObservations({getItem: () => '{bad', setItem: () => {throw Error('disabled');}});
  broken.record([{team_number: '__proto__', ccs_score: 12}], [], Date.now()/1000, ['__proto__']);
  assert.equal(broken.get('__proto__')[0][1], 12);
});
