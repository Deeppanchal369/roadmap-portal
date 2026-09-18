import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One document per issued refresh token.
 *
 * Tokens are grouped into a "family": every rotation replaces a token with a new
 * one in the same family. If a token that was already rotated away is presented
 * again, that means a copy leaked, so the whole family is revoked and the user
 * has to sign in again. This is the standard refresh-token-reuse detection.
 */
const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: String, required: true, index: true },
    // SHA-256 of the JWT. Storing the token itself would make the collection as
    // sensitive as a password table.
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true },
);

// Mongo drops expired sessions on its own; no cleanup cron to maintain.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenAttrs = InferSchemaType<typeof refreshTokenSchema>;
export const RefreshToken = model('RefreshToken', refreshTokenSchema);
