-- Privacy: founders should not see WHICH investors are targeted. The recipient
-- rows carry investor profile UUIDs + scores, so drop the founder read policy on
-- recipients. Founders keep campaign-level visibility (status/counts) via
-- founder_read_own_outreach_campaign. An anonymized founder-facing log can be
-- added later through a view that omits investor_ref.

drop policy if exists "founder_read_own_outreach_recipients" on public.investor_outreach_recipients;
