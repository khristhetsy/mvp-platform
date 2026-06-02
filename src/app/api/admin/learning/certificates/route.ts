import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureCanIssueCertificates, jsonBadRequest, requireLearningStaff } from "@/app/api/admin/learning/_shared";

const issueSchema = z.object({
  founder_id: z.string().uuid(),
  company_id: z.string().uuid().optional().nullable(),
  program_id: z.string().uuid().optional().nullable(),
  certificate_title: z.string().min(3).max(200),
  status: z.enum(["issued", "revoked", "archived"]).optional(),
});

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "CERT-";
  for (let i = 0; i < 10; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function GET() {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  const { data, error } = await auth.supabase
    .from("learning_certificates")
    .select("id, founder_id, company_id, program_id, certificate_title, certificate_code, status, issued_at, issued_by")
    .order("issued_at", { ascending: false })
    .limit(500);
  if (error) return jsonBadRequest(error);
  return NextResponse.json({ certificates: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireLearningStaff();
  if ("error" in auth) return auth.error as NextResponse;

  ensureCanIssueCertificates(auth.profile);

  const body = await request.json().catch(() => ({}));
  const parsed = issueSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  let code = randomCode();
  // best-effort uniqueness retry
  for (let i = 0; i < 3; i += 1) {
    const { data: existing } = await auth.supabase
      .from("learning_certificates")
      .select("id")
      .eq("certificate_code", code)
      .maybeSingle();
    if (!existing) break;
    code = randomCode();
  }

  const { data, error } = await auth.supabase
    .from("learning_certificates")
    .insert({
      founder_id: parsed.data.founder_id,
      company_id: parsed.data.company_id ?? null,
      program_id: parsed.data.program_id ?? null,
      certificate_title: parsed.data.certificate_title,
      certificate_code: code,
      status: parsed.data.status ?? "issued",
      issued_by: auth.profile.id,
    })
    .select("*")
    .single();

  if (error) return jsonBadRequest(error);
  return NextResponse.json({ certificate: data });
}

