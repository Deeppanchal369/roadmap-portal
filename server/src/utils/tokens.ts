import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { env } from '../config/env.js';
import { RefreshToken } from '../models/RefreshToken.js';
import type { UserRole } from '../models/User.js';
import { ApiError } from './ApiError.js';

export const ACCESS_COOKIE = 'rp_access';
export const REFRESH_COOKIE = 'rp_refresh';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  type: 'access';
}

interface RefreshTokenPayload {
  sub: string;
  fid: string;
  jti: string;
  type: 'refresh';
}

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
  };
}

export function signAccessToken(userId: string, role: UserRole): string {
  const payload: AccessTokenPayload = { sub: userId, role, type: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (decoded.type !== 'access') throw new Error('Wrong token type');
  return decoded;
}

/**
 * Issues a refresh token and persists its hash. `familyId` is carried over on
 * rotation so an entire lineage can be revoked at once.
 */
export async function issueRefreshToken(
  userId: string,
  familyId: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const payload: RefreshTokenPayload = { sub: userId, fid: familyId, jti, type: 'refresh' };

  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
  } as SignOptions);
  const tokenHash = sha256(token);

  await RefreshToken.create({
    user: userId,
    familyId,
    tokenHash,
    expiresAt,
    userAgent: meta.userAgent ?? '',
    ip: meta.ip ?? '',
  });

  return { token, tokenHash, expiresAt };
}

export async function startSession(
  userId: string,
  role: UserRole,
  res: Response,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<{ accessToken: string }> {
  const familyId = crypto.randomUUID();
  const accessToken = signAccessToken(userId, role);
  const refresh = await issueRefreshToken(userId, familyId, meta);
  setAuthCookies(res, accessToken, refresh.token, refresh.expiresAt);
  return { accessToken };
}

/**
 * Verifies a presented refresh token and swaps it for a fresh pair.
 *
 * Three things can go wrong, and each is handled differently:
 *  - signature invalid/expired  -> plain 401, nothing to revoke
 *  - hash not in the database   -> plain 401, token was never ours
 *  - hash found but already revoked or replaced -> REUSE. The token leaked,
 *    so the whole family is burned and every session from it dies.
 */
export async function rotateRefreshToken(
  presentedToken: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<{ userId: string; familyId: string; token: string; expiresAt: Date }> {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(presentedToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw ApiError.unauthorized('Your session has expired, please sign in again', 'REFRESH_INVALID');
  }
  if (payload.type !== 'refresh') {
    throw ApiError.unauthorized('Your session has expired, please sign in again', 'REFRESH_INVALID');
  }

  const presentedHash = sha256(presentedToken);
  const stored = await RefreshToken.findOne({ tokenHash: presentedHash });

  if (!stored) {
    throw ApiError.unauthorized('Your session has expired, please sign in again', 'REFRESH_INVALID');
  }

  if (stored.revokedAt || stored.replacedByTokenHash) {
    await revokeFamily(payload.fid);
    throw ApiError.unauthorized(
      'This session was reused after it was rotated, so every session on this device was signed out',
      'REFRESH_REUSED',
    );
  }

  const next = await issueRefreshToken(payload.sub, payload.fid, meta);

  stored.revokedAt = new Date();
  stored.replacedByTokenHash = next.tokenHash;
  await stored.save();

  return { userId: payload.sub, familyId: payload.fid, token: next.token, expiresAt: next.expiresAt };
}

export async function revokeFamily(familyId: string): Promise<void> {
  await RefreshToken.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function revokeToken(presentedToken: string): Promise<void> {
  await RefreshToken.updateOne({ tokenHash: sha256(presentedToken) }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  refreshExpiresAt: Date,
): void {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions(),
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
  // Scoped to the auth routes: the refresh token is never attached to ordinary
  // API calls, so it is not exposed on every request.
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: '/api/v1/auth',
    expires: refreshExpiresAt,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions(), path: '/api/v1/auth' });
}
