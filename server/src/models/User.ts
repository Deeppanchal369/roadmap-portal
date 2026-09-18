import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Never selected by default: a stray `User.find()` in a controller can then
    // never leak the hash into an API response.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'user', index: true },
    avatarUrl: { type: String, default: '' },

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },

    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    // Any refresh token issued before this instant is rejected. Bumped on
    // password reset so a stolen session dies with the old password.
    tokensValidFrom: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.emailVerificationTokenHash;
        delete ret.emailVerificationExpiresAt;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpiresAt;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserAttrs, UserMethods>;

interface UserMethods {
  comparePassword(plain: string): Promise<boolean>;
}

interface UserModel extends Model<UserAttrs, {}, UserMethods> {
  hashPassword(plain: string): Promise<string>;
  /** Returns the raw token (emailed to the user) and the hash we store. */
  createOneTimeToken(): { token: string; tokenHash: string };
  hashOneTimeToken(token: string): string;
}

userSchema.methods.comparePassword = function (plain: string) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain: string) {
  return bcrypt.hash(plain, 12);
};

// Verification and reset tokens are stored hashed for the same reason passwords
// are: a leaked database dump must not hand out working account-recovery links.
userSchema.statics.createOneTimeToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: crypto.createHash('sha256').update(token).digest('hex') };
};

userSchema.statics.hashOneTimeToken = function (token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const User = model<UserAttrs, UserModel>('User', userSchema);
