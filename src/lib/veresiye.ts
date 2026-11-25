import { supabase, assertSupabaseConfigured } from '@/lib/supabase';

export type PurchaseItem = {
  product: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Purchase = {
  id: string;
  items: PurchaseItem[];
  total: number;
  date: string;
  time: string;
};

export type Customer = {
  id: string;
  name: string;
  code: string;
  balance: number;
  lastActivity: string;
  active: boolean;
  hasCode?: boolean;
  lastLoginAt?: string | null;
};

export type AdminSession = { token: string; name: string; expiresIn: number };

export type PortalHealth = {
  platform: string;
  proxy: string;
  supabaseEdgeFunction: string;
};

export async function checkPortalHealth(): Promise<PortalHealth> {
  let response: Response;
  try {
    response = await fetch('/api/veresiye/health', { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('Veresiye bağlantısına ulaşılamadı. Yayın adresini ve internet bağlantınızı kontrol edin.');
  }

  const data = await response.json().catch(() => null) as {
    success?: boolean; platform?: string; proxy?: string; supabase_edge_function?: string; message?: string;
  } | null;
  if (!response.ok || !data?.success) {
    const detail = data?.message || `Sunucu bağlantı kontrolü başarısız (HTTP ${response.status}).`;
    throw new Error(detail);
  }
  return {
    platform: data.platform || 'unknown',
    proxy: data.proxy || 'ready',
    supabaseEdgeFunction: data.supabase_edge_function || 'reachable',
  };
}

type CustomerLoginResponse = {
  success: boolean;
  message?: string;
  session_token?: string;
  expires_in?: number;
  customer?: { id: string; name: string; balance: number | string };
  transactions?: Array<{
    id: string;
    date: string;
    time: string;
    total: number | string;
    items: Array<{ product: string; quantity: number | string; unitPrice: number | string; lineTotal?: number | string }>;
  }>;
};

type AdminCustomerRow = {
  id: string;
  name: string;
  balance: number | string;
  last_activity: string | null;
  is_active: boolean;
  has_code: boolean;
  last_login_at?: string | null;
};

type AdminResponse = {
  success?: boolean;
  message?: string;
  admin_token?: string;
  admin_name?: string;
  expires_in?: number;
  customers?: AdminCustomerRow[];
  code?: string;
  has_code?: boolean;
  is_active?: boolean;
};

function formatLastActivity(value: string | null): string {
  if (!value) return 'Henüz işlem yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Henüz işlem yok';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul',
  }).format(date);
}

async function invokePortalAdmin<T extends AdminResponse>(body: Record<string, unknown>): Promise<T> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<T>('veresiye-portal-admin', { body });
  if (error) throw new Error('Yönetici işlemi tamamlanamadı. İnternet bağlantısını kontrol edip tekrar deneyin.');
  if (!data?.success) throw new Error(data?.message || 'Yönetici işlemi tamamlanamadı.');
  return data;
}

export type CustomerLoginResult = { customer: Customer; purchases: Purchase[]; sessionToken: string; expiresIn: number };

export async function customerLogin(code: string, sessionToken?: string): Promise<CustomerLoginResult> {
  assertSupabaseConfigured();
  if (sessionToken) {
    if (sessionToken.length > 4096) throw new Error('Kayıtlı oturum geçersiz.');
  } else if (!/^\d{6}$/.test(code)) {
    throw new Error('Lütfen 6 haneli giriş kodunuzu kontrol edin.');
  }

  const body = sessionToken ? { session_token: sessionToken } : { code };
  const { data, error } = await supabase.functions.invoke<CustomerLoginResponse>('veresiye-portal-login', { body });
  if (error) throw new Error(error.message || 'Veresiye sunucusuna ulaşılamadı. Lütfen bağlantıyı kontrol edin.');
  if (!data?.success || !data.customer || !Array.isArray(data.transactions) || !data.session_token) {
    throw new Error(data?.message || 'Giriş kodu hatalı veya web erişiminiz kapalı.');
  }

  const transactions = data.transactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.date,
    time: transaction.time,
    total: Number(transaction.total),
    items: transaction.items.map((item) => ({
      product: item.product,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal ?? Number(item.quantity) * Number(item.unitPrice)),
    })),
  }));

  return {
    customer: {
      id: data.customer.id,
      name: data.customer.name,
      code: '',
      balance: Number(data.customer.balance),
      lastActivity: transactions[0] ? `${transactions[0].date} ${transactions[0].time}` : 'Henüz işlem yok',
      active: true,
    },
    purchases: transactions,
    sessionToken: data.session_token,
    expiresIn: Number(data.expires_in || 30 * 24 * 60 * 60),
  };
}

export async function resumeCustomerSession(sessionToken: string): Promise<CustomerLoginResult> {
  return customerLogin('', sessionToken);
}

export async function signInAdmin(pin: string): Promise<AdminSession> {
  if (!pin.trim()) throw new Error('Yönetici PIN kodunu girin.');
  const result = await invokePortalAdmin<AdminResponse>({ action: 'login', admin_pin: pin });
  if (!result.admin_token) throw new Error('Yönetici oturumu oluşturulamadı.');
  return { token: result.admin_token, name: result.admin_name || 'Yönetici', expiresIn: Number(result.expires_in || 1800) };
}

export async function loadAdminCustomers(token: string): Promise<Customer[]> {
  const result = await invokePortalAdmin<AdminResponse>({ action: 'list_customers', admin_token: token });
  return (result.customers || []).map((customer) => ({
    id: customer.id,
    name: customer.name,
    code: '••••••',
    balance: Number(customer.balance),
    lastActivity: formatLastActivity(customer.last_activity),
    active: customer.is_active,
    hasCode: customer.has_code,
    lastLoginAt: customer.last_login_at || null,
  }));
}

export async function setCustomerActive(token: string, id: string, active: boolean): Promise<Customer> {
  const result = await invokePortalAdmin<AdminResponse>({ action: 'set_active', admin_token: token, customer_id: id, active });
  return { id, name: '', code: '••••••', balance: 0, lastActivity: '', active: Boolean(result.is_active), hasCode: Boolean(result.has_code) };
}

export async function revealCustomerCode(token: string, id: string): Promise<string> {
  const result = await invokePortalAdmin<AdminResponse>({ action: 'reveal_code', admin_token: token, customer_id: id });
  if (!result.code || !/^\d{6}$/.test(result.code)) throw new Error('Giriş kodu gösterilemiyor.');
  return result.code;
}

export async function rotateCustomerCode(token: string, id: string): Promise<void> {
  await invokePortalAdmin<AdminResponse>({ action: 'rotate_code', admin_token: token, customer_id: id });
}

export async function signOutAdmin(): Promise<void> {
  // The signed 30-minute token is held only in React memory. Clearing the state is logout.
}
