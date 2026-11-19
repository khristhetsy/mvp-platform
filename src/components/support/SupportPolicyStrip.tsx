import Link from "next/link";
import { SUPPORT_POLICY_HOURS, SUPPORT_POLICY_REPLY_PHRASE } from "@/lib/support/policy";

/** The reply promise at a glance, with a link to the full Customer Support Policy. */
export function SupportPolicyStrip({ href }: Readonly<{ href: string }>) {
  const phrase = SUPPORT_POLICY_REPLY_PHRASE;
  return (
    <div
      role="note"
      aria-label="Support reply time"
      className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-[13px] text-indigo-950"
    >
      <span className="font-semibold">First reply {phrase}.</span>
      <span>Monday to Friday, {SUPPORT_POLICY_HOURS}</span>
      <Link href={href} className="ml-auto font-semibold text-indigo-700 underline hover:text-indigo-900">
        Read the support policy
      </Link>
    </div>
  );
}
