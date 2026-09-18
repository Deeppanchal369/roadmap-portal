import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction, isTest } from './config/env.js';
import {
  apiLimiter,
  errorHandler,
  notFoundHandler,
  verifyOrigin,
} from './middleware/index.js';
import authRoutes from './modules/auth/auth.routes.js';
import { comments, postComments } from './modules/comments/comments.routes.js';
import postsRoutes from './modules/posts/posts.routes.js';
import { readOutbox } from './utils/mailer.js';

export function createApp(): Express {
  const app = express();

  // Behind a proxy (Render, Railway, nginx) the client IP arrives in a header.
  // Left off in development so the rate limiter cannot be fooled by a spoofed
  // X-Forwarded-For from a local client.
  app.set('trust proxy', isProduction ? 1 : false);

  app.use(helmet());
  app.use(
    cors({
      // Cookies only travel cross-origin with an explicit origin allowlist;
      // `*` is not permitted alongside credentials.
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (!isTest) app.use(morgan(isProduction ? 'combined' : 'dev'));

  app.use(verifyOrigin);
  app.use('/api', apiLimiter);

  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/posts', postsRoutes);
  // Comments hang off a post for creation and listing, and are addressed
  // directly for edit and delete.
  app.use('/api/v1/posts/:postId/comments', postComments);
  app.use('/api/v1/comments', comments);

  // Stand-in for an inbox while email is simulated. Never mounted in production.
  if (!isProduction) {
    app.get('/api/v1/dev/outbox', (_req, res) => {
      res.json({ success: true, data: readOutbox() });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
