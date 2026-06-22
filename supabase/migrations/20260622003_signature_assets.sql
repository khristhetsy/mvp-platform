-- Public bucket for email-signature images (logos). Public so embedded <img>
-- src URLs keep working in recipients' inboxes (private signed URLs would expire).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-signature-assets',
  'email-signature-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
