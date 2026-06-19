-- Raise toolkit sessions: persists each founder's in-progress work for
-- each raise toolkit tool (term-sheet, pitch-practice, email-sequence,
-- due-diligence, investor-update, funding-timeline, board-prep, kpi-glossary).
--
-- One row per (company, tool_key). UPSERT on conflict updates data + updated_at.

CREATE TABLE IF NOT EXISTS raise_toolkit_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  founder_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_key    text        NOT NULL CHECK (tool_key IN (
                'term-sheet',
                'pitch-practice',
                'email-sequence',
                'due-diligence',
                'investor-update',
                'funding-timeline',
                'board-prep',
                'kpi-glossary'
              )),
  data        jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, tool_key)
);

CREATE INDEX IF NOT EXISTS idx_raise_toolkit_sessions_company
  ON raise_toolkit_sessions(company_id);

CREATE INDEX IF NOT EXISTS idx_raise_toolkit_sessions_founder_tool
  ON raise_toolkit_sessions(founder_id, tool_key);

ALTER TABLE raise_toolkit_sessions ENABLE ROW LEVEL SECURITY;

-- Founders can read and write only their own sessions
CREATE POLICY "Founders manage their own toolkit sessions"
  ON raise_toolkit_sessions
  FOR ALL
  USING  (founder_id = auth.uid())
  WITH CHECK (founder_id = auth.uid());

-- Staff can read all sessions for support / analytics
CREATE POLICY "Staff can view all toolkit sessions"
  ON raise_toolkit_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'analyst')
    )
  );
