-- Seed the ten iCFO fit-funnel email templates into the Marketing Hub Templates
-- library (marketing_templates). These are the ten funnel arguments rewritten as
-- email: ~90 words, opens on the recipient, one accent button pointing at
-- icapos.com/fit with its own em-fit-NN tag, written preview text. Filed under the
-- Marketing department, seeded as 'draft' so they're reviewed before going active.
-- Idempotent: each row inserts only if a template of that name doesn't already
-- exist. Merge fields use {{...}}.

-- Shared plain, personal styling (one accent colour, one button) per the spec —
-- a designed template reads as marketing; a plain one reads as a person.

-- ---------- E1 · Thesis mismatch ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category, department)
select
  $n$iCFO Fit E1 — Thesis mismatch$n$,
  $s$Most of your no's were decided before the meeting$s$,
  $p$Wrong stage, wrong cheque size, wrong industry.$p$,
  $b$<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.6;font-size:15px;">
  <p style="margin:0 0 14px;">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;">If you've been raising a while, you've had meetings that felt fine and went nowhere.</p>
  <p style="margin:0 0 14px;">Around 70% of the time that isn't a judgement on the company. The investor's criteria ruled you out before the call — wrong stage, wrong cheque size, wrong industry.</p>
  <p style="margin:0 0 14px;">That information mostly exists. It's just scattered across filings and portfolio pages, so founders pitch everyone and hope.</p>
  <p style="margin:0 0 18px;">We keep it structured for the investors in our network.</p>
  <a href="https://icapos.com/fit?s=em-fit-01" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:12px 22px;border-radius:6px;margin:0 0 20px;">See which investors your raise clears</a>
  <p style="margin:0;">Khris</p>
  <p style="margin:2px 0 0;color:#5A6472;font-size:13px;">iCFO Capital Global</p>
  <div style="border-top:1px solid #E2E6ED;margin-top:22px;padding-top:12px;font-size:11.5px;color:#8792A2;">iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a></div>
</div>$b$,
  $t$Hi {{first_name}},

If you've been raising a while, you've had meetings that felt fine and went nowhere.

Around 70% of the time that isn't a judgement on the company. The investor's criteria ruled you out before the call — wrong stage, wrong cheque size, wrong industry.

That information mostly exists. It's just scattered across filings and portfolio pages, so founders pitch everyone and hope.

We keep it structured for the investors in our network.

See which investors your raise clears: https://icapos.com/fit?s=em-fit-01

Khris
iCFO Capital Global$t$,
  'draft', 'general', 'Marketing'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Fit E1 — Thesis mismatch$n$);

-- ---------- E2 · Rating before list ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category, department)
select
  $n$iCFO Fit E2 — Rating before list$n$,
  $s$We rate you before we build your list$s$,
  $p$Founders hate the order. Here's why we keep it.$p$,
  $b$<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.6;font-size:15px;">
  <p style="margin:0 0 14px;">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;">Every founder wants the names first. We run the rating first anyway.</p>
  <p style="margin:0 0 14px;">A list is only worth having if you survive contact with it. Send materials to forty well-matched investors with an unexplained cap table and you've burned forty relationships you can't easily go back to.</p>
  <p style="margin:0 0 18px;">Rating first costs about two weeks. It's the difference between a list that works and a list you spend once.</p>
  <a href="https://icapos.com/fit?s=em-fit-02" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:12px 22px;border-radius:6px;margin:0 0 20px;">Start with four questions</a>
  <p style="margin:0;">Khris</p>
  <p style="margin:2px 0 0;color:#5A6472;font-size:13px;">iCFO Capital Global</p>
  <div style="border-top:1px solid #E2E6ED;margin-top:22px;padding-top:12px;font-size:11.5px;color:#8792A2;">iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a></div>
</div>$b$,
  $t$Hi {{first_name}},

Every founder wants the names first. We run the rating first anyway.

A list is only worth having if you survive contact with it. Send materials to forty well-matched investors with an unexplained cap table and you've burned forty relationships you can't easily go back to.

Rating first costs about two weeks. It's the difference between a list that works and a list you spend once.

Start with four questions: https://icapos.com/fit?s=em-fit-02

Khris
iCFO Capital Global$t$,
  'draft', 'general', 'Marketing'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Fit E2 — Rating before list$n$);

-- ---------- E3 · Start where you are ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category, department)
select
  $n$iCFO Fit E3 — Start where you are$n$,
  $s$You don't need a finished deck to start$s$,
  $p$Readiness is what we produce, not what we require.$p$,
  $b$<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.6;font-size:15px;">
  <p style="margin:0 0 14px;">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;">Most platforms want you arriving with a finished deck, a clean cap table and a three-statement model.</p>
  <p style="margin:0 0 14px;">If you had those, you wouldn't need much help.</p>
  <p style="margin:0 0 18px;">Bring a rough deck and a spreadsheet. What comes back is an ordered list of what to fix, worst first — before an investor finds it instead.</p>
  <a href="https://icapos.com/fit?s=em-fit-03" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:12px 22px;border-radius:6px;margin:0 0 20px;">See where you stand</a>
  <p style="margin:0;">Khris</p>
  <p style="margin:2px 0 0;color:#5A6472;font-size:13px;">iCFO Capital Global</p>
  <div style="border-top:1px solid #E2E6ED;margin-top:22px;padding-top:12px;font-size:11.5px;color:#8792A2;">iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a></div>
</div>$b$,
  $t$Hi {{first_name}},

Most platforms want you arriving with a finished deck, a clean cap table and a three-statement model.

If you had those, you wouldn't need much help.

Bring a rough deck and a spreadsheet. What comes back is an ordered list of what to fix, worst first — before an investor finds it instead.

See where you stand: https://icapos.com/fit?s=em-fit-03

Khris
iCFO Capital Global$t$,
  'draft', 'general', 'Marketing'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Fit E3 — Start where you are$n$);

-- ---------- E4 · The math ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category, department)
select
  $n$iCFO Fit E4 — The math$n$,
  $s$Cold raise close rate: about 0.03%$s$,
  $p$Two of the four stages are worth attacking.$p$,
  $b$<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.6;font-size:15px;">
  <p style="margin:0 0 14px;">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;">Response, meeting, diligence, term sheet. Multiply the published benchmarks through and you land near 0.03%.</p>
  <p style="margin:0 0 14px;">Everyone quotes that to sound sobering. It's more useful as a map.</p>
  <p style="margin:0 0 14px;">Two of those stages move when you change what you bring. Two don't — a fund writing eight cheques a year against three thousand companies is arithmetic.</p>
  <p style="margin:0 0 18px;">Anyone promising to change the base rate is selling you something else.</p>
  <a href="https://icapos.com/fit?s=em-fit-04" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:12px 22px;border-radius:6px;margin:0 0 20px;">Start with the two that move</a>
  <p style="margin:0;">Khris</p>
  <p style="margin:2px 0 0;color:#5A6472;font-size:13px;">iCFO Capital Global</p>
  <div style="border-top:1px solid #E2E6ED;margin-top:22px;padding-top:12px;font-size:11.5px;color:#8792A2;">iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a></div>
</div>$b$,
  $t$Hi {{first_name}},

Response, meeting, diligence, term sheet. Multiply the published benchmarks through and you land near 0.03%.

Everyone quotes that to sound sobering. It's more useful as a map.

Two of those stages move when you change what you bring. Two don't — a fund writing eight cheques a year against three thousand companies is arithmetic.

Anyone promising to change the base rate is selling you something else.

Start with the two that move: https://icapos.com/fit?s=em-fit-04

Khris
iCFO Capital Global$t$,
  'draft', 'general', 'Marketing'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Fit E4 — The math$n$);

-- ---------- E5 · Diligence deaths ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category, department)
select
  $n$iCFO Fit E5 — Diligence deaths$n$,
  $s$The deals that hurt die in diligence$s$,
  $p$Cap table. Financial hygiene. Governance.$p$,
  $b$<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.6;font-size:15px;">
  <p style="margin:0 0 14px;">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;">Cold no's are cheap. The expensive ones die six weeks in, with a fund that was genuinely interested, after you've stopped talking to everyone else.</p>
  <p style="margin:0 0 14px;">Cap table. Financial hygiene. Governance. Not the market, not the team — the discoverable stuff.</p>
  <p style="margin:0 0 18px;">All of it is findable in an afternoon before you go out. Almost nobody looks, because hunting for reasons your deal might die feels like the opposite of raising.</p>
  <a href="https://icapos.com/fit?s=em-fit-05" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:12px 22px;border-radius:6px;margin:0 0 20px;">Find them before an investor does</a>
  <p style="margin:0;">Khris</p>
  <p style="margin:2px 0 0;color:#5A6472;font-size:13px;">iCFO Capital Global</p>
  <div style="border-top:1px solid #E2E6ED;margin-top:22px;padding-top:12px;font-size:11.5px;color:#8792A2;">iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a></div>
</div>$b$,
  $t$Hi {{first_name}},

Cold no's are cheap. The expensive ones die six weeks in, with a fund that was genuinely interested, after you've stopped talking to everyone else.

Cap table. Financial hygiene. Governance. Not the market, not the team — the discoverable stuff.

All of it is findable in an afternoon before you go out. Almost nobody looks, because hunting for reasons your deal might die feels like the opposite of raising.

Find them before an investor does: https://icapos.com/fit?s=em-fit-05

Khris
iCFO Capital Global$t$,
  'draft', 'general', 'Marketing'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Fit E5 — Diligence deaths$n$);

-- ---------- E6 · Saying no ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category, department)
select
  $n$iCFO Fit E6 — Saying no$n$,
  $s$We may tell you no$s$,
  $p$Short lists are the honest outcome of real criteria.$p$,
  $b$<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.6;font-size:15px;">
  <p style="margin:0 0 14px;">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;">Worth being upfront: we turn away more companies than we take.</p>
  <p style="margin:0 0 14px;">If your stage or sector doesn't match what our network actually backs, we'll tell you that rather than queue you into a list padded out to look generous.</p>
  <p style="margin:0 0 14px;">Nine matched investors beats forty names where thirty-one were never going to read it.</p>
  <p style="margin:0 0 18px;">Four questions and you'll know which you are.</p>
  <a href="https://icapos.com/fit?s=em-fit-06" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:12px 22px;border-radius:6px;margin:0 0 20px;">Find out in under a minute</a>
  <p style="margin:0;">Khris</p>
  <p style="margin:2px 0 0;color:#5A6472;font-size:13px;">iCFO Capital Global</p>
  <div style="border-top:1px solid #E2E6ED;margin-top:22px;padding-top:12px;font-size:11.5px;color:#8792A2;">iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a></div>
</div>$b$,
  $t$Hi {{first_name}},

Worth being upfront: we turn away more companies than we take.

If your stage or sector doesn't match what our network actually backs, we'll tell you that rather than queue you into a list padded out to look generous.

Nine matched investors beats forty names where thirty-one were never going to read it.

Four questions and you'll know which you are.

Find out in under a minute: https://icapos.com/fit?s=em-fit-06

Khris
iCFO Capital Global$t$,
  'draft', 'general', 'Marketing'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Fit E6 — Saying no$n$);

-- ---------- E7 · Graduation rates ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category, department)
select
  $n$iCFO Fit E7 — Graduation rates$n$,
  $s$Seed-to-A graduation: 30.6% → 15.4%$s$,
  $p$Half the odds, same runway.$p$,
  $b$<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.6;font-size:15px;">
  <p style="margin:0 0 14px;">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;">That's Carta's number, and it changes what a wasted month costs.</p>
  <p style="margin:0 0 14px;">Twenty meetings with wrong-fit investors used to be an expensive mistake. At current graduation rates it's most of your window.</p>
  <p style="margin:0 0 18px;">The fix isn't working harder on the process. It's not entering conversations that were never going to close.</p>
  <a href="https://icapos.com/fit?s=em-fit-07" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:12px 22px;border-radius:6px;margin:0 0 20px;">See who actually fits your raise</a>
  <p style="margin:0;">Khris</p>
  <p style="margin:2px 0 0;color:#5A6472;font-size:13px;">iCFO Capital Global</p>
  <div style="border-top:1px solid #E2E6ED;margin-top:22px;padding-top:12px;font-size:11.5px;color:#8792A2;">iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a></div>
</div>$b$,
  $t$Hi {{first_name}},

That's Carta's number, and it changes what a wasted month costs.

Twenty meetings with wrong-fit investors used to be an expensive mistake. At current graduation rates it's most of your window.

The fix isn't working harder on the process. It's not entering conversations that were never going to close.

See who actually fits your raise: https://icapos.com/fit?s=em-fit-07

Khris
iCFO Capital Global$t$,
  'draft', 'general', 'Marketing'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Fit E7 — Graduation rates$n$);

-- ---------- E8 · Investor ceiling ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category, department)
select
  $n$iCFO Fit E8 — Investor ceiling$n$,
  $s$Why your list might come up short$s$,
  $p$Investors set their own monthly limit. We hold to it.$p$,
  $b$<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.6;font-size:15px;">
  <p style="margin:0 0 14px;">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;">Every investor in our network caps how much they're willing to receive each month, and we don't go past it.</p>
  <p style="margin:0 0 14px;">Which sometimes means telling a paying founder we can't send to more people this month.</p>
  <p style="margin:0 0 14px;">The alternative is a network that stops opening our emails — and then nobody's materials get read, including yours.</p>
  <p style="margin:0 0 18px;">The list is only worth what the people on it are still willing to receive.</p>
  <a href="https://icapos.com/fit?s=em-fit-08" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:12px 22px;border-radius:6px;margin:0 0 20px;">See who's still reading</a>
  <p style="margin:0;">Khris</p>
  <p style="margin:2px 0 0;color:#5A6472;font-size:13px;">iCFO Capital Global</p>
  <div style="border-top:1px solid #E2E6ED;margin-top:22px;padding-top:12px;font-size:11.5px;color:#8792A2;">iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a></div>
</div>$b$,
  $t$Hi {{first_name}},

Every investor in our network caps how much they're willing to receive each month, and we don't go past it.

Which sometimes means telling a paying founder we can't send to more people this month.

The alternative is a network that stops opening our emails — and then nobody's materials get read, including yours.

The list is only worth what the people on it are still willing to receive.

See who's still reading: https://icapos.com/fit?s=em-fit-08

Khris
iCFO Capital Global$t$,
  'draft', 'general', 'Marketing'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Fit E8 — Investor ceiling$n$);

-- ---------- E9 · Sixteen years ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category, department)
select
  $n$iCFO Fit E9 — Sixteen years$n$,
  $s$Sixteen years. The software is the new part.$s$,
  $p$Where the network and the criteria data came from.$p$,
  $b$<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.6;font-size:15px;">
  <p style="margin:0 0 14px;">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;">iCapOS launched this year. The investor relations practice behind it has been running since 2010.</p>
  <p style="margin:0 0 14px;">One founder came to us after trying five other firms to reach investors, and rated us the best of the five. Another ended up in advanced conversations with several partners he'd never previously contacted.</p>
  <p style="margin:0 0 18px;">Those came from the practice. The platform is that process written down.</p>
  <a href="https://icapos.com/fit?s=em-fit-09" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:12px 22px;border-radius:6px;margin:0 0 20px;">Four questions to start</a>
  <p style="margin:0;">Khris</p>
  <p style="margin:2px 0 0;color:#5A6472;font-size:13px;">iCFO Capital Global</p>
  <div style="border-top:1px solid #E2E6ED;margin-top:22px;padding-top:12px;font-size:11.5px;color:#8792A2;">iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a></div>
</div>$b$,
  $t$Hi {{first_name}},

iCapOS launched this year. The investor relations practice behind it has been running since 2010.

One founder came to us after trying five other firms to reach investors, and rated us the best of the five. Another ended up in advanced conversations with several partners he'd never previously contacted.

Those came from the practice. The platform is that process written down.

Four questions to start: https://icapos.com/fit?s=em-fit-09

Khris
iCFO Capital Global$t$,
  'draft', 'general', 'Marketing'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Fit E9 — Sixteen years$n$);

-- ---------- E10 · Two of four ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category, department)
select
  $n$iCFO Fit E10 — Two of four$n$,
  $s$We can only help with two of the four$s$,
  $p$The other two are arithmetic and trust.$p$,
  $b$<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.6;font-size:15px;">
  <p style="margin:0 0 14px;">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;">Four things get founders rejected.</p>
  <p style="margin:0 0 14px;">Supply and demand is arithmetic — we can't touch it. Trust narrows with a rating and structured materials, but cold contact still starts at zero.</p>
  <p style="margin:0 0 14px;">Thesis mismatch and readiness failures are the two that actually move, and between them they account for most of what kills a raise.</p>
  <p style="margin:0 0 18px;">If a platform tells you it fixes all four, ask which one it's lying about.</p>
  <a href="https://icapos.com/fit?s=em-fit-10" style="display:inline-block;background:#2E78F5;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:12px 22px;border-radius:6px;margin:0 0 20px;">Start with the two that move</a>
  <p style="margin:0;">Khris</p>
  <p style="margin:2px 0 0;color:#5A6472;font-size:13px;">iCFO Capital Global</p>
  <div style="border-top:1px solid #E2E6ED;margin-top:22px;padding-top:12px;font-size:11.5px;color:#8792A2;">iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a></div>
</div>$b$,
  $t$Hi {{first_name}},

Four things get founders rejected.

Supply and demand is arithmetic — we can't touch it. Trust narrows with a rating and structured materials, but cold contact still starts at zero.

Thesis mismatch and readiness failures are the two that actually move, and between them they account for most of what kills a raise.

If a platform tells you it fixes all four, ask which one it's lying about.

Start with the two that move: https://icapos.com/fit?s=em-fit-10

Khris
iCFO Capital Global$t$,
  'draft', 'general', 'Marketing'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Fit E10 — Two of four$n$);
