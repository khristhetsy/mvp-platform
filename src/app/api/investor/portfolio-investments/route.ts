import { NextRequest, NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { listInvestments, createInvestment } from "@/lib/portfolio/db";
import type { CreateInvestmentInput } from "@/lib/portfolio/types";

/** GET /api/investor/portfolio-investments — investor's own investments */
export async function GET(): Promise<NextResponse> {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error as NextResponse;

  try {
    const investments = await listInvestments();
    return NextResponse.json(investments);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** POST /api/investor/portfolio-investments — create new investment */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireApiProfile(["investor"]);
  if ("error" in auth) return auth.error as NextResponse;

  try {
    const body: CreateInvestmentInput = await req.json();
    if (!body.company_name?.trim()) {
      return NextResponse.json({ error: "company_name is required" }, { status: 400 });
    }
    if (!body.amount_invested || body.amount_invested <= 0) {
      return NextResponse.json({ error: "amount_invested must be positive" }, { status: 400 });
    }
    if (!body.invested_at) {
      return NextResponse.json({ error: "invested_at is required" }, { status: 400 });
    }
    const investment = await createInvestment(auth.profile.id, body);
    return NextResponse.json(investment, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
