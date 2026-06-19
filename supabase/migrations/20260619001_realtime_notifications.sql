-- Enable Supabase Realtime for the notifications table so the
-- NotificationBellDropdown can receive live inserts via a channel
-- subscription instead of 60-second polling.
--
-- We only need INSERT events, so REPLICA IDENTITY DEFAULT (primary key)
-- is sufficient — full row data is present in payload.new.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
