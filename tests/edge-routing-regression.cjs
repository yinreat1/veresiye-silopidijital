const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const login = read('supabase/functions/veresiye-portal-login/index.ts');
const admin = read('supabase/functions/veresiye-portal-admin/index.ts');
const customerLogin = read('src/lib/veresiye.ts');
const dev = read('vite.config.ts');
const vercel = read('api/veresiye/[function].ts');

assert.match(login, /hmacHex\('customer-access-code', code\)/, 'customer access codes must be checked as a server-side HMAC');
assert.match(login, /\.eq\('is_active', true\)/, 'disabled customer access must be rejected');
assert.match(login, /veresiye_portal_register_login_attempt/, 'public code login must remain rate limited in the database');
assert.match(login, /p_ip_hash: ipHash/, 'login throttling must include a server-observed IP fingerprint');
assert.match(login, /signCustomerSessionToken/, 'remembered customer login must use a signed token');
assert.match(login, /verifyCustomerSessionToken/, 'remembered sessions must be validated server-side');
assert.doesNotMatch(login, /hasTrustedPortalProxy|VERESIYE_PROXY_SHARED_SECRET/, 'public code login must not require an unset proxy secret');

assert.match(admin, /verify_staff_pin/, 'ProPOS admin PIN must still be verified server-side');
assert.match(admin, /verifyAdminToken/, 'admin actions must use the short-lived signed token');
assert.match(admin, /\.eq\('role', 'admin'\)/, 'only active ProPOS admins may manage customer access');
assert.doesNotMatch(admin, /hasTrustedPortalProxy|VERESIYE_PROXY_SHARED_SECRET/, 'ProPOS desktop calls the admin function directly');

assert.match(customerLogin, /if \(error\) throw new Error\(error\.message/, 'client must surface actual proxy/server errors');
assert.match(dev, /server\.middlewares\.use/, 'Vite dev must route same-origin API requests instead of returning 404');
assert.match(vercel, /functionName === 'health'/, 'Vercel API must expose a safe upstream health endpoint');
assert.doesNotMatch(vercel, /VERESIYE_PROXY_SHARED_SECRET|X-Veresiye-Proxy-Secret/, 'Vercel proxy must not depend on an unconfigured shared secret');

console.log('PASS: customer HMAC + DB rate limit, signed remembered sessions, admin PIN + signed token, Vite development API route and Vercel production route.');
