// HTTP RPC + WebSocket change feed (shared/api.ts transport). Listens on 0.0.0.0 so phones on the LAN can connect.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { DEFAULT_PORT, type ApiResponse, type OpName, type ServerPush } from '../../shared/api.ts';
import type { ID } from '../../shared/types.ts';

// Load server/.env before any module that reads configuration from process.env is evaluated.
const envFile = join(import.meta.dirname, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { handlers } = await import('./ops.ts');
const { directorInfo } = await import('./director.ts');
const store = await import('./store.ts');

const PORT = Number(process.env.PORT ?? DEFAULT_PORT);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const HEARTBEAT_MS = 30_000;
/** The exported web app (npx expo export -p web), served from the same origin when present (Fly.io deploys). */
const WEB_DIR = resolve(process.env.WEB_DIR ?? join(import.meta.dirname, '..', '..', 'dist'));
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

/** A file from the web build, else index.html so the client router handles deep links. False when there's no build. */
function serveWeb(pathname: string, res: ServerResponse): boolean {
  const index = join(WEB_DIR, 'index.html');
  if (!existsSync(index)) return false;
  let file = index;
  try {
    file = resolve(WEB_DIR, `.${decodeURIComponent(pathname)}`);
  } catch {
    // Malformed escape: serve the app shell.
  }
  if (!file.startsWith(WEB_DIR + sep) || !existsSync(file) || !statSync(file).isFile()) file = index;
  const hashed = file.includes(`${sep}_expo${sep}`) || file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
  return true;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) throw new Error('Request body too large (max 2 MB)');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large (max 2 MB)');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error('Request body is not valid JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Request body must be a JSON object');
  if (tooDeep(body)) throw new Error(`Request body is nested deeper than ${MAX_DEPTH} levels`);
  return body;
}

// A pathologically deep object would later overflow structuredClone/JSON.stringify and brick the store.
const MAX_DEPTH = 32;
function tooDeep(root: unknown): boolean {
  const stack: [unknown, number][] = [[root, 1]];
  while (stack.length) {
    const [value, depth] = stack.pop()!;
    if (!value || typeof value !== 'object') continue;
    if (depth > MAX_DEPTH) return true;
    for (const child of Object.values(value)) stack.push([child, depth + 1]);
  }
  return false;
}

const server = createServer(async (req, res) => {
  const started = performance.now();
  const url = URL.parse(req.url ?? '/', 'http://localhost');
  if (!url) return send(res, 400, { ok: false, error: 'Bad request' } satisfies ApiResponse<never>);
  res.on('finish', () => {
    console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Math.round(performance.now() - started)}ms`);
  });
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');

  if (req.method === 'OPTIONS') return void res.writeHead(204).end();
  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true, director: directorInfo(), projects: store.list().length });
  }
  const op = url.pathname.startsWith('/api/') ? url.pathname.slice('/api/'.length) : '';
  if (req.method === 'GET' && !op && serveWeb(url.pathname, res)) return;
  if (req.method !== 'POST' || !op) return send(res, 404, { ok: false, error: 'Not found' } satisfies ApiResponse<never>);
  if (!Object.hasOwn(handlers, op)) return send(res, 404, { ok: false, error: `Unknown op: ${op}` } satisfies ApiResponse<never>);

  try {
    const args = await readJson(req);
    const result = await handlers[op as OpName](args as never);
    send(res, 200, { ok: true, result } satisfies ApiResponse<unknown>);
  } catch (err) {
    // Plain Errors are deliberate refusals (validation, permissions); anything else is a bug worth a stack.
    if (!(err instanceof Error) || err.constructor !== Error) console.error(`[${op}]`, err);
    const error = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) send(res, 400, { ok: false, error } satisfies ApiResponse<never>);
  }
});

// ── WebSocket change feed: /ws?projectId=… ──

const wss = new WebSocketServer({ noServer: true });
const rooms = new Map<ID, Set<WebSocket>>(); // ponytail: rooms are never pruned; bounded by project count.
const alive = new WeakSet<WebSocket>();

server.on('upgrade', (req, socket, head) => {
  const url = URL.parse(req.url ?? '/', 'http://localhost');
  const projectId = url?.searchParams.get('projectId');
  if (url?.pathname !== '/ws' || !projectId || !store.has(projectId)) {
    socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const room = rooms.get(projectId) ?? new Set<WebSocket>();
    rooms.set(projectId, room);
    room.add(ws);
    alive.add(ws);
    ws.on('pong', () => alive.add(ws));
    ws.on('close', () => room.delete(ws));
    ws.on('error', () => ws.terminate());
  });
});

store.onChange((projectId, version) => {
  const message = JSON.stringify({ type: 'changed', projectId, version } satisfies ServerPush);
  for (const ws of rooms.get(projectId) ?? []) if (ws.readyState === WebSocket.OPEN) ws.send(message);
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, HEARTBEAT_MS).unref();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    store.flush();
    process.exit(0);
  });
}

server.listen(PORT, '0.0.0.0', () => {
  const { engine, model } = directorInfo();
  console.log(`Narrative Rehearsal server on port ${PORT} — Director: ${engine}${model ? ` (${model})` : ''}`);
  for (const a of Object.values(networkInterfaces()).flat()) {
    if (a?.family === 'IPv4' && !a.internal) console.log(`  LAN: http://${a.address}:${PORT}`);
  }
});
