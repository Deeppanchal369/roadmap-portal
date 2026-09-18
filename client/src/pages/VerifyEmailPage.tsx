import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Button, Card } from '../components/ui/primitives';

type State = 'checking' | 'success' | 'error';

/**
 * The link a "confirmation email" points to. Since email is simulated, the
 * dev-mode token is handed to the user directly (see AuthDialog) instead of
 * landing in an inbox; this page is what it resolves to either way.
 */
export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This link is missing its token.');
      return;
    }

    let cancelled = false;
    api
      .post('/auth/verify-email', { token })
      .then(() => {
        if (!cancelled) setState('success');
      })
      .catch((error) => {
        if (cancelled) return;
        setState('error');
        setMessage(error instanceof ApiError ? error.message : 'Something went wrong.');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto max-w-sm py-16">
      <Card className="space-y-4 p-6 text-center">
        {state === 'checking' ? (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Confirming your email…</p>
          </>
        ) : state === 'success' ? (
          <>
            <CheckCircle2 className="mx-auto size-10 text-[var(--color-status-done)]" />
            <div>
              <p className="font-medium">Email confirmed</p>
              <p className="mt-1 text-sm text-muted-foreground">You can sign in now.</p>
            </div>
            <Button className="w-full" onClick={() => navigate('/')}>
              Back to requests
            </Button>
          </>
        ) : (
          <>
            <XCircle className="mx-auto size-10 text-destructive" />
            <div>
              <p className="font-medium">Could not confirm this link</p>
              <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => navigate('/')}>
              Back to requests
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
