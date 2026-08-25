# iCapOS Voice ↔ Vapi — Setup

Wire your Vapi account to the iCapOS Voice Hub. Nothing dials for real until
`VOICE_OUTBOUND_ENABLED=true` **and** (per policy) the consent architecture has
cleared a TCPA attorney. You can complete every step below with dialing off and
place a test call to your own phone.

---

## 1. Environment variables (Vercel → Settings → Environment Variables)

| Var | Value | Where to get it |
|-----|-------|-----------------|
| `VAPI_API_KEY` | your **Private** key | Vapi → API Keys |
| `VAPI_ASSISTANT_ID` | `de9fd205-234f-4549-896c-f7bf32e52f41` (assistant "Robert") | Vapi → Assistants → the assistant header |
| `VAPI_PHONE_NUMBER_ID` | the number's id | Vapi → Phone Numbers → your number → copy ID |
| `VOICE_AGENT_SECRET` | a random string you invent (32+ chars) | you create it; also paste into Vapi (step 3) |
| `VAPI_TEST_NUMBER` | your own cell, `+1…` | for in-app test dials only |
| `VOICE_TRANSFER_NUMBER` | the rep's line, `+1…` | for hot-transfer |
| `VOICE_BOOKING_USER_ID` | the admin user id whose Google Calendar hosts demos | that account must have Google connected in-app |
| `VOICE_OUTBOUND_ENABLED` | leave **unset / false** for now | the master kill-switch |

The **Public** API key is only for an in-browser Vapi widget — not needed for
server-side outbound dialing. Rotate the private key after setup since it was
shared in chat.

---

## 2. Voice (TTS)

You already have Vapi, so TTS is covered — pick a voice on the assistant
(Vapi → Assistant "Robert" → **Voice**). Vapi's built-in voices work out of the
box; ElevenLabs/Cartesia voices are optional and, if used, plug their key in on
Vapi's side. No TTS signup needed to start.

Voice direction per the brief: warm, unhurried, *clearly* synthetic-but-pleasant
(you disclose it's AI at 0:03 anyway).

---

## 3. Shared secret

Invent one string. Put it in `VOICE_AGENT_SECRET` (step 1) **and** in Vapi's
**Server URL Secret** field (Assistant → Advanced/Messaging → Server URL, or
org-wide under Settings → Server URL). Vapi sends it back as the `x-vapi-secret`
header; the app already accepts that header, so no custom headers needed.

---

## 4. Webhook URLs (point Vapi at the app)

Set these on the assistant (Server URL + Server Messages). Base is your
production origin, e.g. `https://icapos.com`.

| Purpose | URL | Vapi surface |
|---------|-----|--------------|
| Agent brain (custom LLM) | `https://icapos.com/api/voice/agent` | Model → Custom LLM URL |
| Call-end report | `https://icapos.com/api/voice/call-end` | Server URL / `end-of-call-report` |
| Live status | `https://icapos.com/api/voice/call-status` | Server URL / `status-update` |

Enable server messages: `status-update`, `end-of-call-report` (and
`assistant.speechStarted` later if you want live captions in the monitor).

---

## 5. Call metadata (makes A/B + attribution work)

When the app places a call it attaches `metadata`:
`{ contactId, campaignId, variantId }` plus the A/B `opener` as a template
variable (`variableValues.opener`). Configure the assistant to pass these
through to the webhooks so each attempt records its variant and the agent opens
with the right script. Vapi echoes `call.metadata` on every server message.

---

## 6. Migrations to apply (staging → production, your approval)

- `20260825001_voice_reconsent.sql` — the consent funnel's "Re-consent" row.
- `20260825002_voice_live_calls.sql` — the Live-now monitor's in-progress table.

Until these run, those two surfaces degrade gracefully (blank / "—").

---

## 7. Test flow (with dialing on, to your own phone only)

1. Set all of step 1, including `VOICE_OUTBOUND_ENABLED=true` and `VAPI_TEST_NUMBER`.
2. Voice Hub → Consent Ledger → **Test connection / Test call** places a call to
   `VAPI_TEST_NUMBER` only (no real contact can be dialed this way).
3. Watch the call appear in the Command Center **Live now** panel; confirm the
   outcome lands in **Call Review** when it ends.
4. Turn `VOICE_OUTBOUND_ENABLED` back off until the attorney sign-off.

---

## Vapi payload adapters — built ✓

The wire-format gap is now handled in code, so the endpoints above are
plug-and-play:

- **Custom-LLM protocol:** `/api/voice/agent/chat/completions` is an
  OpenAI-compatible endpoint (streaming + non-streaming). Set the assistant's
  Custom-LLM **URL** to `https://icapos.com/api/voice/agent` — Vapi appends
  `/chat/completions`. It pulls `contactId` / `campaignId` / `variantId` /
  `opener` from the call metadata + variableValues and runs the guardrailed agent.
- **Server-message envelope:** `/api/voice/call-end` and `/api/voice/call-status`
  now accept Vapi's `{ message: { type, call, artifact, ... } }` shape (via
  `vapi-adapter.ts`) as well as a flat body, mapping `endedReason` → disposition
  and Vapi status → the live-monitor status.

So a real call round-trips once the env vars are set and the assistant points at
these URLs with the shared secret.
