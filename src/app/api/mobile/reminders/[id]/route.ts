// PATCH  /api/mobile/reminders/:id   { done } or { title, kind, date, time }
// DELETE /api/mobile/reminders/:id
import { NextResponse } from "next/server";
import { DELETE as siteDelete, PATCH as sitePatch } from "@/app/api/reminders/[id]/route";
import { ptWallToIso } from "@/lib/reminders/pt";
import { asFounder, withJson } from "../../_proxy";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export function PATCH(req: Request, ctx: Ctx) {
  return asFounder(req, async () => {
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b) return NextResponse.json({ error: "Send done as true or false." }, { status: 400 });
    const out: Record<string, unknown> = {};
    if (typeof b.done === "boolean") out.done = b.done;
    if ("title" in b) out.title = b.title;
    if ("kind" in b) out.kind = b.kind;
    if ("date" in b || "time" in b) {
      const dueAt = ptWallToIso(String(b.date ?? ""), String(b.time ?? "09:00"));
      if (!dueAt) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
      out.dueAt = dueAt;
    }
    return sitePatch(withJson(req, out), ctx);
  });
}

export function DELETE(req: Request, ctx: Ctx) {
  return asFounder(req, () => siteDelete(req, ctx));
}
