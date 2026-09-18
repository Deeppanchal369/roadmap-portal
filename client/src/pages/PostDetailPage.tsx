import { Loader2, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { CommentThread } from '../components/CommentThread';
import { Markdown } from '../components/Markdown';
import { StatusBadge } from '../components/StatusBadge';
import { VoteButton } from '../components/VoteButton';
import { Avatar, Badge, Button, Card, Skeleton } from '../components/ui/primitives';
import { useAuth } from '../hooks/useAuth';
import { useComments, useDeletePost, usePost } from '../hooks/usePosts';
import { categoryLabel } from '../lib/constants';
import { formatRelativeTime } from '../lib/utils';

export function PostDetailPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: post, isLoading } = usePost(slug);
  const { data: comments, isLoading: commentsLoading } = useComments(post?._id);
  const deletePost = useDeletePost();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!post) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium">This request doesn't exist</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been removed.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate('/')}>
          Back to requests
        </Button>
      </Card>
    );
  }

  const canManage = user && (user.id === post.author?.id || user.role === 'admin');

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex gap-4">
          <VoteButton postId={post._id} slug={post.slug} voteCount={post.voteCount} hasVoted={post.hasVoted} />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={post.status} />
              <Badge>{categoryLabel(post.category)}</Badge>
            </div>

            <h1 className="text-xl font-semibold leading-snug">{post.title}</h1>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar name={post.author?.name ?? 'Deleted user'} src={post.author?.avatarUrl} className="size-6" />
              <span>{post.author?.name ?? 'Deleted user'}</span>
              <span>·</span>
              <span>{formatRelativeTime(post.createdAt)}</span>
            </div>

            <Markdown>{post.description}</Markdown>

            {canManage ? (
              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  loading={deletePost.isPending}
                  onClick={() => {
                    if (confirm('Delete this request? This cannot be undone.')) {
                      deletePost.mutate(post._id, { onSuccess: () => navigate('/') });
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      {post.statusHistory.length > 0 ? (
        <Card className="space-y-2 p-4">
          <p className="text-sm font-medium">History</p>
          <ol className="space-y-1.5 text-sm text-muted-foreground">
            {post.statusHistory.map((change, index) => (
              <li key={index}>
                Moved to <span className="font-medium text-foreground">{change.to.replace('_', ' ')}</span>
                {change.note ? ` — ${change.note}` : ''} · {formatRelativeTime(change.changedAt)}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="mb-4 font-medium">Comments · {post.commentCount}</h2>
        {commentsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading comments
          </div>
        ) : (
          <CommentThread postId={post._id} comments={comments ?? []} />
        )}
      </Card>
    </div>
  );
}
