import { LogOut, Map, MessageSquarePlus, ShieldCheck } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Avatar, Button } from './ui/primitives';
import { NewRequestDialog } from './NewRequestDialog';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
  }`;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, logout, requireAuth } = useAuth();
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <MessageSquarePlus className="size-3.5" />
            </span>
            Roadmap
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Requests
            </NavLink>
            <NavLink to="/roadmap" className={navLinkClass}>
              <span className="flex items-center gap-1.5">
                <Map className="size-3.5" />
                Roadmap
              </span>
            </NavLink>
            {isAdmin ? (
              <NavLink to="/admin" className={navLinkClass}>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" />
                  Admin
                </span>
              </NavLink>
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (requireAuth('to submit a request')) setComposerOpen(true);
              }}
            >
              <MessageSquarePlus />
              New request
            </Button>

            {user ? (
              <div className="flex items-center gap-2 pl-1">
                <Avatar name={user.name} src={user.avatarUrl} className="size-7" />
                <button
                  onClick={() => void logout()}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => requireAuth()}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>

      <NewRequestDialog open={composerOpen} onOpenChange={setComposerOpen} />
    </div>
  );
}
