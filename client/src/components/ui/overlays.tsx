import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Select as BaseSelect } from '@base-ui/react/select';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { Toast } from '@base-ui/react/toast';
import { Check, ChevronDown, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Overlay primitives. Base UI handles focus trapping, scroll locking, escape
 * and outside-click dismissal, arrow-key navigation and the ARIA wiring — all
 * of which is easy to get subtly wrong by hand and is exactly what the registry
 * builds on.
 */

/* ---------------------------------------------------------------- dialog -- */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]" />
        <BaseDialog.Popup
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'max-h-[calc(100vh-4rem)] overflow-y-auto rounded-card border border-border bg-card p-6 shadow-xl',
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <BaseDialog.Title className="text-lg font-semibold">{title}</BaseDialog.Title>
              {description ? (
                <BaseDialog.Description className="text-sm text-muted-foreground">
                  {description}
                </BaseDialog.Description>
              ) : null}
            </div>
            <BaseDialog.Close
              aria-label="Close"
              className="-mr-1 -mt-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </BaseDialog.Close>
          </div>
          {children}
          {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

/* ---------------------------------------------------------------- select -- */

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
      items={options as SelectOption[]}
    >
      <BaseSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-9 min-w-36 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm',
          'hover:bg-muted',
          className,
        )}
      >
        <BaseSelect.Value />
        <BaseSelect.Icon>
          <ChevronDown className="size-4 text-muted-foreground" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} className="z-50">
          <BaseSelect.Popup className="max-h-72 min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
            {options.map((option) => (
              <BaseSelect.Item
                key={option.value}
                value={option.value}
                className="flex cursor-default items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm data-[highlighted]:bg-muted"
              >
                <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                <BaseSelect.ItemIndicator>
                  <Check className="size-4 text-primary" />
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

/* ------------------------------------------------------------------ tabs -- */

export function Tabs({
  value,
  onValueChange,
  items,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: ReadonlyArray<{ value: string; label: string; count?: number }>;
  className?: string;
}) {
  return (
    <BaseTabs.Root
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
      className={className}
    >
      <BaseTabs.List className="relative flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {items.map((item) => (
          <BaseTabs.Tab
            key={item.value}
            value={item.value}
            className={cn(
              'relative z-10 flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground',
              'data-[selected]:text-foreground',
            )}
          >
            {item.label}
            {typeof item.count === 'number' ? (
              <span className="text-xs text-muted-foreground">{item.count}</span>
            ) : null}
          </BaseTabs.Tab>
        ))}
        {/* Slides between tabs, so the change of selection is visible rather than instant. */}
        <BaseTabs.Indicator className="absolute left-0 top-1 z-0 h-[calc(100%-0.5rem)] w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] rounded-md bg-card shadow-sm transition-all duration-200" />
      </BaseTabs.List>
    </BaseTabs.Root>
  );
}

/* ----------------------------------------------------------------- toast -- */

export const ToastProvider = Toast.Provider;
export const useToast = Toast.useToastManager;

export function ToastViewport() {
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        <ToastList />
      </Toast.Viewport>
    </Toast.Portal>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return (
    <>
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          toast={toast}
          className={cn(
            'w-full rounded-lg border border-border bg-card p-3 pr-9 shadow-lg',
            toast.type === 'error' && 'border-destructive/40',
          )}
        >
          <Toast.Title className="text-sm font-medium" />
          <Toast.Description className="mt-0.5 text-sm text-muted-foreground" />
          <Toast.Close
            aria-label="Dismiss"
            className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </Toast.Close>
        </Toast.Root>
      ))}
    </>
  );
}
