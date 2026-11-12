// Facets game server: serves the built game (dist/) and runs online rooms over WebSocket at /ws.
//
//   npm run build && npm start          # production (PORT env var, default 8787)
//   npm run dev:server                  # development, next to `npm run dev`
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { WebSocketServer, type WebSocket } from 'ws';
import { RoomManager } from './rooms';

const PORT = Number(process.env.PORT) || 8787;
const DIST = resolve(process.env.FACETS_DIST ?? 'dist');
const MAX_MESSAGE_BYTES = 16 * 1024;
const MESSAGES_PER_10S = 60;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function startServer(port = PORT, opts: { quiet?: boolean; aiDelayMs?: number } = {}) {
  const rooms = new RoomManager({ aiDelayMs: opts.aiDelayMs });
  const sweep = setInterval(() => rooms.sweep(), 5 * 60 * 1000);
  sweep.unref();

  const http = createServer((req, res) => serveStatic(req, res, rooms));
  const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });

  wss.on('connection', (ws: WebSocket) => {
    const id = randomUUID();
    let alive = true;
    let windowStart = Date.now();
    let count = 0;
    rooms.connect(id, (msg) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    });
    ws.on('pong', () => (alive = true));
    ws.on('message', (data) => {
      const now = Date.now();
      if (now - windowStart > 10_000) {
        windowStart = now;
        count = 0;
      }
      if (++count > MESSAGES_PER_10S) return ws.send(JSON.stringify({ t: 'error', message: 'Too many messages — slow down.' }));
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(data));
      } catch {
        return ws.send(JSON.stringify({ t: 'error', message: 'Malformed message.' }));
      }
      try {
        rooms.handle(id, parsed);
      } catch (e) {
        console.error('room error', e);
        ws.send(JSON.stringify({ t: 'error', message: 'Something went wrong on the server.' }));
      }
    });
    ws.on('close', () => rooms.disconnect(id));
    // keep-alive: drop connections that stop answering pings
    const ping = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
      ws.ping();
    }, 25_000);
    ws.on('close', () => clearInterval(ping));
  });

  http.listen(port, () => {
    if (!opts.quiet) console.log(`Facets server on http://localhost:${port} (serving ${DIST})`);
  });
  return {
    http,
    wss,
    rooms,
    close: () =>
      new Promise<void>((done) => {
        clearInterval(sweep);
        for (const c of wss.clients) c.terminate();
        wss.close(() => http.close(() => done()));
      }),
  };
}

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg']);
/** Compressed copies of text files, made once per file version and kept in memory. */
const compressed = new Map<string, { mtime: number; br: Buffer; gz: Buffer }>();
function compressedCopy(file: string) {
  const mtime = statSync(file).mtimeMs;
  const hit = compressed.get(file);
  if (hit && hit.mtime === mtime) return hit;
  const raw = readFileSync(file);
  const entry = {
    mtime,
    br: brotliCompressSync(raw, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 10 } }),
    gz: gzipSync(raw, { level: 9 }),
  };
  compressed.set(file, entry);
  return entry;
}

function serveStatic(req: IncomingMessage, res: ServerResponse, rooms: RoomManager) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.roomCount() }));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  // resolve inside DIST only (no path traversal); unknown paths fall back to the app
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, rel);
  if (!file.startsWith(DIST)) file = join(DIST, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(503, { 'content-type': 'text/plain' });
    return res.end('The game has not been built yet. Run `npm run build` first.');
  }
  const type = MIME[extname(file)] ?? 'application/octet-stream';
  const immutable = file.includes(`${DIST}/assets/`);
  const headers: Record<string, string> = {
    'content-type': type,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
    vary: 'accept-encoding',
  };
  const accept = String(req.headers['accept-encoding'] ?? '');
  const encoding = !COMPRESSIBLE.has(extname(file)) ? null : /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
  if (encoding) {
    const copy = compressedCopy(file);
    const body = encoding === 'br' ? copy.br : copy.gz;
    res.writeHead(200, { ...headers, 'content-encoding': encoding, 'content-length': String(body.length) });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

// run directly (not when imported by tests)
if (process.argv[1] && resolve(process.argv[1]).endsWith(join('server', 'index.ts'))) {
  startServer();
}
