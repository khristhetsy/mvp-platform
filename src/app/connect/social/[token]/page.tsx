/**
 * /connect/social/[token] — landing page for a "connect your LinkedIn" invite email.
 * Validates the one-time token, makes sure the person is signed in to iCapOS as staff,
 * then hands off to the normal OAuth start with ?invite= so the label / assignee from
 * the invite land on the account after LinkedIn approves.
 */
import { findOpenInvite } from "@/lib/social/account-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeUserRole } from "@/lib/api/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect your account" };

type Props = { params: Promise<{ token: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md px-4 py-16"><div className="rounded-2xl border border-slate-200 bg-white p-8">{children}</div></div>;
}

export default async function ConnectSocialPage({ params }: Props) {
  const { token } = await params;
  const invite = await findOpenInvite(token).catch(() => null);
  if (!invite) {
    return <Shell><p className="text-center text-sm text-slate-700">This connect link is invalid, already used, or has expired. Ask your admin to send a new one.</p></Shell>;
  }
  const platformName = invite.platform === "linkedin" ? "LinkedIn" : invite.platform === "instagram" ? "Instagram" : "Facebook";
  // Instagram authorizes through the Facebook Page it's linked to — same Meta flow.
  const oauthPlatform = invite.platform === "linkedin" ? "linkedin" : "facebook";
  const oauthName = oauthPlatform === "linkedin" ? "LinkedIn" : "Facebook";
  const color = invite.platform === "linkedin" ? "#0A66C2" : invite.platform === "instagram" ? "#E1306C" : "#1877F2";
  const startHref = `/api/social/${oauthPlatform}/start?invite=${encodeURIComponent(token)}`;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isStaff = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = normalizeUserRole((profile as { role?: string } | null)?.role);
    isStaff = role === "admin" || role === "analyst";
  }

  return (
    <Shell>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: color }}>
          <i className={`ti ti-brand-${invite.platform}`} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-base font-semibold text-slate-900">Connect your {platformName} to iCapOS</h1>
          {invite.label ? <p className="text-[13px] text-slate-500">Account: {invite.label}</p> : null}
        </div>
      </div>
      <ol className="mt-5 space-y-2 text-[13px] text-slate-700">
        <li><b className="font-medium">1.</b> {user ? "You're signed in to iCapOS." : "Sign in to iCapOS with your staff login."}</li>
        <li><b className="font-medium">2.</b> {oauthName} opens and asks you to sign in and approve{invite.platform === "instagram" ? " (Instagram connects through the Facebook Page it's linked to)" : ""}. Your password stays with {oauthName}.</li>
        <li><b className="font-medium">3.</b> You land back in the Social Hub with the account connected.</li>
      </ol>
      <div className="mt-6">
        {!user ? (
          <a href={`/auth/sign-in?next=${encodeURIComponent(`/connect/social/${token}`)}`} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Sign in to iCapOS</a>
        ) : !isStaff ? (
          <p className="text-[13px] text-amber-800">This iCapOS login isn&rsquo;t a staff account ({user.email}). Sign in with your staff login, or ask your admin to add one.</p>
        ) : (
          <a href={startHref} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90" style={{ background: color }}>
            <i className={`ti ti-brand-${invite.platform}`} aria-hidden="true" /> Connect {platformName}
          </a>
        )}
      </div>
      <p className="mt-4 text-[11.5px] text-slate-400">This link works once and expires {new Date(invite.expires_at).toLocaleDateString()}.</p>
    </Shell>
  );
}
