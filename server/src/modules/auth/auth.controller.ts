import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  rotateRefreshToken,
  revokeToken,
  setAuthCookies,
  signAccessToken,
  startSession,
} from '../../utils/tokens.js';
import * as authService from './auth.service.js';

const requestMeta = (req: Request) => ({
  userAgent: req.headers['user-agent'] ?? '',
  ip: req.ip ?? '',
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, devToken } = await authService.register(req.body);
  res.status(201).json({
    success: true,
    data: {
      user,
      message: 'Account created. Check your email to confirm it.',
      ...(devToken ? { devVerificationToken: devToken } : {}),
    },
  });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.verifyEmail(req.body.token);
  res.json({ success: true, data: { user, message: 'Email confirmed. You can sign in now.' } });
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  await authService.resendVerification(req.body.email);
  res.json({ success: true, data: { message: 'If that account needs confirming, a new link is on its way.' } });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.login(req.body);
  await startSession(user.id, user.role, res, requestMeta(req));
  res.json({ success: true, data: { user } });
});

/**
 * Swaps the refresh cookie for a new pair. The client calls this once, on its
 * own, when an API call comes back with ACCESS_EXPIRED.
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (!presented) throw ApiError.unauthorized('No session to refresh', 'NO_REFRESH_TOKEN');

  try {
    const rotated = await rotateRefreshToken(presented, requestMeta(req));
    const user = await authService.getUserById(rotated.userId);
    const accessToken = signAccessToken(user.id, user.role);
    setAuthCookies(res, accessToken, rotated.token, rotated.expiresAt);
    res.json({ success: true, data: { user } });
  } catch (error) {
    // A failed refresh must not leave a stale cookie behind, or the client
    // retries forever against a token that will never work.
    clearAuthCookies(res);
    throw error;
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (presented) await revokeToken(presented);
  clearAuthCookies(res);
  res.json({ success: true, data: { message: 'Signed out' } });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getUserById(req.user!.id);
  res.json({ success: true, data: { user } });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const devToken = await authService.forgotPassword(req.body.email);
  res.json({
    success: true,
    data: {
      message: 'If that email has an account, a reset link is on its way.',
      ...(devToken && env.NODE_ENV !== 'production' ? { devResetToken: devToken } : {}),
    },
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  clearAuthCookies(res);
  res.json({ success: true, data: { message: 'Password updated. Sign in with your new password.' } });
});
