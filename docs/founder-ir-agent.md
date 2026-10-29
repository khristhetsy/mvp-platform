# Founder IR Agent ("Build your agent")

Each founder organization gets one investor relations agent, modeled on the Johnny IR agent (`/johnny`), served at `icapos.com/[company-slug]/[ending]`. The company slug is generated from the company name and locked. The founder edits the ending only (default `invest`).

## What ships

| Area | Where |
| --- | --- |
| Migrations | `supabase/migrations/20261013120000_ir_agents.sql` (already on main) and `20261013190000_ir_agents_studio.sql` (adds the columns the studio needs, seeds plan access) |
| Shared engine | `src/lib/ir-agent/` (slug rules, defaults, scripted replies, AI call with Johnny's four protections, store, access) |
| Chat component | `src/components/ir-agent/AgentChat.tsx` (Johnny's flow, driven by the founder's config) |
| Public page | `src/app/[company]/[ending]/page.tsx` (live agents only, noindex, `?src=` carried into the conversation record and the booking) |
| Reply route | `src/app/api/ir-agent/[agentId]/reply/route.ts` (edge, rate limit, public AI budget, spend recording, guardrails, no percentages) |
| Conversation record | `src/app/api/ir-agent/[agentId]/conversation/route.ts` |
| Founder page | `/founder/ir-agent` with tabs Build, Train, Share, Conversations (`src/components/ir-agent/IrAgentStudio.tsx`) |
| Founder APIs | `src/app/api/founder/ir-agent/*` (agent, questions, contact fields, image, ending check, PDF sources, taught answers, conversations, QR) |
| Admin | Feature Controls card `src/components/admin/IrAgentControls.tsx` and `src/app/api/admin/ir-agent/route.ts` |
| Email composer | "Agent link" toggle and `{{ir_agent}}` merge field in Outreach → Manual |
| Nav | "My IR Agent" under Stage 3 · Marketing (V2) and Investors (V1) |

Johnny's own files are untouched. `/johnny` behaves exactly as before. Founder agents reuse Johnny's pure modules (`src/lib/johnny/profile.ts` for field reading, `isQuestion` and `typoFix` from his config) and get their own copies of the flow, so a change to Johnny never leaks into founder pages and the reverse.

## Access control (admin)

Three layers, checked in `getFounderAgentAccess`:

1. Master switch: `feature_flags` row `founder:ir_agent`. Seeded OFF by the first migration, so turn it on in Feature Controls. Off hides the page and the nav item for everyone. Also appears in the Global Features matrix automatically.
2. Plan checkboxes: a row in `ir_agent_plan_access` means the plan includes it (seeded: Basic, Professional, Premium, SPV Program).
3. Per founder override: `ir_agent_access_overrides` (`enabled` true or false, no row to follow the plan).

Demo and internal accounts (`organizations.purpose` or `email_dispatch_enabled = false`) record conversations but never send email or book a real meeting.

## Master template

Stored in the single row table `ir_agent_template`, edited from the Feature Controls card. Each save bumps `version`, and every agent remembers the version it was copied from. New agents are copied from it; existing agents keep their own copy.

## What founders can and cannot change

Can: ending, agent name, company name as spoken, welcome (up to 3 lines), fact sheet, question wording, order, options, on or off, custom questions, contact questions (name and email stay required), image, taught answers, PDFs, live or paused.

Cannot: the `icapos.com/[company]/` prefix, the disclaimer line, the hard stop on "remove me" or "unsubscribe", the rule against prices, percentages and promises (checked on the server for AI replies and for taught answers).

## Website and signup

The pricing page and the signup plan picker read `ir_agent_plan_access` (`getAgentPlanSet`): a plan that includes the agent shows "Investor Relations Agent, prospecting investors 24/7" with a NEW badge, others show it crossed out, and nothing shows while the master switch is off. Admin picks a live agent as the website demo in Feature Controls (`platform_settings` key `ir_agent_demo`); the pricing page then shows "Talk to a demo agent" linking to it with `src=pricing`.

## Compliance notice

Before Go live, the Build tab shows a notice in three points (the agent is an AI and says so; securities law applies to what it says; seek your own legal counsel) with a required checkbox. The confirmation is stored as `ir_agents.compliance_acknowledged_at` and `compliance_acknowledged_by`, shown to admin in Feature Controls, and the server refuses `status = live` without it. The wording lives in `COMPLIANCE_NOTICE` in `src/lib/ir-agent/defaults.ts`; have counsel review it. The locked footer under every conversation names the AI and the company.

## Booking

Host is the founder who created the agent. With hours set in Scheduling, the agent offers real open times and books through `/api/scheduling/book` (Meet link when Google Calendar is connected). Without hours, the agent collects the contact fields and ends with "the team will reach out"; the details sit in Conversations.

## Apply

1. If `20261013120000_ir_agents.sql` is not applied yet, run it in the Supabase SQL Editor. Then run `20261013190000_ir_agents_studio.sql`. Staging first, then production.
2. Deploy. No new environment variables.
3. In Admin → Feature Controls, turn the Founder IR Agent switch on and check the plan checkboxes.

## Open items for Khris

1. The three fixed Johnny answers (stake, after the call, privacy) are Johnny's and are not copied to founder agents. Founders teach their own.
2. Accredited investor question: in the default set as a custom question (Yes, No, Not sure), stored as typed. Existing agents add it from Build if wanted.
3. The confirmation call promise is dropped for founder agents (the founder may not make that call).
4. Johnny's Google token: reconnect in Integrations.
5. Repo visibility: the repository is public on GitHub.
