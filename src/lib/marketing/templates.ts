import { marketingDb } from "./db";
import { stripHtmlComments } from "./send";
import type { MarketingTemplate } from "./types";

// Remove HTML author comments from a template's body before it's stored, so notes
// like "<!-- to add more; delete to remove … -->" never persist or render.
function cleanTemplateInput<T extends Partial<MarketingTemplate>>(input: T): T {
  if (typeof input.html_body === "string") {
    return { ...input, html_body: stripHtmlComments(input.html_body) };
  }
  return input;
}

export async function getTemplates(): Promise<MarketingTemplate[]> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MarketingTemplate[];
}

export async function getTemplate(id: string): Promise<MarketingTemplate | null> {
  const db = await marketingDb();
  const { data } = await db
    .from("marketing_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data as MarketingTemplate | null;
}

export async function createTemplate(
  input: Partial<MarketingTemplate>,
  createdBy?: string
): Promise<MarketingTemplate> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_templates")
    .insert({ ...cleanTemplateInput(input), ...(createdBy ? { created_by: createdBy } : {}) })
    .select()
    .single();
  if (error) throw error;
  return data as MarketingTemplate;
}

export async function updateTemplate(
  id: string,
  input: Partial<MarketingTemplate>
): Promise<MarketingTemplate> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_templates")
    .update({ ...cleanTemplateInput(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as MarketingTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await marketingDb();
  const { error } = await db.from("marketing_templates").delete().eq("id", id);
  if (error) throw error;
}

export const SEED_TEMPLATES = [
  {
    name: "ICFO Warm — Investability Rating",
    subject: "Your portfolio companies may already qualify",
    preview_text: "We score startups across 13 investor-readiness factors",
    status: "active" as const,
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.7;">
<p>Hi {{first_name}},</p>
<p>I wanted to reach out because I think there's something genuinely useful here for family offices doing early-stage deal flow.</p>
<p>We built <strong>iCapOS</strong> — a platform that scores startups across 13 investment-readiness factors, giving investors a clear signal before they spend time on due diligence.</p>
<p>Think of it as a pre-diligence filter: you see an investability rating from 0–100, broken down by team, market, financials, exit potential, and more — all based on the company's actual documents and data.</p>
<p>We're offering a <strong>free company rating</strong> so you can see the depth of insight before committing to anything.</p>
<p><a href="{{cta_url}}" style="display:inline-block;background:#2E78F5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500;">Get a free rating →</a></p>
<p>Happy to walk you through it if you'd prefer a quick call.</p>
<p>Best,<br>The iCapOS Team</p>
</div>`,
    text_body: `Hi {{first_name}},

We built iCapOS — a platform that scores startups across 13 investment-readiness factors.

We're offering a free company rating: {{cta_url}}

Best,
The iCapOS Team`,
  },
  {
    name: "Cold intro — iCapOS platform",
    subject: "Better deal flow intel — 2 min read",
    preview_text: "Score any startup before spending time on diligence",
    status: "draft" as const,
    html_body: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.7;">
<p>Hi {{first_name}},</p>
<p>Quick intro — I'm reaching out because {{company}} is the kind of investor iCapOS was built for.</p>
<p>iCapOS gives you a real-time <strong>investability score</strong> for any startup — built on 13 diligence factors, no AI hallucinations, just structured data from the company's own documents.</p>
<ul style="padding-left:20px;">
  <li>Save 4–6 hours per company on early screening</li>
  <li>Identify deal-breakers before taking a meeting</li>
  <li>Track portfolio companies over time</li>
</ul>
<p><a href="{{cta_url}}" style="display:inline-block;background:#2E78F5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500;">See a sample report →</a></p>
<p>Worth 10 minutes?</p>
<p>Best,<br>The iCapOS Team</p>
</div>`,
    text_body: `Hi {{first_name}},

iCapOS gives investors a real-time investability score for any startup.

See a sample report: {{cta_url}}

Best,
The iCapOS Team`,
  },
];
