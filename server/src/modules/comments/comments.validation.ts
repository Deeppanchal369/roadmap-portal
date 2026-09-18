import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(5000),
  parentId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'That is not a valid comment id')
    .optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(5000),
});
