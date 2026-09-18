import { Search, X } from 'lucide-react';
import { CATEGORIES, SORT_OPTIONS, STATUSES } from '../lib/constants';
import type { FeedFilters as Filters } from '../hooks/usePosts';
import { Input } from './ui/primitives';
import { Select } from './ui/overlays';

const CATEGORY_OPTIONS = [{ value: '', label: 'All categories' }, ...CATEGORIES];
const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, ...STATUSES];

export function FeedFilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.q}
          onChange={(event) => onChange({ q: event.target.value, page: 1 })}
          placeholder="Search requests…"
          aria-label="Search requests"
          className="pl-9 pr-9"
        />
        {filters.q ? (
          <button
            type="button"
            onClick={() => onChange({ q: '', page: 1 })}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          ariaLabel="Filter by category"
          value={filters.category}
          onValueChange={(value) => onChange({ category: value, page: 1 })}
          options={CATEGORY_OPTIONS}
        />
        <Select
          ariaLabel="Filter by status"
          value={filters.status}
          onValueChange={(value) => onChange({ status: value, page: 1 })}
          options={STATUS_OPTIONS}
        />
        <Select
          ariaLabel="Sort requests"
          value={filters.sort}
          onValueChange={(value) => onChange({ sort: value, page: 1 })}
          options={SORT_OPTIONS}
        />
      </div>
    </div>
  );
}
