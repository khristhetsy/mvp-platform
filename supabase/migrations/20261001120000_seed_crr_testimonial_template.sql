-- Seed the founder testimonial request into the Marketing Hub Templates library.
-- Uses the {{starting_crr}} / {{current_crr}} merge fields: at send time each
-- founder gets their own first and latest Capital Readiness Rating, and founders
-- with no rising CRR on record are skipped (see src/lib/marketing/crr-merge.ts).
-- Seeded as 'draft' under Marketing so it is reviewed before going active.
-- Idempotent: inserts only if a template of this name doesn't already exist.

insert into public.marketing_templates (name, subject, preview_text, html_body, text_body, status, category, department)
select
  $n$Founder testimonial request (CRR)$n$,
  $s${{first_name}}, would you share your iCapOS story?$s$,
  $p$Two or three sentences about your Capital Readiness Rating progress.$p$,
  $b$<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#141A26;line-height:1.6;font-size:15px;">
  <p style="margin:0 0 14px;">Hi {{first_name}},</p>
  <p style="margin:0 0 14px;">Your Capital Readiness Rating went from <strong style="color:#1A6CE4;">{{starting_crr}}</strong> to <strong style="color:#1A6CE4;">{{current_crr}}</strong> on iCapOS. That progress is yours, and other founders would benefit from hearing how you did it.</p>
  <p style="margin:0 0 10px;">Would you write a short recommendation about your experience? Two or three sentences is perfect. If it helps, you could touch on:</p>
  <div style="background:#F4F7FC;border-radius:8px;padding:12px 16px;margin:0 0 14px;">
    <p style="margin:0 0 4px;"><span style="color:#1A6CE4;font-weight:600;">1.</span> Where you started before iCapOS</p>
    <p style="margin:0 0 4px;"><span style="color:#1A6CE4;font-weight:600;">2.</span> What the platform helped you improve in your CRR</p>
    <p style="margin:0;"><span style="color:#1A6CE4;font-weight:600;">3.</span> What that progress means for your raise</p>
  </div>
  <p style="margin:0 0 14px;">Just reply to this email with your recommendation. By replying, you agree we may share it on icapos.com. If you would prefer to stay anonymous, say so in your reply.</p>
  <p style="margin:0 0 18px;">Thank you for building with us.</p>
  <p style="margin:0;font-weight:600;">Khris Thetsy</p>
  <p style="margin:2px 0 0;color:#5A6472;font-size:13px;">Founder &amp; CEO, iCFO Capital Global, Inc.</p>
  <p style="margin:0;color:#5A6472;font-size:13px;">iCapOS</p>
  <div style="border-top:1px solid #E2E6ED;margin-top:22px;padding-top:12px;font-size:11.5px;color:#8792A2;">iCFO Capital Global, Inc., La Jolla, CA &middot; <a href="{{unsubscribe_url}}" style="color:#185FA5;">Unsubscribe</a></div>
</div>$b$,
  $t$Hi {{first_name}},

Your Capital Readiness Rating went from {{starting_crr}} to {{current_crr}} on iCapOS. That progress is yours, and other founders would benefit from hearing how you did it.

Would you write a short recommendation about your experience? Two or three sentences is perfect. If it helps, you could touch on:

1. Where you started before iCapOS
2. What the platform helped you improve in your CRR
3. What that progress means for your raise

Just reply to this email with your recommendation. By replying, you agree we may share it on icapos.com. If you would prefer to stay anonymous, say so in your reply.

Thank you for building with us.

Khris Thetsy
Founder & CEO, iCFO Capital Global, Inc.
iCapOS$t$,
  'draft', 'general', 'Marketing'
where not exists (select 1 from public.marketing_templates where name = $n$Founder testimonial request (CRR)$n$);
