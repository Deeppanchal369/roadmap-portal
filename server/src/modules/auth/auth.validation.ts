import { z } from 'zod';

/**
 * Password rule kept deliberately simple but enforced in one place, shared by
 * signup and reset so the two can never drift apart.
 */
const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'That is too long')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name').max(60),
  email: z.string().trim().toLowerCase().email('That email does not look right'),
  password,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('That email does not look right'),
  password: z.string().min(1, 'Enter your password'),
});

export const tokenSchema = z.object({
  token: z.string().min(10, 'This link is missing its token'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('That email does not look right'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'This link is missing its token'),
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
