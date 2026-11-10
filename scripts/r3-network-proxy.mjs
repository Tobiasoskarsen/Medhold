// Bare lokal feilinnsprøyting. Ingen app-endring, ingen nye avhengigheter.
// Target er den separate syntetiske feilappen, aldri en ekstern host.
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
const control = '.env.r3-network.local';
const logFile = 'docs/testing/r3-network-events.jsonl';
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost:3017').pathname;
  let mode = {};
  try { if (existsSync(control)) mode = JSON.parse(readFileSync(control, 'utf8')); }
  catch { /* Kontrollfilen kan være midt i en lokal oppdatering: ingen feilinnsprøyting. */ }
  const matches = req.method === 'POST' && path === mode.path;
  const record = phase => appendFileSync(logFile, JSON.stringify({ tidspunkt: new Date().toISOString(), method: req.method, path, phase, serverAction: !!req.headers['next-action'] }) + '\n');
  if (matches && mode.phase === 'before') { record('before'); req.socket.destroy(); return; }
  const upstream = request({ hostname: '127.0.0.1', port: 3015, path: req.url, method: req.method, headers: req.headers }, answer => {
    if (matches && mode.phase === 'after') {
      answer.resume(); answer.on('end', () => { record('after'); res.destroy(); }); return;
    }
    res.writeHead(answer.statusCode, answer.headers); answer.pipe(res);
  });
  upstream.on('error', () => { res.destroy(); });
  req.pipe(upstream);
});
// Next dev bruker WebSocket til oppstart/HMR. Ikke blokker den utilsiktet.
server.on('upgrade', (req, socket, head) => {
  const upstream = connect(3015, '127.0.0.1', () => {
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(req.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream); upstream.pipe(socket);
  });
  upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy());
});
server.listen(3017, '127.0.0.1', () => console.log('Lokal nettverksproxy 3017 → 3015. Ingen body, query, cookie eller tokens logges.'));
