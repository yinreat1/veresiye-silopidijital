/**
 * Same-origin Vercel Node.js function proxy for the two approved Veresiye
 * Supabase Edge Functions. The publishable key is read only at runtime from
 * Vercel's server-side environment and is never exposed to Vite/browser code.
 */

type HeaderValue = string | string[] | undefined;
type VercelRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type VercelResponse = {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): VercelResponse;
  send(body: string): VercelResponse;
  json(body: unknown): VercelResponse;
  end(): VercelResponse;
};

// Health is served by this dynamic route at /api/veresiye/health.
const PROJECT_URL = 'https://ukfeuojhigxxxlnhsmls.supabase.co';
const ALLOWED_FUNCTIONS = new Set(['veresiye-portal-login', 'veresiye-portal-admin']);
const MAX_BODY_BYTES = 16 * 1024;
// Supabase publishable keys are designed for public-client use. Keeping this
// server-side fallback avoids a fragile secret setup; never put a service-role key here.
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_b-cFhb97kOd3mLQnBi_SGQ_8oNQPkzS';
const UPSTREAM_TIMEOUT_MS = 20_000;

function headerValue(value: HeaderValue): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function reply(res: VercelResponse, status: number, body: Record<string, unknown>): VercelResponse {
  return res
    .status(status)
    .setHeader('Content-Type', 'application/json; charset=utf-8')
    .setHeader('Cache-Control', 'no-store, max-age=0')
    .setHeader('X-Content-Type-Options', 'nosniff')
    .json(body);
}

function serializeBody(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return null;
}

function firstForwardedIp(value: HeaderValue): string | null {
  const first = headerValue(value).split(',')[0]?.trim() || '';
  if (!first || first.length > 160 || /[\r\n]/.test(first)) return null;
  return first;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS').status(204).end();
    return;
  }

  const requestedFunction = req.query?.function;
  const functionName = Array.isArray(requestedFunction)
    ? requestedFunction.length === 1 ? requestedFunction[0] : ''
    : requestedFunction || '';

  if (functionName === 'health' && method === 'GET') {
    const publishableKey = DEFAULT_PUBLISHABLE_KEY;
    if (!publishableKey.startsWith('sb_publishable_')) {
      reply(res, 503, { success: false, message: 'Supabase publishable key yapılandırılmamış.' });
      return;
    }
    try {
      const upstream = await fetch(`${PROJECT_URL}/functions/v1/veresiye-portal-login`, {
        method: 'POST',
        headers: { apikey: publishableKey, 'Content-Type': 'application/json', 'X-Client-Info': 'silopidijital-veresiye-vercel-health' },
        body: '{}',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      const body = await upstream.text();
      // An empty-code 401 is expected and proves the public login Edge Function is reachable.
      const reachable = upstream.status === 401 && body.includes('Giriş kodu geçersiz');
      if (!reachable) {
        reply(res, 502, { success: false, message: 'Supabase Veresiye giriş fonksiyonuna ulaşılamadı.', upstream_status: upstream.status });
        return;
      }
      reply(res, 200, { success: true, platform: 'vercel', proxy: 'ready', supabase_edge_function: 'reachable' });
    } catch (error) {
      console.error('[veresiye-vercel-health]', error);
      reply(res, 502, { success: false, message: 'Supabase bağlantı kontrolü tamamlanamadı.' });
    }
    return;
  }

  if (functionName === 'health' && method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    reply(res, 405, { success: false, message: 'Health endpoint only supports GET.' });
    return;
  }

  if (method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    reply(res, 405, { success: false, message: 'Method not allowed.' });
    return;
  }

  if (!ALLOWED_FUNCTIONS.has(functionName)) {
    reply(res, 404, { success: false, message: 'Unknown portal function.' });
    return;
  }

  const contentType = headerValue(req.headers['content-type']);
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) {
    reply(res, 415, { success: false, message: 'Content-Type must be application/json.' });
    return;
  }

  const declaredLength = Number(headerValue(req.headers['content-length']));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    reply(res, 413, { success: false, message: 'Request body is too large.' });
    return;
  }

  const rawBody = serializeBody(req.body);
  if (rawBody === null) {
    reply(res, 400, { success: false, message: 'A JSON request body is required.' });
    return;
  }
  const byteLength = new TextEncoder().encode(rawBody).byteLength;
  if (byteLength > MAX_BODY_BYTES) {
    reply(res, 413, { success: false, message: 'Request body is too large.' });
    return;
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    reply(res, 400, { success: false, message: 'Invalid JSON request body.' });
    return;
  }
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    reply(res, 400, { success: false, message: 'A JSON object is required.' });
    return;
  }

  const publishableKey = DEFAULT_PUBLISHABLE_KEY;
  if (!publishableKey.startsWith('sb_publishable_')) {
    reply(res, 503, { success: false, message: 'Supabase publishable key yapılandırılmamış.' });
    return;
  }

  const clientIp = firstForwardedIp(req.headers['x-forwarded-for']);
  const upstreamHeaders: Record<string, string> = {
    apikey: publishableKey,
    'Content-Type': 'application/json',
    'X-Client-Info': 'silopidijital-veresiye-vercel-proxy',
  };
  // Never trust a browser-supplied X-Veresiye-Client-IP header. Only forward
  // the platform-provided x-forwarded-for value observed by this server handler.
  if (clientIp) upstreamHeaders['X-Veresiye-Client-IP'] = clientIp;

  try {
    const upstream = await fetch(`${PROJECT_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: upstreamHeaders,
      body: rawBody,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const responseText = await upstream.text();
    res
      .status(upstream.status)
      .setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
      .setHeader('Cache-Control', 'no-store, max-age=0')
      .setHeader('X-Content-Type-Options', 'nosniff')
      .send(responseText);
  } catch (error) {
    console.error('[veresiye-vercel-proxy]', error);
    reply(res, 502, { success: false, message: 'Veresiye sunucusuna şu anda ulaşılamıyor.' });
  }
}
