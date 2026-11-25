import { createClient } from 'npm:@supabase/supabase-js@2';
import { decryptAccessCode, encryptAccessCode, generateSixDigitCode, hmacHex, signAdminToken, verifyAdminToken } from './_shared/crypto.ts';
import { handleOptions, jsonResponse } from './_shared/http.ts';

type AdminBody = {
  action?: string;
  staff_id?: string;
  admin_pin?: string;
  admin_token?: string;
  customer_id?: string;
  active?: boolean;
};

const genericAuthError = 'Yönetici doğrulaması başarısız. Lütfen yönetici PIN kodunuzu kontrol edin.';

async function recordFailedAdminAttempt(request: Request, pin: string, db: ReturnType<typeof adminClient>) {
  const forwarded = request.headers.get('x-veresiye-client-ip') || request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-client';
  const ipHash = await hmacHex('login-ip-fingerprint', forwarded.slice(0, 160));
  const pinHash = await hmacHex('admin-pin-fingerprint', pin.slice(0, 64));
  const { data, error } = await db.rpc('veresiye_portal_register_login_attempt', { p_ip_hash: ipHash, p_code_hash: pinHash });
  if (error) throw new Error('Yönetici giriş güvenlik kontrolü tamamlanamadı.');
  return data === true;
}

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

async function getBusinessId(db: ReturnType<typeof adminClient>): Promise<string> {
  const { data, error } = await db.rpc('get_default_business_id');
  if (error || typeof data !== 'string' || !data) throw new Error('İşletme bilgisi doğrulanamadı.');
  return data;
}

async function verifyStaffPin(db: ReturnType<typeof adminClient>, staffId: string, pin: string, businessId: string) {
  if (!staffId || !pin || pin.length > 64) return null;
  const { data: staff, error } = await db.from('staff')
    .select('id,name,role,business_id,active')
    .eq('id', staffId)
    .eq('business_id', businessId)
    .eq('role', 'admin')
    .eq('active', true)
    .maybeSingle();
  if (error || !staff) return null;
  const { data: valid, error: pinError } = await db.rpc('verify_staff_pin', { p_staff_id: staff.id, p_pin: pin });
  if (pinError || valid !== true) return null;
  return staff as { id: string; name: string; role: string; business_id: string; active: boolean };
}

async function authorize(db: ReturnType<typeof adminClient>, body: AdminBody, businessId: string) {
  if (body.staff_id && body.admin_pin) {
    const staff = await verifyStaffPin(db, body.staff_id, body.admin_pin, businessId);
    return staff ? { staffId: staff.id, staffName: staff.name } : null;
  }
  if (body.admin_token) {
    const payload = await verifyAdminToken(body.admin_token);
    if (!payload || payload.business_id !== businessId || typeof payload.staff_id !== 'string') return null;
    const { data: staff, error } = await db.from('staff')
      .select('id,name,role,business_id,active')
      .eq('id', payload.staff_id)
      .eq('business_id', businessId)
      .eq('role', 'admin')
      .eq('active', true)
      .maybeSingle();
    if (error || !staff) return null;
    return { staffId: staff.id as string, staffName: staff.name as string };
  }
  return null;
}

async function saveNewCode(db: ReturnType<typeof adminClient>, businessId: string, customerId: string, createdByStaffId: string, preserveActive: boolean) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateSixDigitCode();
    const codeHash = await hmacHex('customer-access-code', code);
    const encrypted = await encryptAccessCode(code);
    const { data, error } = await db.from('veresiye_portal_access').upsert({
      business_id: businessId,
      customer_id: customerId,
      access_code_hash: codeHash,
      access_code_ciphertext: encrypted.ciphertext,
      access_code_iv: encrypted.iv,
      is_active: preserveActive,
      created_by_staff_id: createdByStaffId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,customer_id' }).select('customer_id,is_active').single();
    if (!error && data) return { hasCode: true, active: Boolean(data.is_active) };
    if (!String(error?.message || '').toLowerCase().includes('duplicate')) {
      throw new Error('Müşteri giriş kodu oluşturulamadı.');
    }
  }
  throw new Error('Benzersiz giriş kodu üretilemedi. Yeniden deneyin.');
}

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return jsonResponse({ success: false, message: 'Method not allowed.' }, 405);

  try {
    const body = await request.json() as AdminBody;
    const action = String(body.action || '');
    const db = adminClient();
    const businessId = await getBusinessId(db);

    if (action === 'login') {
      const pin = String(body.admin_pin || '');
      if (!pin || pin.length > 64) return jsonResponse({ success: false, message: genericAuthError }, 401);
      const { data: admins, error } = await db.from('staff')
        .select('id,name')
        .eq('business_id', businessId)
        .eq('role', 'admin')
        .eq('active', true)
        .limit(10);
      if (error || !admins?.length) return jsonResponse({ success: false, message: genericAuthError }, 401);
      let matched: { id: string; name: string } | null = null;
      for (const candidate of admins) {
        const staff = await verifyStaffPin(db, String(candidate.id), pin, businessId);
        if (staff) { matched = { id: staff.id, name: staff.name }; break; }
      }
      if (!matched) {
        const allowed = await recordFailedAdminAttempt(request, pin, db);
        if (!allowed) return jsonResponse({ success: false, message: 'Çok fazla hatalı yönetici PIN denemesi yapıldı. 15 dakika sonra tekrar deneyin.' }, 429);
        return jsonResponse({ success: false, message: genericAuthError }, 401);
      }
      const token = await signAdminToken({ staff_id: matched.id, business_id: businessId, exp: Math.floor(Date.now() / 1000) + 30 * 60 });
      return jsonResponse({ success: true, admin_token: token, admin_name: matched.name, expires_in: 1800 });
    }

    const actor = await authorize(db, body, businessId);
    if (!actor) {
      if (body.staff_id && body.admin_pin) {
        const allowed = await recordFailedAdminAttempt(request, String(body.admin_pin), db);
        if (!allowed) return jsonResponse({ success: false, message: 'Çok fazla hatalı yönetici PIN denemesi yapıldı. 15 dakika sonra tekrar deneyin.' }, 429);
      }
      return jsonResponse({ success: false, message: genericAuthError }, 401);
    }

    if (action === 'list_customers') {
      const [{ data: customers, error: customerError }, { data: accessRows, error: accessError }, { data: sales, error: salesError }] = await Promise.all([
        db.from('customers').select('id,name,phone,balance,created_at').eq('business_id', businessId).order('name', { ascending: true }).limit(2000),
        db.from('veresiye_portal_access').select('customer_id,is_active,last_login_at').eq('business_id', businessId),
        db.from('sales').select('customer_id,customer_name,created_at').eq('business_id', businessId).is('deleted_at', null).in('payment_method', ['credit', 'split']).order('created_at', { ascending: false }).limit(5000),
      ]);
      if (customerError || accessError || salesError) throw new Error('Müşteri listesi okunamadı.');
      const accessByCustomer = new Map((accessRows || []).map((row: any) => [row.customer_id, row]));
      const lastSaleByCustomer = new Map<string, string>();
      const nameToId = new Map((customers || []).map((row: any) => [String(row.name).trim().toLocaleLowerCase('tr'), row.id]));
      for (const sale of sales || []) {
        const customerId = sale.customer_id || nameToId.get(String(sale.customer_name || '').trim().toLocaleLowerCase('tr'));
        if (customerId && !lastSaleByCustomer.has(customerId)) lastSaleByCustomer.set(customerId, sale.created_at);
      }
      return jsonResponse({ success: true, customers: (customers || []).map((customer: any) => {
        const access = accessByCustomer.get(customer.id) as any;
        return {
          id: customer.id,
          name: customer.name,
          balance: Number(customer.balance || 0),
          last_activity: lastSaleByCustomer.get(customer.id) || customer.created_at,
          is_active: Boolean(access?.is_active),
          has_code: Boolean(access),
          last_login_at: access?.last_login_at || null,
        };
      }) });
    }

    const customerId = String(body.customer_id || '');
    if (!customerId) return jsonResponse({ success: false, message: 'Müşteri seçilmedi.' }, 400);
    const { data: customer, error: customerError } = await db.from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .maybeSingle();
    if (customerError || !customer) return jsonResponse({ success: false, message: 'Müşteri bulunamadı.' }, 404);

    if (action === 'status') {
      const { data, error } = await db.from('veresiye_portal_access')
        .select('is_active,last_login_at')
        .eq('business_id', businessId)
        .eq('customer_id', customerId)
        .maybeSingle();
      if (error) throw new Error('Müşteri portal durumu okunamadı.');
      return jsonResponse({ success: true, has_code: Boolean(data), is_active: Boolean(data?.is_active), last_login_at: data?.last_login_at || null });
    }

    if (action === 'rotate_code') {
      const { data: existing, error } = await db.from('veresiye_portal_access')
        .select('is_active').eq('business_id', businessId).eq('customer_id', customerId).maybeSingle();
      if (error) throw new Error('Mevcut erişim kaydı okunamadı.');
      const saved = await saveNewCode(db, businessId, customerId, actor.staffId, Boolean(existing?.is_active));
      return jsonResponse({ success: true, has_code: saved.hasCode, is_active: saved.active, message: 'Yeni giriş kodu oluşturuldu. Güvenlik için varsayılan olarak gizlendi.' });
    }

    if (action === 'reveal_code') {
      const { data, error } = await db.from('veresiye_portal_access')
        .select('access_code_ciphertext,access_code_iv')
        .eq('business_id', businessId).eq('customer_id', customerId).maybeSingle();
      if (error || !data) return jsonResponse({ success: false, message: 'Bu müşteri için henüz giriş kodu oluşturulmamış.' }, 404);
      const code = await decryptAccessCode(data.access_code_ciphertext, data.access_code_iv);
      return jsonResponse({ success: true, code });
    }

    if (action === 'set_active') {
      const active = body.active === true;
      const { data: existing, error } = await db.from('veresiye_portal_access')
        .select('is_active').eq('business_id', businessId).eq('customer_id', customerId).maybeSingle();
      if (error) throw new Error('Erişim kaydı okunamadı.');
      if (!existing && !active) return jsonResponse({ success: true, has_code: false, is_active: false });
      if (!existing && active) {
        const saved = await saveNewCode(db, businessId, customerId, actor.staffId, true);
        return jsonResponse({ success: true, has_code: saved.hasCode, is_active: true, message: 'Erişim açıldı ve yeni giriş kodu oluşturuldu.' });
      }
      const { error: updateError } = await db.from('veresiye_portal_access')
        .update({ is_active: active, updated_at: new Date().toISOString() })
        .eq('business_id', businessId).eq('customer_id', customerId);
      if (updateError) throw new Error('Müşteri erişimi güncellenemedi.');
      return jsonResponse({ success: true, has_code: true, is_active: active });
    }

    return jsonResponse({ success: false, message: 'Bilinmeyen yönetici işlemi.' }, 400);
  } catch (error) {
    console.error('[veresiye-portal-admin]', error);
    return jsonResponse({ success: false, message: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' }, 500);
  }
});
