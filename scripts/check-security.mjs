import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const failures = [];

const app = read('src/App.tsx');
const supabase = read('src/lib/supabase.ts');
const lib = read('src/lib/veresiye.ts');
const apiProxy = read('api/veresiye/[function].ts');
const loginFunction = read('supabase/functions/veresiye-portal-login/index.ts');
const adminFunction = read('supabase/functions/veresiye-portal-admin/index.ts');
const serviceWorker = read('public/sw.js');
const viteConfig = read('vite.config.ts');
const envExample = read('.env.example');
const vercel = JSON.parse(read('vercel.json'));

if (!/fetch\(`\/api\/veresiye\/\$\{name\}`/.test(supabase)) {
  failures.push('Browser requests must use the same-origin Vercel API proxy.');
}
if (!/veresiye-portal-login/.test(apiProxy) || !/veresiye-portal-admin/.test(apiProxy) || !/ALLOWED_FUNCTIONS/.test(apiProxy)) {
  failures.push('Vercel proxy must allow-list only the two Veresiye Edge Functions.');
}
if (!/const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_b-cFhb97kOd3mLQnBi_SGQ_8oNQPkzS'/.test(apiProxy) || /SUPABASE_SECRET_KEYS|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/.test(apiProxy)) {
  failures.push('Vercel proxy must use the exact current server-side publishable key and never a Supabase secret key.');
}
if (/VERESIYE_PROXY_SHARED_SECRET|X-Veresiye-Proxy-Secret|hasTrustedPortalProxy/.test(apiProxy + loginFunction + adminFunction)) {
  failures.push('The public login proxy must not fail closed on an unconfigured private proxy secret; code hashing/rate limits and admin PIN/token checks are the security boundary.');
}
if (/VITE_SUPABASE|sb_publishable_|sb_secret_|service_role/i.test(supabase + app + lib)) {
  failures.push('No Supabase API key may be bundled into browser source.');
}
if (/\.from\(['"](customers|sales|sale_items|sale_payments|customer_payments)['"]\)/.test(lib + app)) {
  failures.push('The browser must not query ProPOS tables directly.');
}
if (/rpc\(['"](customer_login|customer_login_secure|admin_create_customer_secure)['"]/.test(lib)) {
  failures.push('The browser must not call raw customer/login RPCs.');
}
if (/signUp\s*\(|signUpAdmin|register_admin_profile|customer-create|createCustomer\s*\(/i.test(app + lib)) {
  failures.push('Self-service administrator signup or duplicate customer creation remains in the portal.');
}
if (/9\.840|18\.420|Mehmet Yılmaz|Ayşe Demir/.test(app)) failures.push('Hard-coded demo dashboard data remains.');
if (!/ukfeuojhigxxxlnhsmls\.supabase\.co/.test(apiProxy)) failures.push('Vercel proxy must target the personal Yunus ProPOS Supabase project.');
if (!/req\.headers\[['"]x-forwarded-for['"]\]/.test(apiProxy) || /req\.headers\[['"]x-veresiye-client-ip['"]\]/.test(apiProxy)) {
  failures.push('Vercel proxy must forward only the platform-observed client IP and ignore browser-supplied custom IP headers.');
}
if (/VITE_[A-Z0-9_]*SUPABASE|SUPABASE_SECRET_KEYS|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/i.test(envExample)) {
  failures.push('.env.example must not expose browser-prefixed keys or Supabase secret/service-role credentials.');
}
if (!/hmacHex\('customer-access-code', code\)/.test(loginFunction)) failures.push('Customer codes must be fingerprinted server-side.');
if (!/veresiye_portal_register_login_attempt/.test(loginFunction) || !/x-veresiye-client-ip/.test(loginFunction) || !/x-veresiye-client-ip/.test(adminFunction)) {
  failures.push('Portal login rate limiting must use the server-forwarded client IP.');
}
if (!/\.is\('customer_id', null\)/.test(loginFunction)) failures.push('Legacy name matching must not merge purchases linked to a different customer ID.');
if (/customer_payments/.test(loginFunction)) failures.push('Customer payment movements must never be sent to the portal.');
if (!/\.eq\('business_id', businessId\)/.test(loginFunction + adminFunction)) failures.push('ProPOS reads must be scoped to the Ferhat Büfe business.');
if (!/verify_staff_pin/.test(adminFunction) || !/\.eq\('role', 'admin'\)/.test(adminFunction)) failures.push('Admin actions must verify an active ProPOS admin PIN and admin role.');
if (!/AES-GCM/.test(read('supabase/functions/veresiye-portal-admin/_shared/crypto.ts'))) failures.push('Customer codes must be encrypted for the admin reveal action.');
if (!/rotate_code/.test(adminFunction) || !/set_active/.test(adminFunction) || !/reveal_code/.test(adminFunction)) failures.push('Admin code reveal, rotation, or access toggle actions are missing.');
if (!/Kod: \{customer\.hasCode \? \(revealedCodes\[customer\.id\] \|\| '••••••'\)/.test(app)) failures.push('Admin customer list must mask access codes by default.');
if (!/code-eye-button/.test(app) || !/toggleCodeVisibility/.test(app)) failures.push('Admin customer list must include eye-button code reveal.');
if (!/url\.origin !== self\.location\.origin/.test(serviceWorker)) failures.push('Service worker must not cache cross-origin API/Supabase responses.');
if (readdirSync(join(root, 'supabase/migrations')).some((name) => name.endsWith('.sql'))) failures.push('No portal-only schema migration should be bundled as an alternative to the shared ProPOS database migration.');
for (const fn of ['veresiye-portal-login', 'veresiye-portal-admin']) {
  if (!existsSync(join(root, `supabase/functions/${fn}/index.ts`))) failures.push(`Source for ${fn} is missing.`);
}
if (existsSync(join(root, 'supabase/functions/customer-login')) || existsSync(join(root, 'supabase/functions/admin-create-customer'))) {
  failures.push('Obsolete standalone customer-login/admin-create-customer functions must not be deployable.');
}
if (!/project_id\s*=\s*"ukfeuojhigxxxlnhsmls"/.test(read('supabase/config.toml'))) failures.push('Supabase CLI config must target the personal Yunus project.');
if (!/\/api\/veresiye\/health/.test(apiProxy + lib)) failures.push('Vite and Vercel must expose the safe Supabase upstream health endpoint.');
if (!/server\.middlewares\.use/.test(viteConfig) || !/functions\/v1\/\$\{route\}/.test(viteConfig)) failures.push('Vite local development must route same-origin API requests to the Supabase Edge Functions.');
if (!existsSync(join(root, 'public/icon-192.png')) || !existsSync(join(root, 'public/icon-512.png')) || !existsSync(join(root, 'public/apple-touch-icon.png'))) failures.push('Official installable PWA icons are missing.');
if (!/silopi-dijital-logo\.png/.test(app) || !existsSync(join(root, 'public/silopi-dijital-logo.png'))) failures.push('The official Yunus ProPOS wordmark must be reused in the portal.');
if (!/icon-512\.png/.test(app)) failures.push('Compact brand positions must use the official Yunus ProPOS app icon.');
if (existsSync(join(root, 'public/silopi-dijital-mark.png'))) failures.push('The substituted portal logo asset must not be present.');
if (!existsSync(join(root, 'vercel.json'))) failures.push('Vercel deployment configuration is missing.');
if (vercel.outputDirectory !== 'dist' || !vercel.functions?.['api/veresiye/[function].ts']) failures.push('Vercel build output or API function configuration is incomplete.');
if (!existsSync(join(root, '.nvmrc')) || read('.nvmrc').trim() !== '22') failures.push('Node.js build version must be pinned to 22.');
if (existsSync(join(root, 'functions/api/veresiye/[function].ts'))) failures.push('Old Cloudflare Pages API route should be removed from the Vercel package.');

if (failures.length) {
  console.error('Security source checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('PASS: ProPOS-backed Edge Functions, Vite development API middleware, Vercel production proxy, no browser Supabase key, admin PIN authorization, masked codes, customer isolation, hidden payment data, project separation, original Yunus ProPOS brand, and PWA configuration.');
