# Deploy & verify — Calendar, Scheduler & Email Inbox

Repeatable runbook for bringing the calendar + scheduler + platform inbox live on
a tier. **Always do staging first, verify, then production.** None of this is
optional config — the pages 500 without the tables, and email is silent without
Resend + an inbound provider.

Related SOPs: apply a migration (SOP 35), deploy (SOP 53), secrets (SOP 38, 43).

---

## 1. Apply migrations (Supabase SQL editor, in order)

Run each and confirm no errors:

1. `20260620002_profiles_auth_fk_cascade.sql` — referential integrity
2. `20260620003_calendar_scheduling.sql` — `calendar_events`, `scheduling_availability`
3. `20260620004_email_inbox.sql` — `email_threads`, `email_messages`
4. `20260620005_calendar_reminders.sql` — `calendar_events.reminder_sent_at`

Post-check: tables `calendar_events`, `scheduling_availability`, `email_threads`,
`email_messages` exist; column `calendar_events.reminder_sent_at` is present.

## 2. Set environment variables (Vercel, per tier)

- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
  (tier's deployed callback URL), `TOKEN_ENCRYPTION_SECRET`
- Email out: `RESEND_API_KEY`, `EMAIL_FROM`
- Email in: `INBOUND_EMAIL_DOMAIN`, `INBOUND_WEBHOOK_SECRET`
- Cron: `CRON_SECRET`

Redeploy so the new vars take effect. Never commit real values — Vercel only.

## 3. Google Cloud Console

Add the tier's callback to the OAuth client's **Authorized redirect URIs**, exactly:
`https://<tier-domain>/api/integrations/google/callback`. Must match
character-for-character or sign-in fails with `redirect_uri_mismatch`.

## 4. Inbound email provider

Point your inbound provider (Resend Inbound / SendGrid / Mailgun parse) at:
`https://<tier-domain>/api/email/inbound?key=<INBOUND_WEBHOOK_SECRET>`
and add the MX record for `INBOUND_EMAIL_DOMAIN`. Replies are routed by the
`reply+<token>@<domain>` address the outbound message sets as Reply-To.

## 5. Smoke test (in order)

- [ ] `/admin/calendar` loads (no 500 → calendar migration applied)
- [ ] Create an event → it appears on the grid and in Agenda view
- [ ] Admin → Integrations → connect Google → success
- [ ] Create an event with "Add Google Meet" → a Meet link appears
- [ ] `/admin/schedule` → set hours → Save
- [ ] As a different signed-in user, open `/schedule/<host-id>` → open slots show
- [ ] Pick a slot, add a note, Confirm → confirmation + Meet link; event on host calendar
- [ ] `/admin/inbox` → compose to an address you control → arrives, From shows sender name
- [ ] Reply to that email → it lands back in the thread (tests inbound webhook + MX)
- [ ] Inbox nav shows the unread badge + a "New mail" toast when the reply arrives
- [ ] (Optional) trigger `GET /api/cron/meeting-reminders` with the cron secret → returns `{ processed, reminded }`

## 6. Production

Only after staging passes, repeat steps 1–4 for production and redeploy.

## Common snags

- **`redirect_uri_mismatch`** — the Console redirect URI doesn't exactly match
  `GOOGLE_REDIRECT_URI`. Fix one to match the other; re-test.
- **Calendar/inbox pages 500** — migration for that tier wasn't applied.
- **Email never arrives** — `RESEND_API_KEY`/`EMAIL_FROM` unset (sends no-op), or
  sending domain not verified in Resend.
- **Replies don't appear** — inbound provider not pointed at `/api/email/inbound`,
  MX missing, or `INBOUND_WEBHOOK_SECRET` mismatch (webhook returns 401).
