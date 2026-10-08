import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import { getSalesScope } from "@/lib/sales/scope";
import { getContactProfile } from "@/lib/sales/contacts";
import { SalesHubHeader } from "../../SalesHubHeader";
import { SendFlowClient } from "@/components/admin/contracts/SendFlowClient";

export const dynamic = "force-dynamic";

/** Sales Hub › Send SPV Contracts, for one SPV-tagged prospect. */
export default async function SendContractsPage({ searchParams }: { searchParams: Promise<{ contact?: string; resume?: string }> }) {
  const profile = await requireRole(["admin", "analyst"]);
  const { contact: contactId, resume } = await searchParams;
  if (!contactId) redirect("/admin/sales/contracts");

  const [scope, data, eff] = await Promise.all([
    getSalesScope(profile),
    getContactProfile(contactId),
    getEffectivePermissions(createServiceRoleClient(), profile.id, profile),
  ]);
  const visible = data && (scope.canSeeAllContacts || data.contact.assignee_ids.includes(profile.id));
  const shell = (body: ReactNode) => (
    <AppShell role="ADMIN" workspace="admin" profileName={profile.full_name ?? profile.email ?? "Admin"} profileSubtitle={profile.role} profileEmail={profile.email ?? undefined}>
      <SalesHubHeader />
      {body}
    </AppShell>
  );
  if (!data || !visible) return shell(<Blocked title="Contact not available" text="This contact does not exist or is not assigned to you." />);
  const c = data.contact;
  return shell(
    <SendFlowClient
      contact={{ id: c.id, name: c.name, email: c.email, company: c.company }}
      isAdmin={eff.isSuperAdmin || eff.permissions.includes("manage_settings")}
      senderName={profile.full_name ?? null}
      autoResume={resume === "1"}
    />,
  );
}

function Blocked({ title, text, href }: { title: string; text: string; href?: string }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e6ed", borderRadius: 12, padding: 24, maxWidth: 560 }}>
      <h1 style={{ fontSize: 16, fontWeight: 600, color: "#0A1A40", margin: "0 0 6px" }}>{title}</h1>
      <p style={{ fontSize: 13, color: "#5a6b87", margin: 0, lineHeight: 1.6 }}>{text}</p>
      {href ? <a href={href} style={{ display: "inline-block", marginTop: 12, fontSize: 12.5, color: "#2E78F5" }}>Open the contact</a> : null}
    </div>
  );
}
