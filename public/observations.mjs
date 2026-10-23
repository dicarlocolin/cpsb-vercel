const KEY = 'cypat-observations-v1';
const RETENTION = 7 * 24 * 60 * 60;
const MAX_SAMPLES = 3000;

// Browser-owned state survives serverless instance changes and needs no cloud credentials.
export function createObservations(storage, now = Date.now) {
  let history = new Map();
  const clocks = new Map();
  let lastSnapshot;
  try {
    const saved = JSON.parse(storage?.getItem(KEY));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [id, samples] of Object.entries(saved)) {
        if (Array.isArray(samples)) history.set(id, samples.filter(point =>
          Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && point[0] >= now()/1000 - RETENTION).slice(-MAX_SAMPLES));
      }
    }
  } catch {}
  function effectiveActivity(data, listed, fetchedAt) {
    if (!Array.isArray(listed)) return null;
    if (fetchedAt !== lastSnapshot) {
      const active = new Set(listed);
      for (const row of data) {
        const id = String(row.team_number), previous = clocks.get(id);
        const unchanged = active.has(id) && /^\d+:\d{2}:\d{2}$/.test(row.play_time) && previous?.time === row.play_time
          ? previous.unchanged + 1 : 0;
        clocks.set(id, {time: row.play_time, unchanged});
      }
      lastSnapshot = fetchedAt;
    }
    return listed.filter(id => (clocks.get(id)?.unchanged || 0) < 3);
  }
  function record(data, activeTeams, fetchedAt, followed) {
    const ids = new Set(followed.slice(0, 50));
    const active = new Set(activeTeams || []);
    const stamp = Math.floor(fetchedAt);
    history = new Map([...history].filter(([id]) => ids.has(id)));
    for (const row of data) {
      const id = String(row.team_number), score = Number(row.ccs_score);
      if (!ids.has(id) || row.ccs_score == null || row.ccs_score === '' || !Number.isFinite(score) || !Number.isFinite(stamp)) continue;
      const samples = (history.get(id) || []).filter(point => point[0] >= now()/1000 - RETENTION);
      const previous = samples.at(-1);
      if ((!previous || previous[0] < stamp) && (active.has(id) || !previous || previous[1] !== score)) samples.push([stamp, score]);
      history.set(id, samples.slice(-MAX_SAMPLES));
    }
    try {storage?.setItem(KEY, JSON.stringify(Object.fromEntries(history)));} catch {}
  }
  return {effectiveActivity, record, get: id => history.get(id) || []};
}
