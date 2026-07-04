import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createTask } from "@/lib/admin-tasks/queries";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
});

// POST /api/cmo/task — "Add to task": route a CMO brief item into Admin Tasks.
// The Brief only advises; this is how a human turns an item into action.
export async function POST(req: NextRequest): Promise<Response> {
  const profile = await requireRole(["admin", "analyst"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid task." }, { status: 400 });

  try {
    const task = await createTask(createServiceRoleClient(), profile.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: "todo",
      visibility: "admin_only",
      tags: ["cmo-brief", "prospect-pipeline"],
    });
    return NextResponse.json({ ok: true, id: task.id });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create task." }, { status: 500 });
  }
}
