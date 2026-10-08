import "server-only";

/**
 * The send route behind each kind of scheduled email. A scheduled send is
 * replayed through exactly the handler its button posts to, so it does what a
 * send now would have done, including everything that follows the send.
 */
import type { NextRequest } from "next/server";
import type { ScheduledKind } from "./schedule";
import { POST as contractsSend } from "@/app/api/admin/sales/contracts/send/route";
import { POST as gmailSend } from "@/app/api/integrations/google/gmail/send/route";
import { POST as gmailReply } from "@/app/api/integrations/google/gmail/threads/[id]/reply/route";
import { POST as irMatchPost } from "@/app/api/admin/ir/matches/[id]/route";
import { POST as chatterSend } from "@/app/api/sales/chatter/send/route";
import { POST as massEmail } from "@/app/api/marketing/mass-email/route";

type Handler = { path: (params: Record<string, string>) => string; run: (req: NextRequest, params: Record<string, string>) => Promise<Response> };

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve({ id: params.id ?? "" }) });

export const SCHEDULED_HANDLERS: Record<ScheduledKind, Handler> = {
  contracts: { path: () => "/api/admin/sales/contracts/send", run: (req) => contractsSend(req) },
  gmail_send: { path: () => "/api/integrations/google/gmail/send", run: (req) => gmailSend(req) },
  gmail_reply: { path: (p) => `/api/integrations/google/gmail/threads/${p.id}/reply`, run: (req, p) => gmailReply(req, ctx(p)) },
  ir_match_email: { path: (p) => `/api/admin/ir/matches/${p.id}`, run: (req, p) => irMatchPost(req, ctx(p)) },
  sales_chatter: { path: () => "/api/sales/chatter/send", run: (req) => chatterSend(req) },
  mass_email: { path: () => "/api/marketing/mass-email", run: (req) => massEmail(req) },
};
