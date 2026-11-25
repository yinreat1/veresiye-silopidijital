import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const PROJECT_URL = 'https://ukfeuojhigxxxlnhsmls.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_b-cFhb97kOd3mLQnBi_SGQ_8oNQPkzS';
const ALLOWED_FUNCTIONS = new Set(['veresiye-portal-login', 'veresiye-portal-admin']);
const MAX_BODY_BYTES = 16 * 1024;

function devPortalApiPlugin(publishableKey: string) {
  return {
    name: 'silopidijital-veresiye-dev-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        if (!requestUrl.pathname.startsWith('/api/veresiye/')) return next();

        const route = requestUrl.pathname.slice('/api/veresiye/'.length);
        const method = String(req.method || 'GET').toUpperCase();
        const sendJson = (status: number, payload: Record<string, unknown>) => {
          res.writeHead(status, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(JSON.stringify(payload));
        };

        if (method === 'OPTIONS') {
          res.writeHead(204, { Allow: route === 'health' ? 'GET, OPTIONS' : 'POST, OPTIONS', 'Cache-Control': 'no-store' });
          res.end();
          return;
        }

        if (route === 'health') {
          if (method !== 'GET') {
            res.writeHead(405, { Allow: 'GET, OPTIONS' });
            res.end();
            return;
          }
          try {
            const probe = await fetch(`${PROJECT_URL}/functions/v1/veresiye-portal-login`, {
              method: 'POST',
              headers: { apikey: publishableKey, 'Content-Type': 'application/json', 'X-Client-Info': 'silopidijital-veresiye-vite-health' },
              body: '{}',
              signal: AbortSignal.timeout(20_000),
            });
            const body = await probe.text();
            if (probe.status === 401 && body.includes('Giriş kodu geçersiz')) {
              sendJson(200, { success: true, platform: 'vite-dev', proxy: 'ready', supabase_edge_function: 'reachable' });
            } else {
              sendJson(502, { success: false, message: 'Supabase Veresiye giriş fonksiyonuna ulaşılamadı.', upstream_status: probe.status });
            }
          } catch (error) {
            console.error('[veresiye-vite-health]', error);
            sendJson(502, { success: false, message: 'Supabase bağlantı kontrolü tamamlanamadı.' });
          }
          return;
        }

        if (!ALLOWED_FUNCTIONS.has(route)) {
          sendJson(404, { success: false, message: 'Bilinmeyen Veresiye API adresi.' });
          return;
        }
        if (method !== 'POST') {
          res.writeHead(405, { Allow: 'POST, OPTIONS' });
          res.end();
          return;
        }
        if (!/^application\/json(?:\s*;|\s*$)/i.test(String(req.headers['content-type'] || ''))) {
          sendJson(415, { success: false, message: 'İstek JSON biçiminde olmalıdır.' });
          return;
        }

        try {
          let rawBody = '';
          await new Promise<void>((resolve, reject) => {
            req.on('data', (chunk: Buffer) => {
              rawBody += chunk.toString('utf8');
              if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
                reject(new Error('BODY_TOO_LARGE'));
                req.destroy();
              }
            });
            req.on('end', resolve);
            req.on('error', reject);
          });
          const parsed = JSON.parse(rawBody || '{}');
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            sendJson(400, { success: false, message: 'JSON nesnesi bekleniyor.' });
            return;
          }

          const headers: Record<string, string> = {
            apikey: publishableKey,
            'Content-Type': 'application/json',
            'X-Client-Info': 'silopidijital-veresiye-vite-dev-proxy',
          };
          const clientIp = req.socket.remoteAddress || '';
          if (clientIp && clientIp.length <= 160 && !/[\r\n]/.test(clientIp)) headers['X-Veresiye-Client-IP'] = clientIp;
          const upstream = await fetch(`${PROJECT_URL}/functions/v1/${route}`, {
            method: 'POST', headers, body: JSON.stringify(parsed), signal: AbortSignal.timeout(20_000),
          });
          const responseBody = await upstream.text();
          res.writeHead(upstream.status, {
            'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(responseBody);
        } catch (error) {
          if (error instanceof Error && error.message === 'BODY_TOO_LARGE') {
            sendJson(413, { success: false, message: 'İstek gövdesi çok büyük.' });
            return;
          }
          if (error instanceof SyntaxError) {
            sendJson(400, { success: false, message: 'Geçersiz JSON.' });
            return;
          }
          console.error('[veresiye-vite-proxy]', error);
          sendJson(502, { success: false, message: 'Veresiye sunucusuna ulaşılamadı.' });
        }
      });
    },
  };
}

export default defineConfig(() => {
  // Keep this server-side value pinned to the current Yunus ProPOS project key.
  // A stale .env override previously replaced it with an invalid checksum.
  const publishableKey = DEFAULT_PUBLISHABLE_KEY;

  return {
    plugins: [react(), devPortalApiPlugin(publishableKey)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
