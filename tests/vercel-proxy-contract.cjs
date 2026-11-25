const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'api/veresiye/[function].ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
const loaded = new Module(sourcePath, module);
loaded.filename = sourcePath;
loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
loaded._compile(compiled, sourcePath);
const handler = loaded.exports.default;
assert.equal(typeof handler, 'function', 'Vercel API route must export a default handler');

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    send(body) { this.body = body; return this; },
    json(body) { this.body = body; return this; },
    end() { this.body = ''; return this; },
  };
}

function makeRequest({ method = 'POST', fn = 'veresiye-portal-login', body = {}, headers = {} } = {}) {
  return {
    method,
    query: { function: fn },
    headers: { 'content-type': 'application/json', ...headers },
    body,
  };
}

async function call(options) {
  const req = makeRequest(options);
  const res = makeResponse();
  await handler(req, res);
  return res;
}

(async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiJ9.stale-invalid-key';
  const originalSecret = process.env.VERESIYE_PROXY_SHARED_SECRET;
  let upstreamCalls = 0;
  let lastUpstream = null;
  try {
    global.fetch = async (input, init) => {
      upstreamCalls += 1;
      lastUpstream = { url: String(input), init };
      const message = String(init.body) === '{}'
        ? 'Giriş kodu geçersiz veya erişim şu anda kapalı.'
        : 'Beklenen test cevabı.';
      return new Response(JSON.stringify({ success: false, message }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    };

    let response = await call({ method: 'OPTIONS', fn: 'unknown' });
    assert.equal(response.statusCode, 204, 'OPTIONS must return 204');
    assert.equal(upstreamCalls, 0, 'OPTIONS must not call Supabase');

    response = await call({ method: 'GET' });
    assert.equal(response.statusCode, 405, 'GET to the login route must be rejected');
    assert.equal(response.headers.allow, 'POST, OPTIONS');

    response = await call({ method: 'GET', fn: 'health' });
    assert.equal(response.statusCode, 200, 'health route should confirm a reachable Supabase Edge Function');
    assert.equal(response.body.supabase_edge_function, 'reachable');
    assert.equal(lastUpstream.init.headers.apikey, 'sb_publishable_b-cFhb97kOd3mLQnBi_SGQ_8oNQPkzS');
    assert.equal(upstreamCalls, 1, 'health should probe the login function with an empty code, which does not record a failed attempt');

    response = await call({ fn: 'not-allowed' });
    assert.equal(response.statusCode, 404, 'unknown function names must be rejected');

    response = await call({ headers: { 'content-type': 'text/plain' } });
    assert.equal(response.statusCode, 415, 'non-JSON requests must be rejected');

    response = await call({ headers: { 'content-length': '20000' } });
    assert.equal(response.statusCode, 413, 'oversized declared bodies must be rejected');

    response = await call({ body: null });
    assert.equal(response.statusCode, 400, 'missing JSON body must be rejected');

    response = await call({ body: '{not json' });
    assert.equal(response.statusCode, 400, 'invalid JSON must be rejected');

    response = await call({ body: 'x'.repeat(16 * 1024 + 1) });
    assert.equal(response.statusCode, 413, 'oversized JSON body must be rejected');

    const body = { code: '123456' };
    response = await call({
      fn: 'veresiye-portal-login',
      body,
      headers: {
        'x-forwarded-for': '203.0.113.18, 10.0.0.1',
        'x-veresiye-client-ip': '198.51.100.44',
      },
    });
    assert.equal(response.statusCode, 401, 'upstream status must pass through');
    assert.equal(upstreamCalls, 2, 'health and valid login must reach the mocked upstream');
    assert.equal(lastUpstream.url, 'https://ukfeuojhigxxxlnhsmls.supabase.co/functions/v1/veresiye-portal-login');
    assert.equal(lastUpstream.init.headers.apikey, 'sb_publishable_b-cFhb97kOd3mLQnBi_SGQ_8oNQPkzS');
    assert.equal(lastUpstream.init.headers['X-Veresiye-Proxy-Secret'], undefined, 'no shared proxy secret is required by the existing public code-login function');
    assert.equal(lastUpstream.init.headers['X-Veresiye-Client-IP'], '203.0.113.18');
    assert.equal(lastUpstream.init.headers.Authorization, undefined, 'publishable key stays in apikey only; do not send a non-JWT publishable key as Bearer');
    assert.equal(lastUpstream.init.headers['X-Veresiye-Client-IP'], '203.0.113.18', 'browser-supplied spoofed client IP must be ignored');
    assert.equal(lastUpstream.init.body, JSON.stringify(body));
    assert.equal(response.headers['cache-control'], 'no-store, max-age=0');
    assert.deepEqual(response.body, JSON.stringify({ success: false, message: 'Beklenen test cevabı.' }));

    global.fetch = async () => { throw new Error('simulated upstream outage'); };
    const originalConsoleError = console.error;
    console.error = () => {}; // Expected test-only upstream error; keep successful test output clean.
    try {
      response = await call();
    } finally {
      console.error = originalConsoleError;
    }
    assert.equal(response.statusCode, 502, 'upstream outage must be translated to 502');
    assert.match(response.body.message, /ulaşılamıyor/);

    console.log('PASS: Vercel API contract — OPTIONS, method/path allow-list, JSON validation, body limits, pinned publishable key, Vercel client-IP forwarding, upstream passthrough, no-store headers, and upstream failure handling. Supabase upstream is mocked.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
})();
