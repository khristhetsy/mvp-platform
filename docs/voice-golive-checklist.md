# iCapOS Voice Hub — Go-Live Checklist

Everything needed to take the Voice Hub from dormant to live, in order. Nothing
dials or messages until `VOICE_OUTBOUND_ENABLED=true` **and** (policy) the consent
architecture has cleared a TCPA-literate attorney. You can complete every step
below with the kill-switch off and only test against your own number.

---

## 1. Apply the migrations (staging → verify → production)

All additive; each degrades gracefully if unapplied. Apply in order via the
Supabase SQL editor or `supabase db push`.

| Migration | Adds | Until applied |
|-----------|------|---------------|
| `20260824005_formd_connector` (if not already) | Form D tables | — |
| `20260825001_voice_reconsent` | `consent_records.reconsent_status` | funnel "Re-consent" row shows "—" |
| `20260825002_voice_live_calls` | `voice_live_calls` table | Live-now monitor shows empty |
| `20260825003_voice_campaign_audience` | `voice_campaigns.audience_config` | campaigns behave as "all eligible" |
| `20260825004_voice_cadence` | `cadence_steps` + `voice_cadence_enrollments` | cadence engine has nothing to run |

Verify after: `select table_name from information_schema.tables where table_name like 'voice_%';`

---

## 2. Environment variables (Vercel → Settings → Environment Variables)

**Master switch + secret**
```
VOICE_OUTBOUND_ENABLED = false      # flip to true only when ready + attorney-cleared
VOICE_AGENT_SECRET     = <invent a 32+ char random string>
```

**Vapi (voice runtime)**
```
VAPI_API_KEY           = <your private key>
VAPI_ASSISTANT_ID      = de9fd205-234f-4549-896c-f7bf32e52f41   # "Robert"
VAPI_PHONE_NUMBER_ID   = <UUID from Vapi → Phone Numbers → your number>
VAPI_TEST_NUMBER       = <your own cell, +1…>      # test dials only
VOICE_TRANSFER_NUMBER  = <rep's line, +1…>          # hot transfer
```

**Demo booking (Google Calendar — already connected)**
```
VOICE_BOOKING_USER_ID  = <admin user id whose calendar hosts demos>
```

**Twilio (SMS / WhatsApp — optional, for the multichannel cadence)**
```
TWILIO_ACCOUNT_SID     = <from Twilio console>
TWILIO_AUTH_TOKEN      = <from Twilio console>
TWILIO_SMS_FROM        = <your Twilio SMS number, +1…>
TWILIO_WHATSAPP_FROM   = whatsapp:+1…               # approved sender / sandbox
TWILIO_TEST_NUMBER     = <your own cell, +1…>        # test messages only
```

**Cron** — `CRON_SECRET` is already set (used by the cadence tick every 15 min).

---

## 3. Configure Vapi ("Robert" assistant)

- **Model → Custom LLM URL** = `https://icapos.com/api/voice/agent` (Vapi appends `/chat/completions`).
- **Server URL** = `https://icapos.com/api/voice/call-end`; enable server messages `status-update` and `end-of-call-report`. Point status updates at `https://icapos.com/api/voice/call-status`.
- **Server URL Secret** = the same value as `VOICE_AGENT_SECRET` (Vapi sends it as `x-vapi-secret`; the app accepts it).
- **Voice** = pick one (built-in is fine).
- Pass call **metadata** through (`contactId`, `campaignId`, `variantId`, `opener`).

## 4. Configure Twilio (only if using SMS/WhatsApp)

- Messaging → your number → **A message comes in (webhook)** = `https://icapos.com/api/voice/sms-inbound?s=<VOICE_AGENT_SECRET>` (secret in the URL — Twilio can't send headers).
- WhatsApp: set the same inbound webhook on the WhatsApp sender/sandbox.

---

## 5. Test (kill-switch on, your number only)

1. Set `VOICE_OUTBOUND_ENABLED=true` and the `*_TEST_NUMBER`s.
2. **Voice:** Voice Hub → Consent Ledger → test call → dials `VAPI_TEST_NUMBER` only. Watch it appear in the Command Center **Live now** panel; confirm the outcome in **Call Review**.
3. **SMS:** POST `/api/admin/voice/sms/test` → sends to `TWILIO_TEST_NUMBER`; reply **STOP** and confirm the number lands on the DNC list (Consent Ledger).
4. **Cadence:** on a test campaign with a scoped audience of just your test contact, add steps, **Enroll**, and watch the cron fire them.
5. Turn `VOICE_OUTBOUND_ENABLED` back **off** until go-live.

---

## 6. Go-live gate (do not skip)

- The cold Odoo lists are the highest-risk input — **re-consent before dialing** them.
- The consent architecture goes in front of a **TCPA-literate attorney** before a single cold lead is dialed. AI-voice calls need prior express (written in most states) consent; exposure is $500–$1,500 per call, uncapped.
- EU/France contacts stay hard-blocked pending a dedicated GDPR + AI-Act flow.
- Only after sign-off: set `VOICE_OUTBOUND_ENABLED=true` in production.

---

## What's built (for reference)

Command Center · Campaigns + A/B (with significance) · Marketing-Hub-linked
audiences (list / segment / contacts) · consent-gated dialer · live-calls monitor
+ hot transfer · Google-Calendar demo booking · SMS/WhatsApp send + STOP handling
· multichannel cadence engine. All behind the master kill-switch.
