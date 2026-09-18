import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './comments.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const comments = await service.listForPost(req.params.postId as string);
  res.json({ success: true, data: comments });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const comment = await service.createComment(
    req.params.postId as string,
    req.user!.id,
    req.body.body,
    req.body.parentId,
  );
  res.status(201).json({ success: true, data: comment });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const comment = await service.updateComment(req.params.id as string, req.body.body, req.user!);
  res.json({ success: true, data: comment });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteComment(req.params.id as string, req.user!);
  res.status(204).send();
});
