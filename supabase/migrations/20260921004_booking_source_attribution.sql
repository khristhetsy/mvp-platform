-- Attribute a meeting to the campaign that produced it.
--
-- The problem this fixes. A booking was only ever attributable if the person
-- walked the /fit funnel first, in the same browser, before booking: the book
-- route reads an `fs_session` cookie and, only if it finds one, calls
-- handoffFitSession — the single piece of code anywhere that writes a campaign
-- tag onto a contact. Every other route to the scheduler recorded nothing, and
-- `scheduling_bookings` had no source column to fall back on, so the Social Hub
-- reported "Meetings 0" while meetings were plainly happening.
--
-- The fix is to make the BOOKING the attributed record rather than inferring
-- attribution through a contact that, for a cold lead, does not exist.
--
-- The /fit path is deliberately unchanged. It is the highest-confidence signal
-- available and it already works; everything here is additive capture for the
-- paths that currently record nothing.

alter table public.scheduling_bookings
  add column if not exists source_tag        text,
  add column if not exists source_confidence text,
  add column if not exists source_set_by     uuid references public.profiles(id) on delete set null,
  add column if not exists source_set_at     timestamptz;

comment on column public.scheduling_bookings.source_tag is
  'Campaign source_tag this meeting is attributed to. Null means unattributed — which is shown as such, never folded into a zero.';
comment on column public.scheduling_bookings.source_confidence is
  'HOW the tag was obtained, because the answers are not equally trustworthy. fit = walked the funnel; link = clicked a tagged scheduler link; cookie = arrived from a tagged link earlier in the window; self_reported = told us in the booking form; manual = a staff member set it after the meeting.';
comment on column public.scheduling_bookings.source_set_by is
  'Only set for manual. A human overriding a machine is recorded as such.';

-- The ladder, in the order the resolver applies it. Storing the confidence
-- rather than just the tag is what lets the funnel show "7 tagged, 2
-- self-reported" instead of pretending the two are the same evidence.
alter table public.scheduling_bookings
  drop constraint if exists scheduling_bookings_source_confidence_check;
alter table public.scheduling_bookings
  add constraint scheduling_bookings_source_confidence_check check (
    source_confidence is null or source_confidence in
      ('fit', 'link', 'cookie', 'self_reported', 'manual')
  );

-- A tag without a confidence (or the reverse) would make the funnel's
-- breakdown lie, so the database refuses the half-set state outright.
alter table public.scheduling_bookings
  drop constraint if exists scheduling_bookings_source_pair_check;
alter table public.scheduling_bookings
  add constraint scheduling_bookings_source_pair_check check (
    (source_tag is null and source_confidence is null)
    or (source_tag is not null and source_confidence is not null)
  );

-- The funnel rolls meetings up by tag inside a date window, which is now one
-- indexed read instead of the contacts-then-emails-then-bookings walk it did
-- before.
create index if not exists scheduling_bookings_source_created_idx
  on public.scheduling_bookings (source_tag, created_at desc)
  where source_tag is not null;

-- Finding the unattributed ones is a routine staff task (that is the queue for
-- setting a source by hand), so keep it cheap too.
create index if not exists scheduling_bookings_unattributed_idx
  on public.scheduling_bookings (created_at desc)
  where source_tag is null;

-- ---------------------------------------------------------------------------
-- Backfill: the meetings that /fit DID attribute
-- ---------------------------------------------------------------------------
--
-- Past bookings whose linked contact carries a lead_source matching a live
-- campaign tag were already being counted through the old contact join. Copying
-- that onto the booking keeps history intact when the funnel switches over to
-- reading the column — without it, every historical meeting would drop to zero
-- the moment this ships.
--
-- Confidence 'fit' because handoffFitSession was the only writer of a
-- tag-shaped lead_source.

update public.scheduling_bookings b
   set source_tag = c.overrides->>'lead_source',
       source_confidence = 'fit'
  from public.crm_contacts c
 where b.contact_crm_id = c.id
   and b.source_tag is null
   and c.overrides->>'lead_source' is not null
   and exists (
     select 1 from public.social_campaigns sc
      where sc.source_tag = c.overrides->>'lead_source'
   );
