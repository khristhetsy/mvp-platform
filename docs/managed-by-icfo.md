# Managed by iCFO (Premium, Done for you)

How the iCFO team runs a Premium founder account, who can do what, and how to turn it off.

## Roles

| Who | What they are | Can do |
| --- | --- | --- |
| Owner | The founder, `company_members.role = owner` | Everything on their account, including billing |
| Admin, Member | Founder's own team | Work the account. No billing (owner only) |
| Managed by iCFO | iCFO staff, `company_members.role = managed_icfo` | Run the whole account through Open as founder. No billing, no team changes |
| Client Manager | Internal staff role, rank 25 (between Manager and Admin) | Has `act_on_behalf`, so can open any founder account. No billing, users, roles, settings, accounts or integrations |

Billing is owner only on the billing pages and on the portal, checkout, subscription, address, wire invoice and upgrade request routes (`lib/billing/billing-access`). It fails closed.

## Premium account manager

- Operations Hub, Settings: **Premium account manager** is the default person for new Premium accounts.
- When a founder starts paying for Premium (wire marked received, or card), the account goes to that person as Managed by iCFO. The manager and the admins are notified. If no default is set the admins are asked to assign one.
- Admins can reassign on the company page. One manager per account.
- Operations Hub, **Managed accounts** lists active Premium accounts, their manager, renewal date, and Open as founder.

## Open as founder (central act on behalf)

- Switch: `ACT_AS_FOUNDER_CENTRAL=1` in Vercel (Production). Unset it and redeploy to turn everything off. Needs `TOKEN_ENCRYPTION_SECRET` or `CRON_SECRET` for the signed session cookie.
- Who may act: the `act_on_behalf` permission, or Managed by iCFO on that founder's company while the Owner is on an active Premium plan. Re-checked every 30 seconds.
- While acting, every founder page and route runs as the founder (`lib/admin/acting-central`). Row level security still applies, as the founder. Admin and investor screens keep the staff identity (the proxy tags each request with `x-icapos-zone`).
- Blocked while acting: billing, team changes, account deletion, sending Gmail as the founder, outreach and social campaigns, intro requests, social posting and drafts, manual outreach start, social account connection, Gmail disconnect.
- Recorded: the session start (`operational_activity_events`, `act_on_behalf_started`) and every audit log entry (`audit_logs.metadata.acting_staff_id`). The founder sees both under Settings, Team, Your iCFO team.

## SQL to run once (additive, safe to re-run)

- `20261027001_managed_icfo_role.sql`: allows the `managed_icfo` role on `company_members` and `company_invites`.
- `20261027002_client_manager_role.sql`: seeds the Client Manager role and its permissions.
- `20261028001_premium_account_manager.sql`: adds `ops_settings.premium_account_manager_id`.

## Test checklist

1. Owner sees Billing. Admin, Member and Managed by iCFO see the locked card.
2. Owner invites staff as Managed by iCFO (Premium only). Staff accepts from the email link while signed in as staff.
3. Staff opens the company in the admin workspace, clicks Open as founder, browses founder pages, then Exit to admin.
4. While acting: Billing locked, team changes refused, Gmail send refused, campaigns refused.
5. Founder's Team settings shows the account manager and the activity.

## Known limits

- Automations the founder already switched on keep running from the founder's own Gmail. Only starting new ones is blocked while acting.
- Each acting session creates a Supabase sign in session for the founder (one per server instance per about 45 minutes).
- The activity list shows sessions and audit log entries only, not every row change.
