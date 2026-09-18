import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';

/**
 * Renders the markdown people write into requests and comments.
 *
 * `react-markdown` parses to a React tree rather than injecting HTML, and raw
 * HTML is *not* enabled, so a request body cannot smuggle a script tag into
 * anyone else's browser. Styling is applied through explicit element overrides
 * so the output inherits the app's tokens.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('text-sm leading-relaxed text-foreground', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children: c }) => <p className="mb-3 last:mb-0">{c}</p>,
          h1: ({ children: c }) => <h3 className="mb-2 mt-4 text-base font-semibold first:mt-0">{c}</h3>,
          h2: ({ children: c }) => <h3 className="mb-2 mt-4 text-base font-semibold first:mt-0">{c}</h3>,
          h3: ({ children: c }) => <h4 className="mb-2 mt-4 font-semibold first:mt-0">{c}</h4>,
          ul: ({ children: c }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{c}</ul>,
          ol: ({ children: c }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{c}</ol>,
          code: ({ children: c }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{c}</code>
          ),
          pre: ({ children: c }) => (
            <pre className="mb-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs last:mb-0">{c}</pre>
          ),
          blockquote: ({ children: c }) => (
            <blockquote className="mb-3 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">{c}</blockquote>
          ),
          a: ({ children: c, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-primary underline underline-offset-4"
            >
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
