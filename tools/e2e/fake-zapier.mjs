#!/usr/bin/env node
// A stand-in for Zapier "Catch Hook" URLs, for end-to-end tests.
//   node tools/e2e/fake-zapier.mjs            (PORT=4010)
//   POST /hook, /hook/email, /hook/crm        -> stored, answers {ok:true} (or 500 while `fail` is set)
//   GET  /events                              -> everything received so far
//   DELETE /events                            -> clear
//   POST /control {"fail": 2}                 -> answer the next 2 deliveries with HTTP 500
import http from 'node:http';

const port = Number(process.env.PORT ?? 4010);
const received = [];
let failNext = 0;

const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/';
  const send = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'POST' && url.startsWith('/hook')) {
    const raw = await readBody(req);
    if (failNext > 0) {
      failNext--;
      return send(500, { ok: false });
    }
    let body = null;
    try { body = JSON.parse(raw); } catch { /* keep raw */ }
    received.push({ path: url, headers: req.headers, body, raw, at: new Date().toISOString() });
    return send(200, { ok: true });
  }
  if (req.method === 'POST' && url === '/control') {
    const c = JSON.parse((await readBody(req)) || '{}');
    if (typeof c.fail === 'number') failNext = c.fail;
    return send(200, { ok: true, failNext });
  }
  if (req.method === 'GET' && url === '/events') return send(200, received);
  if (req.method === 'DELETE' && url === '/events') {
    received.length = 0;
    return send(200, { ok: true });
  }
  send(404, { error: 'not found' });
});
server.listen(port, '127.0.0.1', () => console.log(`fake zapier on http://127.0.0.1:${port}`));
