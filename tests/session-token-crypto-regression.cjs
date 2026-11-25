const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const serviceSecret = 'test-only-root-secret-for-crypto-regression';
global.Deno = { env: { get(name) { if (name === 'SUPABASE_SECRET_KEYS') return JSON.stringify({ default: serviceSecret }); return undefined; } } };
function loadCrypto(relativePath) {
  const sourcePath = path.join(root, relativePath);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  const loaded = new Module(sourcePath, module);
  loaded.filename = sourcePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
  loaded._compile(compiled, sourcePath);
  return loaded.exports;
}
(async () => {
  const portal = loadCrypto('supabase/functions/veresiye-portal-login/_shared/crypto.ts');
  const proposAdmin = loadCrypto('supabase/functions/veresiye-portal-admin/_shared/crypto.ts');
  const code = '123456';
  const portalHash = await portal.hmacHex('customer-access-code', code);
  const proposHash = await proposAdmin.hmacHex('customer-access-code', code);
  assert.equal(portalHash, proposHash, 'Veresiye login and Yunus ProPOS admin must derive identical six-digit code fingerprints.');
  const now = Date.now();
  const token = await portal.signCustomerSessionToken({
    customer_id: 'customer-test-id', business_id: 'ferhat-bufe-test-id',
    code_hash: portalHash, issued_at_ms: now, exp: Math.floor(now / 1000) + 1800,
  });
  const verified = await portal.verifyCustomerSessionToken(token);
  assert.equal(verified.customer_id, 'customer-test-id');
  assert.equal(verified.business_id, 'ferhat-bufe-test-id');
  assert.equal(await portal.verifyCustomerSessionToken(`${token.slice(0, -1)}x`), null, 'tampered token must fail');
  const expired = await portal.signCustomerSessionToken({
    customer_id: 'customer-test-id', business_id: 'ferhat-bufe-test-id',
    code_hash: portalHash, issued_at_ms: now, exp: Math.floor(now / 1000) - 1,
  });
  assert.equal(await portal.verifyCustomerSessionToken(expired), null, 'expired token must fail');
  console.log('PASS: ProPOS and Veresiye produce identical access-code HMACs; signed session tokens verify and reject tampering/expiry.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
