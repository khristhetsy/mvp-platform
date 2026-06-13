import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { updateInvestment, deleteInvestment } from "@/lib/portfolio/db";
import type { UpdateInvestmentInput } from "@/lib/portfolio/types";

/** PATCH /api/investor/portfolio-investments/[id] */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { id } = await params;
  try {
    const body: UpdateInvestmentInput = await req.json();
    const updated = await updateInvestment(id, body);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** DELETE /api/investor/portfolio-investments/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error as NextResponse;

  const { id } = await params;
  try {
    await deleteInvestment(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
