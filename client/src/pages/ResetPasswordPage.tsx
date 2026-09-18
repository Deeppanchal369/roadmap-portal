import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { Button, Card, Field, Input } from '../components/ui/primitives';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details?.password) setFieldError(err.details.password);
        else setError(err.message);
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-16">
      <Card className="space-y-4 p-6">
        {!token ? (
          <p className="text-sm text-destructive">This link is missing its token.</p>
        ) : done ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto size-10 text-[var(--color-status-done)]" />
            <div>
              <p className="font-medium">Password updated</p>
              <p className="mt-1 text-sm text-muted-foreground">Sign in with your new password.</p>
            </div>
            <Button className="w-full" onClick={() => navigate('/')}>
              Back to requests
            </Button>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-semibold">Choose a new password</h1>
              <p className="mt-1 text-sm text-muted-foreground">This link works once and expires in an hour.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Field
                label="New password"
                htmlFor="reset-password"
                error={fieldError}
                hint="At least 8 characters, with a capital letter and a number."
              >
                <Input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldError)}
                  required
                />
              </Field>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" loading={submitting}>
                Update password
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
