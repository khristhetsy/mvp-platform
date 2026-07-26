// Event Email — per-(event, type) inline-edit drafts. Stores the block document so
// inline edits survive across sessions (loaded when the wizard opens that event+type).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { EventEmailType } from "./merge";
import type { TemplateBlock } from "@/lib/marketing/template-blocks";
import type { TemplateTheme } from "@/lib/marketing/template-theme";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type EventEmailDraft = {
  subject: string | null;
  blocks: TemplateBlock[] | null;
  theme: TemplateTheme | null;
  includeBanner: boolean | null;
  includeLobby: boolean | null;
};

export async function getDraft(
  supabase: SupabaseClient<Database>,
  eventId: string,
  emailType: EventEmailType,
): Promise<EventEmailDraft | null> {
  const { data } = await raw(supabase)
    .from("event_email_drafts")
    .select("subject, blocks, theme, include_banner, include_lobby")
    .eq("event_id", eventId)
    .eq("email_type", emailType)
    .maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    subject: (r.subject as string | null) ?? null,
    blocks: (r.blocks as TemplateBlock[] | null) ?? null,
    theme: (r.theme as TemplateTheme | null) ?? null,
    includeBanner: (r.include_banner as boolean | null) ?? null,
    includeLobby: (r.include_lobby as boolean | null) ?? null,
  };
}

export async function upsertDraft(
  supabase: SupabaseClient<Database>,
  input: {
    eventId: string;
    emailType: EventEmailType;
    subject?: string | null;
    blocks?: TemplateBlock[] | null;
    theme?: TemplateTheme | null;
    includeBanner?: boolean | null;
    includeLobby?: boolean | null;
    updatedBy?: string | null;
  },
): Promise<void> {
  const { error } = await raw(supabase)
    .from("event_email_drafts")
    .upsert(
      {
        event_id: input.eventId,
        email_type: input.emailType,
        subject: input.subject ?? null,
        blocks: input.blocks ?? null,
        theme: input.theme ?? null,
        include_banner: input.includeBanner ?? null,
        include_lobby: input.includeLobby ?? null,
        updated_by: input.updatedBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,email_type" },
    );
  if (error) throw new Error(error.message);
}
