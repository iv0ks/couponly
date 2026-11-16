// Coupons service — the data layer for the lab.
import { Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { coupons, type Coupon } from '../db/schema.js';
import { encodeId } from '../hashids.js';

// What the API returns for a coupon: the hashids code stands in for the raw id.
export type CouponView = {
  code: string;
  title: string;
  couponCode: string;
  discountPct: number;
  redeemed: boolean;
  expiresAt: Date;
  owner: number;
};

function toView(row: Coupon): CouponView {
  return {
    code: encodeId(row.id), // public hashids handle
    title: row.title,
    couponCode: row.code, // the actual coupon string (flag on bob's)
    discountPct: row.discountPct,
    redeemed: row.redeemed,
    expiresAt: row.expiresAt,
    owner: row.ownerId,
  };
}

@Injectable()
export class CouponsService {
  // SAFE: a user's own coupons, scoped to the session user.
  async listOwn(userId: number): Promise<CouponView[]> {
    const rows = await db
      .select()
      .from(coupons)
      .where(eq(coupons.ownerId, userId))
      .orderBy(desc(coupons.updatedAt));
    return rows.map(toView);
  }

  // ⚠️ THE READ VULNERABILITY.
  //
  // Fetches a coupon by its integer id (decoded from the hashids code) and
  // returns it — with no check that it belongs to the caller. The id having
  // been obfuscated into a short code changes nothing: authorization was never
  // about guessability. A correct implementation scopes the query to the owner
  // (see SOLUTION.md).
  async findById(id: number): Promise<CouponView | undefined> {
    const [row] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    return row ? toView(row) : undefined;
  }

  // ⚠️ THE REDEEM (write) VULNERABILITY.
  //
  // Marks any coupon as redeemed by id, with no ownership check. A low-priv
  // user can burn someone else's coupon.
  async redeem(id: number): Promise<CouponView | undefined> {
    const [row] = await db
      .update(coupons)
      .set({ redeemed: true, updatedAt: new Date() })
      .where(eq(coupons.id, id))
      .returning();
    return row ? toView(row) : undefined;
  }

  // ⚠️ THE MODIFY (write) VULNERABILITY.
  //
  // Updates mutable fields of any coupon by id, with no ownership check. A
  // low-priv user can rewrite someone else's coupon (e.g. crank the discount).
  async modify(
    id: number,
    patch: { title?: string; discountPct?: number },
  ): Promise<CouponView | undefined> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.discountPct !== undefined) set.discountPct = patch.discountPct;
    const [row] = await db.update(coupons).set(set).where(eq(coupons.id, id)).returning();
    return row ? toView(row) : undefined;
  }
}
