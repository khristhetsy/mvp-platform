-- Training becomes a normal course in Learning (invitation only).
-- Additive: a course access setting, the existing Training access list tied to a course, and the Training course seeded.
-- Roles: no policy changes. Learning content is read with the service role; the access list keeps its existing RLS (staff manage, a learner reads own row).

alter table public.learning_programs
  add column if not exists access_mode text not null default 'open'
    check (access_mode in ('open','invite_only'));

alter table public.staff_training_enrollments add column if not exists program_id uuid references public.learning_programs(id) on delete cascade;
alter table public.staff_training_invites add column if not exists program_id uuid references public.learning_programs(id) on delete cascade;

insert into public.learning_programs (slug, title, description, readiness_focus, order_index, is_published, content_status, category, difficulty, access_mode)
values ('training', 'Training', 'Learn the iCapOS menu, support queue and sales tools. For iCFO staff and licensee users, by invitation.', 'training', 900, true, 'published', 'Training', 'introductory', 'invite_only')
on conflict (slug) do update set access_mode = 'invite_only';

insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-menu-features-functions', '1.1 Menu, features and functions', '1 Foundations', 'Find any page and use the top bar tools without help.', 40, 'introductory', 'any', 'foundation', 1, true, 'published')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 1 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-menu-features-functions'
on conflict do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-menu-features-functions', 'step-1', 'Learn the workspace layout', $b1$The workspace has a menu on the left, a top bar across the page, and the page in the middle. The apps home, opened from the grid button, shows one tile for each menu section.

**Do this**

- Open the grid button at the top left to see the apps home.
- Find the sidebar menu on the left and the top bar with Search, Select company, Reminders and Notifications.
- Open the Dashboard and read its three panels: Platform health, Operational priorities and Upcoming meetings.

**Remember**

- Everything starts from the Dashboard.
- Collapse the sidebar when you need more room for the page.$b1$, 1, 8, 'published' from public.learning_modules mo where mo.slug = 'training-menu-features-functions'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-menu-features-functions', 'step-2', 'Walk the sidebar sections', $b2$Sections with an arrow expand to show their items. Single pages open directly.

**Do this**

- Open each sidebar section once and read its item names.
- Note which sections are for Customer Support and which are for Administration and System.
- Use the Operations Manual when you are unsure what a page is for.

**Remember**

- System pages are for platform upkeep. Changes there need approval.$b2$, 2, 8, 'published' from public.learning_modules mo where mo.slug = 'training-menu-features-functions'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-menu-features-functions', 'step-3', 'Find anything with Search', $b3$Search jumps straight to a page or a record, so you do not need to know where it sits in the menu.

**Do this**

- Press the Search shortcut or select the Search box in the top bar.
- Type part of a page name, such as support.
- Pick the best match. Its menu path is shown under its name.

**Remember**

- Search also finds contacts, so check you opened the page you meant before you act.$b3$, 3, 8, 'published' from public.learning_modules mo where mo.slug = 'training-menu-features-functions'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-menu-features-functions', 'step-4', 'Work inside one company', $b4$Select company in the top bar puts you inside one company's account.

**Do this**

- Open Select company and choose the company.
- Check the company name before you change anything.
- Clear the selection when you are done.

**Remember**

- Never change a field the client set themselves.$b4$, 4, 8, 'published' from public.learning_modules mo where mo.slug = 'training-menu-features-functions'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-menu-features-functions', 'step-5', 'Reminders, notifications and the assistant', $b5$Reminders hold your tasks. Notifications hold alerts. Ask iCapOS answers questions about what needs attention.

**Do this**

- Open Reminders and clear the items you have finished.
- Read your unread Notifications at the start of each day.
- Ask iCapOS what needs attention, then check its answer before you act.

**Remember**

- AI answers can be wrong. The assistant gives workflow guidance only, not legal, tax or investment advice.$b5$, 5, 8, 'published' from public.learning_modules mo where mo.slug = 'training-menu-features-functions'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-menu-features-functions', 'practice', 'Practice', $b99$Practice. Do each task, then show your reviewer.

1. **Find it fast.** Using Search only, open the Support log. Then reach the same page through the menu. Say which was quicker and why.
2. **Walk the menu.** Open Sales, Marketing and Events. For each, write the item you would use first and why.
3. **Handle a task.** A client says their plan looks wrong. Write the menu path you would follow to check it, in order.$b99$, 6, 10, 'published' from public.learning_modules mo where mo.slug = 'training-menu-features-functions'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-support-company', '2.1 Company', '2 Customer Support', 'Know where each company is in the four stages and help it reach the next one.', 40, 'introductory', 'any', 'foundation', 2, true, 'published')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 2 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-support-company'
on conflict do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-company', 'step-1', 'Go through the Customer Support submenu', $b1$Start by knowing every item under Customer Support, so you know where each kind of work lives.

**Do this**

- Open Customer Support in the sidebar.
- Open each item once: Companies, Investors, Support queue, Support log, Stuck founders, Brokered Intros and AI usage and cost.
- Note what each page shows before you use it.

**Remember**

- Companies is where you review each company's stage and plan.$b1$, 1, 8, 'published' from public.learning_modules mo where mo.slug = 'training-support-company'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-company', 'step-2', 'Review each company and its stage', $b2$Every company is somewhere in four stages: Onboarding, Preparation, Marketing and Closing.

**Do this**

- Open Companies and read the Stage and Plan columns.
- Identify the stage each company is at.
- Open a company to see what is blocking its next stage.

**Remember**

- Review each company, not only the ones that wrote to support.$b2$, 2, 8, 'published' from public.learning_modules mo where mo.slug = 'training-support-company'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-company', 'step-3', 'Use the AI email draft, and always review it', $b3$The platform drafts an email for each company. The draft helps you start, but you are the final check.

**Do this**

- Open the AI email draft for the company.
- Read it against the company's real stage and plan.
- Correct anything wrong, then send.

**Never**

- Never send a draft you have not fully read.
- Never promise a refund, a credit, or an outcome.$b3$, 3, 8, 'published' from public.learning_modules mo where mo.slug = 'training-support-company'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-company', 'step-4', 'Help the company unlock the next stage', $b4$Your job is to keep the process moving until the company completes the stage.

**Do this**

- Name the one thing that unlocks the next stage.
- Tell the client plainly what it is and where to do it.
- Note the next action in the Notes Log.

**Remember**

- Automatic emails and nudges also go out until the stage is done, so check the Notes Log first to avoid repeating them.$b4$, 4, 8, 'published' from public.learning_modules mo where mo.slug = 'training-support-company'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-company', 'step-5', 'Repeat weekly, and plan for Stage 4', $b5$Put the company review on your calendar every week as part of your planning.

**Do this**

- Add a weekly company review block to your calendar.
- Work through the companies from the earliest stage to the latest.
- Once a company completes all four stages, help with outreach improvement and deal closing.

**Remember**

- Consistency matters more than length. A short review every week keeps companies moving.$b5$, 5, 8, 'published' from public.learning_modules mo where mo.slug = 'training-support-company'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-company', 'practice', 'Practice', $b99$Practice. Do each task, then show your reviewer.

1. **Stage review.** Review three companies. Name the stage of each and the one thing that would unlock its next stage.
2. **Draft check.** The AI draft tells a company it is in Marketing when it is still in Preparation. Find the error and write the corrected opening paragraph.
3. **Weekly plan.** Write your weekly company review plan: when it is on your calendar and the order you review companies in.$b99$, 6, 10, 'published' from public.learning_modules mo where mo.slug = 'training-support-company'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-support-queue', '2.2 Support queue', '2 Customer Support', 'Resolve a client request from open to closed.', 48, 'introductory', 'any', 'foundation', 3, true, 'published')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 3 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-support-queue'
on conflict do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-queue', 'step-1', 'Open the queue and review a ticket', $b1$Start every session with the oldest open ticket, because the 48 hour clock runs from when the client wrote.

**Do this**

- Open the support queue in Admin > Support.
- Sort or scan by age. Oldest first.
- Select a ticket and read the whole thread, not only the last message.
- Identify the client, the company, its plan and its stage.
- Decide what the client actually needs: an answer, a fix, a how to, or an escalation.
- Check the Notes Log for earlier emails, so you do not repeat or contradict them.

**Before you reply, know**

- The question: what exactly is being asked.
- The facts: what the platform shows for that account.
- The owner: whether you can resolve it, or it needs Senior Tech Support.$b1$, 1, 8, 'published' from public.learning_modules mo where mo.slug = 'training-support-queue'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-queue', 'step-2', 'Respond with the AI draft, then correct it', $b2$The AI draft saves time, but it can be wrong, so you are the final check. Never send a draft you have not fully read.

**Do this**

- Generate the AI draft for the ticket.
- Read it against the facts you gathered in Step 1.
- Correct anything wrong: plan, price, dates, feature names, steps, and promises.
- Use AI rewrite (Shorter, Friendlier) for tone only, then read the new text again.
- Send, and note the next action in the ticket.

**Check every draft for**

- Accuracy: every fact matches the account and current platform behavior.
- No refund or credit promises: never say iCapOS will refund or credit the client.
- No field changes: never offer to change a field the client set themselves.
- No empty promises: never say you will check, confirm or provide something iCapOS does not have or cannot do.
- No outcome promises: no funding promises, no investor response claims, no unsourced numbers.
- One clear next step: the client knows what happens next.
- Plain tone: short and specific.$b2$, 2, 8, 'published' from public.learning_modules mo where mo.slug = 'training-support-queue'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-queue', 'step-3', 'Self submit a ticket', $b3$Use self submit when a client reached you outside the queue (phone, email, chat, in person) and the request needs a ticket so it is tracked.

**Do this**

- Open the self submit ticket feature.
- Select the client and company.
- Write a clear subject and describe the request in the client's own terms.
- Record how it reached you and the date.
- Submit it, then work it like any other ticket.

**Rules**

- One request per ticket: keep tickets easy to resolve and close.
- Facts only: write what the client said, not your guess about the cause.
- Same clock: the 48 hour turnaround starts when the client first asked, not when you submitted.$b3$, 3, 8, 'published' from public.learning_modules mo where mo.slug = 'training-support-queue'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-queue', 'step-4', 'Access as client', $b4$Use Access as client only when you must log in as the client to resolve the issue on their behalf, and a reply or guide would not solve it. It is a last resort for hands on fixes, not a way to browse accounts.

**How to use it**

- Note the ticket and the reason before you switch.
- Switch in, do only what the ticket requires, and nothing else.
- Switch out as soon as the work is done, using the off switch.
- Record in the ticket what you did and why.

**Limits**

- No sending as the client: email as the founder stays blocked while you act as them.
- No overriding their choices: never change a field the client set themselves.
- No billing changes: billing stays with the client unless the ticket is a billing issue and a senior team member approves.
- Tell the client: say in your reply that you acted on their account and what you did.$b4$, 4, 8, 'published' from public.learning_modules mo where mo.slug = 'training-support-queue'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-queue', 'step-5', 'Close out the ticket', $b5$Close a ticket only when the issue is resolved and the client has what they need. Closing too early reopens work and costs trust.

**Do this**

- Confirm the fix works, or that the client's question was fully answered.
- Send a short final message that states the outcome.
- Write the resolution in the ticket: cause, action taken, and who did it.
- Mark the ticket closed.
- If you used Access as client, confirm you switched out.

**Do not close if**

- The client has not confirmed, and the issue could still be present.
- An escalation is open and Senior Tech Support has not finished.
- A promise is pending: you told the client something would follow.$b5$, 5, 8, 'published' from public.learning_modules mo where mo.slug = 'training-support-queue'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-queue', 'step-6', 'Schedule daily, watch notifications, escalate', $b6$Put one recurring support queue block on your calendar every day, and turn on notifications so a request for assistance reaches you between blocks.

**Daily routine**

- Open the queue at your calendar block.
- Answer the oldest open tickets first, following Steps 1 and 2.
- Handle any notification asking for assistance as soon as you see it.
- Close resolved tickets, following Step 5.
- Before the block ends, note the next action on every ticket still open.

**Escalate complex tech support to Senior Tech Support**

- Decide it is complex: you cannot resolve it with a reply, a guide, or Access as client.
- Hand it to Senior Tech Support with the ticket, the client, what you tried, and what you saw.
- Notify the customer in the same hour. Tell them plainly that a senior technical specialist now has the issue.
- Do not promise a fix date, and do not promise anything iCapOS cannot deliver.
- Keep the ticket open and watch it until Senior Tech Support returns it, then follow up with the client.
- Close it only after the client confirms the issue is resolved.$b6$, 6, 8, 'published' from public.learning_modules mo where mo.slug = 'training-support-queue'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_lessons (module_id, module_slug, lesson_key, title, body_markdown, order_index, estimated_time_minutes, content_status)
select mo.id, 'training-support-queue', 'practice', 'Practice', $b99$Practice. Do each task, then show your reviewer.

1. **Wrong draft.** The AI draft tells a client their plan includes something it does not. Find the error, fix the draft, and explain what you checked.
2. **Phone request.** A client calls asking for help with a failed upload. Self submit the ticket and write its subject and description.
3. **Escalation.** A client reports a problem you cannot reproduce even after Access as client. Write the handoff to Senior Tech Support and the message to the customer.$b99$, 7, 10, 'published' from public.learning_modules mo where mo.slug = 'training-support-queue'
on conflict (module_slug, lesson_key) do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-support-investors-stuck', '2.3 Investors and Stuck founders', '2 Customer Support', 'Support investor accounts and re-engage founders who have stalled.', 15, 'introductory', 'any', 'foundation', 4, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 4 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-support-investors-stuck'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-support-intros-ai-cost', '2.4 Brokered Intros, AI usage and cost', '2 Customer Support', 'Track brokered introductions and keep AI spend under control.', 15, 'introductory', 'any', 'foundation', 5, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 5 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-support-intros-ai-cost'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-sales-contacts', '3.1 Contacts', '3 Sales and Marketing', 'Find, create and update contact records.', 15, 'introductory', 'any', 'foundation', 6, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 6 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-sales-contacts'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-sales', '3.2 Sales', '3 Sales and Marketing', 'Run deals from Opportunities through Pipeline to Contracts.', 15, 'introductory', 'any', 'foundation', 7, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 7 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-sales'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-marketing', '3.3 Marketing', '3 Sales and Marketing', 'Build and send campaigns, sequences and templates.', 15, 'introductory', 'any', 'foundation', 8, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 8 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-marketing'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-social-linkedin', '3.4 Social Media and LinkedIn', '3 Sales and Marketing', 'Plan posts and run LinkedIn outreach.', 15, 'introductory', 'any', 'foundation', 9, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 9 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-social-linkedin'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-ai-agent', '3.5 AI Agent', '3 Sales and Marketing', 'Understand the AI agents and how they are set up.', 15, 'introductory', 'any', 'foundation', 10, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 10 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-ai-agent'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-investor-relations', '4.1 Investor Relations', '4 Investors and Events', 'Manage founder deal flow.', 15, 'introductory', 'any', 'foundation', 11, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 11 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-investor-relations'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-investor-directory', '4.2 Investor Directory', '4 Investors and Events', 'Work with public investor data and control who can use it.', 15, 'introductory', 'any', 'foundation', 12, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 12 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-investor-directory'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-events', '4.3 Events', '4 Investors and Events', 'Run an investor event from invitation to follow up.', 15, 'introductory', 'any', 'foundation', 13, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 13 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-events'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-voice', '4.4 Voice', '4 Investors and Events', 'Run AI calling campaigns and review calls.', 15, 'introductory', 'any', 'foundation', 14, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 14 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-voice'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-communication', '5.1 Communication', '5 Operations', 'Manage email, calendar and meetings.', 15, 'introductory', 'any', 'foundation', 15, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 15 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-communication'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-daily-work-tools', '5.2 Daily work tools', '5 Operations', 'Keep up with tasks, alerts, feeds and reports.', 15, 'introductory', 'any', 'foundation', 16, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 16 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-daily-work-tools'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-deal-rooms-diligence', '5.3 Deal rooms and diligence', '5 Operations', 'Support deals after matching.', 15, 'introductory', 'any', 'foundation', 17, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 17 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-deal-rooms-diligence'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-accounting', '5.4 Accounting', '5 Operations', 'Invoicing, payments and bank activity.', 15, 'introductory', 'any', 'foundation', 18, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 18 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-accounting'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-learning', '5.5 Learning', '5 Operations', 'The founder learning programs.', 15, 'introductory', 'any', 'foundation', 19, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 19 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-learning'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-ceo-manual', '5.6 CEO hub and Operations Manual', '5 Operations', 'Use the CEO page and the manual as the reference for every process.', 15, 'introductory', 'any', 'foundation', 20, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 20 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-ceo-manual'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-admin-users', '6.1 Users, permissions and profile', '6 Administration', 'User Management, User Permissions, My Profile.', 15, 'introductory', 'any', 'foundation', 21, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 21 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-admin-users'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-admin-billing', '6.2 Billing, pricing and accounts', '6 Administration', 'Reviewed with a senior team member, since these change what clients pay.', 15, 'introductory', 'any', 'foundation', 22, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 22 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-admin-billing'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-admin-feature-controls', '6.3 Feature Controls and integrations', '6 Administration', 'Which features are switched on, and how outside tools connect.', 15, 'introductory', 'any', 'foundation', 23, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 23 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-admin-feature-controls'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-system-upkeep', '6.4 System upkeep', '6 Administration', 'Read only for most staff. Changes need approval.', 15, 'introductory', 'any', 'foundation', 24, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 24 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-system-upkeep'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-licensee-stage-1', 'L2 Stage 1: customer onboarding', 'Licensee track', 'Licensee only session.', 15, 'introductory', 'any', 'foundation', 25, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 25 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-licensee-stage-1'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-licensee-stage-2', 'L3 Stage 2: preparation tools', 'Licensee track', 'Licensee only session.', 15, 'introductory', 'any', 'foundation', 26, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 26 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-licensee-stage-2'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-licensee-stage-3', 'L4 Stage 3: outreach', 'Licensee track', 'Licensee only session.', 15, 'introductory', 'any', 'foundation', 27, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 27 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-licensee-stage-3'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-licensee-stage-4', 'L5 Stage 4: customer closing', 'Licensee track', 'Licensee only session.', 15, 'introductory', 'any', 'foundation', 28, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 28 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-licensee-stage-4'
on conflict do nothing;
insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, required_plan, readiness_stage, order_index, is_published, content_status)
values ('training-licensee-stage-5', 'L6 Stage 5: communication', 'Licensee track', 'Licensee only session.', 15, 'introductory', 'any', 'foundation', 29, false, 'draft')
on conflict (slug) do nothing;
insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, mo.id, 29 from public.learning_programs p, public.learning_modules mo where p.slug = 'training' and mo.slug = 'training-licensee-stage-5'
on conflict do nothing;

-- Existing Training access (enrollments and invitations) now belongs to the Training course.
update public.staff_training_enrollments set program_id = (select id from public.learning_programs where slug = 'training') where program_id is null;
update public.staff_training_invites set program_id = (select id from public.learning_programs where slug = 'training') where program_id is null;
