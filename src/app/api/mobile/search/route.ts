// GET /api/mobile/search?q=...   contacts, documents, deal rooms and investors, same as the website search
import { GET as siteGet } from "@/app/api/founder/search/route";
import { asFounder } from "../_proxy";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return asFounder(req, () => siteGet(req));
}
