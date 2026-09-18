import { Router } from 'express';
import {
  authenticate,
  authorize,
  optionalAuth,
  validate,
  validateObjectId,
  writeLimiter,
} from '../../middleware/index.js';
import * as controller from './posts.controller.js';
import {
  changeStatusSchema,
  createPostSchema,
  listPostsQuerySchema,
  updatePostSchema,
} from './posts.validation.js';

const router = Router();

/**
 * Reads are public but run through `optionalAuth`, because a signed-in visitor
 * needs `hasVoted` on each card while an anonymous one still sees the feed.
 */
router.get('/', optionalAuth, validate(listPostsQuerySchema, 'query'), controller.list);
router.get('/stats', controller.stats);
router.get('/roadmap', optionalAuth, controller.roadmap);
router.get('/:slug', optionalAuth, controller.getBySlug);

router.post('/', authenticate, writeLimiter, validate(createPostSchema), controller.create);
router.patch(
  '/:id',
  authenticate,
  validateObjectId('id'),
  validate(updatePostSchema),
  controller.update,
);
router.delete('/:id', authenticate, validateObjectId('id'), controller.remove);

router.post('/:id/vote', authenticate, validateObjectId('id'), controller.upvote);
router.delete('/:id/vote', authenticate, validateObjectId('id'), controller.removeUpvote);

// Moving a request across the roadmap is the one admin-only action.
router.patch(
  '/:id/status',
  authenticate,
  authorize('admin'),
  validateObjectId('id'),
  validate(changeStatusSchema),
  controller.changeStatus,
);

export default router;
