import Link from "next/link";
import { Mail } from "lucide-react";

/**
 * Deep-links to a workspace inbox with the compose modal prefilled for a contact.
 * Drop into any surface where the current user legitimately owns the contact's
 * email (admin CRM, a user's own contacts).
 *
 * Do NOT use on the founder→investor view: investor emails must never be exposed
 * to founders. Founder↔investor contact stays mediated through intro requests.
 */
export function EmailContactButton({
  email,
  subject,
  inboxBasePath,
  label = "Email",
  className,
}: {
  email: string;
  subject?: string;
  /** e.g. "/admin/inbox", "/founder/inbox". */
  inboxBasePath: string;
  label?: string;
  className?: string;
}) {
  const params = new URLSearchParams({ to: email });
  if (subject) params.set("subject", subject);
  const href = `${inboxBasePath}?${params.toString()}`;

  return (
    <Link
      href={href}
      className={
        className ??
        "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      }
    >
      <Mail className="h-3.5 w-3.5" aria-hidden /> {label}
    </Link>
  );
}
