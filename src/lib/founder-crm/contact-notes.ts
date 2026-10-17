import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ContactNote, ContactTask } from "@/lib/founder-crm/contact-notes-types";

/**
 * Loaders for the contact page's Note log and Tasks tabs. Both read through the
 * founder's own session, so row level security keeps them to this founder. If the
 * tables or the new column are not there yet the lists come back empty and the
 * page still opens.
 */

const raw = (client: unknown) => client as SupabaseClient;

export async function loadContactNotes(founderId: string, contactId: string): Promise<ContactNote[]> {
  const supabase = raw(await createServerSupabaseClient());
  const { data } = await supabase
    .from("founder_contact_notes")
    .select("id, body, pinned, created_at")
    .eq("founder_id", founderId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as ContactNote[];
}

export async function loadContactTasks(founderId: string, contactId: string): Promise<ContactTask[]> {
  const supabase = raw(await createServerSupabaseClient());
  const { data } = await supabase
    .from("user_reminders")
    .select("id, title, kind, due_at, done_at")
    .eq("user_id", founderId)
    .eq("contact_id", contactId)
    .order("due_at", { ascending: true })
    .limit(200);
  return (data ?? []) as ContactTask[];
}
