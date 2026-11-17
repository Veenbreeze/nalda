import { Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '../components/ui';
import { useLanguage } from '../i18n/LanguageContext';

export function NotFoundPage() {
  const { tr } = useLanguage();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-7xl font-semibold text-gold-500">404</p>
      <h1 className="mt-2 text-xl font-semibold text-ink-900">{tr('This page could not be found', 'Ukurasa huu haujapatikana')}</h1>
      <p className="mt-1 max-w-md text-sm text-ink-400">
        {tr(
          'The page you are looking for may have been moved, renamed or never existed.',
          'Ukurasa unaoutafuta unaweza kuwa umehamishwa, umebadilishwa jina au haukuwepo.',
        )}
      </p>
      <div className="mt-5 flex gap-2">
        <Link to="/">
          <Button leftIcon={<Home className="h-4 w-4" />}>{tr('Back to dashboard', 'Rudi kwenye dashibodi')}</Button>
        </Link>
        <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => window.history.back()}>
          {tr('Go back', 'Rudi')}
        </Button>
      </div>
    </div>
  );
}
