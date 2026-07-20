-- Visual (block) editor for marketing templates.
--
-- `blocks` stores the structured representation the visual editor edits. The
-- email-safe html_body is REGENERATED from these blocks on save, so html_body
-- remains the single thing that gets sent — nothing about sending changes.
-- Templates without blocks keep working (HTML tab only) until converted.

alter table public.marketing_templates
  add column if not exists blocks jsonb;

comment on column public.marketing_templates.blocks is
  'Structured blocks for the visual editor. html_body is regenerated from this on save; null means the template is HTML-only (not yet converted).';
