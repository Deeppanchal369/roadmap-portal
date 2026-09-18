import { z } from 'zod';
import { POST_CATEGORIES, POST_STATUSES } from '../../models/Post.js';

export const createPostSchema = z.object({
  title: z.string().trim().min(5, 'Give it a title of at least 5 characters').max(120),
  description: z.string().trim().min(10, 'Add a little more detail').max(10_000),
  category: z.enum(POST_CATEGORIES),
});

export const updatePostSchema = createPostSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Nothing to update' },
);

export const changeStatusSchema = z.object({
  status: z.enum(POST_STATUSES),
  note: z.string().trim().max(280).optional().default(''),
});

export const SORTS = ['trending', 'newest', 'top', 'discussed', 'relevance'] as const;

export const listPostsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.enum(POST_CATEGORIES).optional(),
  status: z.enum(POST_STATUSES).optional(),
  sort: z.enum(SORTS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  // Hard ceiling: a client cannot ask for 10,000 rows and stall the database.
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
