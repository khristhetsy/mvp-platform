-- Seed the iCFO Warm + Cold outbound campaign templates into the Marketing Hub
-- Email Templates library (marketing_templates). Warm = branded HTML, marked
-- active; Cold = plain text, marked draft (the cold sending domain still needs
-- SPF/DKIM/DMARC before it should go active). Idempotent: each row inserts only
-- if a template of that name doesn't already exist. Merge fields use {{...}}.

-- ---------- WARM 1 · The match ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category)
select
  $n$iCFO Warm 1 — The match$n$,
  $s${{match_count}} investors fit {{company}}$s$,
  $p$I ran the match on what you sent me.$p$,
  $b$<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.55;">
  <div style="background:#0A1A40;padding:18px 24px;border-radius:4px 4px 0 0;">
    <span style="font-family:Archivo,Arial,sans-serif;font-weight:700;font-size:19px;color:#ffffff;">iCap<span style="color:#2E78F5;">OS</span></span>
  </div>
  <div style="padding:28px 30px;background:#ffffff;border:1px solid #D8DEE8;border-top:none;">
    <p style="font-size:16px;margin:0 0 15px;">Hi {{first_name}},</p>
    <p style="margin:0 0 15px;">Thanks for the detail on {{company}} — that was enough to run you properly.</p>
    <p style="margin:0 0 15px;">{{match_count}} investors in our network fit you on stage, sector and cheque size. Not everyone we know: investors who have actually written into {{sector}} at {{stage}}.</p>
    <p style="margin:0 0 15px;">I won&#39;t put names in an email, but the breakdown is in your profile now — how many, what type of investor, and what they typically write.</p>
    <p style="margin:0 0 15px;">Sixteen years of building those relationships is why they open our email. Each of them caps how much we can send them in a month, which is why fit matters more to us than volume.</p>
    <a href="{{cta_url}}" style="display:inline-block;background:#1A6CE4;color:#ffffff;text-decoration:none;font-weight:600;font-size:14.5px;padding:12px 22px;border-radius:3px;margin:8px 0 20px;">See your match breakdown</a>
    <div style="border-top:1px solid #D8DEE8;margin-top:22px;padding-top:16px;font-size:13.5px;">
      <strong style="display:block;">Khris Thetsy</strong>
      <span style="color:#5A6472;">Founder &amp; CEO, iCFO Capital Global, Inc.</span>
    </div>
  </div>
  <div style="padding:16px 30px;font-size:11.5px;color:#5A6472;background:#ffffff;border:1px solid #D8DEE8;border-top:none;border-radius:0 0 4px 4px;">
    iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a>
  </div>
</div>$b$,
  $t$Hi {{first_name}},

Thanks for the detail on {{company}} — that was enough to run you properly.

{{match_count}} investors in our network fit you on stage, sector and cheque size — investors who have actually written into {{sector}} at {{stage}}.

The breakdown is in your profile now: how many, what type, and what they typically write.

See your match breakdown: {{cta_url}}

Khris Thetsy
Founder & CEO, iCFO Capital Global, Inc.$t$,
  'active', 'general'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Warm 1 — The match$n$);

-- ---------- WARM 2 · The structure ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category)
select
  $n$iCFO Warm 2 — The structure$n$,
  $s$How is the round put together?$s$,
  $p$Worth answering before anything goes out.$p$,
  $b$<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.55;">
  <div style="background:#0A1A40;padding:18px 24px;border-radius:4px 4px 0 0;">
    <span style="font-family:Archivo,Arial,sans-serif;font-weight:700;font-size:19px;color:#ffffff;">iCap<span style="color:#2E78F5;">OS</span></span>
  </div>
  <div style="padding:28px 30px;background:#ffffff;border:1px solid #D8DEE8;border-top:none;">
    <p style="font-size:16px;margin:0 0 15px;">Hi {{first_name}},</p>
    <p style="margin:0 0 15px;">One thing worth settling before we send anything out on your behalf.</p>
    <p style="margin:0 0 15px;">Most rounds that stall aren&#39;t stalling on the company. They stall because joining is work — no lead, no clean vehicle, terms to be negotiated from scratch. Investors who like the business end up waiting to see who moves first, and nobody does.</p>
    <p style="margin:0 0 15px;">So: how is {{company}}&#39;s round structured right now, and has anyone committed yet?</p>
    <p style="margin:0 0 15px;">If it&#39;s clean, we distribute and you&#39;ll start hearing back. If it isn&#39;t, we should fix the vehicle first — you only get one first read with an investor, and I&#39;d rather not spend {{match_count}} of them on a round that isn&#39;t ready to be joined.</p>
    <div style="border-top:1px solid #D8DEE8;margin-top:22px;padding-top:16px;font-size:13.5px;">
      <strong style="display:block;">Khris Thetsy</strong>
      <span style="color:#5A6472;">Founder &amp; CEO, iCFO Capital Global, Inc.</span>
    </div>
  </div>
  <div style="padding:16px 30px;font-size:11.5px;color:#5A6472;background:#ffffff;border:1px solid #D8DEE8;border-top:none;border-radius:0 0 4px 4px;">
    iCFO Capital Global, Inc., La Jolla, CA &middot; Not a lender. Nothing here is an offer of securities. &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a>
  </div>
</div>$b$,
  $t$Hi {{first_name}},

One thing worth settling before we send anything out on your behalf.

Most rounds that stall aren't stalling on the company — they stall because joining is work: no lead, no clean vehicle, terms to negotiate from scratch.

So: how is {{company}}'s round structured right now, and has anyone committed yet?

If it's clean, we distribute. If it isn't, we should fix the vehicle first.

Khris Thetsy
Founder & CEO, iCFO Capital Global, Inc.$t$,
  'active', 'general'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Warm 2 — The structure$n$);

-- ---------- WARM 3 · Two ways to run it ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category)
select
  $n$iCFO Warm 3 — Two ways to run it$n$,
  $s$Two ways to run this$s$,
  $p$Same network. Different amount of your time.$p$,
  $b$<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.55;">
  <div style="background:#0A1A40;padding:18px 24px;border-radius:4px 4px 0 0;">
    <span style="font-family:Archivo,Arial,sans-serif;font-weight:700;font-size:19px;color:#ffffff;">iCap<span style="color:#2E78F5;">OS</span></span>
  </div>
  <div style="padding:28px 30px;background:#ffffff;border:1px solid #D8DEE8;border-top:none;">
    <p style="font-size:16px;margin:0 0 15px;">Hi {{first_name}},</p>
    <p style="margin:0 0 15px;">There are two ways to get {{company}} in front of our investors.</p>
    <p style="margin:0 0 15px;"><strong>You run it.</strong> We match and you approve the list, your one-pager goes to up to 25 investors, and the replies come to you.</p>
    <p style="margin:0 0 15px;"><strong>We run it.</strong> Up to 100 matched investors, introductions brokered on your behalf, and we chase every follow-up so nothing goes quiet while you&#39;re busy. You take the meetings.</p>
    <p style="margin:0 0 15px;">Same network either way, same sixteen years behind it. The only real difference is whose week it costs.</p>
    <p style="margin:0 0 15px;">Which one fits how {{company}} is set up right now?</p>
    <a href="{{cta_url}}" style="display:inline-block;background:#1A6CE4;color:#ffffff;text-decoration:none;font-weight:600;font-size:14.5px;padding:12px 22px;border-radius:3px;margin:8px 0 20px;">Compare the two</a>
    <div style="border-top:1px solid #D8DEE8;margin-top:22px;padding-top:16px;font-size:13.5px;">
      <strong style="display:block;">Khris Thetsy</strong>
      <span style="color:#5A6472;">Founder &amp; CEO, iCFO Capital Global, Inc.</span>
    </div>
  </div>
  <div style="padding:16px 30px;font-size:11.5px;color:#5A6472;background:#ffffff;border:1px solid #D8DEE8;border-top:none;border-radius:0 0 4px 4px;">
    iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a>
  </div>
</div>$b$,
  $t$Hi {{first_name}},

There are two ways to get {{company}} in front of our investors.

You run it — we match, you approve the list, your one-pager goes to up to 25 investors, and the replies come to you.

We run it — up to 100 matched investors, introductions brokered on your behalf, and we chase every follow-up. You take the meetings.

Same network, same sixteen years. The only difference is whose week it costs.

Compare the two: {{cta_url}}

Khris Thetsy
Founder & CEO, iCFO Capital Global, Inc.$t$,
  'active', 'general'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Warm 3 — Two ways to run it$n$);

-- ---------- WARM 4 · The decision ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category)
select
  $n$iCFO Warm 4 — The decision$n$,
  $s$Where do you want to leave this?$s$,
  $p$Three options, one word each.$p$,
  $b$<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.55;">
  <div style="background:#0A1A40;padding:18px 24px;border-radius:4px 4px 0 0;">
    <span style="font-family:Archivo,Arial,sans-serif;font-weight:700;font-size:19px;color:#ffffff;">iCap<span style="color:#2E78F5;">OS</span></span>
  </div>
  <div style="padding:28px 30px;background:#ffffff;border:1px solid #D8DEE8;border-top:none;">
    <p style="font-size:16px;margin:0 0 15px;">Hi {{first_name}},</p>
    <p style="margin:0 0 15px;">{{company}} has been matched and ready to go out for a couple of weeks now.</p>
    <p style="margin:0 0 15px;">Three ways this ends. You start, and we send. You park it, and I put a date on it and come back then. Or the timing is wrong this year and I&#39;ll stop writing.</p>
    <p style="margin:0 0 15px;">Any of the three is fine by me. I&#39;d just rather know which one it is than keep the file open.</p>
    <div style="border-top:1px solid #D8DEE8;margin-top:22px;padding-top:16px;font-size:13.5px;">
      <strong style="display:block;">Khris Thetsy</strong>
      <span style="color:#5A6472;">Founder &amp; CEO, iCFO Capital Global, Inc.</span>
    </div>
  </div>
  <div style="padding:16px 30px;font-size:11.5px;color:#5A6472;background:#ffffff;border:1px solid #D8DEE8;border-top:none;border-radius:0 0 4px 4px;">
    iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a>
  </div>
</div>$b$,
  $t$Hi {{first_name}},

{{company}} has been matched and ready to go out for a couple of weeks now.

Three ways this ends. You start, and we send. You park it, and I put a date on it and come back then. Or the timing is wrong this year and I'll stop writing.

Any of the three is fine by me — I'd just rather know which than keep the file open.

Khris Thetsy
Founder & CEO, iCFO Capital Global, Inc.$t$,
  'active', 'general'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Warm 4 — The decision$n$);

-- ---------- COLD 1 · The question (plain text) ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category)
select
  $n$iCFO Cold 1 — The question$n$,
  $s$raising in 2026?$s$,
  null,
  $b$<div style="font-family:Arial,sans-serif;font-size:15px;color:#141A26;line-height:1.7;max-width:600px;">
<p>{{first_name}} — Khris here, I run iCFO Capital. We&#39;ve spent sixteen years introducing founders to investors.</p>
<p>One question: is {{company}} raising capital this year?</p>
<p>If yes, tell me the stage and roughly the number and I&#39;ll tell you whether our investors are a fit.</p>
<p>If no, say so and I&#39;ll leave you alone.</p>
<p>Khris Thetsy<br>iCFO Capital Global, Inc.<br>La Jolla, CA</p>
<p style="color:#5A6472;font-size:12px;">Reply STOP and I won&#39;t contact you again.</p>
</div>$b$,
  $t${{first_name}} — Khris here, I run iCFO Capital. We've spent sixteen years introducing founders to investors.

One question: is {{company}} raising capital this year?

If yes, tell me the stage and roughly the number and I'll tell you whether our investors are a fit.

If no, say so and I'll leave you alone.

Khris Thetsy
iCFO Capital Global, Inc.
La Jolla, CA

Reply STOP and I won't contact you again.$t$,
  'draft', 'general'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Cold 1 — The question$n$);

-- ---------- COLD 2 · Dormant variant ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category)
select
  $n$iCFO Cold 2 — Dormant variant$n$,
  $s$we were in touch a while back$s$,
  null,
  $b$<div style="font-family:Arial,sans-serif;font-size:15px;color:#141A26;line-height:1.7;max-width:600px;">
<p>{{first_name}} — {{company}} came into our database back in {{year_added}}, around funding. Nothing came of it at the time, which is on me.</p>
<p>Picking it up once: are you raising this year?</p>
<p>If you are, send me the stage and the number and I&#39;ll tell you whether our investors fit. If you&#39;re not, tell me and I&#39;ll close the file properly.</p>
<p>Khris Thetsy<br>iCFO Capital Global, Inc.<br>La Jolla, CA</p>
<p style="color:#5A6472;font-size:12px;">Reply STOP and I won&#39;t contact you again.</p>
</div>$b$,
  $t${{first_name}} — {{company}} came into our database back in {{year_added}}, around funding. Nothing came of it at the time, which is on me.

Picking it up once: are you raising this year?

If you are, send me the stage and the number and I'll tell you whether our investors fit. If you're not, tell me and I'll close the file properly.

Khris Thetsy
iCFO Capital Global, Inc.
La Jolla, CA

Reply STOP and I won't contact you again.$t$,
  'draft', 'general'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Cold 2 — Dormant variant$n$);

-- ---------- COLD 3 · Substance + out ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category)
select
  $n$iCFO Cold 3 — Substance + out$n$,
  $s$Re: raising in 2026?$s$,
  null,
  $b$<div style="font-family:Arial,sans-serif;font-size:15px;color:#141A26;line-height:1.7;max-width:600px;">
<p>{{first_name}} — following up on the note below.</p>
<p>To be concrete about what we do: we hold relationships with family offices, funds and private investors, built over sixteen years. When a company fits what one of them invests in, we put it in front of them. That&#39;s the business.</p>
<p>So — raising, or not the right time?</p>
<p>And if funding isn&#39;t yours to answer for anymore, tell me who it is and I&#39;ll write to them instead.</p>
<p>Khris</p>
</div>$b$,
  $t${{first_name}} — following up on the note below.

To be concrete about what we do: we hold relationships with family offices, funds and private investors, built over sixteen years. When a company fits what one of them invests in, we put it in front of them. That's the business.

So — raising, or not the right time?

And if funding isn't yours to answer for anymore, tell me who it is and I'll write to them instead.

Khris$t$,
  'draft', 'general'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Cold 3 — Substance + out$n$);

-- ---------- COLD 4 · Close the file ----------
insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category)
select
  $n$iCFO Cold 4 — Close the file$n$,
  $s$Re: raising in 2026?$s$,
  null,
  $b$<div style="font-family:Arial,sans-serif;font-size:15px;color:#141A26;line-height:1.7;max-width:600px;">
<p>{{first_name}} — last one from me.</p>
<p>Raising, not raising, or not this year. Any of the three and I&#39;ll file it correctly and stop writing.</p>
<p>No reply and I&#39;ll assume it&#39;s a no, which is a fine answer too.</p>
<p>Khris</p>
</div>$b$,
  $t${{first_name}} — last one from me.

Raising, not raising, or not this year. Any of the three and I'll file it correctly and stop writing.

No reply and I'll assume it's a no, which is a fine answer too.

Khris$t$,
  'draft', 'general'
where not exists (select 1 from public.marketing_templates where name = $n$iCFO Cold 4 — Close the file$n$);
