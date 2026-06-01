import { NextResponse } from "next/server";
import { z } from "zod";
import {
  COLLABORATION_ENTITY_TYPES,
  COLLABORATION_VISIBILITIES,
} from "@/lib/collaboration/types";
import {
  collaborationDefaultsForRole,
  createCollaborationComment,
  listCollaborationComments,
} from "@/lib/collaboration/service";
import { requireApiProfile } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  entityType: z.enum(COLLABORATION_ENTITY_TYPES),
  entityId: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  visibility: z.enum(COLLABORATION_VISIBILITIES),
  isInternalNote: z.boolean().optional(),
  threadContext: z
    .object({
      companyId: z.string().uuid().optional().nullable(),
      investorProfileId: z.string().uuid().optional().nullable(),
      spvId: z.string().uuid().optional().nullable(),
    })
    .optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId are required." }, { status: 400 });
  }

  if (!COLLABORATION_ENTITY_TYPES.includes(entityType as (typeof COLLABORATION_ENTITY_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid entityType." }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const comments = await listCollaborationComments(
      admin,
      auth.profile,
      entityType as (typeof COLLABORATION_ENTITY_TYPES)[number],
      entityId,
    );
    return NextResponse.json({
      comments,
      ...collaborationDefaultsForRole(auth.profile.role),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Unable to load comments.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment payload." }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    const isStaff = auth.profile.role === "admin" || auth.profile.role === "analyst";
    const comment = await createCollaborationComment(admin, auth.profile, {
      ...parsed.data,
      threadContext: isStaff ? parsed.data.threadContext : undefined,
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Unable to create comment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
