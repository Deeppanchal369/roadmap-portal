import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { Button, Field, Input } from './ui/primitives';
import { Dialog } from './ui/overlays';

type Mode = 'signin' | 'signup';

/**
 * One dialog for both modes. Voting or commenting while signed out opens it in
 * place with a reason, so the visitor keeps their scroll position and their
 * half-written comment instead of being redirected to a login page.
 */
export function AuthDialog({
  open,
  reason,
  onOpenChange,
  onLogin,
  onRegister,
}: {
  open: boolean;
  reason?: string;
  onOpenChange: (open: boolean) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (input: { name: string; email: string; password: string }) => Promise<string | undefined>;
}) {
  const [mode, setMode] = useState<Mode>('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState<{ message: string; link?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((previous) => ({ ...previous, [key]: event.target.value }));
    setFieldErrors((previous) => ({ ...previous, [key]: '' }));
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setFieldErrors({});
    setFormError('');
    setNotice(null);
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    setFieldErrors({});

    try {
      if (mode === 'signin') {
        await onLogin(form.email, form.password);
      } else {
        const devToken = await onRegister(form);
        setNotice({
          message: 'Account created. Confirm your email address to sign in.',
          link: devToken ? `/verify-email?token=${devToken}` : undefined,
        });
        setForm({ name: '', email: '', password: '' });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        // Field-level messages from the server land under the right input;
        // anything else becomes one message above the button.
        if (error.details) setFieldErrors(error.details);
        else setFormError(error.message);
      } else {
        setFormError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'signin' ? 'Sign in' : 'Create an account'}
      description={
        reason
          ? `You need an account ${reason}.`
          : mode === 'signin'
            ? 'Welcome back.'
            : 'It takes about twenty seconds.'
      }
    >
      {notice ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted p-3 text-sm">
          <p>{notice.message}</p>
          {notice.link ? (
            <p className="text-muted-foreground">
              Email is simulated in this build, so use{' '}
              <Link
                to={notice.link}
                onClick={() => onOpenChange(false)}
                className="font-medium text-primary underline underline-offset-4"
              >
                this confirmation link
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {mode === 'signup' ? (
          <Field label="Name" htmlFor="auth-name" error={fieldErrors.name}>
            <Input
              id="auth-name"
              value={form.name}
              onChange={update('name')}
              autoComplete="name"
              aria-invalid={Boolean(fieldErrors.name)}
              required
            />
          </Field>
        ) : null}

        <Field label="Email" htmlFor="auth-email" error={fieldErrors.email}>
          <Input
            id="auth-email"
            type="email"
            value={form.email}
            onChange={update('email')}
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.email)}
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="auth-password"
          error={fieldErrors.password}
          hint={mode === 'signup' ? 'At least 8 characters, with a capital letter and a number.' : undefined}
        >
          <Input
            id="auth-password"
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            aria-invalid={Boolean(fieldErrors.password)}
            required
          />
        </Field>

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <Button type="submit" loading={submitting} className="w-full">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {mode === 'signin' ? 'Create an account' : 'I already have an account'}
        </button>
        {mode === 'signin' ? (
          <Link
            to="/forgot-password"
            onClick={() => onOpenChange(false)}
            className="underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        ) : null}
      </div>
    </Dialog>
  );
}
