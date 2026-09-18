import { env } from '../../config/env.js';
import { User, type UserDocument } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import { passwordResetLink, sendMail, verificationLink } from '../../utils/mailer.js';
import { revokeAllForUser } from '../../utils/tokens.js';
import type { LoginInput, RegisterInput } from './auth.validation.js';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Deterministic placeholder avatar, so seeded and real users look alike. */
function avatarFor(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
}

export async function register(input: RegisterInput): Promise<{ user: UserDocument; devToken?: string }> {
  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) {
    throw ApiError.conflict('An account with that email already exists', 'EMAIL_TAKEN');
  }

  const { token, tokenHash } = User.createOneTimeToken();

  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await User.hashPassword(input.password),
    avatarUrl: avatarFor(input.name),
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  });

  const link = verificationLink(token);
  await sendMail({
    to: user.email,
    subject: 'Confirm your email',
    body: `Hi ${user.name}, confirm your email to start posting and voting.`,
    link,
  });

  // Outside production the raw token comes back in the response so a reviewer
  // can finish signup without an inbox. Never exposed in production.
  return { user, devToken: env.NODE_ENV === 'production' ? undefined : token };
}

export async function verifyEmail(token: string): Promise<UserDocument> {
  const user = await User.findOne({
    emailVerificationTokenHash: User.hashOneTimeToken(token),
    emailVerificationExpiresAt: { $gt: new Date() },
  }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');

  if (!user) throw ApiError.badRequest('That confirmation link is invalid or has expired');

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpiresAt = undefined;
  await user.save();
  return user;
}

export async function resendVerification(email: string): Promise<void> {
  const user = await User.findOne({ email });
  if (!user || user.isEmailVerified) return; // say nothing either way
  const { token, tokenHash } = User.createOneTimeToken();
  user.emailVerificationTokenHash = tokenHash;
  user.emailVerificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
  await user.save();
  await sendMail({
    to: user.email,
    subject: 'Confirm your email',
    body: 'Here is a fresh confirmation link.',
    link: verificationLink(token),
  });
}

export async function login(input: LoginInput): Promise<UserDocument> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');

  // Same message and roughly the same work whether the email exists or the
  // password is wrong, so the endpoint cannot be used to enumerate accounts.
  const invalid = ApiError.unauthorized('Email or password is incorrect', 'INVALID_CREDENTIALS');
  if (!user) {
    await User.hashPassword(input.password);
    throw invalid;
  }

  const matches = await user.comparePassword(input.password);
  if (!matches) throw invalid;

  if (env.REQUIRE_EMAIL_VERIFICATION && !user.isEmailVerified) {
    throw new ApiError(403, 'Confirm your email address before signing in', 'EMAIL_NOT_VERIFIED');
  }

  return user;
}

export async function forgotPassword(email: string): Promise<string | undefined> {
  const user = await User.findOne({ email });
  // Always resolve quietly: a different response for unknown emails would leak
  // which addresses have accounts.
  if (!user) return undefined;

  const { token, tokenHash } = User.createOneTimeToken();
  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TTL_MS);
  await user.save();

  await sendMail({
    to: user.email,
    subject: 'Reset your password',
    body: 'This link works once and expires in an hour.',
    link: passwordResetLink(token),
  });

  return env.NODE_ENV === 'production' ? undefined : token;
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const user = await User.findOne({
    passwordResetTokenHash: User.hashOneTimeToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) throw ApiError.badRequest('That reset link is invalid or has expired');

  user.passwordHash = await User.hashPassword(password);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.tokensValidFrom = new Date();
  // Resetting a password is how someone recovers a compromised account, so
  // every existing session has to die with it.
  await user.save();
  await revokeAllForUser(user.id);
}

export async function getUserById(id: string): Promise<UserDocument> {
  const user = await User.findById(id);
  if (!user) throw ApiError.unauthorized('That account no longer exists');
  return user;
}
