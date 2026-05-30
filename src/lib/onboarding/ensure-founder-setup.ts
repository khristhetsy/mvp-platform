import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureSubscriptionForProfile } from "@/lib/subscriptions/get-subscription";
import type { PlanType } from "@/lib/subscriptions/plans";
import type { Company, Profile, UserRole } from "@/lib/supabase/types";

function defaultCompanyName(fullName: string | null, email: string | null) {
  if (fullName?.trim()) {
    return `${fullName.trim()}'s Company`;
  }

  if (email) {
    const localPart = email.split("@")[0]?.trim();
    if (localPart) {
      return `${localPart}'s Company`;
    }
  }

  return "My Company";
}

export async function ensureProfileForUser(input: {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
}) {
  const admin = createServiceRoleClient();

  const { data, error } = await admin
    .from("profiles")
    .upsert(
      {
        id: input.userId,
        email: input.email,
        full_name: input.fullName,
        role: input.role,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to ensure profile: ${error.message}`);
  }

  return data as Profile;
}

export async function ensureFounderCompanyForUser(profile: Profile): Promise<Company | null> {
  if (profile.role !== "founder") {
    return null;
  }

  const admin = createServiceRoleClient();

  const { data: membershipRaw, error: membershipError } = await admin
    .from("company_members")
    .select("company_id, companies(*)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const companyMembersMissing =
    membershipError?.message?.includes("Could not find the table 'public.company_members'") ||
    membershipError?.message?.includes("relation \"public.company_members\" does not exist");

  if (membershipError && !companyMembersMissing) {
    throw new Error(`Failed to load company membership: ${membershipError.message}`);
  }

  const membership = membershipRaw as { company_id: string; companies: Company | null } | null;

  if (membership?.companies) {
    return membership.companies;
  }

  const { data: legacyCompany, error: legacyError } = await admin
    .from("companies")
    .select("*")
    .eq("founder_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (legacyError) {
    throw new Error(`Failed to load founder company: ${legacyError.message}`);
  }

  if (legacyCompany) {
    if (!companyMembersMissing) {
      await admin.from("company_members").upsert(
        {
          company_id: legacyCompany.id,
          user_id: profile.id,
          role: "owner",
        },
        { onConflict: "company_id,user_id" },
      );
    }

    return legacyCompany as Company;
  }

  const companyPayload = {
    founder_id: profile.id,
    company_name: defaultCompanyName(profile.full_name, profile.email),
    status: "draft",
    review_status: "pending",
    business_description: "Company profile created automatically during onboarding.",
  };

  let { data: createdCompany, error: createError } = await admin
    .from("companies")
    .insert(companyPayload)
    .select("*")
    .single();

  if (createError?.code === "42703") {
    const { review_status: _ignored, ...legacyPayload } = companyPayload;
    ({ data: createdCompany, error: createError } = await admin
      .from("companies")
      .insert(legacyPayload)
      .select("*")
      .single());
  }

  if (createError || !createdCompany) {
    throw new Error(`Failed to create default company: ${createError?.message ?? "unknown error"}`);
  }

  const reviewInsert = await admin.from("admin_reviews").insert({
    company_id: createdCompany.id,
    founder_id: profile.id,
    status: "pending",
  });

  if (reviewInsert.error?.code === "42703") {
    await admin.from("admin_reviews").insert({
      company_id: createdCompany.id,
      status: "pending",
    });
  }

  if (!companyMembersMissing) {
    const { error: linkError } = await admin.from("company_members").insert({
      company_id: createdCompany.id,
      user_id: profile.id,
      role: "owner",
    });

    if (linkError) {
      throw new Error(`Failed to link company membership: ${linkError.message}`);
    }
  }

  return createdCompany as Company;
}

export async function ensureUserOnboarding(input: {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  requestedPlan?: PlanType | null;
}) {
  const profile = await ensureProfileForUser(input);
  const subscription = await ensureSubscriptionForProfile({
    profileId: profile.id,
    role: profile.role,
    requestedPlan: input.requestedPlan,
  });
  const company = await ensureFounderCompanyForUser(profile);

  return { profile, company, subscription };
}

export async function userHasCompanyAccess(userId: string, companyId: string) {
  const admin = createServiceRoleClient();

  const { data, error } = await admin
    .from("company_members")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();

  const companyMembersMissing =
    error?.message?.includes("Could not find the table 'public.company_members'") ||
    error?.message?.includes("relation \"public.company_members\" does not exist");

  if (error && !companyMembersMissing) {
    return false;
  }

  if (data) {
    return true;
  }

  const { data: legacy } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("founder_id", userId)
    .maybeSingle();

  return Boolean(legacy);
}
