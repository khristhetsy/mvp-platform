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

export function DiligenceReportDocument({
  companyName,
  generatedAt,
  executiveSummary,
  missingDocuments,
  recommendations,
  riskFlags,
}: {
  companyName: string;
  generatedAt: string | null;
  executiveSummary: string | null | undefined;
  missingDocuments: string[];
  recommendations: string[];
  riskFlags: string[];
}) {
  const sections = useMemo(() => parseSections(executiveSummary), [executiveSummary]);

  const toc: { id: string; label: string }[] = [
    ...sections.map((s) => ({ id: s.id, label: s.heading })),
    ...(riskFlags.length ? [{ id: "risk-flags", label: "Risk flags" }] : []),
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
              className="block w-full rounded-md px-2 py-1.5 text-left text-[13px] text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Document */}
      <article className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#2E78F5]">Diligence report</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0c2340]">{companyName}</h1>
        {generatedAt && <p className="mt-0.5 text-xs text-slate-400">Generated {generatedAt} · Preliminary</p>}

        {sections.map((s) => (
          <div key={s.id} id={s.id} className="scroll-mt-4">
            <p className="mb-2 mt-7 font-mono text-[10px] uppercase tracking-[0.09em] text-[#2E78F5]">{s.heading}</p>
            {bodyParts(s.body).map((p, i) => (
              <p key={i} className="mt-1.5 text-sm leading-6 text-slate-700">{p}</p>
            ))}
          </div>
        ))}

        {riskFlags.length > 0 && (
          <div id="risk-flags" className="scroll-mt-4">
            <p className="mb-2 mt-7 font-mono text-[10px] uppercase tracking-[0.09em] text-[#2E78F5]">Risk flags</p>
            <ul className="space-y-1.5">
              {riskFlags.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 text-amber-500">▲</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

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
