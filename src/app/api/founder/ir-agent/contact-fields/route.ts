import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFounderAgentApi } from "@/lib/ir-agent/founder";
import { getContactFields, replaceContactFields } from "@/lib/ir-agent/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  fields: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(30),
        label: z.string().trim().min(1).max(40),
        kind: z.enum(["short_text", "email", "phone"]),
        required: z.boolean(),
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(8),
});

/** Replace the contact questions. Name and email stay required: the booking needs them. */
export async function PUT(req: Request) {
  const auth = await requireFounderAgentApi();
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Each contact question needs a label." }, { status: 400 });
  const fields = parsed.data.fields.map((f) => ({ ...f, key: f.key.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30) || "field" }));
  const keys = new Set<string>();
  for (const f of fields) {
    if (keys.has(f.key)) return NextResponse.json({ error: `Two questions share the key ${f.key}.` }, { status: 400 });
    keys.add(f.key);
  }
  const name = fields.find((f) => f.key === "name");
  const email = fields.find((f) => f.key === "email");
  if (!name || !email) return NextResponse.json({ error: "Name and email are needed for the invitation." }, { status: 400 });
  name.required = true;
  name.enabled = true;
  email.required = true;
  email.enabled = true;
  email.kind = "email";
  const ok = await replaceContactFields(auth.ctx.agent.id, fields);
  if (!ok) return NextResponse.json({ error: "Could not save contact questions." }, { status: 500 });
  return NextResponse.json({ contactFields: await getContactFields(auth.ctx.agent.id) });
}
