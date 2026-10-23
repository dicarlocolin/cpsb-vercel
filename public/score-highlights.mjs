// Keep highlight timing separate from table renders so sorting never restarts it.
export function createScoreHighlights(now = () => performance.now()) {
  let previous = new Map();
  const changes = new Map();
  return {
    observe(rows) {
      const current = new Map(), stamp = now();
      for (const row of rows) {
        const raw = row.ccs_score, id = String(row.team_number);
        if (raw == null || String(raw).trim() === '') continue;
        const score = Number(raw);
        if (!Number.isFinite(score)) continue;
        current.set(id, score);
        if (previous.has(id) && score !== previous.get(id)) {
          changes.set(id, {color: score > previous.get(id) ? '#5789FF' : '#FF383C', started: stamp});
        }
      }
      for (const [id, change] of changes) {
        if (!current.has(id) || stamp - change.started >= 6000) changes.delete(id);
      }
      previous = current;
    },
    get(teamId) {
      const change = changes.get(teamId);
      if (!change) return null;
      const elapsed = now() - change.started;
      if (elapsed >= 6000) { changes.delete(teamId); return null; }
      return {color: change.color, elapsed};
    }
  };
}
