import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import QRCode from 'qrcode';
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FileText,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Power,
  QrCode,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import {
  customerLogin,
  resumeCustomerSession,
  checkPortalHealth,
  loadAdminCustomers,
  setCustomerActive,
  signInAdmin,
  signOutAdmin,
  revealCustomerCode,
  rotateCustomerCode,
  type AdminSession,
  type Customer,
  type Purchase,
} from '@/lib/veresiye';

type View = 'customer-login' | 'customer' | 'admin-login' | 'admin';
type CustomerFilter = 'all' | 'active' | 'inactive';
type PortalHealthState = { status: 'idle' | 'checking' | 'ok' | 'error'; message: string };
const CUSTOMER_SESSION_KEY = 'silopidijital-veresiye-session-v1';

const formatMoney = (amount: number) => new Intl.NumberFormat('tr-TR', {
  style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(amount);


function BrandMark({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return <img src="/icon-512.png" alt="Silopi Dijital" className="brand-mark" />;
  }

  return (
    <div className="brand-lockup brand-lockup-official">
      <img src="/silopi-dijital-logo.png" alt="Silopi Dijital" className="brand-logo-wordmark" />
      <div className="brand-product-label"><strong>VERESİYE</strong><small>FERHAT BÜFE</small></div>
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>(() => window.location.pathname.replace(/\/$/, '') === '/admin' ? 'admin-login' : 'customer-login');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
  const [loginError, setLoginError] = useState('');
  const [adminNotice, setAdminNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerPurchases, setCustomerPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>('all');
  const [showQr, setShowQr] = useState(false);
  const [pendingCustomerId, setPendingCustomerId] = useState<string | null>(null);
  const [portalHealth, setPortalHealth] = useState<PortalHealthState>({ status: 'idle', message: '' });

  useEffect(() => {
    if (window.location.pathname.replace(/\/$/, '') === '/admin') return;
    let cancelled = false;
    let savedToken = '';
    try { savedToken = window.localStorage.getItem(CUSTOMER_SESSION_KEY) || ''; } catch { savedToken = ''; }
    if (!savedToken) return;

    setIsLoading(true);
    void resumeCustomerSession(savedToken).then((result) => {
      if (cancelled) return;
      setSelectedCustomer(result.customer);
      setCustomerPurchases(result.purchases);
      // Rotate the signed 30-day token after every successful restore.
      try { window.localStorage.setItem(CUSTOMER_SESSION_KEY, result.sessionToken); } catch { /* Login remains valid for this visit if storage is disabled. */ }
      setView('customer');
    }).catch(() => {
      try { window.localStorage.removeItem(CUSTOMER_SESSION_KEY); } catch { /* storage may be disabled */ }
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const filteredCustomers = useMemo(() => customers.filter((customer) => {
    const matchesName = customer.name.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'));
    const matchesStatus = customerFilter === 'all'
      || (customerFilter === 'active' && customer.active)
      || (customerFilter === 'inactive' && !customer.active);
    return matchesName && matchesStatus;
  }), [customers, search, customerFilter]);

  const totalDebt = customers.reduce((sum, customer) => sum + Math.max(0, customer.balance), 0);
  const activeCustomerCount = customers.filter((customer) => customer.active).length;

  useEffect(() => {
    if (!adminSession) return;
    const timeout = window.setTimeout(() => {
      setAdminSession(null);
      setCustomers([]);
      setRevealedCodes({});
      setLoginError('Güvenlik için yönetici oturumu sona erdi. Lütfen yeniden giriş yapın.');
      window.history.replaceState({}, '', '/admin');
      setView('admin-login');
    }, Math.max(0, adminSession.expiresIn * 1000));
    return () => window.clearTimeout(timeout);
  }, [adminSession]);

  const handlePortalHealthCheck = async () => {
    setPortalHealth({ status: 'checking', message: 'Bağlantı kontrol ediliyor…' });
    try {
      const health = await checkPortalHealth();
      setPortalHealth({ status: 'ok', message: `Bağlantı hazır · ${health.platform} · Supabase erişilebilir` });
    } catch (error) {
      setPortalHealth({ status: 'error', message: error instanceof Error ? error.message : 'Bağlantı kontrol edilemedi.' });
    }
  };

  const handleCustomerLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setLoginError('');
    try {
      const result = await customerLogin(code);
      try {
        if (rememberMe) window.localStorage.setItem(CUSTOMER_SESSION_KEY, result.sessionToken);
        else window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
      } catch { /* Browser storage may be disabled; login still works for this visit. */ }
      setSelectedCustomer(result.customer);
      setCustomerPurchases(result.purchases);
      setCode('');
      setView('customer');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Giriş yapılamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setLoginError('');
    setAdminNotice('');
    try {
      const session = await signInAdmin(adminPassword);
      const rows = await loadAdminCustomers(session.token);
      setAdminSession(session);
      setCustomers(rows);
      setAdminPassword('');
      setRevealedCodes({});
      setView('admin');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Yönetici girişi tamamlanamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await signOutAdmin();
    setAdminSession(null);
    setCustomers([]);
    setAdminPassword('');
    setRevealedCodes({});
    setLoginError('');
    setAdminNotice('');
    window.history.replaceState({}, '', '/');
    setView('customer-login');
  };

  const toggleCustomer = async (customer: Customer) => {
    if (!adminSession) return;
    setPendingCustomerId(customer.id);
    setLoginError('');
    setAdminNotice('');
    try {
      await setCustomerActive(adminSession.token, customer.id, !customer.active);
      setRevealedCodes((items) => { const next = { ...items }; delete next[customer.id]; return next; });
      setCustomers((items) => items.map((item) => item.id === customer.id ? { ...item, active: !customer.active, hasCode: true } : item));
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Müşteri erişimi güncellenemedi.');
    } finally {
      setPendingCustomerId(null);
    }
  };

  const toggleCodeVisibility = async (customer: Customer) => {
    if (!adminSession || !customer.hasCode) return;
    if (revealedCodes[customer.id]) {
      setRevealedCodes((items) => { const next = { ...items }; delete next[customer.id]; return next; });
      return;
    }
    setPendingCustomerId(customer.id);
    try {
      const revealed = await revealCustomerCode(adminSession.token, customer.id);
      setRevealedCodes((items) => ({ ...items, [customer.id]: revealed }));
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Giriş kodu gösterilemedi.');
    } finally {
      setPendingCustomerId(null);
    }
  };

  const regenerateCode = async (customer: Customer) => {
    if (!adminSession || !window.confirm(`${customer.name} için yeni giriş kodu oluşturulsun mu? Eski kod geçersiz olacak.`)) return;
    setPendingCustomerId(customer.id);
    setLoginError('');
    setAdminNotice('');
    try {
      await rotateCustomerCode(adminSession.token, customer.id);
      setRevealedCodes((items) => { const next = { ...items }; delete next[customer.id]; return next; });
      setCustomers(await loadAdminCustomers(adminSession.token));
      setAdminNotice('Yeni giriş kodu oluşturuldu. Göz simgesiyle görüntüleyebilirsiniz.');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Yeni giriş kodu oluşturulamadı.');
    } finally {
      setPendingCustomerId(null);
    }
  };


  const logoutCustomer = () => {
    try { window.localStorage.removeItem(CUSTOMER_SESSION_KEY); } catch { /* storage may be disabled */ }
    setSelectedCustomer(null);
    setCustomerPurchases([]);
    setView('customer-login');
  };

  if (view === 'customer-login') {
    return <LoginScreen mode="customer" code={code} setCode={setCode} error={loginError} onSubmit={handleCustomerLogin} loading={isLoading} onHealthCheck={handlePortalHealthCheck} healthState={portalHealth} rememberMe={rememberMe} setRememberMe={setRememberMe} />;
  }

  if (view === 'admin-login') {
    return <LoginScreen mode="admin" code={adminPassword} setCode={setAdminPassword} error={loginError} onSubmit={handleAdminLogin} loading={isLoading} showPassword={showPassword} setShowPassword={setShowPassword} />;
  }

  if (view === 'customer' && selectedCustomer) {
    return <CustomerDashboard customer={selectedCustomer} purchases={customerPurchases} onLogout={logoutCustomer} />;
  }

  return (
    <div className="app-shell admin-shell">
      <aside className="sidebar">
        <div className="sidebar-top"><BrandMark /><span className="sidebar-close"><ShieldCheck size={19} /></span></div>
        <nav className="sidebar-nav">
          <p className="nav-label">YÖNETİM</p>
          <button className="nav-item active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><LayoutDashboard size={18} /> Genel Bakış</button>
          <button className="nav-item" onClick={() => document.getElementById('customer-list')?.scrollIntoView({ behavior: 'smooth' })}><UsersRound size={18} /> Müşteriler <span className="nav-count">{customers.length}</span></button>
          <button className="nav-item" onClick={() => document.getElementById('customer-list')?.scrollIntoView({ behavior: 'smooth' })}><Receipt size={18} /> Veresiye hesapları</button>
          <p className="nav-label nav-label-space">ARAÇLAR</p>
          <button className="nav-item" onClick={() => setShowQr(true)}><QrCode size={18} /> Ortak QR kodu</button>
        </nav>
        <div className="sidebar-bottom"><div className="admin-profile"><div className="avatar avatar-blue">SD</div><div><strong>Ferhat Büfe</strong><span>{adminSession?.name || 'Yönetici'}</span></div><MoreHorizontal size={17} /></div></div>
      </aside>

      <main className="admin-main">
        <header className="topbar">
          <div className="topbar-left"><div className="icon-button menu-button"><Menu size={20} /></div><div><span className="eyebrow">{new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).toLocaleUpperCase('tr')}</span><h1>Genel Bakış</h1></div></div>
          <div className="topbar-actions"><div className="mobile-brand"><BrandMark compact /></div><button className="button button-secondary admin-logout" onClick={handleAdminLogout}><LogOut size={16} /> Çıkış yap</button></div>
        </header>

        <div className="admin-content">
          <section className="welcome-row"><div><h2>Hoş geldin.</h2><p>Ferhat Büfe veresiye erişimlerini buradan yönetebilirsin. Müşteri kaydı ProPOS Cari ekranından oluşturulur.</p></div><span className="count-pill">PROPOS BAĞLANTISI AKTİF</span></section>

          {loginError && <div className="form-error admin-inline-error"><X size={15} />{loginError}</div>}
          {adminNotice && <div className="admin-notice" role="status">{adminNotice}</div>}

          <section className="stats-grid">
            <StatCard icon={<WalletCards size={19} />} label="Toplam açık borç" value={formatMoney(totalDebt)} detail="Kayıtlı hesapların toplamı" accent="blue" />
            <StatCard icon={<UsersRound size={19} />} label="Aktif müşteriler" value={String(activeCustomerCount)} detail="Erişimi açık hesaplar" accent="teal" />
            <StatCard icon={<UserRound size={19} />} label="Toplam müşteri" value={String(customers.length)} detail="Kayıtlı müşteri sayısı" accent="amber" />
            <StatCard icon={<ShieldCheck size={19} />} label="Satış bağlantısı" value="Aktif" detail="ProPOS verileri canlı okunuyor" accent="green" />
          </section>

          <section className="dashboard-grid">
            <div className="panel customer-panel" id="customer-list">
              <div className="panel-heading"><div><h3>Müşteriler</h3><p>Hesap durumlarını ve erişim izinlerini buradan yönetin.</p></div><span className="count-pill">{customers.length} KAYIT</span></div>
              <div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Müşteri ara..." /></div><button className="filter-button" onClick={() => setCustomerFilter((current) => current === 'all' ? 'active' : current === 'active' ? 'inactive' : 'all')}>{customerFilter === 'all' ? 'Tümü' : customerFilter === 'active' ? 'Aktifler' : 'Kapalılar'} <ChevronRight size={15} /></button></div>
              <div className="customer-table">
                <div className="table-head"><span>MÜŞTERİ / GİRİŞ KODU</span><span>GÜNCEL BORÇ</span><span>SON HAREKET</span><span>DURUM</span><span /></div>
                {filteredCustomers.map((customer) => <div className="table-row" key={customer.id}>
                  <div className="customer-cell"><div className="avatar avatar-blue">{customer.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><strong>{customer.name}</strong><span className="customer-code-line">Kod: {customer.hasCode ? (revealedCodes[customer.id] || '••••••') : 'Henüz oluşturulmadı'}<button type="button" className="code-eye-button" disabled={!customer.hasCode || pendingCustomerId === customer.id} onClick={() => void toggleCodeVisibility(customer)} aria-label={revealedCodes[customer.id] ? 'Giriş kodunu gizle' : 'Giriş kodunu göster'} title={revealedCodes[customer.id] ? 'Gizle' : 'Giriş kodunu göster'}>{revealedCodes[customer.id] ? <EyeOff size={13} /> : <Eye size={13} />}</button><button type="button" className="code-eye-button" disabled={pendingCustomerId === customer.id} onClick={() => void regenerateCode(customer)} aria-label="Giriş kodunu yenile" title="Giriş kodunu yenile"><KeyRound size={12} /></button></span></div></div>
                  <strong className={customer.balance > 0 ? 'debt' : 'paid'}>{formatMoney(customer.balance)}</strong>
                  <span className="muted-cell">{customer.lastActivity}</span>
                  <span className={`status ${customer.active ? 'status-active' : 'status-muted'}`}><i />{customer.active ? 'Aktif' : 'Kapalı'}</span>
                  <button className="row-action customer-toggle" disabled={pendingCustomerId === customer.id} onClick={() => void toggleCustomer(customer)} aria-label={customer.active ? `${customer.name} erişimini kapat` : `${customer.name} erişimini aç`} title={customer.active ? 'Erişimi kapat' : 'Erişimi aç'}><Power size={16} /></button>
                </div>)}
                {filteredCustomers.length === 0 && <div className="empty-row">{customers.length === 0 ? 'Henüz müşteri eklenmemiş.' : 'Aradığınız müşteri bulunamadı.'}</div>}
              </div>
            </div>

            <div className="panel activity-panel">
              <div className="panel-heading"><div><h3>Satış sistemi bağlantısı</h3><p>Gerçek hareketler bağlandığında burada görünecek.</p></div><div className="quick-icon shield-icon"><ShieldCheck size={18} /></div></div>
              <div className="integration-placeholder"><div className="integration-placeholder-icon"><Receipt size={24} /></div><strong>ProPOS verileri canlı bağlı</strong><p>Müşteri adları, güncel bakiyeler ve veresiye alışverişleri doğrudan Ferhat Büfe ProPOS verilerinden okunur. Tahsilat hareketleri müşteri ekranına gönderilmez.</p></div>
            </div>
          </section>

          <section className="bottom-grid"><div className="quick-card qr-card"><div className="quick-icon qr-icon"><QrCode size={20} /></div><div><h3>Ortak QR kodunuz</h3><p>Bütün müşteriler aynı QR kodunu kullanır, kendi 6 haneli kodlarıyla giriş yapar.</p><button className="outline-button" onClick={() => setShowQr(true)}>QR kodu görüntüle <ArrowUpRight size={14} /></button></div></div><div className="quick-card security-card"><div className="quick-icon shield-icon"><ShieldCheck size={20} /></div><div><h3>Müşteri erişim kontrolü</h3><p>İstediğiniz müşterinin erişimini tek dokunuşla açıp kapatabilirsiniz.</p><div className="security-status"><span><i /> Yönetici oturumu açık</span></div></div></div></section>
        </div>
      </main>

      {showQr && <QrModal onClose={() => setShowQr(false)} />}
    </div>
  );
}

type LoginScreenProps =
  | {
      mode: 'customer'; code: string; setCode: (value: string) => void; error: string;
      onSubmit: (event: FormEvent<HTMLFormElement>) => void; loading: boolean;
      onHealthCheck: () => void; healthState: PortalHealthState; rememberMe: boolean; setRememberMe: (value: boolean) => void;
    }
  | {
      mode: 'admin'; code: string; setCode: (value: string) => void; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
      loading: boolean; showPassword: boolean; setShowPassword: (value: boolean) => void;
    };

function LoginScreen(props: LoginScreenProps) {
  const isAdmin = props.mode === 'admin';
  return <div className="login-page"><div className="login-glow glow-one" /><div className="login-glow glow-two" /><div className="login-container">
    <div className="login-brand"><div className="login-brand-main"><BrandMark /></div><div className="login-store"><Store size={18} /> Ferhat Büfe</div></div>
    <div className="login-card"><div className="login-icon"><BrandMark compact /></div><span className="eyebrow">{isAdmin ? 'YÖNETİCİ GİRİŞİ' : 'MÜŞTERİ GİRİŞİ'}</span><h1>{isAdmin ? 'Yönetim paneline hoş geldin' : 'Hesabına güvenle ulaş'}</h1><p>{isAdmin ? 'ProPOS üzerinde tanımlı yönetici PIN kodunuzla giriş yapın.' : 'Size verilen 6 haneli giriş kodunu girerek hesabınızı görüntüleyin.'}</p>
      <form onSubmit={props.onSubmit} className="login-form">
        <label>{isAdmin ? 'Yönetici PIN kodu' : '6 haneli giriş kodu'}<div className="input-wrap">{isAdmin ? <LockKeyhole size={18} /> : <KeyRound size={18} />}<input autoFocus type={isAdmin && !props.showPassword ? 'password' : 'text'} inputMode={isAdmin ? 'text' : 'numeric'} autoComplete={isAdmin ? 'current-password' : 'one-time-code'} maxLength={isAdmin ? undefined : 6} pattern={isAdmin ? undefined : '[0-9]{6}'} value={props.code} onChange={(event) => props.setCode(isAdmin ? event.target.value : event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={isAdmin ? 'ProPOS yönetici PIN kodu' : '••••••'} required />{isAdmin && <button type="button" className="input-action" onClick={() => props.setShowPassword(!props.showPassword)} aria-label={props.showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>{props.showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>}</div></label>
        {props.mode === 'customer' && <label className="remember-row"><input type="checkbox" checked={props.rememberMe} onChange={(event) => props.setRememberMe(event.target.checked)} /> Beni hatırla</label>}
        {props.error && <div className="form-error"><X size={15} />{props.error}</div>}
        <button className="button button-primary login-submit" type="submit" disabled={props.loading}>{props.loading ? 'Kontrol ediliyor...' : isAdmin ? 'Panele giriş yap' : 'Hesabıma giriş yap'}<ArrowUpRight size={17} /></button>
        {props.mode === 'customer' && <div className="portal-health-area">
          <button type="button" className="portal-health-button" onClick={props.onHealthCheck} disabled={props.healthState.status === 'checking'}>{props.healthState.status === 'checking' ? 'Bağlantı kontrol ediliyor…' : 'Bağlantıyı kontrol et'}</button>
          {props.healthState.message && <p className={`portal-health-result portal-health-${props.healthState.status}`} role="status">{props.healthState.message}</p>}
        </div>}
      </form>
    </div>
    <div className="login-footer"><button type="button" className="admin-entry-link" onClick={() => { window.location.assign(isAdmin ? '/' : '/admin'); }}>{isAdmin ? 'Müşteri girişi' : 'Yönetici girişi'}</button><span><ShieldCheck size={13} /> Güvenli erişim</span></div>
  </div></div>;
}

function CustomerDashboard({ customer, purchases, onLogout }: { customer: Customer; purchases: Purchase[]; onLogout: () => void }) {
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const visiblePurchases = showAll ? purchases : purchases.slice(0, 10);

  return <div className="customer-page">
    <header className="customer-header"><div className="customer-brand"><BrandMark /></div><div className="store-identity"><Store size={19} /><span>Ferhat Büfe</span></div><button className="header-logout" onClick={onLogout}><LogOut size={16} /> Çıkış</button></header>
    <main className="customer-main">
      <section className="customer-profile"><div className="customer-avatar"><UserRound size={24} /></div><div><h1>{customer.name}</h1><p>Veresiye Hesabım</p></div></section>
      <section className="balance-card"><div className="balance-top"><span><WalletCards size={18} /> {customer.balance < -0.009 ? 'Mağazadaki Avansınız' : customer.balance > 0.009 ? 'Güncel Toplam Borç' : 'Güncel Bakiye'}</span><ShieldCheck size={18} /></div><strong>{formatMoney(Math.abs(customer.balance))}{customer.balance < -0.009 ? ' alacak' : ''}</strong><div className="balance-bottom"><span><Clock3 size={14} /> Son hareket: {customer.lastActivity}</span><span className="balance-status"><i /> Hesap aktif</span></div></section>
      <div className="section-title"><div className="section-title-label"><ShoppingBag size={22} /><div><h2>Alışveriş Geçmişi</h2><p>Veresiye alışverişleriniz</p></div></div>{purchases.length > 10 && <button className="history-button" onClick={() => setShowAll((current) => !current)}>{showAll ? 'Daha az göster' : 'Tümünü gör'} <ChevronRight size={18} /></button>}</div>
      <div className="purchase-list">
        {visiblePurchases.map((purchase) => {
          const summary = purchase.items.slice(0, 2).map((line) => `${line.product} (${line.quantity} adet)`).join(' + ');
          const hiddenCount = Math.max(0, purchase.items.length - 2);
          const isExpanded = expandedPurchase === purchase.id;
          return <article className={`purchase-item ${isExpanded ? 'purchase-item-expanded' : ''}`} key={purchase.id}>
            <button className="purchase-summary" onClick={() => setExpandedPurchase(isExpanded ? null : purchase.id)} aria-expanded={isExpanded}>
              <div className="purchase-icon"><ShoppingBag size={21} /></div><div className="purchase-info"><strong>{summary || 'Ürün ayrıntısı bulunamadı'}{hiddenCount > 0 && ` + ${hiddenCount} diğer ürün`}</strong><span><CalendarDays size={14} /> {purchase.date} · {purchase.time}</span></div><div className="purchase-amount"><strong>{formatMoney(purchase.total)}</strong><ChevronRight size={19} className={isExpanded ? 'purchase-arrow-open' : ''} /></div>
            </button>
            {isExpanded && <div className="purchase-detail"><div className="detail-heading"><span>ÜRÜN</span><span>MİKTAR</span><span>BİRİM</span><span>TOPLAM</span></div>{purchase.items.map((line, index) => <div className="detail-row" key={`${purchase.id}-${index}`}><strong>{line.product}</strong><span>{line.quantity} adet</span><span>{formatMoney(line.unitPrice)}</span><strong>{formatMoney(line.lineTotal)}</strong></div>)}<div className="detail-total"><span>İşlem toplamı</span><strong>{formatMoney(purchase.total)}</strong></div></div>}
          </article>;
        })}
        {visiblePurchases.length === 0 && <div className="empty-row customer-empty-row">Henüz görüntülenecek veresiye alışverişi bulunmuyor.</div>}
      </div>
      <div className="customer-note"><div className="note-icon"><ShieldCheck size={21} /></div><div><strong>Bilgileriniz güvende</strong><p>Ödeme hareketleri bu ekranda gösterilmez. Ödemeler toplam borçtan düşülür.</p></div><ShieldCheck className="note-check" size={25} /></div>
    </main>
    <footer className="customer-footer"><span>SilopiDijital Veresiye · Ferhat Büfe</span><span><LockKeyhole size={13} /> Güvenli bağlantı</span></footer>
  </div>;
}

function StatCard({ icon, label, value, detail, accent }: { icon: ReactNode; label: string; value: string; detail: string; accent: string }) {
  return <div className="stat-card"><div className={`stat-icon stat-${accent}`}>{icon}</div><div className="stat-label">{label}</div><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></div>;
}

function QrModal({ onClose }: { onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const publicUrl = new URL('/', window.location.origin).toString();

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(publicUrl, { width: 480, margin: 2, color: { dark: '#071426', light: '#ffffff' } })
      .then((dataUrl) => { if (!cancelled) setQrDataUrl(dataUrl); })
      .catch(() => { if (!cancelled) setQrDataUrl(''); });
    return () => { cancelled = true; };
  }, [publicUrl]);

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = 'silopidijital-veresiye-qr.png';
    link.href = qrDataUrl;
    link.click();
  };

  const printQr = () => {
    if (!qrDataUrl) return;
    const printWindow = window.open('', '_blank', 'width=720,height=820');
    if (!printWindow) return;
    printWindow.document.write(`<html lang="tr"><head><meta charset="utf-8"><title>SilopiDijital Veresiye QR</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:60px;color:#071426}img{width:320px}h1{font-size:28px;margin:24px 0 8px}p{color:#52667d}</style></head><body><img src="${qrDataUrl}" alt="SilopiDijital Veresiye QR"><h1>SilopiDijital Veresiye</h1><p>Ferhat Büfe · Müşteri giriş adresi</p></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyStatus('Adres kopyalandı.');
    } catch {
      setCopyStatus('Adres kopyalanamadı.');
    }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-card qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
    <div className="modal-header"><div><span className="modal-kicker">MÜŞTERİ ERİŞİMİ</span><h3 id="qr-modal-title">Ortak QR kodunuz</h3></div><button className="icon-button" onClick={onClose} aria-label="Kapat"><X size={19} /></button></div>
    <div className="qr-layout"><div className="qr-visual">{qrDataUrl ? <img src={qrDataUrl} alt="SilopiDijital Veresiye giriş QR kodu" /> : <span className="qr-loading">Hazırlanıyor</span>}</div><div className="qr-copy"><h4>SilopiDijital Veresiye</h4><p>Müşterileriniz bu kodu telefonlarıyla okutarak giriş sayfasına ulaşabilir.</p><div className="url-box"><span>Ortak giriş adresi</span><strong>{publicUrl}</strong><button aria-label="Adresi kopyala" onClick={() => void copyUrl()}><Copy size={15} /></button></div>{copyStatus && <p className="qr-copy-status">{copyStatus}</p>}<div className="qr-actions"><button className="button button-primary" onClick={downloadQr} disabled={!qrDataUrl}><Download size={17} /> QR indir</button><button className="button button-secondary" onClick={printQr} disabled={!qrDataUrl}><FileText size={17} /> Yazdır</button></div></div></div>
    <div className="qr-warning"><ShieldCheck size={17} /><span>Bu ortak QR kod kimlik doğrulamaz. Her müşteri kendi 6 haneli koduyla giriş yapar.</span></div>
  </div></div>;
}

export default App;
