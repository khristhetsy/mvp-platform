import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { marketingDb } from "@/lib/marketing/db";

export async function GET(): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const db = await marketingDb();
    const { data, error } = await db
      .from("marketing_unsubscribes")
      .select("email,reason,unsubscribed_at")
      .order("unsubscribed_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const { email, reason } = await req.json();
    if (!email?.includes("@")) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    const db = await marketingDb();
    const { error } = await db
      .from("marketing_unsubscribes")
      .upsert({ email: email.toLowerCase().trim(), reason: reason ?? "manual_admin" }, { onConflict: "email" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(["admin"]);
    const email = req.nextUrl.searchParams.get("email");
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
    const db = await marketingDb();
    const { error } = await db.from("marketing_unsubscribes").delete().eq("email", email);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
