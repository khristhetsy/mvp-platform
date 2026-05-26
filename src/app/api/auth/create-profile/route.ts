import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

export async function POST(request: Request) {
  try {
    const { userId, email, fullName, role } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { error: "Missing required fields: userId, email" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Create profile directly on the server side
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        email,
        full_name: fullName || "",
        role: (role || "founder") as UserRole,
      })
      .select()
      .single();

    if (error) {
      console.error("Profile creation error:", error);
      return NextResponse.json(
        { error: `Failed to create profile: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: data }, { status: 201 });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
