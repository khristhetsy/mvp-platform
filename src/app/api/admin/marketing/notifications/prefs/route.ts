import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { NOTIF_TYPES, NOTIF_GROUPS, CHANNELS } from "@/lib/marketing/notifications/catalog";
import { getEffectiveAll } from "@/lib/marketing/notifications/resolve";
import { savePrefs, saveSettings } from "@/lib/marketing/notifications/store";

export const dynamic = "force-dynamic";

const CADENCE_TOKENS = /^(daily_\d{4}|after_\d+[hd]|weekly_(sun|mon|tue|wed|thu|fri|sat))$/;
const channel = z.enum(["in_app", "email", "push"]);
const timeStr = z.string().regex(/^\d{2}:\d{2}$/);

const patchSchema = z.object({
  prefs: z.array(z.object({
    type_id: z.string().max(80),
    enabled: z.boolean(),
    channels: z.array(channel).max(3),
    cadence: z.string().regex(CADENCE_TOKENS).nullable().optional(),
  })).max(100).optional(),
  settings: z.object({
    master_on: z.boolean().optional(),
    quiet_hours_on: z.boolean().optional(),
    quiet_start: timeStr.optional(),
    quiet_end: timeStr.optional(),
    digest_time: timeStr.optional(),
    default_channels: z.array(channel).max(3).optional(),
    timezone: z.string().max(64).optional(),
  }).optional(),
});

export async function GET(): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const { settings, rows } = await getEffectiveAll(profile.id);
    return NextResponse.json({
      groups: NOTIF_GROUPS,
      channels: CHANNELS,
      catalog: NOTIF_TYPES.map((t) => ({
        id: t.id, group: t.group, label: t.label, description: t.description,
        kind: t.kind, supportsCadence: t.supportsCadence, urgent: t.urgent,
        defaultCadence: t.defaultCadence ?? null, preview: t.preview ?? null,
      })),
      settings,
      prefs: rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load." }, { status: 500 });
  }
}

export async function PATCH(req: Request): Promise<Response> {
  try {
    const profile = await requireRole(["admin"]);
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const valid = new Set(NOTIF_TYPES.map((t) => t.id));
    if (parsed.data.prefs) {
      const prefs = parsed.data.prefs
        .filter((p) => valid.has(p.type_id))
        .map((p) => ({ type_id: p.type_id, enabled: p.enabled, channels: p.channels, cadence: p.cadence ?? null }));
      await savePrefs(profile.id, prefs);
    }
    if (parsed.data.settings) {
      await saveSettings(profile.id, parsed.data.settings);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
