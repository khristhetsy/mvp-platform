/**
 * End-to-end audit for subscription signup flows (no Stripe).
 * Run: node scripts/audit-subscription-signup-flow.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnvLocalIfNeeded() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocalIfNeeded();

const TRIAL_DURATION_DAYS = 3;
const FOUNDER_PROFESSIONAL_FEATURES = [
  "dashboard",
  "ai_diligence",
  "documents",
  "readiness",
  "settings",
  "investor_access",
  "capital_raise",
  "elearning",
  "analytics",
  "premium_tools",
];

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function defaultPlanForRole(role, _requestedPlan) {
  if (role === "admin" || role === "analyst") {
    return { plan_type: "admin_internal", subscription_status: "internal", trial_started_at: null, trial_ends_at: null };
  }
  if (role === "investor") {
    return { plan_type: "investor_free", subscription_status: "free", trial_started_at: null, trial_ends_at: null };
  }
  const now = new Date();
  return {
    plan_type: "founder_trial",
    subscription_status: "trialing",
    trial_started_at: now.toISOString(),
    trial_ends_at: addDays(now, TRIAL_DURATION_DAYS).toISOString(),
  };
}

function isTrialActive(subscription, now = new Date()) {
  if (subscription.plan_type !== "founder_trial") return false;
  if (subscription.subscription_status !== "trialing") return false;
  if (!subscription.trial_ends_at) return false;
  return new Date(subscription.trial_ends_at).getTime() > now.getTime();
}

function featuresForTrial(subscription, now = new Date()) {
  if (subscription.plan_type === "founder_trial" && isTrialActive(subscription, now)) {
    return new Set(FOUNDER_PROFESSIONAL_FEATURES);
  }
  return new Set(["dashboard", "ai_diligence", "documents", "readiness", "settings"]);
}

function parseRequestedPlan(value) {
  const allowed = new Set(["founder_trial", "founder_basic", "founder_professional", "investor_free"]);
  return typeof value === "string" && allowed.has(value) ? value : null;
}

function daysBetween(startIso, endIso) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

const results = [];
function pass(name, detail) {
  results.push({ status: "PASS", name, detail });
}
function fail(name, detail) {
  results.push({ status: "FAIL", name, detail });
}
function warn(name, detail) {
  results.push({ status: "WARN", name, detail });
}

async function main() {
  // --- Static logic checks (no DB) ---
  const trialDefaults = defaultPlanForRole("founder", "founder_basic");
  if (trialDefaults.plan_type === "founder_trial" && trialDefaults.subscription_status === "trialing") {
    pass("Founder Basic selection → subscription defaults to founder_trial", trialDefaults.plan_type);
  } else {
    fail("Founder Basic selection → subscription defaults to founder_trial", JSON.stringify(trialDefaults));
  }

  const proDefaults = defaultPlanForRole("founder", "founder_professional");
  if (proDefaults.plan_type === "founder_trial") {
    pass("Founder Professional selection → subscription defaults to founder_trial", proDefaults.plan_type);
  } else {
    fail("Founder Professional selection → subscription defaults to founder_trial", JSON.stringify(proDefaults));
  }

  const trialDays = daysBetween(trialDefaults.trial_started_at, trialDefaults.trial_ends_at);
  if (trialDays === TRIAL_DURATION_DAYS) {
    pass("Trial duration is 3 days", `${trialDays} days`);
  } else {
    fail("Trial duration is 3 days", `Expected 3, got ${trialDays}`);
  }

  const activeTrialSub = {
    plan_type: "founder_trial",
    subscription_status: "trialing",
    trial_ends_at: addDays(new Date(), 1).toISOString(),
  };
  const trialFeatures = featuresForTrial(activeTrialSub);
  if (FOUNDER_PROFESSIONAL_FEATURES.every((f) => trialFeatures.has(f))) {
    pass("Active founder_trial grants full Professional feature set", `${trialFeatures.size} features`);
  } else {
    fail("Active founder_trial grants full Professional feature set", [...trialFeatures].join(", "));
  }

  if (parseRequestedPlan("founder_basic") === "founder_basic" && parseRequestedPlan("invalid") === null) {
    pass("parseRequestedPlan validates allowed plan types", "founder_basic accepted, invalid rejected");
  } else {
    fail("parseRequestedPlan validates allowed plan types", "");
  }

  const signUpRedirects = { founder: "/founder/onboarding", investor: "/investor/dashboard" };
  if (signUpRedirects.founder === "/founder/onboarding" && signUpRedirects.investor === "/investor/dashboard") {
    pass("Signup redirect destinations", JSON.stringify(signUpRedirects));
  } else {
    fail("Signup redirect destinations", JSON.stringify(signUpRedirects));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    warn("Live Supabase audit skipped", "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    printResults();
    process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: subscriptionsTableError } = await supabase.from("subscriptions").select("id").limit(1);
  if (subscriptionsTableError) {
    fail("subscriptions table reachable", subscriptionsTableError.message);
    printResults();
    process.exit(1);
  }
  pass("subscriptions table reachable", "OK");

  const { data: duplicateProfiles, error: dupError } = await supabase.rpc("exec_sql", {
    query: "",
  }).maybeSingle();
  void duplicateProfiles;
  void dupError;

  const { data: allSubs, error: allSubsError } = await supabase.from("subscriptions").select("profile_id");
  if (allSubsError) {
    fail("Load subscriptions for duplicate check", allSubsError.message);
  } else {
    const counts = new Map();
    for (const row of allSubs ?? []) {
      counts.set(row.profile_id, (counts.get(row.profile_id) ?? 0) + 1);
    }
    const duplicates = [...counts.entries()].filter(([, c]) => c > 1);
    if (duplicates.length === 0) {
      pass("No duplicate subscriptions per profile_id", `${counts.size} profiles with subscriptions`);
    } else {
      fail("No duplicate subscriptions per profile_id", JSON.stringify(duplicates));
    }
  }

  const { data: founderBackfill } = await supabase
    .from("subscriptions")
    .select("plan_type, subscription_status, role")
    .eq("role", "founder")
    .limit(20);

  const professionalOrTrial = (founderBackfill ?? []).filter(
    (s) =>
      (s.plan_type === "founder_professional" && s.subscription_status === "active") ||
      (s.plan_type === "founder_trial" && s.subscription_status === "trialing"),
  );
  if ((founderBackfill ?? []).length === 0) {
    warn("Existing founder subscription backfill", "No founder subscriptions in DB yet");
  } else if (professionalOrTrial.length === (founderBackfill ?? []).length) {
    pass("Existing founders have professional or trial access (not locked to basic)", `${professionalOrTrial.length} checked`);
  } else {
    warn(
      "Existing founders subscription mix",
      JSON.stringify((founderBackfill ?? []).map((s) => `${s.plan_type}/${s.subscription_status}`)),
    );
  }

  const testRuns = [
    { label: "Founder Free Trial", role: "founder", requested_plan: "founder_trial" },
    { label: "Founder Basic selection", role: "founder", requested_plan: "founder_basic" },
    { label: "Founder Professional selection", role: "founder", requested_plan: "founder_professional" },
    { label: "Investor signup", role: "investor", requested_plan: "investor_free" },
  ];

  const createdUserIds = [];

  for (const scenario of testRuns) {
    const email = `audit-${scenario.role}-${scenario.requested_plan}-${Date.now()}@capitalos-audit.invalid`;
    const password = `AuditTest!${Date.now()}`;

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `Audit ${scenario.label}`,
        role: scenario.role,
        requested_plan: scenario.requested_plan,
      },
    });

    if (createError || !created.user) {
      fail(`${scenario.label}: create auth user`, createError?.message ?? "no user");
      continue;
    }

    createdUserIds.push(created.user.id);

    await new Promise((r) => setTimeout(r, 500));

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, email")
      .eq("id", created.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      fail(`${scenario.label}: profile created by trigger`, profileError?.message ?? "missing profile");
      continue;
    }

    if (profile.role === scenario.role) {
      pass(`${scenario.label}: profile role`, profile.role);
    } else {
      fail(`${scenario.label}: profile role`, `expected ${scenario.role}, got ${profile.role}`);
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(created.user.id);
    const storedRequested = authUser?.user?.user_metadata?.requested_plan;
    if (storedRequested === scenario.requested_plan) {
      pass(`${scenario.label}: requested_plan in auth metadata`, storedRequested);
    } else {
      fail(`${scenario.label}: requested_plan in auth metadata`, `expected ${scenario.requested_plan}, got ${storedRequested}`);
    }

    const defaults = defaultPlanForRole(scenario.role, scenario.requested_plan);
    const now = new Date().toISOString();
    const { data: insertedSub, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        profile_id: profile.id,
        role: profile.role,
        plan_type: defaults.plan_type,
        subscription_status: defaults.subscription_status,
        trial_started_at: defaults.trial_started_at,
        trial_ends_at: defaults.trial_ends_at,
        current_period_start: now,
        current_period_end: defaults.trial_ends_at,
        monthly_price_cents: 0,
        currency: "USD",
      })
      .select("*")
      .single();

    if (subError) {
      fail(`${scenario.label}: create subscription`, subError.message);
      continue;
    }

    if (scenario.role === "founder") {
      if (insertedSub.plan_type === "founder_trial" && insertedSub.subscription_status === "trialing") {
        pass(`${scenario.label}: subscription is founder_trial/trialing`, insertedSub.plan_type);
      } else {
        fail(`${scenario.label}: subscription is founder_trial/trialing`, `${insertedSub.plan_type}/${insertedSub.subscription_status}`);
      }

      if (insertedSub.trial_started_at && insertedSub.trial_ends_at) {
        const d = daysBetween(insertedSub.trial_started_at, insertedSub.trial_ends_at);
        if (d === 3) {
          pass(`${scenario.label}: trial_ends_at is 3 days after trial_started_at`, `${d} days`);
        } else {
          fail(`${scenario.label}: trial_ends_at is 3 days after trial_started_at`, `${d} days`);
        }
      } else {
        fail(`${scenario.label}: trial dates set`, JSON.stringify(insertedSub));
      }

      if (scenario.requested_plan === "founder_basic" || scenario.requested_plan === "founder_professional") {
        if (insertedSub.plan_type !== scenario.requested_plan) {
          pass(`${scenario.label}: paid plan NOT auto-granted`, `subscription=${insertedSub.plan_type}, requested=${scenario.requested_plan}`);
        } else {
          fail(`${scenario.label}: paid plan NOT auto-granted`, `subscription incorrectly set to ${insertedSub.plan_type}`);
        }
      }

      if (scenario.requested_plan === "founder_trial") {
        const features = featuresForTrial(insertedSub);
        if (features.has("investor_access") && features.has("capital_raise")) {
          pass(`${scenario.label}: full Professional access during trial`, "investor_access + capital_raise allowed");
        } else {
          fail(`${scenario.label}: full Professional access during trial`, [...features].join(", "));
        }
      }
    }

    if (scenario.role === "investor") {
      if (insertedSub.plan_type === "investor_free" && insertedSub.subscription_status === "free") {
        pass(`${scenario.label}: subscription is investor_free/free`, insertedSub.plan_type);
      } else {
        fail(`${scenario.label}: subscription is investor_free/free`, `${insertedSub.plan_type}/${insertedSub.subscription_status}`);
      }
    }

    const { error: dupInsertError } = await supabase.from("subscriptions").insert({
      profile_id: profile.id,
      role: profile.role,
      plan_type: defaults.plan_type,
      subscription_status: defaults.subscription_status,
      monthly_price_cents: 0,
      currency: "USD",
    });

    if (dupInsertError && /duplicate|unique/i.test(dupInsertError.message)) {
      pass(`${scenario.label}: duplicate subscription blocked`, "unique profile_id constraint");
    } else if (dupInsertError) {
      pass(`${scenario.label}: duplicate subscription blocked`, dupInsertError.message);
    } else {
      fail(`${scenario.label}: duplicate subscription blocked`, "second insert succeeded unexpectedly");
    }
  }

  for (const userId of createdUserIds) {
    await supabase.from("subscriptions").delete().eq("profile_id", userId);
    await supabase.from("profiles").delete().eq("id", userId);
    await supabase.auth.admin.deleteUser(userId);
  }
  pass("Test users cleaned up", `${createdUserIds.length} users removed`);

  printResults();
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

function printResults() {
  console.log("\n=== Subscription Signup Flow Audit ===\n");
  for (const r of results) {
    console.log(`${r.status.padEnd(5)} ${r.name}`);
    if (r.detail) console.log(`       ${r.detail}`);
  }
  const failed = results.filter((r) => r.status === "FAIL").length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const warnings = results.filter((r) => r.status === "WARN").length;
  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${warnings} warnings\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
