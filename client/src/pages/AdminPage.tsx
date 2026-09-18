import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { Badge, Card, Skeleton, Textarea } from '../components/ui/primitives';
import { Select, useToast } from '../components/ui/overlays';
import { ApiError } from '../lib/api';
import { ALLOWED_TRANSITIONS, categoryLabel, STATUSES } from '../lib/constants';
import { useChangeStatus, useFeed } from '../hooks/usePosts';

/**
 * Admin-only board. Reuses the ordinary feed query (already scoped to the
 * signed-in user by the API client) rather than a second endpoint, since the
 * data an admin needs — every request, most recent first — is the same feed
 * anyone can request; the server enforces who may call the status-change
 * endpoint, not who may read the list.
 */
export function AdminPage() {
  const { data, isLoading } = useFeed({ q: '', category: '', status: '', sort: 'newest', page: 1 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">Move requests across the roadmap as they're triaged.</p>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20" />)
        ) : data && data.items.length > 0 ? (
          data.items.map((post) => <AdminRow key={post._id} post={post} />)
        ) : (
          <Card className="p-8 text-center text-sm text-muted-foreground">No requests yet.</Card>
        )}
      </div>
    </div>
  );
}

function AdminRow({ post }: { post: { _id: string; slug: string; title: string; status: string; category: string; voteCount: number } }) {
  const changeStatus = useChangeStatus();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);

  const allowedNext = ALLOWED_TRANSITIONS[post.status as keyof typeof ALLOWED_TRANSITIONS] ?? [];
  const options = [
    { value: post.status, label: STATUSES.find((s) => s.value === post.status)?.label ?? post.status },
    ...allowedNext.map((value) => ({
      value,
      label: STATUSES.find((s) => s.value === value)?.label ?? value,
    })),
  ];

  async function handleChange(next: string) {
    if (next === post.status) return;
    try {
      await changeStatus.mutateAsync({ postId: post._id, status: next, note });
      setNote('');
      setNoteOpen(false);
      toast.add({ title: 'Status updated', description: `Moved to ${next.replace('_', ' ')}`, type: 'success' });
    } catch (error) {
      toast.add({
        title: 'Could not update status',
        description: error instanceof ApiError ? error.message : 'Something went wrong',
        type: 'error',
      });
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/requests/${post.slug}`} className="min-w-0 flex-1 font-medium hover:underline">
          {post.title}
        </Link>
        <Badge>{categoryLabel(post.category)}</Badge>
        <span className="text-sm text-muted-foreground">{post.voteCount} votes</span>
        <StatusBadge status={post.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select ariaLabel={`Change status for ${post.title}`} value={post.status} onValueChange={handleChange} options={options} />
        <button
          type="button"
          onClick={() => setNoteOpen((open) => !open)}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {noteOpen ? 'Hide note' : 'Add a note'}
        </button>
      </div>

      {noteOpen ? (
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional context for this change (shown in the request's history)"
          rows={2}
        />
      ) : null}
    </Card>
  );
}
