import { Link } from 'react-router-dom';
import { useRoadmap } from '../hooks/usePosts';
import { ROADMAP_COLUMNS } from '../lib/constants';
import type { Post } from '../lib/types';
import { Card, EmptyState, Skeleton } from '../components/ui/primitives';
import { VoteButton } from '../components/VoteButton';
import { Map } from 'lucide-react';

export function RoadmapPage() {
  const { data, isLoading } = useRoadmap();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Roadmap</h1>
        <p className="text-sm text-muted-foreground">
          What's accepted, what's underway, and what's already shipped.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {ROADMAP_COLUMNS.map((column) => {
          const posts = data?.[column.value] ?? [];
          return (
            <div key={column.value} className="space-y-3">
              <div>
                <h2 className="font-medium">{column.label}</h2>
                <p className="text-xs text-muted-foreground">{column.blurb}</p>
              </div>

              <div className="space-y-2">
                {isLoading ? (
                  <>
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </>
                ) : posts.length === 0 ? (
                  <EmptyState
                    icon={<Map className="size-5" />}
                    title="Nothing here yet"
                    description="Requests will appear once they're moved into this stage."
                  />
                ) : (
                  posts.map((post) => <RoadmapCard key={post._id} post={post} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoadmapCard({ post }: { post: Post }) {
  return (
    <Card className="p-3">
      <Link to={`/requests/${post.slug}`} className="flex gap-3">
        <VoteButton postId={post._id} slug={post.slug} voteCount={post.voteCount} hasVoted={post.hasVoted} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{post.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{post.commentCount} comments</p>
        </div>
      </Link>
    </Card>
  );
}
