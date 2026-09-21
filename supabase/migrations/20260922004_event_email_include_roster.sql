-- Event Email — remember whether the who's-presenting sections are included.
--
-- The roster (presenting companies, Founder Showcase, exhibitors) has always
-- reached the email as merge data and was never rendered. Now that it is, the
-- choice to include it belongs beside the existing banner and lobby toggles,
-- so it survives reopening the wizard.
--
-- Defaults true: the sections are the point of the change, and an event with
-- an empty roster renders nothing at all rather than an empty heading.

alter table public.event_email_drafts
  add column if not exists include_roster boolean not null default true;
