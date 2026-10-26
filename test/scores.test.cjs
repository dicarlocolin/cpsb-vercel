const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scoresModule = import('../public/scores.mjs');

test('scores use the public total and correct NetAcad components, preserving adjustments and zeroes', async () => {
  const {teamScores} = await scoresModule;
  assert.deepEqual(teamScores({ccs_score: '200', score_1: '10.25', score_2: '20.5', total: '225.75'}), {
    Score: 225.75, CCSScore: 200, NetAcadQuiz: 10.25, NetAcadPT: 20.5
  });
  assert.deepEqual(teamScores({ccs_score: 0, score_1: '0.00', score_2: 0, total: '0'}), {
    Score: 0, CCSScore: 0, NetAcadQuiz: 0, NetAcadPT: 0
  });
});

test('unavailable scores remain unavailable instead of showing zero or an incomplete total', async () => {
  const {teamScores} = await scoresModule;
  for (const invalid of [undefined, null, '', ' ', 'null', 'invalid', Infinity]) {
    const scores = teamScores({ccs_score: invalid, total: invalid, score_1: invalid, score_2: invalid});
    assert.ok(Object.values(scores).every(Number.isNaN));
  }
  assert.ok(Object.values(teamScores()).every(Number.isNaN));
  const scores = teamScores({ccs_score: 200, score_1: 10, total: 230});
  assert.equal(scores.Score, 230);
  assert.ok(Number.isNaN(scores.NetAcadPT));
});

test('saved columns gain the total and formulas retain CCS semantics through repeated saves', async () => {
  const {migrateScoreConfig} = await scoresModule;
  const config = {
    columns: ['TeamID', 'Score', 'PPM'],
    formulas: 'PPM = Score / TimeMinutes\nScoreRate = PPM + Score',
    name: 'My teams'
  };
  const upgraded = migrateScoreConfig(config);
  assert.deepEqual(upgraded.columns, ['TeamID', 'Score', 'CCSScore', 'PPM']);
  assert.equal(upgraded.formulas, 'PPM = CCSScore / TimeMinutes\nScoreRate = PPM + CCSScore');
  assert.equal(upgraded.name, config.name);
  assert.equal(config.formulas.startsWith('PPM = Score /'), true);
  const saved = JSON.parse(JSON.stringify({...upgraded, formulas: 'PPM = Score / TimeMinutes'}));
  assert.equal(migrateScoreConfig(saved).formulas, 'PPM = Score / TimeMinutes');
  assert.deepEqual(migrateScoreConfig({...config, columns: ['TeamID']}).columns, ['TeamID']);
});

class Element {
  constructor(tag, text) {
    this.tag = tag; this.textContent = text; this.children = []; this.dataset = {};
    this.attributes = {}; this.style = {setProperty() {}}; this.classList = {add() {}};
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
}

async function harness() {
  const {teamScores} = await scoresModule;
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const fields = source.match(/ fields=(\{.*\});/)[1];
  const initialSort = source.match(/let data=\[\],sort='([^']+)',direction=(-?\d+)/);
  const elements = Object.fromEntries(['head', 'rows', 'status', 'title'].map(id => [id, new Element(id)]));
  const config = {
    name: 'Scores', teams: '19-a\n19-b\nmissing', format: 'HH:MM:SS',
    columns: ['TeamID', 'Score', 'CCSScore', 'NetAcadPT', 'NetAcadQuiz', 'PPM'],
    formulas: 'PPM = CCSScore / TimeMinutes\nNetAcad = NetAcadPT + NetAcadQuiz\nTotalRate = Score / TimeMinutes'
  };
  const context = {
    config, teamScores,
    data: [
      {team_number: '19-a', ccs_score: '200', score_1: '10', score_2: '20', total: '230', play_time: '01:00:00'},
      {team_number: '19-b', ccs_score: '190', score_1: '25', score_2: '30', total: '245', play_time: '01:00:00'}
    ],
    sort: initialSort[1], direction: Number(initialSort[2]), selected: null, vulnTotals: {}, lastFetch: 0, activeTeams: null, activeFetchedAt: 0,
    livePlayTime: seconds => seconds, imageActivity: () => null, activityLabel: () => 'Unknown',
    scoreHighlights: {get: () => null}, totalScoreHighlights: {get: () => null},
    $: id => elements[id], el: (tag, text) => new Element(tag, text)
  };
  const api = vm.runInNewContext(`const fields=${fields};\n` +
    source.slice(source.indexOf('function evaluate('), source.indexOf('async function load(')) +
    ';({rows,render,formulas})', context);
  return {api, elements};
}

test('scoreboard rows expose each score to formulas and reserve the new column names', async () => {
  const {api} = await harness();
  const [row, , missing] = api.rows();
  assert.equal(row.Score, 230); assert.equal(row.CCSScore, 200);
  assert.equal(row.NetAcadQuiz, 10); assert.equal(row.NetAcadPT, 20);
  assert.equal(row.PPM, 200 / 60); assert.equal(row.NetAcad, 30); assert.equal(row.TotalRate, 230 / 60);
  assert.ok(Number.isNaN(missing.Score)); assert.ok(Number.isNaN(missing.CCSScore));
  for (const name of ['Score', 'CCSScore', 'NetAcadQuiz', 'NetAcadPT']) {
    assert.throws(() => api.formulas(`${name} = 1`), /different column name/);
  }
});

test('table defaults to ascending position, displays Cisco headers, and sorts numeric scores with missing scores last', async () => {
  const {api, elements} = await harness();
  api.render();
  const headings = elements.head.children[0].children;
  assert.deepEqual(headings.map(th => th.children[0].textContent), ['Team ID', 'Score', 'CCS Score', 'Cisco PT', 'Cisco Quiz', 'PPM']);
  assert.deepEqual(elements.rows.children.map(row => row.dataset.teamId), ['19-a', '19-b', 'missing']);
  assert.equal(elements.rows.children[0].children[1].textContent, 230);
  assert.equal(elements.rows.children[2].children[1].textContent, '—');
  headings[1].children[0].onclick();
  assert.deepEqual(elements.rows.children.map(row => row.dataset.teamId), ['19-a', '19-b', 'missing']);
  elements.head.children[0].children[1].children[0].onclick();
  assert.deepEqual(elements.rows.children.map(row => row.dataset.teamId), ['19-b', '19-a', 'missing']);
  elements.head.children[0].children[2].children[0].onclick();
  assert.deepEqual(elements.rows.children.map(row => row.dataset.teamId), ['19-b', '19-a', 'missing']);
  elements.head.children[0].children[2].children[0].onclick();
  assert.deepEqual(elements.rows.children.map(row => row.dataset.teamId), ['19-a', '19-b', 'missing']);
  elements.head.children[0].children[4].children[0].onclick();
  assert.deepEqual(elements.rows.children.map(row => row.dataset.teamId), ['19-a', '19-b', 'missing']);
});
