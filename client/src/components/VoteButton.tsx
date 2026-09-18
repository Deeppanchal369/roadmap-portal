import { ChevronUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useVote } from '../hooks/usePosts';
import { cn } from '../lib/utils';

export function VoteButton({
  postId,
  slug,
  voteCount,
  hasVoted,
  size = 'md',
}: {
  postId: string;
  slug?: string;
  voteCount: number;
  hasVoted: boolean;
  size?: 'sm' | 'md';
}) {
  const { requireAuth } = useAuth();
  const vote = useVote();

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!requireAuth('to upvote a request')) return;
        vote.mutate({ postId, slug, hasVoted });
      }}
      aria-pressed={hasVoted}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors',
        size === 'sm' ? 'h-12 w-11' : 'h-14 w-12',
        hasVoted
          ? 'border-primary bg-accent text-primary'
          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-primary',
      )}
    >
      <ChevronUp className={size === 'sm' ? 'size-4' : 'size-5'} strokeWidth={2.5} />
      <span className={cn('font-semibold tabular-nums', size === 'sm' ? 'text-xs' : 'text-sm')}>
        {voteCount}
      </span>
    </button>
  );
}
