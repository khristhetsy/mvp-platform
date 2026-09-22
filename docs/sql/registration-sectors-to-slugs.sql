-- One spelling for a sector, in the rows that already exist.
--
-- Two registration paths disagreed. The public form's interest chips wrote
-- slugs ("fintech") into networking_optins, while the field-set questions on
-- the same page wrote the label the registrant read ("FinTech") into
-- registrations.answers. Matching compares those strings directly, so an
-- attendee registered by staff shared no sector with one who registered
-- himself, and a later rename would have orphaned every stored answer.
--
-- The code now stores slugs. This rewrites what is already stored to match.
-- Values that are neither a slug nor a label (a legacy "Agtech") are kept,
-- lower-cased, exactly as the application keeps them: two people who both
-- typed the same thing still have something in common.

-- ── The vocabulary ──────────────────────────────────────────────────────────
-- Comparison ignores case, spaces and separators, so "AI / ML", "ai-ml" and
-- "AI/ML" are one sector. Mirrors toSectorSlug in src/lib/icfo-events/sectors.ts.
-- Dropped again at the end: this is a backfill, not a new piece of schema.

create or replace function public.icfo_sector_slug(value text)
returns text
language sql
immutable
as $$
  select coalesce(
    (
      select m.slug
      from (values
        ('fintech', 'fintech'),
        ('healthtech', 'healthtech'),
        ('saas', 'saas'),
        ('saasb2bsoftware', 'saas'),
        ('edtech', 'edtech'),
        ('cleantech', 'cleantech'),
        ('ecommerce', 'ecommerce'),
        ('aiml', 'ai-ml'),
        ('realestate', 'real-estate'),
        ('consumer', 'consumer'),
        ('deeptech', 'deep-tech'),
        ('marketplace', 'marketplace'),
        ('logistics', 'logistics'),
        ('hardware', 'hardware'),
        ('other', 'other')
      ) as m(compare_key, slug)
      where m.compare_key = lower(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]+', '', 'g'))
    ),
    lower(btrim(coalesce(value, '')))
  );
$$;

-- ── registrations.answers -> 'sectors' (a list) ─────────────────────────────

update public.registrations r
set answers = jsonb_set(
      r.answers,
      '{sectors}',
      (
        select coalesce(jsonb_agg(distinct public.icfo_sector_slug(e.value)), '[]'::jsonb)
        from jsonb_array_elements_text(r.answers -> 'sectors') as e(value)
        where btrim(e.value) <> ''
      )
    )
where jsonb_typeof(r.answers -> 'sectors') = 'array'
  and exists (
    select 1
    from jsonb_array_elements_text(r.answers -> 'sectors') as e(value)
    where btrim(e.value) <> '' and e.value is distinct from public.icfo_sector_slug(e.value)
  );

-- ── registrations.answers -> 'sector' (one value) ───────────────────────────

update public.registrations r
set answers = jsonb_set(r.answers, '{sector}', to_jsonb(public.icfo_sector_slug(r.answers ->> 'sector')))
where jsonb_typeof(r.answers -> 'sector') = 'string'
  and btrim(r.answers ->> 'sector') <> ''
  and (r.answers ->> 'sector') is distinct from public.icfo_sector_slug(r.answers ->> 'sector');

-- A 'sectors' that was stored as a single string rather than a list.
update public.registrations r
set answers = jsonb_set(r.answers, '{sectors}', to_jsonb(public.icfo_sector_slug(r.answers ->> 'sectors')))
where jsonb_typeof(r.answers -> 'sectors') = 'string'
  and btrim(r.answers ->> 'sectors') <> ''
  and (r.answers ->> 'sectors') is distinct from public.icfo_sector_slug(r.answers ->> 'sectors');

-- ── networking_optins.interests ─────────────────────────────────────────────
-- Already slugs from the public form, but staff-entered rows came through the
-- answers, so normalise these too rather than assuming.

update public.networking_optins n
set interests = (
      select coalesce(jsonb_agg(distinct public.icfo_sector_slug(e.value)), '[]'::jsonb)
      from jsonb_array_elements_text(n.interests) as e(value)
      where btrim(e.value) <> ''
    )
where jsonb_typeof(n.interests) = 'array'
  and exists (
    select 1
    from jsonb_array_elements_text(n.interests) as e(value)
    where btrim(e.value) <> '' and e.value is distinct from public.icfo_sector_slug(e.value)
  );

drop function if exists public.icfo_sector_slug(text);

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Every stored sector should now be a slug. Anything this lists is a legacy
-- value nobody has re-picked — visible on the registration, matchable against
-- itself, and not a failure of the backfill.
--
-- select distinct e.value
-- from public.registrations r
-- cross join lateral jsonb_array_elements_text(
--   case when jsonb_typeof(r.answers -> 'sectors') = 'array' then r.answers -> 'sectors' else '[]'::jsonb end
-- ) as e(value)
-- where e.value not in ('fintech','healthtech','saas','edtech','cleantech','ecommerce','ai-ml',
--                       'real-estate','consumer','deep-tech','marketplace','logistics','hardware','other');
