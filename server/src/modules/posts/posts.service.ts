import mongoose, { type PipelineStage } from 'mongoose';
import { Comment } from '../../models/Comment.js';
import { Post, ROADMAP_STATUSES, canTransition, type PostStatus } from '../../models/Post.js';
import { ApiError } from '../../utils/ApiError.js';
import { trendingScoreStage } from '../../utils/trending.js';
import type { ListPostsQuery } from './posts.validation.js';

const toId = (value: string) => new mongoose.Types.ObjectId(value);

/** Author fields safe to show publicly. Nothing else leaves the database. */
const authorLookup: PipelineStage.FacetPipelineStage[] = [
  {
    $lookup: {
      from: 'users',
      localField: 'author',
      foreignField: '_id',
      as: 'author',
      pipeline: [{ $project: { name: 1, avatarUrl: 1, role: 1 } }],
    },
  },
  { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
];

/**
 * `voters` can be long, and the client only needs one bit from it: did *I*
 * already vote? It is computed in the database and the array itself is dropped
 * before the documents leave Mongo.
 */
function viewerStages(viewerId?: string): PipelineStage.FacetPipelineStage[] {
  return [
    {
      $addFields: {
        hasVoted: viewerId
          ? { $in: [toId(viewerId), { $ifNull: ['$voters', []] }] }
          : false,
      },
    },
    { $project: { voters: 0 } },
  ];
}

const SORT_SPECS: Record<string, Record<string, 1 | -1>> = {
  trending: { trendingScore: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  top: { voteCount: -1, createdAt: -1 },
  discussed: { commentCount: -1, createdAt: -1 },
};

export async function listPosts(query: ListPostsQuery, viewerId?: string) {
  const { q, category, status, page, limit } = query;
  const sort = query.sort ?? (q ? 'relevance' : 'trending');

  const match: Record<string, unknown> = {};
  if (category) match.category = category;
  if (status) match.status = status;
  // `$text` is only valid in the first stage, so the text clause is folded into
  // the same `$match` as the filters rather than added later.
  if (q) match.$text = { $search: q };

  const pipeline: PipelineStage[] = [{ $match: match }];
  if (q) pipeline.push({ $addFields: { relevance: { $meta: 'textScore' } } });
  pipeline.push(trendingScoreStage as PipelineStage);

  const sortStage: Record<string, 1 | -1> =
    sort === 'relevance' && q
      ? { relevance: -1, voteCount: -1 }
      : (SORT_SPECS[sort] ?? SORT_SPECS.trending!);
  pipeline.push({ $sort: sortStage });

  // One round trip returns both the page and the total, so the UI can render
  // pagination without a second count query racing the first.
  pipeline.push({
    $facet: {
      items: [
        { $skip: (page - 1) * limit },
        { $limit: limit },
        ...authorLookup,
        ...viewerStages(viewerId),
      ],
      meta: [{ $count: 'total' }],
    },
  });

  const [result] = await Post.aggregate(pipeline);
  const items = result?.items ?? [];
  const total: number = result?.meta?.[0]?.total ?? 0;

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getPostBySlug(slug: string, viewerId?: string) {
  const [post] = await Post.aggregate([
    { $match: { slug } },
    ...authorLookup,
    ...viewerStages(viewerId),
    {
      $lookup: {
        from: 'users',
        localField: 'statusHistory.changedBy',
        foreignField: '_id',
        as: 'statusActors',
        pipeline: [{ $project: { name: 1, avatarUrl: 1 } }],
      },
    },
  ]);

  if (!post) throw ApiError.notFound('That feature request does not exist');
  return post;
}

export async function createPost(
  input: { title: string; description: string; category: string },
  authorId: string,
) {
  const post = await Post.create({ ...input, author: authorId });
  return post.populate('author', 'name avatarUrl role');
}

export async function updatePost(
  postId: string,
  input: Partial<{ title: string; description: string; category: string }>,
  actor: { id: string; role: string },
) {
  const post = await Post.findById(postId);
  if (!post) throw ApiError.notFound('That feature request does not exist');

  const isOwner = post.author.toString() === actor.id;
  if (!isOwner && actor.role !== 'admin') {
    throw ApiError.forbidden('Only the author or an admin can edit this request');
  }

  Object.assign(post, input);
  await post.save();
  return post.populate('author', 'name avatarUrl role');
}

export async function deletePost(postId: string, actor: { id: string; role: string }) {
  const post = await Post.findById(postId);
  if (!post) throw ApiError.notFound('That feature request does not exist');

  const isOwner = post.author.toString() === actor.id;
  if (!isOwner && actor.role !== 'admin') {
    throw ApiError.forbidden('Only the author or an admin can delete this request');
  }

  await Promise.all([post.deleteOne(), Comment.deleteMany({ post: post._id })]);
}

/**
 * Voting, done in a single atomic update.
 *
 * The guard `voters: { $ne: userId }` lives in the *filter*, not in application
 * code. Two simultaneous clicks therefore cannot both pass a read-then-write
 * check: MongoDB matches the document once, and the second update finds nothing
 * to match. `$addToSet` and `$inc` land together in that one operation, so the
 * array and the counter can never disagree.
 */
export async function addVote(postId: string, userId: string) {
  const updated = await Post.findOneAndUpdate(
    { _id: postId, voters: { $ne: toId(userId) } },
    { $addToSet: { voters: toId(userId) }, $inc: { voteCount: 1 } },
    { new: true },
  ).select('voteCount');

  if (updated) return { voteCount: updated.voteCount, hasVoted: true };

  // No match means either the post is gone or this user had already voted.
  // Voting twice is treated as a no-op rather than an error, so a double click
  // or a retried request does not surface a scary failure.
  const existing = await Post.findById(postId).select('voteCount');
  if (!existing) throw ApiError.notFound('That feature request does not exist');
  return { voteCount: existing.voteCount, hasVoted: true };
}

export async function removeVote(postId: string, userId: string) {
  const updated = await Post.findOneAndUpdate(
    { _id: postId, voters: toId(userId) },
    { $pull: { voters: toId(userId) }, $inc: { voteCount: -1 } },
    { new: true },
  ).select('voteCount');

  if (updated) return { voteCount: updated.voteCount, hasVoted: false };

  const existing = await Post.findById(postId).select('voteCount');
  if (!existing) throw ApiError.notFound('That feature request does not exist');
  return { voteCount: existing.voteCount, hasVoted: false };
}

export async function changeStatus(
  postId: string,
  next: PostStatus,
  note: string,
  adminId: string,
) {
  const post = await Post.findById(postId);
  if (!post) throw ApiError.notFound('That feature request does not exist');

  const current = post.status as PostStatus;
  if (current === next) return post.populate('author', 'name avatarUrl role');

  if (!canTransition(current, next)) {
    throw ApiError.badRequest(
      `A request cannot move from "${current.replace('_', ' ')}" to "${next.replace('_', ' ')}"`,
    );
  }

  post.status = next;
  post.statusHistory.push({
    from: current,
    to: next,
    changedBy: toId(adminId),
    note,
    changedAt: new Date(),
  });
  await post.save();
  return post.populate('author', 'name avatarUrl role');
}

/**
 * The public board. One query returns all three columns grouped, instead of
 * three separate round trips that could show a post in two columns at once.
 */
export async function getRoadmap(viewerId?: string) {
  const posts = await Post.aggregate([
    { $match: { status: { $in: [...ROADMAP_STATUSES] } } },
    { $sort: { voteCount: -1, updatedAt: -1 } },
    ...authorLookup,
    ...viewerStages(viewerId),
  ]);

  const columns: Record<string, unknown[]> = { planned: [], in_progress: [], completed: [] };
  for (const post of posts) {
    columns[post.status as string]?.push(post);
  }
  return columns;
}

export async function getStats() {
  const [byStatus, total] = await Promise.all([
    Post.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Post.countDocuments(),
  ]);

  const counts: Record<string, number> = {};
  for (const row of byStatus) counts[row._id as string] = row.count as number;
  return { total, byStatus: counts };
}
