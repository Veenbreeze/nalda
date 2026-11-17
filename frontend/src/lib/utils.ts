import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

let currentLanguage: 'en' | 'sw' = 'en';

export function setFormatLanguage(language: 'en' | 'sw'): void {
  currentLanguage = language;
}

function numberLocale(): string {
  return currentLanguage === 'sw' ? 'sw-TZ' : 'en-TZ';
}

function dateLocale(): string {
  return currentLanguage === 'sw' ? 'sw-TZ' : 'en-GB';
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: string | number | null | undefined, currency = 'TZS'): string {
  const num = typeof value === 'string' ? Number(value) : value ?? 0;
  const safe = Number.isFinite(num) ? num : 0;
  return `${currency} ${safe.toLocaleString(numberLocale(), { maximumFractionDigits: 0 })}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? Number(value) : value ?? 0;
  return (Number.isFinite(num) ? num : 0).toLocaleString(numberLocale());
}

export function formatBytes(bytes?: number | null): string {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / Math.pow(1024, index);
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(value?: string | null, withTime = false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(dateLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function timeAgo(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return '—';
  const diff = Date.now() - date;
  const minutes = Math.floor(diff / 60000);
  const sw = currentLanguage === 'sw';
  if (minutes < 1) return sw ? 'sasa hivi' : 'just now';
  if (minutes < 60) return sw ? `${minutes} dk zilizopita` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return sw ? `${hours} saa zilizopita` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return sw ? `${days} siku zilizopita` : `${days}d ago`;
  return formatDate(value);
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function titleCase(value?: string | null): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function hasPermission(admin: { role?: { permissions: string[] } } | null, permission: string): boolean {
  const perms = admin?.role?.permissions ?? [];
  return perms.includes('*') || perms.includes(permission);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
