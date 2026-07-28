# Outreach go-live checklist

Everything needed to turn on automated + manual investor outreach, in order.
Do each step on **staging** first, verify, then repeat on **production**.

## 0. What this enables

- **Automated outreach** (Deploy → Outreach → Automated): shares the founder's
  published Founder Preview one-pager with in-industry investors (match ≥ 50,
  sector-aligned) once their Investable Score ≥ 70. Founder view is read-only;
  admins control pause/resume in the investor-outreach manager.
- **Manual outreach** (Deploy → Outreach → Manual): the founder builds a list,
  composes an email, sets a Day 0/3/7 sequence, and sends. Auto-stops on reply.
- **Engagement**: Opened / Clicked / Replied status on the board and in the
  Manual builder's Review tab.

Nothing sends real email until `INVESTOR_OUTREACH_LIVE=true` (step 3).

## 1. Deploy the code

Push and let the platform build/deploy:

```bash
git push
```

## 2. Run the database migrations

Apply in the Supabase SQL editor (or CLI), in numeric order. All are idempotent.

- `20260728001_founder_manual_outreach.sql`
- `20260728002_founder_manual_outreach_recipients.sql`
- `20260728003_manual_outreach_replied.sql`
- `20260728004_outreach_opened.sql`
- `20260728005_outreach_clicked.sql`

Depends on the earlier `20260719002_investor_outreach.sql` (automated outreach
tables) already being applied. "Success. No rows returned" is the expected
result for these schema changes.

## 3. Environment variables

Set in the hosting environment (e.g. Vercel), per environment tier.

| Variable | Purpose | Notes |
|----------|---------|-------|
| `INVESTOR_OUTREACH_LIVE` | Master send switch. `true` = real email; anything else queues without sending. | Leave off until you've tested the flow end to end. |
| `RESEND_API_KEY` | Resend sending (should already be set). | From resend.com/api-keys. |
| `EMAIL_FROM` | From address, e.g. `iCapOS <no-reply@icapos.com>`. | Domain must be verified in Resend. |
| `NEXT_PUBLIC_APP_URL` | Base URL for links (Founder Preview, unsubscribe). | e.g. `https://icapos.com`. |
| `OUTREACH_REPLY_ADDRESS` | Reply-to base for manual sends, e.g. `replies@icapos.com`. Enables reply-stop. | Without it, sends still work but replies aren't detected. |
| `OUTREACH_INBOUND_SECRET` | Shared secret guarding the inbound-reply webhook. | Any long random string. |
| `RESEND_WEBHOOK_SECRET` | Shared secret guarding the open/click event webhook. | Any long random string. |

## 4. Resend configuration

1. **Verify the sending domain** (icapos.com) for sending.
2. **Enable open + click tracking** on the domain (Resend domain settings).
3. **Event webhook** — add a webhook for `email.opened` and `email.clicked`
   pointing to:

   ```
   https://<your-domain>/api/webhooks/email-events?secret=<RESEND_WEBHOOK_SECRET>
   ```

4. **Inbound replies** (for reply-stop) — configure Resend Inbound (MX records
   on the `OUTREACH_REPLY_ADDRESS` domain) to forward replies to:

   ```
   https://<your-domain>/api/webhooks/outreach-inbound?secret=<OUTREACH_INBOUND_SECRET>
   ```

## 5. Verify (with `INVESTOR_OUTREACH_LIVE` still OFF)

- Load Deploy → Outreach → Automated as a founder with score ≥ 70 and at least
  one sector-aligned 50+ match. Confirm the "Automated outreach" row shows
  "On — waiting…"/"Running" and investors appear (view-only, no toggle).
- Trigger the orchestration cron manually (`POST /api/admin/run-digest-pass`
  or the orchestration endpoint) and confirm recipients advance to "sent" in the
  log **without** any real email being sent.
- Build a Manual campaign, Start it, and confirm recipients enroll and the
  Review tab shows their status.

## 6. Go live

- Set `INVESTOR_OUTREACH_LIVE=true`.
- Send yourself a test (Manual → Review → "Send test to me") and confirm the
  email, the unsubscribe link, and — after opening/clicking — the status
  updates on the board / Review tab.
- Reply to a test send and confirm the sequence stops and the reply is forwarded
  to the founder.

## Controls & safety

- **Suppression**: every send honors the shared `marketing_unsubscribes` list;
  unsubscribing anywhere suppresses everywhere.
- **Caps**: automated outreach sends a weekly cap per campaign; manual follows
  the Day 0/3/7 schedule.
- **Admin control**: pause/resume/cap for automated outreach lives in the admin
  investor-outreach manager. Founders cannot control automated outreach.
- **Compliance**: emails share the Founder Preview and carry the fixed
  disclaimer + unsubscribe. Copy in `intro-template.ts` / `manual-template.ts`
  is counsel-reviewable — swap in approved wording before broad sending.
