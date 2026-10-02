-- Founder testimonials submitted from icapos.com/testimonial (signed link in the
-- CRR testimonial request email). Admins approve or decline them in Marketing Hub
-- → Testimonials; approved rows feed the homepage "Founder results" section.
-- Written and read only through the service role (server code); RLS is enabled
-- with an admin read/update policy for completeness.
-- Idempotent: safe to re-run.

create table if not exists public.founder_testimonials (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  title text,
  company_name text,
  industry text,
  stage text,
  quote text not null check (char_length(quote) between 20 and 600),
  anonymous boolean not null default false,
  show_score boolean not null default true,
  crr_start integer,
  crr_current integer,
  consent_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists founder_testimonials_status_idx on public.founder_testimonials (status, created_at desc);
create index if not exists founder_testimonials_email_idx on public.founder_testimonials (lower(email));

alter table public.founder_testimonials enable row level security;

drop policy if exists "admins manage founder testimonials" on public.founder_testimonials;
create policy "admins manage founder testimonials"
  on public.founder_testimonials
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- The request email now links to the form instead of asking for a reply.
update public.marketing_templates
set
  html_body = replace(
    html_body,
    $old$<p style="margin:0 0 14px;">Just reply to this email with your recommendation. By replying, you agree we may share it on icapos.com. If you would prefer to stay anonymous, say so in your reply.</p>$old$,
    $new$<p style="margin:0 0 14px;">It takes about two minutes. You choose whether your name and score are shown, and nothing is published until you agree on the form.</p>
  <a href="{{testimonial_url}}" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:12px 22px;border-radius:6px;margin:0 0 18px;">Write your recommendation</a>
  <p style="margin:0 0 14px;color:#5A6472;font-size:13px;">Prefer email? Just reply with your recommendation and tell us if you would like to stay anonymous.</p>$new$
  ),
  text_body = replace(
    text_body,
    $old$Just reply to this email with your recommendation. By replying, you agree we may share it on icapos.com. If you would prefer to stay anonymous, say so in your reply.$old$,
    $new$It takes about two minutes. You choose whether your name and score are shown, and nothing is published until you agree on the form.

Write your recommendation: {{testimonial_url}}

Prefer email? Just reply with your recommendation and tell us if you would like to stay anonymous.$new$
  ),
  updated_at = now()
where name = 'Founder testimonial request (CRR)'
  and html_body not like '%{{testimonial_url}}%';
