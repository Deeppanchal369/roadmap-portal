import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Post } from '../lib/types';
import { categoryLabel } from '../lib/constants';
import { formatRelativeTime } from '../lib/utils';
import { Avatar, Badge, Card } from './ui/primitives';
import { StatusBadge } from './StatusBadge';
import { VoteButton } from './VoteButton';

export function PostCard({ post }: { post: Post }) {
  return (
    <Card className="flex gap-4 p-4 transition-colors hover:border-foreground/20">
      <VoteButton postId={post._id} slug={post.slug} voteCount={post.voteCount} hasVoted={post.hasVoted} />

      <Link to={`/requests/${post.slug}`} className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={post.status} />
          <Badge>{categoryLabel(post.category)}</Badge>
        </div>

        <h3 className="font-medium leading-snug">{post.title}</h3>

        <p className="line-clamp-2 text-sm text-muted-foreground">
          {post.description.replace(/[#*_`>-]/g, '')}
        </p>

        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Avatar name={post.author?.name ?? 'Deleted user'} src={post.author?.avatarUrl} className="size-5" />
            {post.author?.name ?? 'Deleted user'}
          </span>
          <span>{formatRelativeTime(post.createdAt)}</span>
          <span className="ml-auto flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {post.commentCount}
          </span>
        </div>
      </Link>
    </Card>
  );
}
