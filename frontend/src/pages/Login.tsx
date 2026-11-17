import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { apiErrorMessage } from '../lib/api';
import { BrandMark } from '../components/AppShell';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useLanguage } from '../i18n/LanguageContext';
import { Button, Input } from '../components/ui';

const FEATURE_KEYS = ['login.feature1', 'login.feature2', 'login.feature3', 'login.feature4'] as const;

export function LoginPage() {
  const { admin, login } = useAuth();
  const { t, tr } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (admin) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      toast.success(t('login.welcomeToast'));
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-cream px-4 py-4 sm:px-6">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-gold-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-gold-300/30 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-10 hidden h-40 w-40 rounded-full border-[12px] border-gold-200/40 lg:block" />
      <div className="pointer-events-none absolute bottom-16 left-1/4 hidden h-24 w-24 rounded-full border-[10px] border-gold-300/30 lg:block" />

      <div className="relative grid max-h-full w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/80 shadow-card backdrop-blur-md lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-gold-700 via-gold-800 to-ink-900 p-8 text-white lg:flex [@media(max-height:720px)]:p-6 xl:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-300/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-gold-400/20 blur-2xl" />

          <div className="relative flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="font-display text-xl font-semibold text-white">NALDA USA Products</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold-200">{t('login.brandSubtitle')}</p>
            </div>
          </div>

          <div className="relative mt-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-gold-100">
              <Sparkles className="h-3.5 w-3.5" /> {tr('Beauty · Skincare · Perfumes · Baby Essentials', 'Urembo · Utunzaji wa ngozi · Manukato · Mahitaji ya watoto')}
            </div>
            <h1 className="font-display text-[32px] font-semibold leading-tight text-white xl:text-4xl">
              {t('login.tagline')}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-gold-100/80">{t('login.description')}</p>

            <div className="mt-6 space-y-2 [@media(max-height:720px)]:hidden">
              {FEATURE_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5 ring-1 ring-inset ring-white/10">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-400/30 text-gold-100">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs font-medium text-white">{t(key)}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="relative mt-8 text-[11px] text-gold-200/70 [@media(max-height:680px)]:hidden">Mikocheni B, Dar es Salaam · +255 747 163 059</p>
        </div>

        <div className="flex min-h-0 flex-col justify-center overflow-y-auto px-6 py-8 sm:px-10 lg:px-12 lg:py-10 [@media(max-height:720px)]:py-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 lg:hidden">
              <BrandMark />
              <div>
                <p className="font-display text-lg font-semibold text-ink-900">NALDA CRM</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gold-600">{t('shell.brandSubtitle')}</p>
              </div>
            </div>
            <LanguageSwitcher variant="light" className="ml-auto" />
          </div>

          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-700">
              <ShieldCheck className="h-3.5 w-3.5" /> {t('login.adminAccess')}
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold text-ink-900">{t('login.welcomeBack')}</h2>
            <p className="mt-2 text-sm text-ink-400">{t('login.subtitle')}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-[42px] h-4 w-4 text-ink-300" />
              <Input
                label={t('login.email')}
                type="email"
                autoComplete="email"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-2xl pl-11"
                required
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-[42px] h-4 w-4 text-ink-300" />
              <Input
                label={t('login.password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t('login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-2xl pl-11 pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-[38px] rounded-full p-1 text-ink-400 hover:text-ink-700"
                aria-label={t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button
              type="submit"
              size="lg"
              loading={loading}
              className="w-full rounded-2xl"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {t('login.signIn')}
            </Button>
          </form>

          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-gold-200 bg-gold-50/70 p-3.5 [@media(max-height:680px)]:hidden">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
            <div className="text-[11px] leading-relaxed text-gold-800">
              <p className="font-semibold">{t('login.authorisedTitle')}</p>
              <p className="mt-0.5 text-gold-700/80">{t('login.authorisedBody')}</p>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-ink-400 [@media(max-height:680px)]:hidden">
            {t('login.footer', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </div>
  );
}
