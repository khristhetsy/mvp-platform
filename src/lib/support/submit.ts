/**
 * Open a support request for a founder: create it (as the founder, under RLS),
 * auto-assign it, set the promised reply time, and hand the slow work
 * (staff alerts, founder confirmation email, AI triage, log) to `after()` so
 * the founder sees the confirmation straight away.
 *
 * Shared by the Request help form and the assistant's handoff.
 */
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { autoAssignSupportRequest, createSupportRequest, type SupportSource } from "./support";
import { finishNewRequest, setPromisedReply } from "./care";

export type SubmittedRequest = {
  id: string;
  ownerId: string | null;
  ownerName: string | null;
  dueAt: string | null;
};

export async function submitSupportRequest(
  supabase: SupabaseClient<Database>,
  input: {
    companyId: string;
    founderId: string;
    subject: string;
    body: string;
    source?: SupportSource;
    contextStage?: string | null;
    contextItem?: string | null;
    via: "form" | "assistant";
  },
): Promise<SubmittedRequest | { error: string }> {
  const created = await createSupportRequest(supabase, {
    companyId: input.companyId,
    founderId: input.founderId,
    subject: input.subject,
    body: input.body,
    source: input.source,
    contextStage: input.contextStage ?? null,
    contextItem: input.contextItem ?? null,
  });
  if ("error" in created) return created;

  let ownerId: string | null = null;
  let ownerName: string | null = null;
  let dueAt: string | null = null;
  try {
    const admin = createServiceRoleClient() as unknown as SupabaseClient<Database>;
    ownerId = await autoAssignSupportRequest(admin, created.id);
    dueAt = await setPromisedReply(created.id);
    if (ownerId) {
      const { data } = await (admin as unknown as SupabaseClient)
        .from("profiles")
        .select("full_name, email")
        .eq("id", ownerId)
        .maybeSingle();
      const p = data as { full_name: string | null; email: string | null } | null;
      ownerName = p?.full_name?.trim() || p?.email || null;
    }
  } catch {
    /* the request exists; assignment and timing are best effort */
  }

  after(async () => {
    try {
      await finishNewRequest(created.id, input.via);
    } catch {
      /* best effort; the scheduled pass still reminds staff */
    }
  });

  return { id: created.id, ownerId, ownerName, dueAt };
}
