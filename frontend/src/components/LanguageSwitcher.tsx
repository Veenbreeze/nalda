import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { languageNames, type Language } from '../i18n/translations';
import { cn } from '../lib/utils';

const LANGUAGES: Language[] = ['en', 'sw'];

interface LanguageSwitcherProps {
  variant?: 'header' | 'light';
  className?: string;
}

export function LanguageSwitcher({ variant = 'header', className }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('shell.language')}
        title={t('shell.language')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl py-1.5 pl-2.5 pr-2 text-xs font-semibold transition',
          variant === 'header'
            ? 'border border-white/15 bg-white/10 text-gold-100 hover:bg-white/15'
            : 'border border-ink-200 bg-white text-ink-600 shadow-sm hover:border-ink-300',
        )}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:block">{languageNames[language]}</span>
        <span className="sm:hidden">{language.toUpperCase()}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('shell.language')}
          className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-xl border border-ink-100 bg-white p-1.5 shadow-xl"
        >
          {LANGUAGES.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={language === option}
              onClick={() => {
                setLanguage(option);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition',
                language === option
                  ? 'bg-gold-50 text-gold-700'
                  : 'text-ink-600 hover:bg-ink-50',
              )}
            >
              {languageNames[option]}
              {language === option && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
