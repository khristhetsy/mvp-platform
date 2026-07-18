# Passkeys / "biometric login" — plan

Status: **proposal, not built.** Written from `icapos-biometric-mockup.html`.

---

## 1. What the mockup actually shows (and what it doesn't)

The mockup's scan is **simulated** — a `setTimeout` that fakes `Verified ✓`. There is no
biometric code in it. Worth stating plainly so nobody assumes this is half-done.

It also conflates **two different features**:

| Screen | What it really is | Risk |
|---|---|---|
| 1 · "Enable Face ID" | Passkey **enrollment** | Low — additive |
| 2 · "iCapOS is locked → tap to unlock" | **App lock** (re-auth of an *existing* session) | Low–medium |
| 3 · Unlocked dashboard | Just the dashboard | — |

"Sign in with a glance" (replacing the password at login) is a **third** thing the mockup
implies but doesn't show. It is by far the hardest piece. These must be decided separately.

> Naming note: the mockup uses `crr` / "Capital Readiness Rating". Project convention is
> `lead_prescore` — never `crr`. Any build must follow the convention.

## 2. How this actually works (so expectations are right)

Passkeys use **WebAuthn**. The important properties:

- **Biometrics never leave the device.** We never receive a face or fingerprint. The
  device's authenticator unlocks a private key and signs a challenge; we store only a
  **public key**.
- **Registration:** server issues a challenge → browser creates a credential → server
  verifies and stores the public key + credential ID.
- **Authentication:** server issues a challenge → device signs it → server verifies the
  signature against the stored public key → server establishes a session.
- Passkeys are **bound to a domain** (the RP ID). `icapos.com` credentials do not work on
  a preview/staging domain. This needs deciding up front.

## 3. Current state

- Auth: **Supabase Auth, email + password only** (`signInWithPassword`). No OAuth, no
  magic link, no MFA.
- No passkey libraries installed. No credentials table.

## 4. The core problem: Supabase has no native passkeys

This is the crux of the whole project. WebAuthn verification is straightforward; the hard
part is **turning a verified assertion into a Supabase session**. Options:

**A. Custom WebAuthn + mint a session (server-side)**
Verify the assertion with `@simplewebauthn/server`, then create a session for that user —
in practice via the admin API (`generateLink`) and exchanging the token for a session.
- ✅ Keeps Supabase Auth; no migration.
- ⚠️ **This endpoint is effectively "log in as this user."** If it can ever be tricked,
  it's full account takeover. It must be airtight: strict challenge binding, one-time
  challenges, origin/RP checks, rate limiting, no user-supplied identity.
- Verdict: viable, but the security burden sits with us.

**B. Third-party auth provider** (Hanko, Passage, Clerk, WorkOS)
- ✅ They own the passkey + session security.
- ❌ Migrating auth is a large, risky change across every protected route and the
  `profiles` trigger. Not proportionate just to add biometrics.

**C. Supabase MFA**
- ❌ TOTP only. **Not biometric.** Doesn't achieve the goal. Listed only to rule out.

**Recommendation: A**, but *phased* so we don't touch login until enrollment is proven.

## 5. Data model

```
user_passkeys
  id             uuid pk
  user_id        uuid  -> auth.users
  credential_id  text unique      -- base64url
  public_key     bytea
  counter        bigint           -- replay detection
  transports     text[]
  device_label   text             -- "Khris's iPhone"
  created_at     timestamptz
  last_used_at   timestamptz
```
RLS: a user may only read/delete **their own** rows. Writes go through the server.

## 6. Phasing (each phase ships independently)

**Phase 1 — Enrollment + device management. No login change.**
- `@simplewebauthn/server` + `/browser`, the table above.
- "Enable Face ID" after login; Settings → list devices, rename, revoke.
- **Zero lockout risk** — password login untouched. Proves the ceremony end-to-end.

**Phase 2 — Passkey sign-in as an *option*.**
- "Sign in with Face ID" **next to** the password form. Password always remains.
- Requires the §4A session-minting decision + security review.
- Gate behind a flag; roll out to staff first.

**Phase 3 — App lock (the mockup's screen 2), optional.**
- Re-auth an *existing* session after inactivity. No session minting → much lower risk.
- Decide: is this real value, or friction? Most B2B tools don't lock on every open.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Lockout / lost device** | Password never removed. Revoke from Settings. Multiple passkeys per user. |
| **Session-minting abuse** (§4A) | One-time challenges bound server-side; verify origin + RP ID; rate limit; never trust client-supplied user id; audit every mint. |
| **Replay** | Store and verify the signature `counter`. |
| **Domain binding** | Decide RP ID (`icapos.com`). Passkeys won't work on preview URLs — expect this in testing. |
| **Browser support** | Feature-detect; hide the option where unsupported. |
| **Scope creep** | Phase 1 is genuinely useful alone. Stop there if Phase 2 isn't worth the burden. |

## 8. Open decisions (needed before building)

1. **Which feature?** Passkey **sign-in** (replace password at login), **app lock**, or
   both? The mockup implies both; they're separate projects.
2. **Is Phase 2 worth it** given the session-minting burden — or is Phase 1 (faster
   re-auth + device management) enough?
3. **RP ID / domains** — production only, or staging too?
4. **Who first?** Staff-only rollout before founders/investors?

## 9. Honest recommendation

Build **Phase 1 only**, then reassess. It's additive, carries no lockout risk, and proves
the whole WebAuthn path. Phase 2 is where the real security burden appears — it deserves
its own decision (and review) once Phase 1 is real, not as part of "build the mockup."
