import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { ZodError, type ZodTypeAny } from 'zod';
import { env, isProduction } from '../config/env.js';
import type { UserRole } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ACCESS_COOKIE, verifyAccessToken } from '../utils/tokens.js';

/* ------------------------------------------------------------------ auth -- */

function readAccessToken(req: Request): string | null {
  const fromCookie = req.cookies?.[ACCESS_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  // Bearer is accepted as well so the API can be exercised from Postman/curl
  // without juggling a cookie jar. The browser client always uses the cookie.
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Rejects the request when there is no valid access token. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = readAccessToken(req);
  if (!token) return next(ApiError.unauthorized());
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    // A distinct code so the client interceptor knows to try /auth/refresh once
    // rather than bouncing the user straight to the login screen.
    next(ApiError.unauthorized('Your session has expired', 'ACCESS_EXPIRED'));
  }
};

/** Attaches `req.user` when a valid token is present, but never rejects. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readAccessToken(req);
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      /* anonymous visitor, carry on */
    }
  }
  next();
};

/** Role gate. Used after `authenticate`. */
export const authorize =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };

/* ------------------------------------------------------------ validation -- */

type Source = 'body' | 'query' | 'params';

/**
 * Validates and *replaces* the request segment with the parsed result, so
 * handlers work with typed, coerced, stripped data and never re-check it.
 */
export const validate =
  (schema: ZodTypeAny, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === 'query') {
        Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
      } else {
        req[source] = parsed as never;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of error.issues) {
          const key = issue.path.join('.') || source;
          if (!fieldErrors[key]) fieldErrors[key] = issue.message;
        }
        return next(ApiError.badRequest('Some fields need attention', fieldErrors));
      }
      next(error);
    }
  };

/** Guards against a malformed id reaching Mongoose and throwing a CastError. */
export const validateObjectId =
  (param: string): RequestHandler =>
  (req, _res, next) => {
    const value = req.params[param];
    if (!value || !mongoose.isValidObjectId(value)) {
      return next(ApiError.badRequest(`'${param}' is not a valid id`));
    }
    next();
  };

/* ------------------------------------------------------------------ csrf -- */

/**
 * Because auth lives in cookies, a cross-site form could otherwise make a
 * state-changing call with the user's credentials attached. SameSite already
 * blocks most of it; this verifies the Origin header on every mutating request
 * as a second, explicit layer.
 */
export const verifyOrigin: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // non-browser client (curl, Postman, server-to-server)
  if (env.CORS_ORIGINS.includes(origin)) return next();
  next(ApiError.forbidden('Request origin is not allowed'));
};

/* ------------------------------------------------------------ rate limit -- */

const limiterOptions = { standardHeaders: 'draft-7' as const, legacyHeaders: false };

/** Generous ceiling for ordinary browsing. */
export const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, ...limiterOptions });

/** Tight ceiling for credential endpoints, to blunt password spraying. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  skipSuccessfulRequests: true,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again in a few minutes' } },
  ...limiterOptions,
});

/** Stops one account flooding the feed. */
export const writeLimiter = rateLimit({ windowMs: 60_000, limit: 30, ...limiterOptions });

/* ----------------------------------------------------------------- error -- */

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
};

/**
 * Single exit point for every failure. Responses always have the same shape:
 * `{ success: false, error: { code, message, details? } }`.
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  // Duplicate key — surfaces as a friendly 409 instead of a raw Mongo error.
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    const field = Object.keys((err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {})[0] ?? 'value';
    res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE', message: `That ${field} is already taken` },
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details: Record<string, string> = {};
    for (const [key, value] of Object.entries(err.errors)) details[key] = value.message;
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Some fields need attention', details },
    });
    return;
  }

  console.error('[unhandled]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL',
      message: 'Something went wrong on our side',
      ...(isProduction ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
};
