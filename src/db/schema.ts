// Database schema (Drizzle ORM).
//
// couponly is a small store-coupon service. The lab lives on the `coupons`
// table. Its primary key is a plain **sequential integer**, but the API never
// exposes that integer: it exposes a hashids-encoded "code" derived from it
// (see src/hashids.ts). The app leans on that obfuscation as if it were a
// permission — it reads, redeems and modifies a coupon by its code with no
// ownership check. The point of the level is that the code is reversible once
// the salt leaks, so an "unguessable" id is NOT authorization (CWE-639).
import { pgTable, integer, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: integer('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
});

export const coupons = pgTable('coupons', {
  // Sequential integer PK. The API maps it to/from a hashids code and treats
  // that code as secret — it isn't.
  id: integer('id').primaryKey(),
  ownerId: integer('owner_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  // The coupon code the customer would type at checkout. The victim's premium
  // coupon carries the FLAG here.
  code: text('code').notNull(),
  // Discount percentage (0–100). Mutable via the vulnerable PATCH endpoint.
  discountPct: integer('discount_pct').notNull(),
  redeemed: boolean('redeemed').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
