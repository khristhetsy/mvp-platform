import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { getContactLists, saveContactList } from "@/lib/outreach/contact-lists";

export const dynamic = "force-dynamic";

/** List the founder's saved contact lists. */
export async function GET() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ lists: [] });

  return NextResponse.json({ lists: await getContactLists(company.id) });
}

/** Save a named list. Body: { id?, name, contactIds }. */
export async function POST(request: Request) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; name?: unknown; contactIds?: unknown }
    | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Give the list a name." }, { status: 400 });

  const contactIds = Array.isArray(body?.contactIds)
    ? body.contactIds.filter((v): v is string => typeof v === "string")
    : [];
  const id = typeof body?.id === "string" ? body.id : null;

  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company found." }, { status: 404 });

  const savedId = await saveContactList(company.id, auth.profile.id, { id, name, contactIds });
  if (!savedId) {
    return NextResponse.json(
      { error: "Couldn't save the list. The contact-lists table may need its migration run." },
      { status: 500 },
    );
  }
  return NextResponse.json({ id: savedId });
}
