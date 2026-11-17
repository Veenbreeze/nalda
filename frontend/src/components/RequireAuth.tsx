import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { BrandMark } from './AppShell';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-900">
        <BrandMark size="lg" />
        <p className="font-display text-xl text-white">NALDA CRM</p>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-[slide-in_1s_ease-in-out_infinite] bg-gold-500" />
        </div>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
