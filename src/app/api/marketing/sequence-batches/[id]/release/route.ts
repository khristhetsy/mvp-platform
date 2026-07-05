import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEffectivePermissions } from "@/lib/rbac/effective-permissions";
import { releaseSequenceBatch } from "@/lib/marketing/sequences";
import type { Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/marketing/sequence-batches/[id]/release — human release, gated by
// manage_actions (or super_admin). Runs the actual send through the send path.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = (await requireRole(["admin", "analyst"]).catch(() => null)) as (Profile & { is_super_admin?: boolean }) | null;
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const svc = createServiceRoleClient();
  const effective = await getEffectivePermissions(svc, profile.id, profile);
  const canApprove = effective.isSuperAdmin || effective.permissions.includes("manage_actions");
  if (!canApprove) {
    return NextResponse.json({ error: "You don't have permission to release sends. Ask an approver or a super admin." }, { status: 403 });
  }

  const { id } = await params;
  try {
    const result = await releaseSequenceBatch(id, profile.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Release failed." }, { status: 500 });
  }
}
