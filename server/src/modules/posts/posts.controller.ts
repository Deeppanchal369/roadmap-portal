import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as postsService from './posts.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await postsService.listPosts(req.query as never, req.user?.id);
  res.json({ success: true, data: result.items, pagination: result.pagination });
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) => {
  const post = await postsService.getPostBySlug(req.params.slug as string, req.user?.id);
  res.json({ success: true, data: post });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const post = await postsService.createPost(req.body, req.user!.id);
  res.status(201).json({ success: true, data: post });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const post = await postsService.updatePost(req.params.id as string, req.body, req.user!);
  res.json({ success: true, data: post });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await postsService.deletePost(req.params.id as string, req.user!);
  res.status(204).send();
});

export const upvote = asyncHandler(async (req: Request, res: Response) => {
  const result = await postsService.addVote(req.params.id as string, req.user!.id);
  res.json({ success: true, data: result });
});

export const removeUpvote = asyncHandler(async (req: Request, res: Response) => {
  const result = await postsService.removeVote(req.params.id as string, req.user!.id);
  res.json({ success: true, data: result });
});

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const post = await postsService.changeStatus(
    req.params.id as string,
    req.body.status,
    req.body.note ?? '',
    req.user!.id,
  );
  res.json({ success: true, data: post });
});

export const roadmap = asyncHandler(async (req: Request, res: Response) => {
  const columns = await postsService.getRoadmap(req.user?.id);
  res.json({ success: true, data: columns });
});

export const stats = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await postsService.getStats() });
});
