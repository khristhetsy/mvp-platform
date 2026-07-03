# iCapOS Voice — Operator Guide

How to use what's built, how to turn it on, and what must happen first. Everything
below is **dormant** until you deliberately enable it: no calls are placed and no
telephony vendor is wired in.

---

## 1. What's built and where it lives

Four operator surfaces, all under **Admin → Compliance**:

| Surface | Path | What it's for |
|---|---|---|
| Voice Consent Ledger | `/admin/voice/consent-ledger` | The pre-dial gate as UI — who's eligible or blocked, and why |
| Voice Campaigns | `/admin/voice/campaigns` | Configure audience, guardrail version, A/B opener variants |
| Voice Performance | `/admin/voice/performance` | Booked-demo rate, opt-out canary, variant significance |
| Voice Call Review | `/admin/voice/calls` | Per-call audit: outcome, recording/transcript, consent trail |

Two server endpoints a voice runtime (Vapi/Retell) would call:

- `POST /api/voice/agent` — the guardrailed Claude brain, one turn per call.
- `POST /api/voice/call-end` — records the outcome + writes a note back to Odoo.

Reads are open to admin/analyst; all writes are admin-only.

---

## 2. Current state: dormant + consent-closed

- **Master switch is OFF.** `VOICE_OUTBOUND_ENABLED` is unset, so the gate blocks
  every dial and both webhooks return 503.
- **Consent-closed by default.** No `consent_records` row = blocked. Your ~24K
  Odoo contacts are all blocked until consent is captured — this is intentional
  (the cold lists are the highest legal-exposure input).
- **No vendors.** Vapi, Twilio, ElevenLabs, and the booking tool are not connected.

You can safely click through all four surfaces today. They'll show zeros — that's
the honest, correct state before a pilot.

---

## 3. Before you can dial (non-negotiable prerequisites)

1. **Legal sign-off.** A TCPA-literate attorney reviews the consent architecture
   before a single cold lead is dialed. AI-generated voice is treated as
   artificial voice under the TCPA — prior express (usually written) consent is
   required, exposure is $500–$1,500 per call and uncapped.
2. **Re-consent the cold lists.** The Odoo leads have no consent on file. You need
   a documented opt-in per contact, stored in `consent_records` with evidence.
3. **Lock the §9 vendor decisions** — runtime (Vapi vs Retell), telephony (Twilio
   vs Telnyx), TTS voice, and booking tool.
4. **EU/FR stays hard-blocked** pending a dedicated GDPR + AI-Act flow.

Only after 1–4 do the env vars below do anything useful.

---

## 4. How to turn it on (env vars)

Set in Vercel (Production), then redeploy:

| Variable | Purpose |
|---|---|
| `VOICE_OUTBOUND_ENABLED` | Master kill-switch. Set to `true` to arm the gate + webhooks. Default off. |
| `VOICE_AGENT_SECRET` | Shared secret the runtime must send as `x-voice-secret` on both webhooks. |
| `ANTHROPIC_API_KEY` | Powers the agent turns (already used elsewhere). Without it, the agent degrades to a safe disclosure line. |
| `ODOO_URL` / `ODOO_DB` / `ODOO_USERNAME` / `ODOO_API_KEY` | Already set — used for the call-end note writeback. |

With `VOICE_OUTBOUND_ENABLED` off, nothing runs no matter what else is set.

---

## 5. How the gate works (the safety spine)

Every dial must pass `pre_dial_gate(contact_id)` — a Postgres function returning
`{ eligible, reason, disclosure, phone }`. It checks, in order:

1. phone present
2. live consent (not revoked, not expired)
3. jurisdiction allowed (EU/FR blocked)
4. not on the do-not-call list
5. under the two-call cap
6. recipient-local time is 8am–9pm

The `v_call_queue` view only surfaces contacts that already pass all of it, and the
app never dials without an `eligible` result. Three layers, one chokepoint.

The AI disclosure string is returned by the gate and **must be spoken first** on
every call.

---

## 6. Operating it (once armed + legal-cleared)

**Capture consent.** Insert a `consent_records` row per opted-in contact:
`contact_id` (Odoo id), `channel='voice'`, `consent_type`, `jurisdiction`,
`call_timezone` (IANA, e.g. `America/New_York`), `evidence_url`. A capture UI is a
future build; until then this is done via your consent flow / data load.

**Configure a campaign.** Voice Campaigns → New campaign (name + audience) → add
one or more A/B variants (label, opener script, traffic %). Opener scripts are
checked against the compliance lexicon on save — forbidden terms (SPV,
funding-probability language, etc.) are rejected with the offending term named. The
AI disclosure is prepended automatically; don't write it into the script. Set the
campaign to `active` when ready.

**Point the runtime at the endpoints.** In Vapi/Retell:
- Custom-LLM URL → `https://<your-domain>/api/voice/agent`, header
  `x-voice-secret: <VOICE_AGENT_SECRET>`.
- Call-end webhook → `https://<your-domain>/api/voice/call-end`, same header.

The agent request body carries `{ contactId, audience, messages, ... }`; the
response is `{ reply, toolCalls, guardrailVersion, violations }`.

**Monitor.** Watch Performance (opt-out rate first, then booked rate), Call Review
(audit any call), and the Consent Ledger (eligibility + DNC).

**Opt-outs are automatic.** The agent's `mark_opt_out` tool adds the number to the
do-not-call list and revokes consent across all channels the instant someone asks
to stop — no manual step.

---

## 7. Guardrails baked in

- Advisory-only. Not a broker-dealer. Never solicits investment.
- "Engagement traction," never funding probability. Pre-score is a `lead_prescore`.
- No SPV / deal-structure language. "Private Market" / "indicated interest" only.
- Disclosure fires before anything else; warm, immediate opt-out on any pushback.
- Guardrail prompt is versioned (`v1.0.0`) and stamped on every campaign + attempt.

---

## 8. What's NOT built yet (needs vendor + legal first)

- Live-calls surface (real-time transcript stream) — exists only once a runtime streams.
- Actual dialing, hot transfer, voicemail drops — Step 3/6, vendor-dependent.
- SMS / WhatsApp cadence — Step 7 (Twilio).
- A consent-capture UI and the Cal.com/Calendar booking wiring.

---

## 9. Decision checklist to hand your team / attorney

- [ ] Attorney sign-off on the consent architecture (blocks everything).
- [ ] Runtime: Vapi + Claude vs Retell.
- [ ] Telephony: Twilio vs Telnyx (Twilio if SMS/WhatsApp share one account).
- [ ] TTS voice: ElevenLabs vs Cartesia (audition on disclosure + objection turns).
- [ ] Booking: Cal.com vs Google Calendar (already connected).
- [ ] Re-consent plan for the cold Odoo lists.
