const {test} = require('node:test');
const assert = require('node:assert/strict');

async function fixture(address, storage) {
  const {applyPreset} = await import('../public/presets.mjs');
  const url = new URL(address, 'https://cpsb.vercel.app');
  const history = {state: {existing: true}, replaceState(state, title, address) {this.address = address; this.replacedState = state;}};
  const config = applyPreset(url, storage, history);
  return {config, history};
}

test('LASA preset replaces saved settings with all requested teams, columns and formulas', async () => {
  let saved = JSON.stringify({name: 'Existing scoreboard'});
  const {config, history} = await fixture('/?preset=lasa', {setItem(key, value) {assert.equal(key, 'cypat-config'); saved = value;}});
  assert.deepEqual(JSON.parse(saved), config);
  assert.equal(config.name, 'LASA CyberPatriot');
  assert.deepEqual(config.teams.split('\n'), [
    '19-3340, virus.exe', '19-1119, rm -rf /', `19-3341, under 5'4"`,
    '19-3342, iNc0gnITo mOd3!', '19-1120, Mango Company', '19-1121, Goodbye World',
    '19-1122, ABOVE all', '19-1123, cisCOPE', '19-1033, cache me if you can',
    '19-3343, Team A', '19-1034, The Other Cavaliers', '19-1035, The Amateurs',
    '19-1036, <404RiceNotFound>', '19-1037, Team C'
  ]);
  assert.equal(config.format, 'HH:MM:SS');
  assert.equal(config.localTimes, true);
  assert.equal(config.refreshSeconds, 30);
  assert.deepEqual(config.columns, ['Pos', 'Overall', 'TeamID', 'TeamName', 'Score', 'TimeSeconds', 'Active', 'VulnsFound', 'VulnsRemaining', 'Warnings', 'PPM', 'PPH']);
  assert.equal(config.formulas, 'PPM = Score / TimeMinutes\nPPH = Score / TimeHours');
  assert.equal(history.address, '/');
  assert.deepEqual(history.replacedState, history.state);
});

test('ordinary visits and unknown presets preserve saved settings and the URL', async () => {
  const storage = {setItem() {assert.fail('must not overwrite saved settings');}};
  for (const address of ['/', '/?preset=unknown']) {
    const {config, history} = await fixture(address, storage);
    assert.equal(config, null);
    assert.equal(history.address, undefined);
  }
});

test('preset works for the current session when storage is unavailable', async () => {
  for (const storage of [undefined, {setItem() {throw Error('Storage blocked');}}]) {
    const {config, history} = await fixture('/?preset=lasa&other=1#scores', storage);
    assert.equal(config.name, 'LASA CyberPatriot');
    assert.equal(history.address, '/?other=1#scores');
  }
});

test('both LASA shortcut spellings redirect to the preset on the home page', () => {
  const {redirects} = require('../vercel.json');
  for (const route of ['/lasa', '/lasa/']) {
    assert.deepEqual(redirects.find(rule => rule.source === route), {source: route, destination: '/?preset=lasa', permanent: false});
  }
});
