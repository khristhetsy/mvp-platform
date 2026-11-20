import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getOrClaimEnrollment } from "@/lib/learning/staff-training/data";

/** Whether this person has the Training course. The menus show the Training row only when true. */
export async function GET() {
  const auth = await requireApiProfile();
  if ("error" in auth) return NextResponse.json({ enrolled: false });
  const enrollment = await getOrClaimEnrollment(auth.profile);
  return NextResponse.json({ enrolled: Boolean(enrollment) });
}
