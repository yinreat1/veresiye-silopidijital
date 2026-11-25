/**
 * Browser-safe same-origin API client. The browser never calls ProPOS tables.
 * Login and admin requests go through the same-origin platform proxy; the
 * public publishable key and customer data access stay on the server side.
 */
export const isSupabaseConfigured = true;

type PortalFunctionName = 'veresiye-portal-login' | 'veresiye-portal-admin';
type InvokeOptions = { body?: Record<string, unknown> };
type InvokeResult<T> = { data: T | null; error: Error | null };

async function invoke<T>(name: PortalFunctionName, options: InvokeOptions = {}): Promise<InvokeResult<T>> {
  try {
    const response = await fetch(`/api/veresiye/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(options.body ?? {}),
    });

    const data = await response.json().catch(() => null) as T | null;
    if (!response.ok) {
      const message = data && typeof data === 'object' && 'message' in data
        ? String((data as { message?: unknown }).message || 'Veresiye isteği tamamlanamadı.')
        : 'Veresiye isteği tamamlanamadı.';
      return { data, error: new Error(message) };
    }
    return { data, error: null };
  } catch {
    return { data: null, error: new Error('Veresiye sunucusuna ulaşılamadı. İnternet bağlantınızı kontrol edin.') };
  }
}

export const supabase = {
  functions: {
    invoke: <T,>(name: PortalFunctionName, options?: InvokeOptions) => invoke<T>(name, options),
  },
};

export function assertSupabaseConfigured(): void {
  // No Supabase credential is exposed to the browser. In development,
  // vite.config.ts proxies requests server-side; in production, Vercel's
  // api/veresiye/[function].ts function handles the same-origin requests.
}
