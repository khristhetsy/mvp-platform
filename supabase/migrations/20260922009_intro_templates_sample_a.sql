-- The invitation, rewritten around what the founder actually told us.
--
-- The first version said only that two people were registered for the same
-- event and shared some sectors. Founders answer a required one-line pitch at
-- registration, plus stage, whether they are raising and the round size — none
-- of which reached the investor, who was being asked to accept a meeting on
-- the strength of a name.
--
-- A token nobody answered removes its own line rather than leaving a gap (see
-- renderBody), so a founder who registered before those fields existed still
-- gets a sentence that reads.
--
-- Also corrects a promise: accepting no longer opens a room. The founder picks
-- a slot inside the event and brings the link.

update public.event_intro_templates
set subject = 'Meet {{founder_name}} at {{event_title}}',
    body =
      E'Hi {{first_name}},\n\n'
      '{{founder_line}}.\n'
      '{{founder_pitch}}\n'
      '{{founder_stage_line}}\n\n'
      'You are both at {{event_title}}{{shared_line}}.\n\n'
      'Accept and {{founder_name}} will send you a time and a meeting link. Nothing is shared until you both agree, and no contact details change hands before that.',
    updated_at = now()
where kind = 'invitation';

update public.event_intro_templates
set subject = 'Still interested in meeting {{founder_name}}?',
    body =
      E'Hi {{first_name}},\n\n'
      '{{founder_line}} is hoping to meet you at {{event_title}}{{shared_line}}.\n'
      '{{founder_pitch}}\n\n'
      'One click either way and we will stop asking.',
    updated_at = now()
where kind = 'follow_up';

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expect two rows, both quoting the founder's own answers.
-- select kind, subject from public.event_intro_templates order by kind;
