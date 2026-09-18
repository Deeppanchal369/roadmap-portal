import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Skeleton } from './ui/primitives';

/**
 * Client-side gate only — a nicety so a non-admin lands somewhere sensible
 * instead of a broken page. The actual authorization is enforced server-side
 * by `authorize('admin')` on the status-change route; this component cannot be
 * the security boundary because anyone can read and change client code.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();

  if (isLoading) return <Skeleton className="h-32" />;
  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
