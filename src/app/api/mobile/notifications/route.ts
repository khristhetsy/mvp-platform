// GET  /api/mobile/notifications?limit=12   the signed in person's notifications and the unread count (same as the website bell)
// POST /api/mobile/notifications            mark all read (no body) or { action: "read", ids: [...] }
import { GET as siteGet, POST as sitePost } from "@/app/api/notifications/route";
import { asMember } from "../_proxy";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return asMember(req, () => siteGet(req));
}
export function POST(req: Request) {
  return asMember(req, () => sitePost(req));
}
