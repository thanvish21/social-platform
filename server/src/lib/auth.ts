import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { env } from './env.js';
import { query, queryOne } from './db.js';

export interface AccessPayload {
  sub: string; // user id
  handle: string;
}

// ─── Password hashing ────────────────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── Access tokens (short-lived, stateless) ──────────────────
export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl });
}

export function verifyAccessToken(token: string): AccessPayload | null {
  try {
    return jwt.verify(token, env.jwt.accessSecret) as AccessPayload;
  } catch {
    return null;
  }
}

// ─── Refresh tokens (rotated, stored hashed, family-tracked) ─
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Issue a refresh token, persisting its hash under a rotation family. */
export async function issueRefreshToken(userId: string, familyId?: string): Promise<string> {
  const family = familyId ?? randomUUID();
  const token = jwt.sign({ sub: userId, family }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl,
  });
  const expiresAt = new Date(Date.now() + env.jwt.refreshTtl * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hashToken(token), family, expiresAt],
  );
  return token;
}

interface RefreshRow {
  id: string;
  user_id: string;
  family_id: string;
  revoked: boolean;
  expires_at: Date;
}

/**
 * Rotate a refresh token. Implements reuse detection: if a token that was
 * already rotated (revoked) is presented again, the entire family is revoked
 * (likely token theft) and rotation fails.
 *
 * Returns a fresh { accessToken, refreshToken } pair on success.
 */
export async function rotateRefreshToken(
  presentedToken: string,
): Promise<{ userId: string; refreshToken: string } | null> {
  let decoded: { sub: string; family: string };
  try {
    decoded = jwt.verify(presentedToken, env.jwt.refreshSecret) as any;
  } catch {
    return null;
  }

  const row = await queryOne<RefreshRow>(
    `SELECT id, user_id, family_id, revoked, expires_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [hashToken(presentedToken)],
  );

  if (!row) return null;

  // Reuse detection: a revoked token being replayed = compromise.
  if (row.revoked) {
    await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE family_id = $1`, [
      row.family_id,
    ]);
    return null;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  // Revoke the presented token and issue a successor in the same family.
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, [row.id]);
  const refreshToken = await issueRefreshToken(row.user_id, row.family_id);
  return { userId: row.user_id, refreshToken };
}

/** Revoke all refresh tokens for a user (logout-all). */
export async function revokeAllTokens(userId: string): Promise<void> {
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [userId]);
}
