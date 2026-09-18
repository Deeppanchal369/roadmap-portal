import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api, type Paginated } from '../lib/api';
import type { CommentNode, Post, RoadmapColumns } from '../lib/types';

export interface FeedFilters {
  q: string;
  category: string;
  status: string;
  sort: string;
  page: number;
}

export const postKeys = {
  all: ['posts'] as const,
  feed: (filters: FeedFilters) => ['posts', 'feed', filters] as const,
  detail: (slug: string) => ['posts', 'detail', slug] as const,
  roadmap: ['posts', 'roadmap'] as const,
  comments: (postId: string) => ['comments', postId] as const,
};

function buildQuery(filters: FeedFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  if (filters.sort) params.set('sort', filters.sort);
  params.set('page', String(filters.page));
  return params.toString();
}

export function useFeed(filters: FeedFilters) {
  return useQuery({
    queryKey: postKeys.feed(filters),
    queryFn: () => api.getPage<Post>(`/posts?${buildQuery(filters)}`),
    // Keeps the previous page on screen while the next one loads, so changing a
    // filter does not blank the list and jump the scroll position.
    placeholderData: (previous: Paginated<Post> | undefined) => previous,
  });
}

export function usePost(slug: string) {
  return useQuery({
    queryKey: postKeys.detail(slug),
    queryFn: () => api.get<Post>(`/posts/${slug}`),
    enabled: Boolean(slug),
  });
}

export function useRoadmap() {
  return useQuery({
    queryKey: postKeys.roadmap,
    queryFn: () => api.get<RoadmapColumns>('/posts/roadmap'),
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description: string; category: string }) =>
      api.post<Post>('/posts', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.all }),
  });
}

/**
 * Optimistic upvote.
 *
 * The card flips the instant it is clicked, because waiting ~200ms for a round
 * trip on the single most-used control in the product feels broken. The cache
 * snapshot taken in `onMutate` is restored verbatim in `onError`, so a failed
 * request leaves no trace of the optimistic change, and `onSettled` reconciles
 * with whatever the server actually recorded.
 *
 * Every cached view of the post is patched, not just the one that was clicked —
 * the same request can be on screen in the feed and open in a detail page.
 */
export function useVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, hasVoted }: { postId: string; slug?: string; hasVoted: boolean }) =>
      hasVoted
        ? api.delete<{ voteCount: number; hasVoted: boolean }>(`/posts/${postId}/vote`)
        : api.post<{ voteCount: number; hasVoted: boolean }>(`/posts/${postId}/vote`),

    onMutate: async ({ postId, hasVoted }) => {
      // Stop any in-flight refetch from landing on top of the optimistic state.
      await queryClient.cancelQueries({ queryKey: postKeys.all });

      const snapshot: Array<[QueryKey, unknown]> = queryClient.getQueriesData({
        queryKey: postKeys.all,
      });

      const delta = hasVoted ? -1 : 1;
      const patch = (post: Post): Post =>
        post._id === postId
          ? { ...post, voteCount: Math.max(0, post.voteCount + delta), hasVoted: !hasVoted }
          : post;

      queryClient.setQueriesData<unknown>({ queryKey: postKeys.all }, (current: unknown) => {
        if (!current) return current;

        // Feed page: { items, pagination }
        if (typeof current === 'object' && 'items' in (current as Paginated<Post>)) {
          const page = current as Paginated<Post>;
          return { ...page, items: page.items.map(patch) };
        }

        // Detail page: a single post
        if (typeof current === 'object' && '_id' in (current as Post)) {
          return patch(current as Post);
        }

        // Roadmap board: three arrays of posts
        if (typeof current === 'object' && 'planned' in (current as RoadmapColumns)) {
          const columns = current as RoadmapColumns;
          return {
            planned: columns.planned.map(patch),
            in_progress: columns.in_progress.map(patch),
            completed: columns.completed.map(patch),
          } satisfies RoadmapColumns;
        }

        return current;
      });

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: postKeys.all }),
  });
}

export function useChangeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, status, note }: { postId: string; status: string; note?: string }) =>
      api.patch<Post>(`/posts/${postId}/status`, { status, note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.all }),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.delete(`/posts/${postId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.all }),
  });
}

/* -------------------------------------------------------------- comments -- */

export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: postKeys.comments(postId ?? ''),
    queryFn: () => api.get<CommentNode[]>(`/posts/${postId}/comments`),
    enabled: Boolean(postId),
  });
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; parentId?: string }) =>
      api.post<CommentNode>(`/posts/${postId}/comments`, input),
    onSuccess: async () => {
      // The comment count on the post changes too, so both caches refresh.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: postKeys.comments(postId) }),
        queryClient.invalidateQueries({ queryKey: postKeys.all }),
      ]);
    },
  });
}

export function useUpdateComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.patch<CommentNode>(`/comments/${id}`, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.comments(postId) }),
  });
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/comments/${id}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: postKeys.comments(postId) }),
        queryClient.invalidateQueries({ queryKey: postKeys.all }),
      ]);
    },
  });
}
