import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, api } from '../lib/api';
import type { PublicUser } from '../lib/types';
import { AuthDialog } from '../components/AuthDialog';

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string }) => Promise<string | undefined>;
  logout: () => Promise<void>;
  /**
   * Returns true when the visitor is signed in. Otherwise it opens the sign-in
   * dialog with a reason and returns false, so a caller can write
   * `if (!requireAuth('to upvote')) return;` and stop there.
   */
  requireAuth: (reason?: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; reason?: string }>({ open: false });
  const queryClient = useQueryClient();

  // On load the app asks the server who it is talking to. The access cookie is
  // httpOnly, so there is nothing the JavaScript can read directly — and if it
  // has expired, the api client silently refreshes before this resolves.
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ user: PublicUser }>('/auth/me')
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<{ user: PublicUser }>('/auth/login', { email, password });
      setUser(data.user);
      setDialog({ open: false });
      // Vote state and admin-only data differ per user, so nothing cached for
      // the previous visitor may survive a sign-in.
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const data = await api.post<{ devVerificationToken?: string }>('/auth/register', input);
      return data.devVerificationToken;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    setUser(null);
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const requireAuth = useCallback(
    (reason?: string) => {
      if (user) return true;
      setDialog({ open: true, reason });
      return false;
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAdmin: user?.role === 'admin', login, register, logout, requireAuth }),
    [user, isLoading, login, register, logout, requireAuth],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthDialog
        open={dialog.open}
        reason={dialog.reason}
        onOpenChange={(open) => setDialog({ open })}
        onLogin={login}
        onRegister={register}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
