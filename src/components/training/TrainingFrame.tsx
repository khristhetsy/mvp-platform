import { AppShell } from "@/components/AppShell";
import type { Role } from "@/lib/auth";
import type { WorkspaceId } from "@/lib/workspace-nav";

type P = { id: string; role?: string | null; full_name?: string | null; email?: string | null };

/** Puts the trainee pages inside the same workspace shell (sidebar, top bar) as the rest of the app. */
export function TrainingFrame({ profile, children }: { profile: P; children: React.ReactNode }) {
  const r = String(profile.role ?? "").toLowerCase();
  const workspace: WorkspaceId = r === "admin" || r === "analyst" ? "admin" : r === "investor" ? "investor" : "founder";
  const role: Role = workspace === "admin" ? (r === "analyst" ? "ANALYST" : "ADMIN") : workspace === "investor" ? "INVESTOR" : "FOUNDER";
  return (
    <AppShell role={role} workspace={workspace} profileName={profile.full_name ?? profile.email ?? "Trainee"} profileEmail={profile.email ?? undefined}>
      {children}
    </AppShell>
  );
}
