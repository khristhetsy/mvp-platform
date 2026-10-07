import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCopyWithMaster } from "@/lib/email/masters-queries";
import { renderSlotValue } from "@/lib/email/template-merge";
import { splitLines, splitParagraphs } from "@/lib/email/condense";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Investment overview · iCFO Capital Global", robots: { index: false, follow: false } };

const NAVY = "#0A1A40";
const BLUE = "#1A6CE4";

/** Escaped, formatted HTML from the same renderers the email uses. */
function Html({ html, className }: Readonly<{ html: string; className?: string }>) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function More({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <details className="group mt-1">
      <summary className="cursor-pointer list-none text-sm font-semibold" style={{ color: BLUE }}>
        <span className="group-open:hidden">{label} ▾</span>
        <span className="hidden group-open:inline">Show less ▴</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/**
 * Full overview page for a condensed deal introduction email (linked from the
 * email's "Read the full overview"). Public by link: the copy id is a random
 * uuid. Archived copies and other masters are not served.
 */
export default async function DealOverviewPage({ params }: Readonly<{ params: Promise<{ copyId: string }> }>) {
  const { copyId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(copyId)) notFound();
  const copy = await getCopyWithMaster(copyId).catch(() => null);
  if (!copy || copy.status === "archived" || copy.master.name !== "Deal introduction") notFound();

  const v = copy.slot_values ?? {};
  const val = (k: string) => (v[k] ?? "").trim();
  const paras = splitParagraphs(val("body"));
  const items = splitLines(val("considerations"));
  const photo = renderSlotValue(val("sender_photo"), "image");
  const hero = renderSlotValue(val("hero_image"), "image");
  const cta = renderSlotValue(val("cta_url"), "url");

  return (
    <main className="min-h-screen bg-[#F6F8FC] px-4 py-8 text-[15px] leading-relaxed text-[#16223F]">
      <article className="mx-auto max-w-[640px] overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="px-6 py-4" style={{ borderBottom: `4px solid ${NAVY}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/email/icfo-logo.png" alt="iCFO Capital Global, Inc." width={110} />
        </header>
        {hero && hero !== "#" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt={val("company_name")} className="block h-auto w-full" />
        ) : null}

        <div className="px-6 pb-6 pt-6">
          <h1 className="mb-4 text-[22px] font-bold leading-tight" style={{ color: NAVY }}>
            {val("headline")}
          </h1>

          {paras.length > 0 ? <Html html={renderSlotValue(paras[0], "richtext")} /> : null}
          {paras.length > 1 ? (
            <More label={`Show ${paras.length - 1} more ${paras.length - 1 === 1 ? "paragraph" : "paragraphs"}`}>
              <Html html={renderSlotValue(paras.slice(1).join("\n\n"), "richtext")} />
            </More>
          ) : null}

          {items.length > 0 ? (
            <section className="mt-6">
              <h2 className="mb-2 text-base font-bold" style={{ color: BLUE }}>
                {val("considerations_title") || "Highlights"}
              </h2>
              <Html html={renderSlotValue(items.slice(0, 3).join("\n"), "list")} />
              {items.length > 3 ? (
                <More label={`Show ${items.length - 3} more`}>
                  <Html html={renderSlotValue(items.slice(3).join("\n"), "list")} />
                </More>
              ) : null}
            </section>
          ) : null}

          {val("terms") ? (
            <section className="mt-6">
              <h2 className="mb-2 text-base font-bold" style={{ color: BLUE }}>
                {val("terms_title") || "Terms"}
              </h2>
              <Html html={renderSlotValue(val("terms"), "terms")} />
            </section>
          ) : null}

          <section className="mt-6">
            {val("cta_intro") ? <p className="mb-3">{val("cta_intro")}</p> : null}
            {cta && cta !== "#" ? (
              <a
                href={cta}
                className="inline-block rounded-lg px-5 py-2.5 text-[15px] font-bold text-white"
                style={{ background: BLUE }}
              >
                {val("cta_text") || "Schedule a conversation"}
              </a>
            ) : null}
          </section>
        </div>

        <section className="flex gap-4 border-t border-[#E6EAF2] px-6 py-5 text-sm">
          {photo && photo !== "#" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={val("sender_name")} width={72} height={72} className="h-[72px] w-[72px] shrink-0 rounded-full object-cover" />
          ) : null}
          <div className="min-w-0">
            <div>
              <span className="font-bold" style={{ color: NAVY }}>{val("sender_name")}</span>
              {val("sender_title") ? <span style={{ color: BLUE }}> · {val("sender_title")}</span> : null}
            </div>
            <div>
              {[val("sender_phone"), val("sender_email")].filter(Boolean).join(" · ")}
            </div>
            {val("sender_bio") ? (
              <More label="Show bio">
                <p className="italic text-[#5A6B8C]">{val("sender_bio")}</p>
              </More>
            ) : null}
          </div>
        </section>

        <footer className="bg-[#F6F8FC] px-6 py-5 text-center text-[11px] leading-relaxed text-[#5A6B8C]">
          iCFO Capital Global, Inc. · 4225 Executive Sq Ste 600, La Jolla, CA 92037
          <br />
          iCFO Capital Global, Inc. does not solicit securities and is not an investment adviser, broker-dealer, or
          funding portal. This content is for educational purposes only. It is not an offer to sell or a solicitation of
          an offer to buy any security, and no assurance of funding is offered or implied.
        </footer>
      </article>
    </main>
  );
}
