import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Threaded comments use an adjacency list (`parent`) plus a cached `depth`.
 *
 * Threads here are shallow (a handful of replies per request), so building the
 * tree in memory after one indexed query per post is cheaper and far simpler
 * than a materialised path or `$graphLookup`. Depth is capped so the UI can
 * never be pushed into an unreadable indent.
 */
export const MAX_COMMENT_DEPTH = 4;

const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    depth: { type: Number, default: 0, min: 0, max: MAX_COMMENT_DEPTH },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    // Soft delete: removing a parent outright would orphan its replies, so the
    // node stays as a tombstone and the thread keeps its shape.
    isDeleted: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

commentSchema.index({ post: 1, createdAt: 1 });

export type CommentAttrs = InferSchemaType<typeof commentSchema>;
export const Comment = model('Comment', commentSchema);
