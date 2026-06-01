import { getGoogleConnectionStatus } from "@/lib/integrations/connected-accounts";
import type { GmailFoundationStatus } from "@/lib/email/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function getGmailFoundationStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<GmailFoundationStatus> {
  const google = await getGoogleConnectionStatus(supabase, userId);

  if (google.connected && google.email) {
    return {
      draftingAvailable: true,
      gmailSendingEnabled: false,
      googleConnected: true,
      googleEmailHint: google.email.replace(/(.{2}).+(@.+)/, "$1…$2"),
      message:
        "Email drafting is available. Gmail is connected for Calendar; outbound Gmail send is not enabled in Phase 1.",
    };
  }

  if (google.configured) {
    return {
      draftingAvailable: true,
      gmailSendingEnabled: false,
      googleConnected: false,
      googleEmailHint: null,
      message:
        "Email drafting available; connect Google in Settings for Calendar. Gmail sending not enabled in Phase 1.",
    };
  }

  return {
    draftingAvailable: true,
    gmailSendingEnabled: false,
    googleConnected: false,
    googleEmailHint: null,
    message: "Email drafting available; Gmail sending not enabled. Google OAuth is not configured on this environment.",
  };
}
