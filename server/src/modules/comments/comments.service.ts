import { Comment, MAX_COMMENT_DEPTH } from '../../models/Comment.js';
import { Post } from '../../models/Post.js';
import { ApiError } from '../../utils/ApiError.js';

interface CommentNode {
  id: string;
  body: string;
  depth: number;
  isDeleted: boolean;
  editedAt: Date | null;
  createdAt: Date;
  author: unknown;
  parent: string | null;
  replies: CommentNode[];
}

/**
 * Turns the flat, chronologically sorted rows into a tree in one pass.
 *
 * Every row is indexed by id first, then attached to its parent. Because the
 * rows are already sorted by `createdAt`, a parent is always seen before its
 * replies, and both the top level and each reply list come out in order without
 * a second sort.
 */
function buildTree(rows: Array<Record<string, unknown>>): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const row of rows) {
    const id = String(row._id);
    byId.set(id, {
      id,
      body: row.isDeleted ? '[deleted]' : (row.body as string),
      depth: row.depth as number,
      isDeleted: Boolean(row.isDeleted),
      editedAt: (row.editedAt as Date | null) ?? null,
      createdAt: row.createdAt as Date,
      author: row.isDeleted ? null : row.author,
      parent: row.parent ? String(row.parent) : null,
      replies: [],
    });
  }

  for (const node of byId.values()) {
    if (node.parent && byId.has(node.parent)) {
      byId.get(node.parent)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function listForPost(postId: string): Promise<CommentNode[]> {
  const rows = await Comment.find({ post: postId })
    .sort({ createdAt: 1 })
    .populate('author', 'name avatarUrl role')
    .lean();
  return buildTree(rows as unknown as Array<Record<string, unknown>>);
}

export async function createComment(
  postId: string,
  authorId: string,
  body: string,
  parentId?: string,
) {
  const post = await Post.findById(postId).select('_id');
  if (!post) throw ApiError.notFound('That feature request does not exist');

  let depth = 0;
  if (parentId) {
    const parent = await Comment.findOne({ _id: parentId, post: postId }).select('depth');
    if (!parent) throw ApiError.badRequest('The comment you are replying to no longer exists');
    // Past the cap, a reply is flattened onto the deepest allowed level rather
    // than rejected — the user still gets their reply, the UI stays readable.
    depth = Math.min(parent.depth + 1, MAX_COMMENT_DEPTH);
  }

  const comment = await Comment.create({
    post: postId,
    author: authorId,
    parent: parentId ?? null,
    depth,
    body,
  });

  await Post.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });
  return comment.populate('author', 'name avatarUrl role');
}

export async function updateComment(
  commentId: string,
  body: string,
  actor: { id: string; role: string },
) {
  const comment = await Comment.findById(commentId);
  if (!comment || comment.isDeleted) throw ApiError.notFound('That comment no longer exists');

  // Admins can remove a comment but not rewrite what somebody said.
  if (comment.author.toString() !== actor.id) {
    throw ApiError.forbidden('Only the author can edit a comment');
  }

  comment.body = body;
  comment.editedAt = new Date();
  await comment.save();
  return comment.populate('author', 'name avatarUrl role');
}

export async function deleteComment(commentId: string, actor: { id: string; role: string }) {
  const comment = await Comment.findById(commentId);
  if (!comment || comment.isDeleted) throw ApiError.notFound('That comment no longer exists');

  const isAuthor = comment.author.toString() === actor.id;
  if (!isAuthor && actor.role !== 'admin') {
    throw ApiError.forbidden('Only the author or an admin can delete a comment');
  }

  const hasReplies = await Comment.exists({ parent: comment._id });

  if (hasReplies) {
    // Keep the node as a tombstone so the replies under it stay reachable.
    comment.isDeleted = true;
    comment.body = '';
    await comment.save();
  } else {
    await comment.deleteOne();
  }

  await Post.updateOne({ _id: comment.post }, { $inc: { commentCount: -1 } });
}
