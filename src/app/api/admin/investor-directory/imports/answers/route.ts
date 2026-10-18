import { NextResponse } from "next/server";
import { z } from "zod";
import { directoryAdmin, failed } from "@/lib/investor-directory/admin-auth";
import { loadImportMemory, saveImportMemory } from "@/lib/investor-directory/import-memory";

export const runtime = "nodejs";

const FIELD = z.enum([
  "firm", "contact_name", "title", "email", "phone", "website", "location", "city", "state", "country",
  "investor_types", "funding_stages", "capital_types", "industries", "fund_name", "fund_size", "avg_investment",
  "strategy", "investing_now", "notes", "source_url",
]);
const body = z.object({ answers: z.record(z.string().min(1).max(200), z.array(FIELD).max(8)) });

/** The signed in admin's remembered column answers. */
export async function GET() {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ answers: await loadImportMemory(auth.adminId) });
  } catch (err) {
    return failed(err, "Couldn't load your remembered answers.");
  }
}

export async function PUT(req: Request) {
  const auth = await directoryAdmin();
  if ("error" in auth) return auth.error;
  try {
    const parsed = body.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Those answers could not be read." }, { status: 400 });
    await saveImportMemory(auth.adminId, parsed.data.answers);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failed(err, "Couldn't save your answers.");
  }
}
