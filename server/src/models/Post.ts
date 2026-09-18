import { Schema, model, type InferSchemaType } from 'mongoose';
import { slugify } from '../utils/slug.js';

export const POST_CATEGORIES = ['ui-ux', 'integrations', 'performance', 'general'] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export const POST_STATUSES = ['under_review', 'planned', 'in_progress', 'completed'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** The three columns of the public roadmap board. `under_review` lives in the feed. */
export const ROADMAP_STATUSES = ['planned', 'in_progress', 'completed'] as const;

/**
 * Explicit state machine rather than "admin can set any value". It documents
 * the intended lifecycle, and it makes an invalid move a 400 with a clear
 * message instead of silently corrupting the board.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  under_review: ['planned', 'in_progress'],
  planned: ['under_review', 'in_progress'],
  in_progress: ['planned', 'completed'],
  completed: ['in_progress'],
};

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

const postSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
    slug: { type: String, required: true, unique: true },
    // Stored as raw markdown; rendered (and sanitised) on the client.
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 10_000 },
    category: { type: String, enum: POST_CATEGORIES, required: true, index: true },
    status: { type: String, enum: POST_STATUSES, default: 'under_review', index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /**
     * Who voted, plus a denormalised count.
     *
     * The array is the source of truth and guarantees one vote per user; the
     * counter exists so the feed can sort without unwinding arrays. Both are
     * mutated in a single atomic update (see posts.service) so they cannot
     * drift apart.
     */
    voters: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [], select: false },
    voteCount: { type: Number, default: 0, min: 0, index: true },
    commentCount: { type: Number, default: 0, min: 0 },

    statusHistory: {
      type: [
        {
          _id: false,
          from: { type: String, enum: POST_STATUSES },
          to: { type: String, enum: POST_STATUSES },
          changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          note: { type: String, default: '' },
          changedAt: { type: Date, default: () => new Date() },
        },
      ],
      default: [],
    },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

// Full-text search across the two fields users actually search by.
postSchema.index({ title: 'text', description: 'text' }, { weights: { title: 5, description: 1 } });
// Serves the default feed ordering and the Kanban board query.
postSchema.index({ status: 1, voteCount: -1, createdAt: -1 });

postSchema.pre('validate', function (next) {
  if (!this.slug && this.title) this.slug = slugify(this.title);
  next();
});

export type PostAttrs = InferSchemaType<typeof postSchema>;
export const Post = model('Post', postSchema);
