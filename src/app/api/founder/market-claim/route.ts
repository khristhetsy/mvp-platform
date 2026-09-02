import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { getActiveCompanyForUser } from "@/lib/organizations/active-company";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";
import { getUserPlan } from "@/lib/subscriptions/get-subscription";
import { checkUsage, recordUsage } from "@/lib/ai-usage/service";
import {
  buildMarketClaimSystemPrompt,
  parseMarketClaim,
  normalizeMarketClaim,
  marketClaimFallback,
} from "@/lib/founder/market-claim";

// Grading a deck with Sonnet is the same class of call as the pitch-deck analyzer, so
// it shares that feature's usage cap (both read the founder's deck with Sonnet).
const USAGE_FEATURE = "pitch_deck_analyzer";

export const maxDuration = 300;
const ANTHROPIC_TIMEOUT_MS = 280_000;

function describeFailure(input: { status?: number; detail?: string; err?: unknown }): string {
  const { status, detail, err } = input;
  if (err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"))) {
    return "this deck took too long to grade — try a lighter PDF and run it again";
  }
  if (status === 401 || status === 403) return "the AI service rejected our credentials — an admin needs to check the ANTHROPIC_API_KEY";
  if (status === 429) return "the AI service is rate-limited right now — wait a moment and try again";
  if (status === 413 || status === 400) return "this deck couldn't be processed — it may be too large; try a lighter PDF";
  if (status === 500 || status === 503 || status === 529) return "the AI service is temporarily overloaded — please try again in a minute";
  if (status) return `the AI service returned an error (${status}) — please try again`;
  const raw = (detail ?? (err instanceof Error ? err.message : "")).trim();
  return raw ? `the AI request failed — ${raw.slice(0, 160)}` : "the AI request failed — please try again";
}

// POST /api/founder/market-claim — grade the founder's market claim from their latest deck.
export async function POST() {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const supabase = await createServerSupabaseClient();
  const { company } = await getActiveCompanyForUser(auth.profile);
  if (!company) return NextResponse.json({ error: "No company linked." }, { status: 400 });

  const { data: doc } = await supabase
    .from("documents")
    .select("id, file_path, file_name, mime_type")
    .eq("company_id", company.id)
    .eq("document_type", "PITCH_DECK")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!doc?.file_path) {
    return NextResponse.json(
      { error: "No pitch deck found. Upload your deck to the data room first — the grader reads its market section." },
      { status: 404 },
    );
  }

  if (!isClaudeConfigured()) {
    return NextResponse.json({ report: marketClaimFallback() });
  }

  const admin = createServiceRoleClient();
  const plan = await getUserPlan(auth.profile.id).catch(() => null);
  const usage = await checkUsage({ profileId: auth.profile.id, plan, feature: USAGE_FEATURE, admin });
  if (!usage.allowed) {
    return NextResponse.json(
      { error: "usage_limit_reached", limit: usage.maxRuns, period: usage.period, used: usage.used, resetAt: usage.resetAt },
      { status: 429 },
    );
  }

  const { data: fileData, error: dlError } = await admin.storage.from("company-documents").download(doc.file_path);
  if (dlError || !fileData) return NextResponse.json({ error: "Unable to retrieve your deck file." }, { status: 500 });

  const base64 = Buffer.from(await fileData.arrayBuffer()).toString("base64");

  const systemPrompt = buildMarketClaimSystemPrompt(
    company.company_name ?? "this company",
    company.industry ?? "",
    company.revenue_stage ?? "",
  );

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error("No API key");

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), ANTHROPIC_TIMEOUT_MS);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      signal: abort.signal,
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_SONNET,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: `Grade the market claim in this deck for ${company.company_name}. Return the JSON only.` },
            ],
          },
        ],
      }),
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[market-claim] Anthropic API ${res.status}:`, detail.slice(0, 500));
      return NextResponse.json({ report: marketClaimFallback(describeFailure({ status: res.status, detail })) });
    }

    const data = (await res.json()) as { content: Array<{ type: string; text: string }>; stop_reason?: string };
    const raw = data.content.find((b) => b.type === "text")?.text?.trim() ?? "";
    const parsed = parseMarketClaim(raw);
    if (!parsed) {
      console.error(`[market-claim] Unparseable reply (stop_reason=${data.stop_reason ?? "?"}, len=${raw.length})`);
      return NextResponse.json({ report: marketClaimFallback("the AI returned a response we couldn't read — please retry") });
    }

    const report = normalizeMarketClaim(parsed);
    await recordUsage({ profileId: auth.profile.id, feature: USAGE_FEATURE, admin });
    return NextResponse.json({
      report,
      deck: { fileName: doc.file_name ?? "your deck" },
      companyName: company.company_name ?? "Your company",
      industry: company.industry ?? null,
      stage: company.revenue_stage ?? null,
    });
  } catch (err) {
    console.error("[market-claim] AI request failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ report: marketClaimFallback(describeFailure({ err })) });
  }
}
