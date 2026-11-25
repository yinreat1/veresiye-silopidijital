const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const serverPath = path.join(root, 'scripts/local-vercel-proxy-server.cjs');

(async () => {
  const server = spawn(process.execPath, [serverPath], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  server.stdout.setEncoding('utf8');
  server.stderr.setEncoding('utf8');
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });

  const waitForServer = async () => {
    const start = Date.now();
    while (Date.now() - start < 5000) {
      if (output.includes('READY http://127.0.0.1:8788')) return;
      if (server.exitCode !== null) throw new Error(`Local Vercel proxy server exited early: ${output}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Local Vercel proxy server did not start: ${output}`);
  };

  try {
    await waitForServer();

    let response = await fetch('http://127.0.0.1:8788/');
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Vercel proxy HTTP smoke/);

    response = await fetch('http://127.0.0.1:8788/api/veresiye/health');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).supabase_edge_function, 'reachable');

    response = await fetch('http://127.0.0.1:8788/api/veresiye/veresiye-portal-login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: '123456' }),
    });
    assert.equal(response.status, 401, 'mock upstream status must pass through over HTTP');
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.match((await response.json()).message, /Yerel Vercel HTTP testi/);

    response = await fetch('http://127.0.0.1:8788/api/veresiye/not-allowed', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(response.status, 404, 'unknown API path must be rejected over HTTP');

    response = await fetch('http://127.0.0.1:8788/api/veresiye/veresiye-portal-login');
    assert.equal(response.status, 405, 'GET must be rejected over HTTP');

    response = await fetch('http://127.0.0.1:8788/api/veresiye/veresiye-portal-login', {
      method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x',
    });
    assert.equal(response.status, 415, 'non-JSON request must be rejected over HTTP');

    console.log('PASS: local Vercel API HTTP integration — static shell, allowed proxy POST, upstream status/body forwarding, no-store caching, unknown path/method rejection, and content-type validation. Supabase upstream is mocked.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolve) => {
      if (server.exitCode !== null) return resolve();
      server.once('exit', resolve);
      setTimeout(resolve, 1500);
    });
  }
})();
