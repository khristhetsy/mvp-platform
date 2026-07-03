import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { requireRole } from "@/lib/supabase/auth";
import { updatePartner, updatePartnerProfile, archivePartner } from "@/lib/crm-connectors/odoo/write";
import { getEditableSchema } from "@/lib/crm-connectors/odoo/schema";
import { fetchAndMapPartner } from "@/lib/crm-connectors/odoo/adapter";
import { patchMirrorContact, deleteMirrorContact, upsertContacts } from "@/lib/crm-connectors/mirror";

export const dynamic = "force-dynamic";

/** Re-fetch a single partner from Odoo and refresh its mirror row. Best-effort. */
async function refreshMirror(externalId: string): Promise<void> {
  const contact = await fetchAndMapPartner(externalId).catch(() => null);
  if (contact) await upsertContacts([contact]).catch(() => {});
}

// Write-back to Odoo is admin-only (analysts are read-only).
const updateSchema = z.object({
  action: z.literal("update"),
  fields: z.object({
    name: z.string().max(200).nullish(),
    email: z.string().email().max(200).nullish().or(z.literal("")),
    phone: z.string().max(60).nullish(),
    title: z.string().max(120).nullish(),
    website: z.string().max(300).nullish(),
    city: z.string().max(120).nullish(),
  }),
});
const archiveSchema = z.object({ action: z.literal("archive") });
const profileSchema = z.object({
  action: z.literal("updateProfile"),
  values: z.record(z.string(), z.unknown()),
});
const bodySchema = z.discriminatedUnion("action", [updateSchema, archiveSchema, profileSchema]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await requireRole(["admin"]).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Only admins can edit source records." }, { status: 403 });
  const { id } = await params;
  const externalId = decodeURIComponent(id).replace(/^mirror:/, "");

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    if (parsed.data.action === "archive") {
      await archivePartner(externalId);
      await deleteMirrorContact(externalId);
      return NextResponse.json({ archived: true });
    }

    if (parsed.data.action === "updateProfile") {
      const schema = await getEditableSchema();
      await updatePartnerProfile(externalId, parsed.data.values, schema);
      await refreshMirror(externalId);
      return NextResponse.json({ updated: true });
    }

    const f = parsed.data.fields;
    const written = await updatePartner(externalId, {
      name: f.name ?? undefined,
      email: (f.email ?? undefined) || undefined,
      phone: f.phone ?? undefined,
      title: f.title ?? undefined,
      website: f.website ?? undefined,
      city: f.city ?? undefined,
    });
    // Reflect in the mirror immediately.
    await patchMirrorContact(externalId, {
      name: f.name ?? undefined,
      email: f.email ? f.email : undefined,
      rawPatch: written,
    });
    return NextResponse.json({ updated: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Write failed." }, { status: 500 });
  }
}
