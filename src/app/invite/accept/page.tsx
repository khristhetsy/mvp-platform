import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/data/audit";
import { MANAGED_ICFO_ROLE, isIcfoManagerOrAdmin } from "@/lib/team/managed-icfo-core";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import { ownerHasManagedIcfoPlan } from "@/lib/team/managed-icfo";

export const dynamic = "force-dynamic";

const ACCENT = "#2E78F5";

export default async function InviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = await getTranslations("appPages");

  if (!token) {
    return <ErrorPage title={t("invalid_link")} message="This invite link is missing a token. Please check the email and try again." />;
  }

  const admin = createServiceRoleClient();

  // Look up the invite
  const { data: invite } = await admin
    .from("company_invites")
    .select("id, company_id, invitee_email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return <ErrorPage title={t("invite_not_found")} message="This invite link is invalid or has already been used." />;
  }
  if (invite.status !== "pending") {
    return <ErrorPage title={t("invite_no_longer_valid")} message={`This invite has been ${invite.status}. Please ask your co-founder to send a new one.`} />;
  }
  if (new Date(invite.expires_at) < new Date()) {
    return <ErrorPage title={t("invite_expired")} message="This invite link has expired (invites are valid for 7 days). Please ask your co-founder to send a new one." />;
  }

  // Fetch company name separately (avoids join type inference issues)
  const { data: company } = await admin
    .from("companies")
    .select("company_name")
    .eq("id", invite.company_id)
    .maybeSingle();

  const companyName = company?.company_name ?? "your company";

  // Check if the current user is logged in
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to sign-in with return URL
    const returnTo = encodeURIComponent(`/invite/accept?token=${token}`);
    redirect(`/auth/sign-in?returnTo=${returnTo}`);
  }

  const isManaged = invite.role === MANAGED_ICFO_ROLE;
  if (isManaged) {
    // Managed by iCFO is for the iCFO team. Who accepts is decided by the signed in
    // account (staff Manager or Admin), not by the email the invite was sent to,
    // so the team can accept from their staff login.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: me } = await (admin as any).from("profiles").select("role, is_super_admin").eq("id", user.id).maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eff = await getEffectivePermissions(admin as any, user.id, me ?? null);
    const staffOk = isIcfoManagerOrAdmin({
      profileRole: me?.role ?? null,
      roleSlug: eff.roleSlug,
      isSuperAdmin: eff.isSuperAdmin,
    });
    if (!staffOk) {
      return <ErrorPage title={t("invalid_link")} message="Managed by iCFO is for iCFO Manager and Admin accounts. Please sign in with your iCFO staff account and open the link again." />;
    }
    if (!(await ownerHasManagedIcfoPlan(admin, invite.company_id))) {
      return <ErrorPage title={t("invite_no_longer_valid")} message="Managed by iCFO is available on Premium, Done for you. Please contact iCFO." />;
    }
  }

  // Check if already a member
  const { data: existingMember } = await admin
    .from("company_members")
    .select("id")
    .eq("company_id", invite.company_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMember) {
    return (
      <SuccessPage
        companyName={companyName}
        message="You're already a member of this company."
        alreadyMember
      />
    );
  }

  // Accept the invite: create member + mark invite accepted
  const { error: memberError } = await admin.from("company_members").insert({
    company_id: invite.company_id,
    user_id: user.id,
    role: invite.role,
  });
  if (memberError) {
    return <ErrorPage title={t("invalid_link")} message="We could not add you to this company. Please try again or contact iCFO." />;
  }

  if (isManaged) {
    await writeAuditLog(admin, {
      userId: user.id,
      action: "team.managed_icfo_accepted",
      entityType: "company_invite",
      entityId: invite.id,
      metadata: { company_id: invite.company_id },
    });
  }

  await admin.from("company_invites").update({
    status: "accepted",
    accepted_at: new Date().toISOString(),
    accepted_by_user_id: user.id,
  }).eq("id", invite.id);

  if (isManaged) {
    return (
      <SuccessPage
        companyName={companyName}
        href="/admin"
        message={`You are now listed as Managed by iCFO on ${companyName}. Open the company from the admin workspace.`}
      />
    );
  }
  return <SuccessPage companyName={companyName} />;
}

// ── Sub-pages ─────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#F8F9FC",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "40px 20px",
    }}>
      <div style={{
        background: "white", borderRadius: 20,
        border: "1px solid #e5e7eb",
        padding: "40px 44px", maxWidth: 460, width: "100%",
        textAlign: "center",
      }}>
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: ACCENT, letterSpacing: "-0.02em" }}>
            iCapOS
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorPage({ title, message }: { title: string; message: string }) {
  return (
    <Shell>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: "#fef2f2", border: "1px solid #fecaca",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 8v4m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 10px" }}>{title}</h1>
      <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: "0 0 28px" }}>{message}</p>
      <Link
        href="/founder"
        style={{
          display: "inline-block", background: ACCENT, color: "white",
          fontSize: 14, fontWeight: 600, padding: "10px 24px", borderRadius: 10,
          textDecoration: "none",
        }}
      >
        Go to dashboard
      </Link>
    </Shell>
  );
}

function SuccessPage({ companyName, message, alreadyMember, href = "/founder" }: { companyName: string; message?: string; alreadyMember?: boolean; href?: string }) {
  return (
    <Shell>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: "#f0fdf4", border: "1px solid #bbf7d0",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 12.75 11.25 15 15 9.75M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 10px" }}>
        {alreadyMember ? "Already a member" : `Welcome to ${companyName}!`}
      </h1>
      <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: "0 0 28px" }}>
        {message ?? `You've joined the ${companyName} workspace. You can now collaborate on investor outreach, documents, and fundraising.`}
      </p>
      <Link
        href={href}
        style={{
          display: "inline-block", background: ACCENT, color: "white",
          fontSize: 14, fontWeight: 600, padding: "10px 24px", borderRadius: 10,
          textDecoration: "none",
        }}
      >
        Go to dashboard →
      </Link>
    </Shell>
  );
}
