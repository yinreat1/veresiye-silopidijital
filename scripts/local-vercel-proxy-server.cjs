const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'api/veresiye/[function].ts');
const compiled = ts.transpile(fs.readFileSync(sourcePath, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
const loaded = new Module(sourcePath, module);
loaded.filename = sourcePath;
loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
loaded._compile(compiled, sourcePath);
const handler = loaded.exports.default;

process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_local_http_test_key';
const originalFetch = global.fetch;
global.fetch = async (input, init) => {
  const target = String(input);
  if (!target.startsWith('https://ukfeuojhigxxxlnhsmls.supabase.co/functions/v1/')) {
    throw new Error('Unexpected proxy destination');
  }
  const message = String(init?.body) === '{}'
    ? 'Giriş kodu geçersiz veya erişim şu anda kapalı.'
    : 'Yerel Vercel HTTP testi: Supabase upstream mock yanıtı.';
  return new Response(JSON.stringify({ success: false, message }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
};

const server = http.createServer(async (incoming, outgoing) => {
  if (incoming.url === '/' && incoming.method === 'GET') {
    outgoing.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    outgoing.end('<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Vercel proxy HTTP smoke</title></head><body><h1>SilopiDijital Veresiye Vercel Proxy Smoke</h1><p id="status">Hazır</p></body></html>');
    return;
  }

  const url = new URL(incoming.url || '/', 'http://127.0.0.1:8788');
  const match = url.pathname.match(/^\/api\/veresiye\/([^/]+)$/);
  if (!match) {
    outgoing.writeHead(404); outgoing.end('not found'); return;
  }

  const chunks = [];
  for await (const chunk of incoming) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  let body;
  if (rawBody) {
    try { body = JSON.parse(rawBody); }
    catch { body = rawBody; }
  }

  const req = {
    method: incoming.method,
    headers: incoming.headers,
    query: { function: decodeURIComponent(match[1]) },
    body,
  };
  const res = {
    status(code) { outgoing.statusCode = code; return this; },
    setHeader(name, value) { outgoing.setHeader(name, value); return this; },
    send(value) { outgoing.end(value); return this; },
    json(value) { outgoing.end(JSON.stringify(value)); return this; },
    end() { outgoing.end(); return this; },
  };
  try { await handler(req, res); }
  catch (error) { outgoing.statusCode = 500; outgoing.end(JSON.stringify({ error: 'local handler failure' })); }
});

server.listen(8788, '127.0.0.1', () => process.stdout.write('READY http://127.0.0.1:8788\n'));
process.on('SIGTERM', () => server.close(() => { global.fetch = originalFetch; process.exit(0); }));
