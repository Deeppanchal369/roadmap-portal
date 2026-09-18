import { Router } from 'express';
import { authenticate, validate, validateObjectId, writeLimiter } from '../../middleware/index.js';
import * as controller from './comments.controller.js';
import { createCommentSchema, updateCommentSchema } from './comments.validation.js';

// `mergeParams` lets this router read :postId from the parent posts router.
const postComments = Router({ mergeParams: true });

postComments.get('/', validateObjectId('postId'), controller.list);
postComments.post(
  '/',
  authenticate,
  writeLimiter,
  validateObjectId('postId'),
  validate(createCommentSchema),
  controller.create,
);

const comments = Router();
comments.patch(
  '/:id',
  authenticate,
  validateObjectId('id'),
  validate(updateCommentSchema),
  controller.update,
);
comments.delete('/:id', authenticate, validateObjectId('id'), controller.remove);

export { postComments, comments };
