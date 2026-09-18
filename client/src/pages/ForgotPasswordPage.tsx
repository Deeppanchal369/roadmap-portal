import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { Button, Card, Field, Input } from '../components/ui/primitives';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ message: string; devLink?: string } | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await api.post<{ message: string; devResetToken?: string }>('/auth/forgot-password', {
        email,
      });
      setResult({
        message: data.message,
        devLink: data.devResetToken ? `/reset-password?token=${data.devResetToken}` : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-16">
      <Card className="space-y-4 p-6">
        <div>
          <h1 className="text-lg font-semibold">Reset your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we'll send you a link to choose a new one.
          </p>
        </div>

        {result ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted p-3 text-sm">
            <p>{result.message}</p>
            {result.devLink ? (
              <p className="text-muted-foreground">
                Email is simulated in this build, so use{' '}
                <Link
                  to={result.devLink}
                  className="font-medium text-primary underline underline-offset-4"
                >
                  this reset link
                </Link>
                .
              </p>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field label="Email" htmlFor="forgot-email">
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" loading={submitting}>
              Send reset link
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to requests
        </button>
      </Card>
    </div>
  );
}
