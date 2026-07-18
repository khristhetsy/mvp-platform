import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventPref = { in_app: boolean; email: boolean; digest: boolean };

type DigestFrequency = "daily" | "weekly" | "off";

type NotificationPrefs = {
  events: Record<string, EventPref>;
  digest_frequency: DigestFrequency;
  quiet_start: string | null;
  quiet_end: string | null;
  pause_all: boolean;
  critical_override: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_slack: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  events: {
    new_founder_signup: { in_app: true, email: true, digest: true },
    stage_approval_request: { in_app: true, email: true, digest: false },
    compliance_escalation: { in_app: true, email: true, digest: false },
    remediation_overdue: { in_app: true, email: false, digest: true },
    investor_interest: { in_app: true, email: true, digest: false },
    intro_request: { in_app: true, email: true, digest: false },
    spv_blocker: { in_app: true, email: true, digest: false },
    document_uploaded: { in_app: true, email: false, digest: true },
    readiness_rescored: { in_app: false, email: false, digest: true },
    strong_investor_match: { in_app: true, email: true, digest: false },
  },
  digest_frequency: "weekly",
  quiet_start: "20:00",
  quiet_end: "07:00",
  pause_all: false,
  critical_override: true,
  channel_in_app: true,
  channel_email: true,
  channel_slack: false,
};

const DIGEST_FREQUENCIES: readonly DigestFrequency[] = ["daily", "weekly", "off"];

function isEventPref(value: unknown): value is EventPref {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.in_app === "boolean" &&
    typeof v.email === "boolean" &&
    typeof v.digest === "boolean"
  );
}

function coerceEvents(input: unknown): Record<string, EventPref> {
  if (typeof input !== "object" || input === null) return DEFAULT_PREFS.events;
  const out: Record<string, EventPref> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isEventPref(value)) {
      out[key] = { in_app: value.in_app, email: value.email, digest: value.digest };
    }
  }
  return Object.keys(out).length > 0 ? out : DEFAULT_PREFS.events;
}

function coerceBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function coerceTime(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : fallback;
}

function sanitize(body: Record<string, unknown>): NotificationPrefs {
  const digest = body.digest_frequency;
  const digest_frequency: DigestFrequency = DIGEST_FREQUENCIES.includes(
    digest as DigestFrequency,
  )
    ? (digest as DigestFrequency)
    : DEFAULT_PREFS.digest_frequency;

  return {
    events: coerceEvents(body.events),
    digest_frequency,
    quiet_start: coerceTime(body.quiet_start, DEFAULT_PREFS.quiet_start),
    quiet_end: coerceTime(body.quiet_end, DEFAULT_PREFS.quiet_end),
    pause_all: coerceBool(body.pause_all, DEFAULT_PREFS.pause_all),
    critical_override: coerceBool(body.critical_override, DEFAULT_PREFS.critical_override),
    channel_in_app: coerceBool(body.channel_in_app, DEFAULT_PREFS.channel_in_app),
    channel_email: coerceBool(body.channel_email, DEFAULT_PREFS.channel_email),
    channel_slack: coerceBool(body.channel_slack, DEFAULT_PREFS.channel_slack),
  };
}

export async function GET(): Promise<Response> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // notification_preferences isn't in the generated Supabase types yet.
  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from("notification_preferences")
    .select(
      "events, digest_frequency, quiet_start, quiet_end, pause_all, critical_override, channel_in_app, channel_email, channel_slack",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(DEFAULT_PREFS);
  }

  const prefs: NotificationPrefs = sanitize(data as Record<string, unknown>);
  return NextResponse.json(prefs);
}

export async function PUT(req: Request): Promise<Response> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    body = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prefs = sanitize(body);

  // notification_preferences isn't in the generated Supabase types yet.
  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        ...prefs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select(
      "events, digest_frequency, quiet_start, quiet_end, pause_all, critical_override, channel_in_app, channel_email, channel_slack",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const saved: NotificationPrefs = sanitize(data as Record<string, unknown>);
  return NextResponse.json(saved);
}
