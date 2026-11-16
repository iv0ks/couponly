// Hashids codec — the shared id ↔ code translation for coupons.
//
// Coupons are addressed in the API by a short public "code" derived from their
// sequential primary key with hashids (e.g. id 1 → "gY6z"). The application
// treats that code as if it were secret and unguessable, so it skips ownership
// checks on the read / redeem / modify endpoints. It isn't secret: the salt
// needed to reproduce this exact codec leaks through GET /api/config, so an
// attacker can encode ANY id and forge a valid code for a coupon they don't
// own. Obfuscation is not authorization (CWE-639).
import Hashids from 'hashids';
import { config } from './config.js';

// A single shared instance built from the (leakable) salt + min length.
const hashids = new Hashids(config.hashidsSalt, config.hashidsMinLength);

// id → public code. Returns e.g. "gY6z".
export function encodeId(id: number): string {
  return hashids.encode(id);
}

// public code → id, or null if the code is not a well-formed single-number
// hashid for this salt. This validates *shape*, never ownership.
export function decodeId(code: unknown): number | null {
  if (typeof code !== 'string' || code.length === 0) return null;
  // hashids throws (not returns empty) when the string contains characters
  // outside its alphabet, so guard the call and treat any failure as "not a
  // valid code".
  let decoded: (number | bigint)[];
  try {
    decoded = hashids.decode(code);
  } catch {
    return null;
  }
  if (decoded.length !== 1) return null;
  const value = decoded[0];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null;
  return value;
}
