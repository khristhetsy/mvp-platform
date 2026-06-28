-- ============================================================
-- Light investor verification (Stage 2)
-- Identity verification stays the access gate (kyc_status). Accreditation
-- becomes an OPTIONAL, separately-verified signal that boosts the Partner
-- Score's credibility pillar. Legal name + consent support the ID review.
-- ============================================================

alter table public.investor_profiles
  add column if not exists legal_name              text,
  add column if not exists kyc_consent             boolean not null default false,
  add column if not exists accreditation_verified  boolean not null default false,
  add column if not exists accreditation_reviewed_at timestamptz,
  add column if not exists accreditation_reviewed_by uuid references auth.users(id);

-- Grandfather: investors already verified under the old flow had accreditation
-- evidence in their checklist, so treat them as accreditation-verified too.
update public.investor_profiles
   set accreditation_verified = true,
       accreditation_reviewed_at = coalesce(accreditation_reviewed_at, kyc_reviewed_at, now())
 where kyc_status = 'verified'
   and accreditation_verified = false;
