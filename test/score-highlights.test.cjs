const {test} = require('node:test');
const assert = require('node:assert/strict');
const modulePromise = import('../public/score-highlights.mjs');
const rows = (a, b = 20) => [{team_number: '19-a', ccs_score: a}, {team_number: '19-b', ccs_score: b}];

test('first samples and equal scores stay white; gains and losses highlight each team independently', async () => {
  const {createScoreHighlights} = await modulePromise;
  const highlights = createScoreHighlights(() => 0);
  highlights.observe(rows(10));
  assert.equal(highlights.get('19-a'), null);
  highlights.observe(rows('10'));
  assert.equal(highlights.get('19-a'), null);
  highlights.observe(rows(11, 19));
  assert.deepEqual(highlights.get('19-a'), {color: '#5789FF', elapsed: 0});
  assert.deepEqual(highlights.get('19-b'), {color: '#FF383C', elapsed: 0});
});

test('renders and unchanged polls preserve elapsed time; the highlight expires after the hold and fade', async () => {
  const {createScoreHighlights} = await modulePromise;
  let now = 0;
  const highlights = createScoreHighlights(() => now);
  highlights.observe(rows(0));
  highlights.observe(rows(5));
  now = 4999;
  assert.equal(highlights.get('19-a').elapsed, 4999);
  highlights.observe(rows(5));
  now = 5500;
  assert.deepEqual(highlights.get('19-a'), {color: '#5789FF', elapsed: 5500});
  assert.deepEqual(highlights.get('19-a'), {color: '#5789FF', elapsed: 5500});
  now = 6000;
  assert.equal(highlights.get('19-a'), null);
  highlights.observe(rows(5));
  assert.equal(highlights.get('19-a'), null);
});

test('a further score change restarts the full highlight with the latest direction', async () => {
  const {createScoreHighlights} = await modulePromise;
  let now = 0;
  const highlights = createScoreHighlights(() => now);
  highlights.observe(rows(10));
  highlights.observe(rows(20));
  now = 5500;
  highlights.observe(rows(15));
  assert.deepEqual(highlights.get('19-a'), {color: '#FF383C', elapsed: 0});
  now = 7000;
  highlights.observe(rows(16));
  assert.deepEqual(highlights.get('19-a'), {color: '#5789FF', elapsed: 0});
});

test('missing and invalid scores clear highlights and establish a fresh baseline when reporting resumes', async () => {
  const {createScoreHighlights} = await modulePromise;
  for (const invalid of [null, undefined, '', ' ', NaN, Infinity, 'invalid']) {
    const highlights = createScoreHighlights(() => 0);
    highlights.observe(rows(10));
    highlights.observe(rows(20));
    highlights.observe(rows(invalid));
    assert.equal(highlights.get('19-a'), null);
    highlights.observe(rows(30));
    assert.equal(highlights.get('19-a'), null);
  }
  const highlights = createScoreHighlights(() => 0);
  highlights.observe(rows(10));
  highlights.observe(rows(20));
  highlights.observe([]);
  assert.equal(highlights.get('19-a'), null);
  highlights.observe(rows(30));
  assert.equal(highlights.get('19-a'), null);
});
