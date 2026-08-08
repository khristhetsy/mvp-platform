"use client";

// Renders the AI diligence report as a typeset document with a table-of-contents
// rail — the same "preview panel" treatment as the business plan editor. The AI
// narrative arrives as one blob with embedded ALL-CAPS headers (OVERVIEW,
// CURRENT STATUS, RISKS IDENTIFIED, …); we parse those into sections and render
// the missing-documents / next-steps from the structured arrays.
import { useMemo } from "react";

type Section = { id: string; heading: string; body: string };

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

// Pull leading ALL-CAPS tokens (len ≥ 2) as the heading, rest as the body.
function splitHeading(block: string): { heading: string; body: string } {
  const tokens = block.split(/\s+/);
  const head: string[] = [];
  let i = 0;
  for (; i < tokens.length && head.length < 6; i++) {
    if (tokens[i].length >= 2 && /^[A-Z][A-Z&/'’-]+$/.test(tokens[i])) head.push(tokens[i]);
    else break;
  }
  if (head.length >= 1 && i < tokens.length) {
    return { heading: titleCase(head.join(" ")), body: tokens.slice(i).join(" ").trim() };
  }
  return { heading: "", body: block };
}

function parseSections(text: string | null | undefined): Section[] {
  if (!text?.trim()) return [];
  const blocks = text.split(/\s*---\s*/).map((b) => b.trim()).filter(Boolean);
  const out: Section[] = [];
  for (const block of blocks) {
    const { heading, body } = splitHeading(block);
    if (!body) continue;
    const h = heading || "Summary";
    // The structured arrays render these; drop the narrative duplicates.
    if (/^missing documents?$/i.test(h) || /^(next steps|recommend)/i.test(h)) continue;
    out.push({ id: slug(h) + "-" + out.length, heading: h, body });
  }
  return out;
}

function bodyParts(body: string): string[] {
  // Split "1. …" numbered runs and " - " bullets into separate lines; else one.
  const numbered = body.split(/\s(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean);
  if (numbered.length > 1) return numbered;
  const bullets = body.split(/\s-\s(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
  if (bullets.length > 2) return bullets;
  return [body];
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const IMPORTANT_NOTICE =
  "This summary is a procedural status document only. It reflects what materials are on file and what is outstanding. It does not reflect a completed review of any document's contents. No conclusions about the company's suitability for investment should be drawn from this summary at this stage. All findings are preliminary and subject to material revision upon completion of full document review.";

export function DiligenceReportDocument({
  companyName,
  generatedAt,
  executiveSummary,
  businessOverview,
  financialReview,
  marketReview,
  legalReview,
  teamReview,
  missingDocuments,
  recommendations,
  riskFlags,
}: {
  companyName: string;
  generatedAt: string | null;
  executiveSummary: string | null | undefined;
  businessOverview?: string | null;
  financialReview?: string | null;
  marketReview?: string | null;
  legalReview?: string | null;
  teamReview?: string | null;
  missingDocuments: string[];
  recommendations: string[];
  riskFlags: string[];
}) {
  const sections = useMemo(() => parseSections(executiveSummary), [executiveSummary]);

  // The source document each section is analyzed from — surfaced in the empty
  // state so the founder knows exactly what to upload to fill it.
  const SECTION_SOURCES: Record<string, string> = {
    "business-overview": "Business Plan",
    "financial-review": "Financial Statements",
    "market-review": "Business Plan or Market Research",
    "legal-compliance-review": "Legal or Corporate Documents",
    "team-review": "Team Bios",
  };

  const reviews = [
    { id: "business-overview", label: "Business overview", body: businessOverview },
    { id: "financial-review", label: "Financial review", body: financialReview },
    { id: "market-review", label: "Market review", body: marketReview },
    { id: "legal-compliance-review", label: "Legal & compliance review", body: legalReview },
    { id: "team-review", label: "Team review", body: teamReview },
  ].map((r) => {
    const text = r.body && r.body.trim().length > 0 && r.body.trim() !== "Not provided." ? r.body.trim() : null;
    return { ...r, text, provided: Boolean(text), source: SECTION_SOURCES[r.id] };
  });

  const toc: { id: string; label: string; provided?: boolean }[] = [
    { id: "important-notice", label: "Important notice" },
    ...sections.map((s) => ({ id: s.id, label: s.heading })),
    ...reviews.map((r) => ({ id: r.id, label: r.label, provided: r.provided })),
    { id: "risk-flags", label: "Risk flags" },
    ...(missingDocuments.length ? [{ id: "missing-documents", label: "Missing documents" }] : []),
    ...(recommendations.length ? [{ id: "next-steps", label: "Next steps" }] : []),
  ];

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[190px_1fr]">
      {/* TOC rail */}
      <nav className="self-start lg:sticky lg:top-4">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Contents</p>
        <div className="space-y-0.5">
          {toc.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <span className="min-w-0 truncate">{item.label}</span>
              {item.provided === true ? (
                <span className="flex-none text-emerald-600" title="Analyzed" aria-label="Analyzed">✓</span>
              ) : item.provided === false ? (
                <span className="flex-none text-slate-300" title="Pending" aria-label="Pending">○</span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      {/* Document */}
      <article className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#2E78F5]">Diligence report</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0c2340]">{companyName}</h1>
        {generatedAt && <p className="mt-0.5 text-xs text-slate-400">Generated {generatedAt} · Preliminary</p>}

        <div id="important-notice" className="scroll-mt-4">
          <p className="mb-2 mt-7 font-mono text-[10px] uppercase tracking-[0.09em] text-[#2E78F5]">Important notice</p>
          <p className="mt-1.5 text-sm leading-6 text-slate-700">{IMPORTANT_NOTICE}</p>
        </div>

        {sections.map((s) => (
          <div key={s.id} id={s.id} className="scroll-mt-4">
            <p className="mb-2 mt-7 font-mono text-[10px] uppercase tracking-[0.09em] text-[#2E78F5]">{s.heading}</p>
            {bodyParts(s.body).map((p, i) => (
              <p key={i} className="mt-1.5 text-sm leading-6 text-slate-700">{p}</p>
            ))}
          </div>
        ))}

        {reviews.map((r) => (
          <div key={r.id} id={r.id} className="scroll-mt-4">
            <p className="mb-2 mt-7 font-mono text-[10px] uppercase tracking-[0.09em] text-[#2E78F5]">{r.label}</p>
            {r.provided ? (
              bodyParts(r.text!).map((p, i) => (
                <p key={i} className="mt-1.5 text-sm leading-6 text-slate-700">{p}</p>
              ))
            ) : (
              <div className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
                <span aria-hidden="true" className="text-slate-400">📄</span>
                <span className="text-[13px] text-slate-500">
                  Not yet analyzed — add a <b className="font-medium text-slate-700">{r.source}</b> to populate this section.
                </span>
              </div>
            )}
          </div>
        ))}

        <div id="risk-flags" className="scroll-mt-4">
          <p className="mb-2 mt-7 font-mono text-[10px] uppercase tracking-[0.09em] text-[#2E78F5]">Risk flags</p>
          {riskFlags.length === 0 ? (
            <p className="mt-1.5 text-sm italic text-slate-400">None recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {riskFlags.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 text-amber-500">▲</span>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>

        {missingDocuments.length > 0 && (
          <div id="missing-documents" className="scroll-mt-4">
            <p className="mb-2 mt-7 font-mono text-[10px] uppercase tracking-[0.09em] text-[#2E78F5]">Missing documents</p>
            <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {missingDocuments.map((doc) => (
                <div key={doc} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="text-rose-500">✕</span>
                  {doc}
                </div>
              ))}
            </div>
          </div>
        )}

        {recommendations.length > 0 && (
          <div id="next-steps" className="scroll-mt-4">
            <p className="mb-2 mt-7 font-mono text-[10px] uppercase tracking-[0.09em] text-[#2E78F5]">Next steps</p>
            <ol className="space-y-1.5">
              {recommendations.map((rec, i) => (
                <li key={rec} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#2E78F5] text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  {rec.replace(/^\d+\.\s*/, "")}
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="mt-8 border-t border-slate-100 pt-4 text-[11px] leading-5 text-slate-400">
          Informational only — not investment advice, a recommendation, or a guarantee of funding. Findings are
          preliminary and based on the documents currently on file.
        </p>
      </article>
    </section>
  );
}
