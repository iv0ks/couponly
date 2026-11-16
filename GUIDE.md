# couponly: Learning Guide

![CWE-639](https://img.shields.io/badge/CWE--639-IDOR-red?style=flat-square)
![Node](https://img.shields.io/badge/Node-NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Docker](https://img.shields.io/badge/Lab-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

**couponly is an intentionally vulnerable application built for security education.** It contains a deliberate [IDOR / broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
(CWE-639) flaw so you can practice finding and exploiting it in a safe and controlled environment.

<br>

> [!TIP]
> A guided, **non-spoiler** path to solving this lab. It teaches the *method*, not the answer — the exact winning request and the flag stay in [SOLUTION.md](SOLUTION.md).

<br>

## 🧬 What broken access control is

Here is the whole idea in one sentence:

> **Broken access control happens when an app checks _who you are_ but forgets
> to check _whether you're allowed to touch this particular thing_.**

Logging in answers "who are you?" — that's **authentication**. Deciding whether
*this* user may read, redeem or edit *this* coupon is a separate question —
that's **authorization**. This lab is an **IDOR** (Insecure Direct Object
Reference): the app takes a coupon reference from the request and acts on the
coupon, never asking whether it belongs to the caller.

The twist here is the reference itself. Earlier labs used sequential integers
(count through them) and base64 handles (decode, alter, re-encode). couponly
uses **hashids** — a library that turns a database id like `4` into a short
code like `30ExX6`. Developers reach for it *believing it hides the id*. It
doesn't hide anything securely: a hashid is a **reversible encoding**, not
encryption. Its only "secret" is a short **salt**, and the moment that salt is
known, anyone can turn any id into its code and back again.

Think of a cloakroom that replaced ticket numbers `1, 2, 3` with codes from a
little rotor machine. If the machine (and its setting) sits on the counter for
anyone to read, the codes are no more secret than the numbers were — you just
crank the handle to make whichever ticket you like.

> Want the deeper background — horizontal vs vertical escalation, why id format
> (sequential / UUID / base64 / hashids) is never the control, and the full
> workflow with **Burp Suite** and **OWASP ZAP**? Read the shared
> **[Broken Access Control field guide](https://github.com/iv0ks/appsec-labs/blob/main/docs/broken-access-control.md)**.
> This lab is a hands-on application of it.

<br>

## 🎓 What this level teaches

**Level 5 — the id is obfuscated, reversibly, and the recipe leaks.** The
coupon endpoints look a coupon up by its hashids *code* and then read, redeem or
modify it with **no check that it belongs to you**. You can't guess a valid code
by hand — but you don't have to. The app ships the ingredients to rebuild the
codec, so you can forge the code of any coupon you want.

- **Entry points:**
  - `GET /api/coupons/:code` — read a coupon.
  - `POST /api/coupons/:code/redeem` — redeem (burn) a coupon.
  - `PATCH /api/coupons/:code` — modify a coupon's fields.
- **The broken defence:** the code is short and "unguessable", so the app
  assumes it's safe — being logged in is treated as enough.
- **What you can see legitimately:** your own coupons, via `GET /api/coupons`.
- **The target:** another user's coupon, whose code you can *forge* once you know
  how codes are built.

## 🪧 How to approach it

1. Sign in as `alice` through your proxy and load the wallet. Note your own
   coupons carry short codes like `K0pqY2` — no obvious way to count to anyone
   else's.
2. Open one of your own coupons by code and capture that request in your proxy.
   That's your **baseline**: `GET /api/coupons/<your-code>` returns your coupon.
3. Watch what the app loads on startup. Front-ends often fetch a "bootstrap" or
   "config" endpoint. What does it contain? Is there anything there that would
   let *you* generate codes the same way the server does?
4. If you can reproduce the server's encoding, you can turn a known code back
   into its underlying number — and then forge the code for a *different* number.
   Try the neighbours of your own ids.
5. Feed a forged code into the request you captured in step 2 and send it.
   Compare against your baseline. Then try the write endpoints (redeem / modify)
   on the same forged code.

## 🕵️‍♂️ Going further

Once you realise the endpoints act on *any* valid code, the exposure is every
coupon in the system — you can walk the whole id space by encoding `1, 2, 3, …`.
Keep a second identity handy to prove that a coupon owned by someone else is
readable *and writable* while you're authenticated as alice. That contrast is
the proof of a broken authorization check, independent of how "obscure" the code
looks.

## 🤔 Why it matters

"Encode the id with hashids" is a popular *wrong* answer to IDOR. It makes ids
look opaque in URLs, which feels safer, but it is obfuscation, not
authorization — and it collapses entirely when the salt leaks (in a config
endpoint, a JS bundle, a mobile app, or just by cracking a short salt offline).
Learning to treat the code as decoration and to hunt for the encoding recipe as
an attacker is the core skill this level builds.

---

When you have captured the flag (or want to check the fix and the *why* behind
it), continue to **[SOLVE → SOLUTION.md](SOLUTION.md)**.

<br>

> **Legal / ethics.** This is an educational, deliberately vulnerable lab. Run it
> only locally, on owned, isolated infrastructure, and never use these techniques
> against systems without explicit written authorization.
