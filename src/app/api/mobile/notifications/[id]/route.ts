// PATCH /api/mobile/notifications/:id   mark one notification read
import { PATCH as sitePatch } from "@/app/api/notifications/[id]/route";
import { asFounder } from "../../_proxy";

export const dynamic = "force-dynamic";

export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return asFounder(req, () => sitePatch(req, ctx));
}
