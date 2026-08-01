// server/src/lib/jwt.ts
// ─────────────────────────────────────────────────────────────
// Thin wrapper around jsonwebtoken. Centralizing sign/verify here
// means the secret and algorithm choice live in exactly one place.
// ─────────────────────────────────────────────────────────────

import jwt, { type SignOptions } from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-change-me-before-production'
// jsonwebtoken's types constrain `expiresIn` to a specific string-literal
// shape (e.g. "12h", "7d") that TypeScript can't verify against a plain
// runtime env var — this cast is the standard way to cross that boundary
// honestly (we can't statically prove JWT_EXPIRES_IN's format, only that
// jsonwebtoken will throw at runtime if it's malformed, same as before).
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '12h') as SignOptions['expiresIn']

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-only-change-me-before-production') {
  // Fail loudly rather than silently running production auth on a
  // publicly-known placeholder secret.
  throw new Error('JWT_SECRET must be set to a real secret in production (see server/.env).')
}

export interface JwtPayload {
  userId: string
  username: string
  role: string
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/** Returns the decoded payload, or null if the token is invalid/expired. */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}
