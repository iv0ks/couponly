// Integration smoke tests that do not require a live database.
//
// The full read/write-IDOR exploit (leak the hashids salt from GET /api/config,
// forge the victim's coupon code, read/redeem/modify it) is verified
// end-to-end against the Docker stack (see SOLUTION.md). These tests pin the
// guarantees that do not touch Postgres:
//   1. the health endpoint responds,
//   2. every coupon route refuses unauthenticated callers (the auth guard runs
//      before any DB access, so no connection is opened), and
//   3. the hashids codec round-trips (encode→decode is the identity), which is
//      the exact primitive the exploit relies on.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/main.js';
import { encodeId, decodeId } from '../src/hashids.js';

let app: INestApplication;

beforeAll(async () => {
  app = await createApp();
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe('couponly http surface', () => {
  it('serves the health check', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.text).toBe('ok');
  });

  it('requires a session to list your own coupons', async () => {
    const res = await request(app.getHttpServer()).get('/api/coupons');
    expect(res.status).toBe(401);
  });

  it('requires a session to read a coupon by code (the read IDOR endpoint)', async () => {
    const res = await request(app.getHttpServer()).get(`/api/coupons/${encodeId(4)}`);
    expect(res.status).toBe(401);
  });

  it('requires a session to redeem a coupon (the write IDOR endpoint)', async () => {
    const res = await request(app.getHttpServer()).post(`/api/coupons/${encodeId(4)}/redeem`);
    expect(res.status).toBe(401);
  });

  it('requires a session to modify a coupon (the write IDOR endpoint)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/coupons/${encodeId(4)}`)
      .send({ discountPct: 99 });
    expect(res.status).toBe(401);
  });

  // ⚠️ The enabler: /api/config leaks the salt with NO session. This test pins
  // that behaviour so a future "fix" that removes the leak fails loudly here.
  it('leaks the hashids salt via /api/config without a session', async () => {
    const res = await request(app.getHttpServer()).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.hashids?.salt).toBeTypeOf('string');
    expect(res.body.hashids.salt.length).toBeGreaterThan(0);
  });
});

describe('hashids codec', () => {
  it('round-trips an id through encode → decode', () => {
    for (const id of [1, 2, 3, 4, 5, 42, 1000]) {
      expect(decodeId(encodeId(id))).toBe(id);
    }
  });

  it('rejects malformed codes', () => {
    expect(decodeId('')).toBeNull();
    expect(decodeId('!!!not-a-code!!!')).toBeNull();
    expect(decodeId(undefined)).toBeNull();
  });
});
