-- Say why the two were matched.
--
-- The board has always shown a "why matched" column; the email said nothing,
-- so an investor received an introduction with no idea what it rested on.
-- `{{match_reason}}` is one short line — the shared sectors when there are
-- any, otherwise what the other person is at this event. It never invents a
-- reason: a pair matched on roles alone says exactly that.

update public.event_intro_templates
set body =
      E'Hi {{first_name}},\n\n'
      '{{founder_line}}.\n'
      '{{founder_pitch}}\n'
      '{{founder_stage_line}}\n'
      '{{match_reason}}\n\n'
      'You are both at {{event_title}}{{shared_line}}.\n\n'
      'Accept and {{founder_name}} will send you a time and a meeting link. Nothing is shared until you both agree, and no contact details change hands before that.',
    updated_at = now()
where kind = 'invitation';

update public.event_intro_templates
set body =
      E'Hi {{first_name}},\n\n'
      '{{founder_line}} is also at {{event_title}}.\n'
      '{{match_reason}}\n\n'
      'If a conversation would be useful, accept below and they will send you a time. Nothing is shared until you both agree.',
    updated_at = now()
where kind = 'peer_invitation';

-- ── Verify ──────────────────────────────────────────────────────────────────
-- select kind, body like '%match_reason%' as has_reason
-- from public.event_intro_templates order by kind;
