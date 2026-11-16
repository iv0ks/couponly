// Runtime configuration, read once from the environment.
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL', 'postgres://couponly:couponly@localhost:5432/couponly'),
  sessionSecret: required('SESSION_SECRET', 'dev-only-insecure-secret-change-me'),

  // Hashids parameters used to turn sequential coupon ids into short,
  // "unguessable-looking" public codes (e.g. id 1 → "gY6z"). The salt is the
  // only thing standing between an attacker and the raw ids — and this lab
  // leaks it on purpose (see GET /api/config). A hashid is obfuscation, not
  // authorization: once you know the salt you can forge any coupon's code.
  // NOTE: hashids is deprecated in favour of sqids; we use it deliberately here
  // because its weak, shareable "salt" is exactly the teaching point.
  hashidsSalt: required('HASHIDS_SALT', 'couponly-2026'),
  hashidsMinLength: Number(process.env.HASHIDS_MIN_LENGTH ?? 6),

  // The challenge flag, baked into the image at build time and seeded into the
  // victim's premium coupon. Never committed.
  flag: required('FLAG', 'FLAG{COUPONLY_UNHASHED_THE_ID}'),
};
