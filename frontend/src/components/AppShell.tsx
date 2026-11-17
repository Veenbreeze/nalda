import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardList,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Megaphone,
  Settings,
  ShoppingBag,
  Sparkles,
  Target,
  Truck,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { cn, hasPermission, initials } from '../lib/utils';
import { Avatar } from './ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';

type NavItem = { to: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; permission: string; end?: boolean };

const navItems: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'dashboard.view', end: true },
  { to: '/customers', labelKey: 'nav.customers', icon: Users, permission: 'customer.view' },
  { to: '/products', labelKey: 'nav.products', icon: Boxes, permission: 'product.view' },
  { to: '/orders', labelKey: 'nav.orders', icon: ClipboardList, permission: 'order.view' },
  { to: '/pipeline', labelKey: 'nav.pipeline', icon: Target, permission: 'deal.view' },
  { to: '/inbox', labelKey: 'nav.inbox', icon: MessageCircle, permission: 'whatsapp.view' },
  { to: '/campaigns', labelKey: 'nav.campaigns', icon: Megaphone, permission: 'whatsapp.campaign' },
  { to: '/automations', labelKey: 'nav.automations', icon: Workflow, permission: 'automation.view' },
  { to: '/cargo', labelKey: 'nav.cargo', icon: Truck, permission: 'cargo.view' },
  { to: '/reports', labelKey: 'nav.reports', icon: BarChart3, permission: 'report.view' },
  { to: '/data', labelKey: 'nav.data', icon: Database, permission: 'customer.import' },
];

const bottomItems: NavItem[] = [
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'settings.view' },
];

export function AppShell() {
  const { admin, logout } = useAuth();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const can = (permission: string) => hasPermission(admin, permission);
  const current = [...navItems, ...bottomItems].find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 font-display text-lg font-bold text-ink-900 shadow-gold">
          N
        </div>
        <div>
          <p className="font-display text-base font-semibold leading-tight text-white">NALDA</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold-400">{t('shell.brandSubtitle')}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">{t('shell.workspace')}</p>
        {navItems.filter((item) => can(item.permission)).map((item) => {
          const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={cn('sidebar-link relative', active && 'sidebar-link-active')}
            >
              <item.icon className={cn('h-[18px] w-[18px]', active ? 'text-gold-400' : 'text-ink-400')} />
              {t(item.labelKey)}
            </NavLink>
          );
        })}

        <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">{t('shell.administration')}</p>
        {bottomItems.filter((item) => can(item.permission)).map((item) => {
          const active = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn('sidebar-link relative', active && 'sidebar-link-active')}
            >
              <item.icon className={cn('h-[18px] w-[18px]', active ? 'text-gold-400' : 'text-ink-400')} />
              {t(item.labelKey)}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/15 text-xs font-bold text-gold-400">
            {initials(admin?.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{admin?.fullName}</p>
            <p className="truncate text-[10px] text-ink-400">{admin?.role?.name}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-ink-900 lg:block">{SidebarContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 animate-slide-in bg-ink-900">
            <button
              className="absolute right-3 top-5 rounded-lg p-1.5 text-ink-400 hover:bg-white/10 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-gold-500/20 bg-gradient-to-r from-gold-700 via-gold-800 to-ink-900 px-4 text-white shadow-sm sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-gold-100/80 hover:bg-white/10 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label={t('shell.openNavigation')}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-gold-100/70">NALDA USA Products</p>
              <p className="text-sm font-semibold text-white">{current ? t(current.labelKey) : 'CRM'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-gold-100 ring-1 ring-inset ring-white/15 xl:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Mikocheni B · Dar es Salaam
            </div>
            <LanguageSwitcher />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 py-1.5 pl-1.5 pr-2.5 transition hover:bg-white/15"
              >
                <Avatar name={admin?.fullName} size="sm" />
                <span className="hidden text-left sm:block">
                  <span className="block text-xs font-semibold leading-tight text-white">{admin?.fullName}</span>
                  <span className="block text-[10px] leading-tight text-gold-100/70">{admin?.role?.name}</span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-gold-100/70" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-2 w-52 animate-fade-in rounded-xl border border-ink-100 bg-white p-1.5 shadow-card">
                    <div className="border-b border-ink-100 px-3 py-2">
                      <p className="truncate text-xs font-semibold text-ink-800">{admin?.email}</p>
                      <p className="text-[10px] text-ink-400">{admin?.role?.name}</p>
                    </div>
                    <NavLink
                      to="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink-600 hover:bg-ink-50"
                    >
                      <Settings className="h-3.5 w-3.5" /> {t('shell.settings')}
                    </NavLink>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-3.5 w-3.5" /> {t('shell.signOut')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-9 w-9 text-base', md: 'h-12 w-12 text-xl', lg: 'h-16 w-16 text-2xl' };
  return (
    <div className={cn('flex items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-600 font-display font-bold text-ink-900 shadow-gold', sizes[size])}>
      N
    </div>
  );
}

export function EmptyIcon({ icon: Icon }: { icon: typeof ShoppingBag }) {
  return <Icon className="h-6 w-6" />;
}

export { Sparkles };
