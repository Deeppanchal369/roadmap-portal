import { Router } from 'express';
import { authLimiter, authenticate, validate } from '../../middleware/index.js';
import * as controller from './auth.controller.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from './auth.validation.js';
import { z } from 'zod';

const router = Router();

// Every credential-handling route sits behind the strict limiter.
router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/verify-email', authLimiter, validate(tokenSchema), controller.verifyEmail);
router.post(
  '/resend-verification',
  authLimiter,
  validate(z.object({ email: z.string().trim().toLowerCase().email() })),
  controller.resendVerification,
);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), controller.resetPassword);

export default router;
