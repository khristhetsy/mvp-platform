import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureMessageThread } from "@/lib/messaging/threads";
import type { ThreadMessageType } from "@/lib/messaging/types";
import type { Database } from "@/lib/supabase/types";

export async function openMessageThreadFromSignal(
  supabase: SupabaseClient<Database>,
  input: {
    companyId: string;
    investorId: string;
    createdBy: string;
    introRequestId?: string | null;
    messageType: ThreadMessageType;
    body: string;
  },
) {
  const { data: company } = await supabase
    .from("companies")
    .select("founder_id")
    .eq("id", input.companyId)
    .maybeSingle();

  if (!company?.founder_id) {
    return { error: new Error("Company founder not found.") };
  }

  return ensureMessageThread(supabase, {
    companyId: input.companyId,
    founderId: company.founder_id,
    investorId: input.investorId,
    createdBy: input.createdBy,
    introRequestId: input.introRequestId ?? null,
    initialMessageType: input.messageType,
    initialBody: input.body,
  });
}
