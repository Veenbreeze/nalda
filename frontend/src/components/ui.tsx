import React, { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { cn, initials } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';

// ---------------- Button ----------------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'gold-outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-gold-400 to-gold-600 text-ink-900 hover:from-gold-300 hover:to-gold-500 shadow-gold focus-visible:ring-gold-500',
  secondary:
    'border border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50 focus-visible:ring-ink-300',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 focus-visible:ring-ink-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  dark: 'bg-ink-900 text-white hover:bg-ink-800 focus-visible:ring-ink-700',
  'gold-outline': 'border border-gold-500/60 bg-gold-50 text-gold-700 hover:bg-gold-100 focus-visible:ring-gold-400',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
  icon: 'h-9 w-9',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

// ---------------- Inputs ----------------
interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldWrapper({ label, error, hint, required, children, className }: FieldWrapperProps) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export function Input({ label, error, hint, wrapperClassName, className, required, ...props }: InputProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <input
        className={cn('input-base', error && 'border-red-400 focus:border-red-500 focus:ring-red-500/10', className)}
        {...props}
      />
    </FieldWrapper>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export function Textarea({ label, error, hint, wrapperClassName, className, required, ...props }: TextareaProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <textarea
        className={cn('input-base min-h-[90px] resize-y', error && 'border-red-400', className)}
        {...props}
      />
    </FieldWrapper>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  hint,
  wrapperClassName,
  className,
  options,
  placeholder,
  children,
  required,
  ...props
}: SelectProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <select className={cn('input-base appearance-none', error && 'border-red-400', className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
    </FieldWrapper>
  );
}

// ---------------- Card ----------------
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4', className)}>
      <div>
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------- Badge ----------------
type Tone = 'gold' | 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple' | 'ink';

const toneClasses: Record<Tone, string> = {
  gold: 'bg-gold-50 text-gold-700 ring-gold-500/20',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  gray: 'bg-ink-100 text-ink-600 ring-ink-500/10',
  purple: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  ink: 'bg-ink-900 text-white ring-ink-900',
};

export function Badge({
  children,
  tone = 'gray',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusToneMap: Record<string, Tone> = {
  ACTIVE: 'green',
  INACTIVE: 'gray',
  ARCHIVED: 'gray',
  NEW: 'blue',
  PENDING_CONFIRMATION: 'amber',
  CONFIRMED: 'gold',
  PROCESSING: 'purple',
  DELIVERED: 'green',
  CANCELLED: 'red',
  UNPAID: 'red',
  PARTIALLY_PAID: 'amber',
  PAID: 'green',
  REFUNDED: 'gray',
  OPEN: 'green',
  PENDING: 'amber',
  CLOSED: 'gray',
  SENDING: 'amber',
  SENT: 'green',
  DRAFT: 'gray',
  SCHEDULED: 'blue',
  FAILED: 'red',
  COMPLETED: 'green',
  ACTIVE_WORKFLOW: 'green',
  REQUESTED: 'blue',
  SOURCING: 'amber',
  PURCHASED: 'purple',
  IN_TRANSIT: 'gold',
  ARRIVED: 'green',
  HIGH: 'red',
  MEDIUM: 'amber',
  LOW: 'gray',
  WON: 'green',
  LOST: 'red',
};

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const { enumLabel } = useLanguage();
  const key = (status ?? '').toUpperCase();
  return (
    <Badge tone={statusToneMap[key] ?? 'gray'} className={className}>
      {enumLabel(status)}
    </Badge>
  );
}

// ---------------- Avatar ----------------
const avatarColors = ['bg-gold-100 text-gold-700', 'bg-sky-100 text-sky-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700'];

export function Avatar({ name, size = 'md', className }: { name?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };
  const color = avatarColors[(name?.length ?? 0) % avatarColors.length];
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold', sizes[size], color, className)}>
      {initials(name)}
    </div>
  );
}

// ---------------- Modal ----------------
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const { tr } = useLanguage();
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={cn(
          'flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl animate-fade-in sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700" aria-label={tr('Close', 'Funga')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------- Feedback ----------------
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-gold-600', className)} />;
}

export function PageLoader({ label }: { label?: string }) {
  const { tr } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-ink-400">
      <Spinner className="h-8 w-8" />
      <p className="mt-3 text-sm">{label ?? tr('Loading…', 'Inapakia…')}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-50 text-gold-600">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------------- Pagination ----------------
export function Pagination({
  page,
  totalPages,
  total,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (total === 0) return null;
  return <PaginationInner page={page} totalPages={totalPages} total={total} onChange={onChange} className={className} />;
}

function PaginationInner({
  page,
  totalPages,
  total,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  const { tr } = useLanguage();
  return (
    <div className={cn('flex flex-col items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 sm:flex-row', className)}>
      <p className="text-xs text-ink-400">
        {tr('Page', 'Ukurasa')} <span className="font-semibold text-ink-600">{page}</span> {tr('of', 'wa')}{' '}
        <span className="font-semibold text-ink-600">{Math.max(1, totalPages)}</span> · {total.toLocaleString()}{' '}
        {tr('records', 'rekodi')}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} leftIcon={<ChevronLeft className="h-4 w-4" />}>
          {tr('Prev', 'Nyuma')}
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} rightIcon={<ChevronRight className="h-4 w-4" />}>
          {tr('Next', 'Mbele')}
        </Button>
      </div>
    </div>
  );
}

// ---------------- Tabs ----------------
export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto rounded-xl bg-ink-100/70 p-1 scrollbar-none', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition',
            value === tab.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {tab.label}
          {typeof tab.count === 'number' && (
            <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]', value === tab.value ? 'bg-gold-100 text-gold-700' : 'bg-ink-200/60 text-ink-500')}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------- Page header ----------------
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------- Stat card ----------------
export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = 'gold',
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <Card className="p-4 transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset', toneClasses[tone])}>{icon}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </Card>
  );
}
