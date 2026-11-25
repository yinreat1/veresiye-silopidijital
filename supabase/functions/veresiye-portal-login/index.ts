import { createClient } from 'npm:@supabase/supabase-js@2';
import { hmacHex, signCustomerSessionToken, verifyCustomerSessionToken } from './_shared/crypto.ts';
import { handleOptions, jsonResponse } from './_shared/http.ts';

const invalidLogin = 'Giriş kodu geçersiz veya erişim şu anda kapalı.';

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const secretMapRaw = Deno.env.get('SUPABASE_SECRET_KEYS');
  let secretKey = '';
  if (secretMapRaw) {
    try { secretKey = (JSON.parse(secretMapRaw) as Record<string, string>).default || ''; } catch { /* legacy fallback below */ }
  }
  secretKey ||= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !secretKey) throw new Error('Supabase Edge Function server credentials are unavailable.');
  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return {
    date: new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(date),
    time: new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Istanbul' }).format(date),
  };
}

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return jsonResponse({ success: false, message: 'Method not allowed.' }, 405);

  try {
    const body = await request.json() as { code?: string; session_token?: string };
    const code = String(body.code || '').trim();
    const sessionToken = String(body.session_token || '').trim();
    if (!sessionToken && !/^\d{6}$/.test(code)) return jsonResponse({ success: false, message: invalidLogin }, 401);

    const db = adminClient();
    const { data: businessId, error: businessError } = await db.rpc('get_default_business_id');
    if (businessError || typeof businessId !== 'string' || !businessId) throw new Error('İşletme bilgisi doğrulanamadı.');

    let customerId = '';
    let customerCodeHash = '';
    if (sessionToken) {
      const payload = await verifyCustomerSessionToken(sessionToken);
      if (!payload || payload.business_id !== businessId || typeof payload.customer_id !== 'string') {
        return jsonResponse({ success: false, message: 'Kayıtlı oturumun süresi dolmuş. Lütfen giriş kodunuzu yeniden girin.' }, 401);
      }
      const { data: access, error: accessError } = await db.from('veresiye_portal_access')
        .select('customer_id,access_code_hash,updated_at')
        .eq('business_id', businessId)
        .eq('customer_id', payload.customer_id)
        .eq('is_active', true)
        .maybeSingle();
      if (accessError) throw new Error('Kayıtlı oturum doğrulanamadı.');
      if (!access) return jsonResponse({ success: false, message: 'Bu hesabın web erişimi kapatılmış.' }, 401);
      const accessUpdatedAt = access.updated_at ? new Date(access.updated_at).getTime() : 0;
      if (payload.code_hash !== access.access_code_hash || accessUpdatedAt > Number(payload.issued_at_ms)) {
        return jsonResponse({ success: false, message: 'Kayıtlı oturum yenilendi. Lütfen güncel giriş kodunuzu kullanın.' }, 401);
      }
      customerId = String(access.customer_id);
      customerCodeHash = String(access.access_code_hash);
    } else {
      const codeHash = await hmacHex('customer-access-code', code);
      const forwarded = request.headers.get('x-veresiye-client-ip') || request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-client';
      const ipHash = await hmacHex('login-ip-fingerprint', forwarded.slice(0, 160));
      const { data: access, error: accessError } = await db.from('veresiye_portal_access')
        .select('customer_id,access_code_hash')
        .eq('business_id', businessId)
        .eq('access_code_hash', codeHash)
        .eq('is_active', true)
        .maybeSingle();
      if (accessError) throw new Error('Giriş kontrolü şu anda tamamlanamadı.');
      if (!access) {
        const { data: allowed, error: limitError } = await db.rpc('veresiye_portal_register_login_attempt', {
          p_ip_hash: ipHash,
          p_code_hash: codeHash,
        });
        if (limitError) throw new Error('Giriş güvenlik kontrolü şu anda tamamlanamadı.');
        if (allowed !== true) return jsonResponse({ success: false, message: 'Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.' }, 429);
        return jsonResponse({ success: false, message: invalidLogin }, 401);
      }
      customerId = String(access.customer_id);
      customerCodeHash = String(access.access_code_hash);
    }

    const { data: customer, error: customerError } = await db.from('customers')
      .select('id,name,balance,created_at')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .maybeSingle();
    if (customerError || !customer) return jsonResponse({ success: false, message: invalidLogin }, 401);

    const [byId, byLegacyName] = await Promise.all([
      db.from('sales').select('id,total,refund_amount,created_at,payment_method,customer_id,customer_name,deleted_at')
        .eq('business_id', businessId).eq('customer_id', customer.id).in('payment_method', ['credit', 'split'])
        .is('deleted_at', null).order('created_at', { ascending: false }).limit(1000),
      db.from('sales').select('id,total,refund_amount,created_at,payment_method,customer_id,customer_name,deleted_at')
        .eq('business_id', businessId).eq('customer_name', customer.name).is('customer_id', null).in('payment_method', ['credit', 'split'])
        .is('deleted_at', null).order('created_at', { ascending: false }).limit(1000),
    ]);
    if (byId.error || byLegacyName.error) throw new Error('Alışveriş geçmişi okunamadı.');
    const uniqueSales = new Map<string, any>();
    for (const sale of [...(byId.data || []), ...(byLegacyName.data || [])]) uniqueSales.set(sale.id, sale);
    const candidateSales = [...uniqueSales.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 1000);

    const splitIds = candidateSales.filter((sale) => sale.payment_method === 'split').map((sale) => sale.id);
    let splitCreditIds = new Set<string>();
    if (splitIds.length) {
      const { data: splitCreditRows, error } = await db.from('sale_payments').select('sale_id')
        .in('sale_id', splitIds).eq('method', 'credit').gt('amount', 0);
      if (error) throw new Error('Alışveriş ayrıntıları okunamadı.');
      splitCreditIds = new Set((splitCreditRows || []).map((row: any) => row.sale_id));
    }
    const creditSales = candidateSales.filter((sale) => sale.payment_method === 'credit' || (sale.payment_method === 'split' && splitCreditIds.has(sale.id)));
    const saleIds = creditSales.map((sale) => sale.id);

    let items: any[] = [];
    let returns: any[] = [];
    if (saleIds.length) {
      const [itemsResult, returnsResult] = await Promise.all([
        db.from('sale_items').select('id,sale_id,product_name,quantity,unit_price,subtotal').in('sale_id', saleIds).limit(10000),
        db.from('sale_returns').select('sale_id,sale_item_id,quantity,amount').in('sale_id', saleIds).limit(10000),
      ]);
      if (itemsResult.error || returnsResult.error) throw new Error('Ürün ayrıntıları okunamadı.');
      items = itemsResult.data || [];
      returns = returnsResult.data || [];
    }

    const returnsByItem = new Map<string, { quantity: number; amount: number }>();
    for (const returned of returns) {
      if (!returned.sale_item_id) continue;
      const current = returnsByItem.get(returned.sale_item_id) || { quantity: 0, amount: 0 };
      current.quantity += Number(returned.quantity || 0);
      current.amount += Number(returned.amount || 0);
      returnsByItem.set(returned.sale_item_id, current);
    }
    const itemsBySale = new Map<string, any[]>();
    for (const item of items) {
      const returned = returnsByItem.get(item.id) || { quantity: 0, amount: 0 };
      const remainingQuantity = Math.max(0, Number(item.quantity || 0) - returned.quantity);
      const lineTotal = Math.max(0, Number(item.subtotal || 0) - returned.amount);
      if (remainingQuantity <= 0 || lineTotal <= 0) continue;
      const list = itemsBySale.get(item.sale_id) || [];
      list.push({ product: item.product_name, quantity: remainingQuantity, unitPrice: Number(item.unit_price || 0), lineTotal });
      itemsBySale.set(item.sale_id, list);
    }

    const transactions = creditSales.map((sale) => {
      const dateTime = formatDateTime(sale.created_at);
      return {
        id: sale.id,
        date: dateTime.date,
        time: dateTime.time,
        total: Math.max(0, Number(sale.total || 0) - Number(sale.refund_amount || 0)),
        items: itemsBySale.get(sale.id) || [],
      };
    }).filter((sale) => sale.total > 0 || sale.items.length > 0);

    const newSessionToken = await signCustomerSessionToken({
      customer_id: customer.id,
      business_id: businessId,
      code_hash: customerCodeHash,
      issued_at_ms: Date.now(),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    });

    await db.from('veresiye_portal_access').update({ last_login_at: new Date().toISOString() })
      .eq('business_id', businessId).eq('customer_id', customer.id);

    return jsonResponse({
      success: true,
      session_token: newSessionToken,
      expires_in: 30 * 24 * 60 * 60,
      customer: { id: customer.id, name: customer.name, balance: Number(customer.balance || 0) },
      transactions,
    });
  } catch (error) {
    console.error('[veresiye-portal-login]', error);
    return jsonResponse({ success: false, message: 'Hesap bilgileri şu anda alınamadı. Lütfen daha sonra tekrar deneyin.' }, 500);
  }
});
