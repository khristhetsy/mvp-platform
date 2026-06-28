-- Migration: 20260628001_company_jurisdiction.sql
-- Country/jurisdiction of LEGAL INCORPORATION — distinct from the operating
-- country/state already on companies. Investors filter and assess fit on the
-- legal entity they'd actually invest into (e.g. "Delaware C-Corp", "UK Ltd",
-- "Singapore Pte Ltd"), which is often different from where the company operates.
-- Additive, nullable — no backfill or RLS change required.

alter table public.companies add column if not exists incorporation_jurisdiction text;
