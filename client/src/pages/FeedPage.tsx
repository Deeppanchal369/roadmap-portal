import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FeedFilterBar } from '../components/FeedFilterBar';
import { PostCard } from '../components/PostCard';
import { Button, Card, EmptyState, Skeleton } from '../components/ui/primitives';
import { useDebounce } from '../hooks/useDebounce';
import { useFeed, type FeedFilters } from '../hooks/usePosts';
import { Inbox } from 'lucide-react';

const DEFAULT_FILTERS: FeedFilters = { q: '', category: '', status: '', sort: 'trending', page: 1 };

export function FeedPage() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<FeedFilters>({
    ...DEFAULT_FILTERS,
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    status: params.get('status') ?? '',
    sort: params.get('sort') ?? 'trending',
    page: Number(params.get('page') ?? 1),
  });

  const debouncedQuery = useDebounce(filters.q);
  const activeFilters = { ...filters, q: debouncedQuery };
  const { data, isLoading, isPlaceholderData } = useFeed(activeFilters);

  function updateFilters(patch: Partial<FeedFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    const nextParams = new URLSearchParams();
    if (next.q) nextParams.set('q', next.q);
    if (next.category) nextParams.set('category', next.category);
    if (next.status) nextParams.set('status', next.status);
    if (next.sort !== 'trending') nextParams.set('sort', next.sort);
    if (next.page > 1) nextParams.set('page', String(next.page));
    setParams(nextParams, { replace: true });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Feature requests</h1>
        <p className="text-sm text-muted-foreground">Suggest something, or upvote what already matters to you.</p>
      </div>

      <FeedFilterBar filters={filters} onChange={updateFilters} />

      <div className={`space-y-3 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)
        ) : data && data.items.length > 0 ? (
          data.items.map((post) => <PostCard key={post._id} post={post} />)
        ) : (
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="No requests match"
            description={
              filters.q || filters.category || filters.status
                ? 'Try clearing a filter or searching something else.'
                : 'Be the first to suggest something.'
            }
          />
        )}
      </div>

      {data && data.pagination.totalPages > 1 ? (
        <Card className="flex items-center justify-between p-3 text-sm">
          <span className="text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} requests
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={filters.page <= 1}
              onClick={() => updateFilters({ page: filters.page - 1 })}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={filters.page >= data.pagination.totalPages}
              onClick={() => updateFilters({ page: filters.page + 1 })}
            >
              Next
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
