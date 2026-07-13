import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { listThreads, composeThread, isMailFolder } from "@/lib/email/inbox";

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const folderParam = req.nextUrl.searchParams.get("folder") ?? "inbox";
  const folder = isMailFolder(folderParam) ? folderParam : "inbox";
  const threads = await listThreads(auth.supabase, auth.profile.id, folder);
  return NextResponse.json({ threads });
}

const attachmentSchema = z.object({
  name: z.string().max(200),
  path: z.string().max(400),
  size: z.number().int().nonnegative(),
  content_type: z.string().nullish(),
});

const composeSchema = z.object({
  to: z.string().min(1).max(2000),
  toName: z.string().max(200).optional(),
  cc: z.string().max(2000).optional(),
  bcc: z.string().max(2000).optional(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(500000),
  html: z.string().max(2000000).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireApiProfile();
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = composeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const thread = await composeThread(
      auth.supabase,
      { id: auth.profile.id, email: auth.profile.email, name: auth.profile.full_name },
      {
        to: parsed.data.to,
        toName: parsed.data.toName,
        cc: parsed.data.cc ?? null,
        bcc: parsed.data.bcc ?? null,
        subject: parsed.data.subject,
        body: parsed.data.body,
        html: parsed.data.html ?? null,
        attachments: parsed.data.attachments?.map((a) => ({ ...a, content_type: a.content_type ?? null })),
      },
    );
    return NextResponse.json({ thread });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to send message." },
      { status: 500 },
    );
  }
}
