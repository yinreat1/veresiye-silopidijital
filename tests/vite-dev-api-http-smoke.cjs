const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'vite.config.ts');
const source = fs.readFileSync(sourcePath, 'utf8').replace('import.meta.url', "new URL('./vite.config.ts', 'file://' + __filename).href");
const compiled = ts.transpile(source, {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
});
const mockModule = { exports: {} };
function mockRequire(request) {
  if (request === 'vite') return { defineConfig: (config) => config, loadEnv: () => ({}) };
  if (request === '@vitejs/plugin-react') return { default: () => ({ name: 'test-react-plugin' }) };
  return require(request);
}
new Function('exports', 'require', 'module', '__filename', '__dirname', compiled)(
  mockModule.exports, mockRequire, mockModule, sourcePath, path.dirname(sourcePath),
);

function makeRequest({ method, url, body = '', headers = {} }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.socket = { remoteAddress: '127.0.0.1' };
  return req;
}
function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(body = '') { this.body = String(body); },
  };
}
async function invoke(middleware, { method, url, body = '', headers = {} }) {
  const req = makeRequest({ method, url, body, headers });
  const res = makeResponse();
  const pending = middleware(req, res, () => { res.statusCode = 404; res.body = 'next'; });
  if (body) req.emit('data', Buffer.from(body));
  req.emit('end');
  await pending;
  return res;
}

(async () => {
  const viteConfig = mockModule.exports.default({ mode: 'development' });
  const plugin = viteConfig.plugins.find((item) => item.name === 'silopidijital-veresiye-dev-api');
  assert.ok(plugin, 'Vite dev API plugin must be registered');
  let middleware;
  plugin.configureServer({ middlewares: { use(handler) { middleware = handler; } } });
  assert.equal(typeof middleware, 'function');

  const originalFetch = global.fetch;
  let upstreamUrl = '';
  let upstreamInit = null;
  try {
    global.fetch = async (input, init) => {
      upstreamUrl = String(input);
      upstreamInit = init;
      if (String(init?.body) === '{}') {
        return new Response(JSON.stringify({ success: false, message: 'Giriş kodu geçersiz veya erişim şu anda kapalı.' }), {
          status: 401, headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, customer: { id: 'c1' }, transactions: [], session_token: 'signed-token' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    };

    let response = await invoke(middleware, { method: 'GET', url: '/api/veresiye/health' });
    assert.equal(response.statusCode, 200, 'health must no longer return Vite 404');
    assert.equal(JSON.parse(response.body).success, true);
    assert.equal(upstreamUrl, 'https://ukfeuojhigxxxlnhsmls.supabase.co/functions/v1/veresiye-portal-login');

    response = await invoke(middleware, {
      method: 'POST',
      url: '/api/veresiye/veresiye-portal-login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    });
    assert.equal(response.statusCode, 200, 'POST customer login must be forwarded instead of Vite 404');
    assert.equal(JSON.parse(response.body).session_token, 'signed-token');
    assert.equal(upstreamUrl, 'https://ukfeuojhigxxxlnhsmls.supabase.co/functions/v1/veresiye-portal-login');
    assert.equal(upstreamInit.headers.apikey, 'sb_publishable_b-cFhb97kOd3mLQnBi_SGQ_8oNQPkzS');
    assert.equal(upstreamInit.headers['X-Veresiye-Client-IP'], '127.0.0.1');
    assert.equal(upstreamInit.headers.Authorization, undefined, 'dev proxy must never add a service-role Authorization header');

    response = await invoke(middleware, { method: 'POST', url: '/api/veresiye/not-allowed', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(response.statusCode, 404, 'unknown routes must be rejected');

    response = await invoke(middleware, { method: 'POST', url: '/api/veresiye/veresiye-portal-login', headers: { 'content-type': 'text/plain' }, body: '{}' });
    assert.equal(response.statusCode, 415, 'non-JSON requests must be rejected');

    console.log('PASS: Vite dev HTTP middleware — GET health, POST customer login passthrough, publishable key, client IP, allow-list, and content-type checks. Supabase upstream is mocked.');
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
