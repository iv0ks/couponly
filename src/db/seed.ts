// Seed script — idempotent.
//
// Three identities make the lab work:
//   - alice (id 1): you, an ordinary customer. Credentials alice/password123.
//   - bob   (id 2): the victim, a store manager. His PREMIUM coupon carries the
//                   FLAG as its code.
//   - carol (id 3): bystander, keeps the coupon list realistic.
//
// Coupon ids are **fixed sequential integers** so the lab is reproducible and
// SOLUTION.md can cite bob's exact id. The API never shows those integers — it
// shows the hashids code — but `GET /api/config` leaks the salt, so an attacker
// can reverse a known code to its id and then forge the code of any other id.
// alice can only list her OWN coupons; reaching bob's premium coupon is the
// lab.
import { eq } from 'drizzle-orm';
import { db, sql } from './client.js';
import { users, coupons } from './schema.js';
import { hashPassword } from '../auth.js';
import { config } from '../config.js';

const seedUsers = [
  { id: 1, username: 'alice', password: 'password123', displayName: 'Alice Martins' },
  { id: 2, username: 'bob', password: 'correct-horse-battery-staple', displayName: 'Bob Keller' },
  { id: 3, username: 'carol', password: 'hunter2hunter2', displayName: 'Carol Nwosu' },
];

type SeedCoupon = {
  id: number;
  ownerId: number;
  title: string;
  code: string;
  discountPct: number;
  redeemed: boolean;
  expiresAt: Date;
};

// Sequential ids. bob's "Premium partner coupon" (id 4) holds the flag as its
// code. alice owns ids 1 and 2; carol owns id 5.
const seedCoupons: SeedCoupon[] = [
  {
    id: 1,
    ownerId: 1,
    title: 'Welcome 10% off',
    code: 'WELCOME-4821',
    discountPct: 10,
    redeemed: false,
    expiresAt: new Date('2027-01-31T23:59:59Z'),
  },
  {
    id: 2,
    ownerId: 1,
    title: 'Free shipping weekend',
    code: 'SHIPFREE-7730',
    discountPct: 15,
    redeemed: false,
    expiresAt: new Date('2027-02-14T23:59:59Z'),
  },
  {
    id: 3,
    ownerId: 3,
    title: 'Newsletter subscriber 20%',
    code: 'NEWS-2025-5590',
    discountPct: 20,
    redeemed: false,
    expiresAt: new Date('2027-03-01T23:59:59Z'),
  },
  {
    // bob's premium coupon — the target. Its code carries the flag and is only
    // reachable by forging its hashids code from the leaked salt.
    id: 4,
    ownerId: 2,
    title: 'Premium partner coupon',
    code: config.flag,
    discountPct: 90,
    redeemed: false,
    expiresAt: new Date('2027-06-30T23:59:59Z'),
  },
  {
    id: 5,
    ownerId: 3,
    title: 'Loyalty tier bonus',
    code: 'LOYAL-9911',
    discountPct: 25,
    redeemed: false,
    expiresAt: new Date('2027-04-15T23:59:59Z'),
  },
];

async function main(): Promise<void> {
  console.log('[seed] seeding users …');
  for (const u of seedUsers) {
    await db
      .insert(users)
      .values({
        id: u.id,
        username: u.username,
        passwordHash: hashPassword(u.password),
        displayName: u.displayName,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: u.username,
          passwordHash: hashPassword(u.password),
          displayName: u.displayName,
        },
      });
  }

  console.log('[seed] seeding coupons …');
  for (const c of seedCoupons) {
    await db
      .insert(coupons)
      .values(c)
      .onConflictDoUpdate({
        target: coupons.id,
        set: {
          ownerId: c.ownerId,
          title: c.title,
          code: c.code,
          discountPct: c.discountPct,
          redeemed: c.redeemed,
          expiresAt: c.expiresAt,
        },
      });
  }

  const [bobCoupon] = await db.select().from(coupons).where(eq(coupons.ownerId, 2)).limit(1);
  console.log(
    `[seed] done. users: alice, bob, carol. flag seeded on bob's premium coupon (id ${bobCoupon?.id}).`,
  );
  await sql.end();
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
