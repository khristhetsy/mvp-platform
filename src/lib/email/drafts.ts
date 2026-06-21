// Email drafts data access (owner-scoped). email_drafts isn't in generated types.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { EmailAttachment } from "./inbox";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type EmailDraft = {
  id: string;
  to_email: string | null;
  subject: string | null;
  body: string | null;
  attachments: EmailAttachment[];
  updated_at: string;
};

export async function listDrafts(supabase: SupabaseClient<Database>, ownerId: string): Promise<EmailDraft[]> {
  const { data } = await raw(supabase)
    .from("email_drafts")
    .select("id, to_email, subject, body, attachments, updated_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  return (data as unknown as EmailDraft[]) ?? [];
}

export async function saveDraft(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  input: { id?: string | null; to?: string | null; subject?: string | null; body?: string | null; attachments?: EmailAttachment[] },
): Promise<EmailDraft> {
  const row = {
    owner_id: ownerId,
    to_email: input.to ?? null,
    subject: input.subject ?? null,
    body: input.body ?? null,
    attachments: input.attachments ?? [],
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await raw(supabase).from("email_drafts").update(row).eq("id", input.id).eq("owner_id", ownerId).select("id, to_email, subject, body, attachments, updated_at").single();
    if (error || !data) throw new Error(`Could not save draft: ${error?.message ?? "unknown"}`);
    return data as unknown as EmailDraft;
  }

  const { data, error } = await raw(supabase).from("email_drafts").insert(row).select("id, to_email, subject, body, attachments, updated_at").single();
  if (error || !data) throw new Error(`Could not save draft: ${error?.message ?? "unknown"}`);
  return data as unknown as EmailDraft;
}

export async function deleteDraft(supabase: SupabaseClient<Database>, ownerId: string, id: string): Promise<void> {
  await raw(supabase).from("email_drafts").delete().eq("id", id).eq("owner_id", ownerId);
}
