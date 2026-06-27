-- Migration: 20260627007_company_contact_phone.sql
-- Founder onboarding now collects a contact phone number. Stored on the company
-- record (authenticated/private — never exposed on public surfaces).

alter table public.companies
  add column if not exists contact_phone text;
