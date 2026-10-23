const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createScoreboard} = require('../lib/scoreboard.cjs');
const api = createScoreboard();
const root = path.resolve(__dirname, '../public');
const {redirects} = require('../vercel.json');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml'};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return api(req, res);
  const redirect = redirects.find(rule => rule.source === url.pathname);
  if (redirect) {
    res.writeHead(redirect.permanent ? 308 : 307, {Location: redirect.destination});
    res.end(); return;
  }
  try {
    const file = path.resolve(root, '.' + (decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!file.startsWith(root + path.sep)) {res.writeHead(403); res.end(); return;}
    const bytes = await fs.readFile(file);
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
    res.end(bytes);
  } catch {res.writeHead(404); res.end('Not found');}
});
const port = Number(process.env.PORT) || 8000;
server.listen(port, '127.0.0.1', () => console.log(`CyPat Scoreboard: http://localhost:${port}`));
