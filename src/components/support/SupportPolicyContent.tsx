import {
  formatPolicyDate,
  SUPPORT_POLICY_HOURS,
  SUPPORT_POLICY_REPLY_BUSINESS_DAYS,
  type PlanLimitRow,
} from "@/lib/support/policy";

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="mt-7">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-2.5 text-sm leading-7 text-slate-700">{children}</div>
    </section>
  );
}

function Bullets({ items }: Readonly<{ items: Array<[string, string]> }>) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map(([label, text]) => (
        <li key={label}>
          <span className="font-semibold text-slate-900">{label}</span> {text}
        </li>
      ))}
    </ul>
  );
}

/**
 * The Customer Support Policy. Founders also see their plan limits (planRows);
 * investors are always free, so they get the same policy without that table.
 */
export function SupportPolicyContent({
  audience,
  planRows = [],
}: Readonly<{ audience: "founder" | "investor"; planRows?: PlanLimitRow[] }>) {
  const founder = audience === "founder";
  return (
    <article className="max-w-3xl">
      <p className="text-xs text-slate-500">Version dated {formatPolicyDate()}</p>

      <Section title="Purpose and scope">
        <p>
          This policy sets what users of iCapOS can expect when they contact iCFO Capital Global, Inc. (&quot;iCFO&quot;) for support, and
          what iCFO does and does not commit to.
        </p>
        <p>
          It applies to requests sent through the iCapOS Support page, the Request help button, a handoff from the iCapOS assistant, and
          replies to support emails. It does not change any signed agreement or subscription terms. If this policy and a signed agreement
          differ, the agreement controls.
        </p>
      </Section>

      <Section title="Support hours">
        <p>Our team answers requests Monday to Friday, {SUPPORT_POLICY_HOURS} time.</p>
        <p>
          A request sent outside those hours is counted from the next opening. Weekends are not counted. On public holidays we may
          extend our reply target, and we will say so in your request when we do.
        </p>
      </Section>

      <Section title="First reply target">
        <p>
          Our target is a first reply from a member of the iCFO team within {SUPPORT_POLICY_REPLY_BUSINESS_DAYS} business days, which is{" "}
          {SUPPORT_POLICY_REPLY_BUSINESS_DAYS * 24} hours counted Monday to Friday during support hours.
        </p>
        <Bullets
          items={[
            ["A target, not a guarantee.", "We aim to meet it on every request. Missing it does not create any obligation beyond continuing to work on your request."],
            ["What counts as a first reply.", "An answer, a question for you, or a status update from a person on our team. An automated message or an answer from the iCapOS assistant does not count."],
            ["Resolution time.", "We do not promise a fixed time to resolve an issue. It depends on the issue."],
            ["If we need longer.", "We will tell you in your request."],
          ]}
        />
      </Section>

      <Section title="iCapOS assistant">
        <p>The iCapOS assistant answers questions about how to use iCapOS at any time, but it is automated and is not a member of our team.</p>
        <p>
          Its answers can be incomplete or wrong, so check anything important before you rely on it. It does not give legal, tax,
          accounting, financial or investment advice. If you need a person, use Request help or the handoff option and our team will
          reply under the first reply target above.
        </p>
      </Section>

      <Section title="What support does not cover">
        <p>Support helps you use iCapOS. It does not guarantee any business outcome and it is not professional advice.</p>
        <Bullets
          items={[
            ["Advice.", "Legal, tax, accounting, securities and investment advice."],
            founder
              ? ["Fundraising outcomes.", "Investor interest, introductions, meetings, terms or funding. Using iCapOS or contacting support does not guarantee any of them."]
              : ["Investment outcomes.", "Deal flow, introductions, terms, closings or returns. Using iCapOS or contacting support does not guarantee any of them."],
            ["Third party services.", "Problems with services we do not run, such as your email provider, your bank or another party's own systems."],
            ["Other users' information.", "We do not share one user's information with another user through support."],
            ["Custom work.", "Changes to iCapOS, or work outside iCapOS, unless covered by a separate written agreement."],
          ]}
        />
      </Section>

      {founder && planRows.length > 0 ? (
        <Section title="Plan limits">
          <p>Support cannot raise or waive the limits of your plan. To get higher limits, change your plan.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Plan</th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Matched investors</th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Intro requests</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map((r) => (
                  <tr key={r.plan}>
                    <td className="border border-slate-200 px-3 py-2 font-medium text-slate-900">{r.plan}</td>
                    <td className="border border-slate-200 px-3 py-2">{r.matchedInvestors}</td>
                    <td className="border border-slate-200 px-3 py-2">{r.introRequests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The numbers are maximums, not promises. Investors set their own monthly acceptance caps, so your list can be shorter. Intro
            request limits are counted over your 30 day period from signup. If these limits differ from our pricing page, the pricing
            page and your subscription terms control.
          </p>
        </Section>
      ) : null}

      <Section title="What we need from you">
        <p>We can help faster when your request is specific, and some requests need your input before we can continue.</p>
        <Bullets
          items={[
            ["Describe the issue.", "What you were doing, what you expected, what happened, and the page where it happened. Screenshots help."],
            ["Use your own account.", "We may verify who you are before we share or change account information."],
            ["Waiting on you.", "When we need something from you, your request shows \"Waiting on you.\" Our target applies to our reply, not to the time we wait for yours."],
            ["Fields you set.", "The information in your profile and settings is yours to choose and maintain."],
          ]}
        />
      </Section>

      <Section title="Limits and remedies">
        <p>This policy describes how we aim to work. It is not a warranty and it is not a service level agreement.</p>
        <Bullets
          items={[
            ["No credits or refunds.", "Missing a reply target does not entitle you to a refund, credit, fee reduction or other compensation. Fees are governed by your subscription terms or signed agreement."],
            ["Circumstances beyond our control.", "Outages, third party failures, security incidents, unusually high volume and events outside our reasonable control can extend our targets."],
            ["Law.", "Nothing in this policy limits rights you have under applicable law that cannot be waived."],
          ]}
        />
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update this policy from time to time. The version shown on the iCapOS Support page, with its date, is the version that
          applies.
        </p>
        <p>To contact support, use Request help on the iCapOS Support page. You can also reply to any support email we send about your request.</p>
      </Section>

    </article>
  );
}
