-- Seed the three named Event Template library rows (build spec §6). REVIEW/RUN
-- AFTER 20260725001_event_email.sql (needs the marketing_templates.category column).
-- These are library reference rows for the Event Hub → Event Template wizard; the
-- wizard renders the live HTML per-event (stored as the campaign's body_override),
-- so these bodies use merge tokens and carry the locked compliance footer.

insert into public.marketing_templates (name, subject, html_body, category, status)
select v.name, v.subject, v.html_body, 'event', 'active'
from (values
  (
    'event-invite-v1',
    'You''re invited: {{EVENT_TITLE}}',
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;"><div style="background:#0c2340;color:#fff;padding:28px;"><div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9fd0ff;">{{EVENT_BADGE}}</div><h1 style="font-size:24px;margin:8px 0 4px;">{{EVENT_TITLE}}</h1><p style="color:#cfe0f5;margin:0;">{{EVENT_TAGLINE}}</p><p style="color:#e7eefa;margin:12px 0 0;font-weight:bold;">{{EVENT_DATE}} · {{EVENT_TIME_RANGE}}</p></div><div style="padding:22px;"><a href="{{REGISTER_URL}}" style="display:inline-block;background:#2E78F5;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">Register to attend →</a><div style="margin-top:16px;">{{SESSIONS}}</div></div><div style="padding:16px 22px;border-top:1px solid #e2e8f2;font-size:11px;color:#8a93a6;">{{ORGANIZER_LINE}}<br>iCFO events are for education and community only. Nothing in this email is an offer to sell or a solicitation to buy any security. iCFO Capital Global, Inc. is not a broker-dealer, placement agent, or registered investment adviser, and no funding outcome is promised.<br><a href="{{UNSUBSCRIBE_URL}}" style="color:#8a93a6;">Unsubscribe</a></div></div>'
  ),
  (
    'event-reminder-v1',
    'Three days to go: {{EVENT_TITLE}}',
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;"><div style="background:#0c2340;color:#fff;padding:28px;"><h1 style="font-size:22px;margin:0 0 6px;">Three days to go — {{EVENT_TITLE}}</h1><p style="color:#e7eefa;margin:0;font-weight:bold;">{{EVENT_DATE}} · {{EVENT_TIME_RANGE}}</p></div><div style="padding:22px;"><a href="{{REGISTER_URL}}" style="display:inline-block;background:#2E78F5;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">Register now →</a><div style="margin-top:16px;">{{SESSIONS}}</div></div><div style="padding:16px 22px;border-top:1px solid #e2e8f2;font-size:11px;color:#8a93a6;">{{ORGANIZER_LINE}}<br>iCFO events are for education and community only. Nothing in this email is an offer to sell or a solicitation to buy any security. iCFO Capital Global, Inc. is not a broker-dealer, placement agent, or registered investment adviser, and no funding outcome is promised.<br><a href="{{UNSUBSCRIBE_URL}}" style="color:#8a93a6;">Unsubscribe</a></div></div>'
  ),
  (
    'event-dayof-v1',
    'We''re live today: {{EVENT_TITLE}}',
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;"><div style="background:#0c2340;color:#fff;padding:28px;"><h1 style="font-size:22px;margin:0 0 6px;">We''re live today — {{EVENT_TITLE}}</h1><p style="color:#e7eefa;margin:0;font-weight:bold;">{{EVENT_TIME_RANGE}}</p></div><div style="padding:22px;"><a href="{{LOBBY_URL}}" style="display:inline-block;background:#2E78F5;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">Enter lobby ↗</a><div style="margin-top:16px;">{{SESSIONS}}</div></div><div style="padding:16px 22px;border-top:1px solid #e2e8f2;font-size:11px;color:#8a93a6;">{{ORGANIZER_LINE}}<br>iCFO events are for education and community only. Nothing in this email is an offer to sell or a solicitation to buy any security. iCFO Capital Global, Inc. is not a broker-dealer, placement agent, or registered investment adviser, and no funding outcome is promised.<br><a href="{{UNSUBSCRIBE_URL}}" style="color:#8a93a6;">Unsubscribe</a></div></div>'
  )
) as v(name, subject, html_body)
where not exists (
  select 1 from public.marketing_templates t where t.name = v.name
);
