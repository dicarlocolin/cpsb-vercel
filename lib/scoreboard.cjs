const {totalVulns} = require('./vulns.cjs');

// Cache only to reduce upstream traffic; correctness never depends on instance memory.
function createScoreboard({fetchJSON = async (url, signal) => {
  const response = await fetch(url, {headers: {'Cache-Control': 'no-cache'}, signal});
  if (!response.ok) throw Error('Upstream request failed');
  return response.json();
}, now = Date.now} = {}) {
  const cache = new Map();
  const pending = new Map();
  async function remote(endpoint, ttl, signal) {
    const old = cache.get(endpoint);
    if (old && now() - old.at < ttl * 1000) return old;
    if (pending.has(endpoint)) return pending.get(endpoint);
    const request = (async () => {
      const data = await fetchJSON('https://scoreboard.uscyberpatriot.org' + endpoint,
        AbortSignal.any([signal, AbortSignal.timeout(20000)]));
      if (endpoint.includes('chart.php') ? !Array.isArray(data?.rows) || !Array.isArray(data?.cols) : !Array.isArray(data?.data)) {
        throw Error('Invalid upstream response');
      }
      const value = {at: now(), data};
      if (cache.size >= 256) cache.delete(cache.keys().next().value);
      cache.set(endpoint, value);
      return value;
    })();
    pending.set(endpoint, request);
    try { return await request; } finally { pending.delete(endpoint); }
  }
  return async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, body) => {res.statusCode = status; res.end(JSON.stringify(body));};
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET'); return send(405, {error: 'Method not allowed.'});
    }
    const url = new URL(req.url, 'http://localhost');
    const ttl = url.searchParams.get('fresh') === '1' ? 0 : Math.max(15, Math.min(3600, Number(url.searchParams.get('interval')) || 60));
    const team = url.searchParams.get('team');
    const teams = [...new Set(url.searchParams.getAll('team'))];
    if (url.pathname === '/api/team' && (!team || team.length > 40)) return send(400, {error: 'Invalid team ID.'});
    if (url.pathname === '/api/scores' && (teams.length > 50 || teams.some(id => !id || id.length > 40))) {
      return send(400, {error: 'Request at most 50 valid team IDs.'});
    }
    // Bound the entire request, including batches of optional image statistics.
    const signal = AbortSignal.timeout(45000);
    try {
      if (url.pathname === '/api/scores') {
        const [scores, active] = await Promise.all([
          remote('/api/team/scores.php', ttl, signal),
          remote('/api/team/scores.php?recent=5', ttl, signal).catch(() => null)
        ]);
        const vulnTotals = Object.create(null);
        if (url.searchParams.get('vulns') === '1') {
          const requested = new Set(teams);
          const queue = scores.data.data.filter(row => requested.has(String(row.team_number)));
          async function collect() {
            while (queue.length) {
              signal.throwIfAborted();
              const id = String(queue.shift().team_number);
              try {
                const images = await remote('/api/image/scores.php?' + new URLSearchParams({team: id}), ttl, signal);
                vulnTotals[id] = totalVulns(images.data.data);
              } catch { vulnTotals[id] = {found: null, remaining: null}; }
            }
          }
          await Promise.all(Array.from({length: Math.min(4, queue.length)}, collect));
        }
        return send(200, {data: scores.data.data, fetchedAt: scores.at / 1000,
          activeTeams: active ? active.data.data.map(row => String(row.team_number)) : null,
          activeFetchedAt: active ? active.at / 1000 : null, vulnTotals});
      }
      if (url.pathname === '/api/team') {
        const query = '?' + new URLSearchParams({team});
        const [chart, images] = await Promise.all([
          remote('/api/image/chart.php' + query, ttl, signal),
          remote('/api/image/scores.php' + query, ttl, signal)
        ]);
        return send(200, {chart: chart.data, images: images.data});
      }
      return send(404, {error: 'Not found.'});
    } catch {
      return send(502, {error: 'Scoreboard unavailable. Please try again shortly.'});
    }
  };
}
module.exports = {createScoreboard};
