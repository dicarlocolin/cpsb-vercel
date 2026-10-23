const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {createScoreboard} = require('../lib/scoreboard.cjs');

async function fixture(t, fetchJSON, now) {
  const server = http.createServer(createScoreboard({fetchJSON, now}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (route, options) => fetch(`http://127.0.0.1:${server.address().port}${route}`, options);
}

test('API returns scores, caches ordinary reads, and fresh requests bypass cache', async t => {
  let calls = 0;
  const request = await fixture(t, async () => {calls++; return {data: [{team_number: '19-a', ccs_score: 20}]};});
  let response = await request('/api/scores');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json();
  assert.deepEqual(data.activeTeams, ['19-a']);
  assert.equal(data.data[0].ccs_score, 20);
  await request('/api/scores'); assert.equal(calls, 2);
  await request('/api/scores?fresh=1'); assert.equal(calls, 4);
});

test('cold function instances serve details without a local history file', async t => {
  const calls = [];
  const request = await fixture(t, async address => {
    calls.push(address);
    return address.includes('chart.php') ? {cols: [], rows: []} : {data: [{image: 'Windows', ccs_score: 50}]};
  });
  const response = await request('/api/team?team=19-a&fresh=1');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.chart, {cols: [], rows: []});
  assert.equal(body.images.data[0].ccs_score, 50);
  assert.equal(calls.length, 2);
  assert.equal((await request('/api/team')).status, 400);
  assert.equal((await request('/api/team?team=' + 'a'.repeat(41))).status, 400);
});

test('activity and optional image failures degrade gracefully; score failures return 502', async t => {
  let broken = false;
  const request = await fixture(t, async address => {
    if (broken || address.includes('recent=5') || address.includes('/image/')) throw Error('offline');
    return {data: [{team_number: '19-a', ccs_score: 20}]};
  });
  let response = await request('/api/scores?vulns=1&team=19-a&fresh=1');
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.activeTeams, null);
  assert.deepEqual(body.vulnTotals['19-a'], {found: null, remaining: null});
  broken = true;
  response = await request('/api/scores?fresh=1');
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /Scoreboard unavailable/);
});

test('optional image requests cover only requested teams and preserve unknown totals', async t => {
  const ids = [];
  const request = await fixture(t, async address => {
    const url = new URL(address);
    if (url.pathname.includes('/image/')) {
      ids.push(url.searchParams.get('team'));
      return {data: [{found: '3', remaining: 0}, {found: 2, remaining: null}]};
    }
    return {data: [{team_number: '19-a'}, {team_number: '19-b'}]};
  });
  await request('/api/scores'); assert.deepEqual(ids, []);
  const body = await (await request('/api/scores?vulns=1&team=19-a&team=missing')).json();
  assert.deepEqual(ids, ['19-a']);
  assert.deepEqual(body.vulnTotals, {'19-a': {found: 5, remaining: null}});
});

test('API rejects writes, oversized batches, unknown routes and malformed upstream JSON', async t => {
  const request = await fixture(t, async () => ({}));
  const response = await request('/api/scores', {method: 'POST'});
  assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET');
  assert.equal((await request('/api/unknown')).status, 404);
  assert.equal((await request('/api/scores?' + Array.from({length: 51}, (_, i) => 'team=' + i).join('&'))).status, 400);
  assert.equal((await request('/api/scores')).status, 502);
});
