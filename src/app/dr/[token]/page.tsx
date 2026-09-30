import type { Metadata } from "next";
import { canOpenShare, companyDocuments, companyName, loadShareLink, logShareView, normShareEmail } from "@/lib/ir/share-links";

/**
 * Public page for an IR share link (/dr/<token>?e=<investor email>): the company's data room
 * or one term sheet. Only the investors the link was sent to get in, while it is live; every
 * open is logged on the investor's record. Files open through /dr/<token>/d/<id>, which logs
 * the view and hands out a 5 minute signed URL.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared documents · iCapOS", robots: { index: false, follow: false } };

const fmtSize = (n: number | null) => (!n ? "" : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const typeLabel = (t: string | null) => (t ? t.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "Other");

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <div className="mx-auto max-w-2xl">
        <p className="mb-6 text-[13px] font-semibold tracking-wide text-indigo-700">iCapOS</p>
        {children}
        <p className="mt-8 text-[11.5px] text-slate-400">Confidential. Shared by iCFO Capital Global, Inc. for your review only. Please don&rsquo;t forward.</p>
      </div>
    </main>
  );
}

export default async function SharePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> }) {
  const { token } = await params;
  const email = normShareEmail((await searchParams).e);
  const link = await loadShareLink(token);
  const gate = link ? canOpenShare(link, email) : { ok: false as const, reason: "not_recipient" as const };
  if (!link || !gate.ok) {
    const text = !link ? "This link isn't valid." : gate.ok ? "" : gate.reason === "expired" ? "This link has expired. Reply to the email you received and we'll send a new one." : gate.reason === "revoked" ? "This link has been turned off." : "This link only opens from the email it was sent in. Open it from that email, or reply and we'll send you one.";
    return <Shell><div className="rounded-xl border border-slate-200 bg-white p-6"><h1 className="text-[18px] font-semibold">Can&rsquo;t open this link</h1><p className="mt-2 text-[14px] text-slate-600">{text}</p></div></Shell>;
  }
  await logShareView(link, email, "open", null, null);
  const company = (await companyName(link.company_id)) ?? "the company";
  const q = `?e=${encodeURIComponent(email)}`;
  const expires = link.expires_at ? new Date(link.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  if (link.kind === "term_sheet") {
    const docs = link.document_id && link.company_id ? (await companyDocuments(link.company_id)).filter((d) => d.id === link.document_id) : [];
    const name = link.file_name ?? docs[0]?.name ?? "Term sheet";
    const fileId = link.document_id ?? "file";
    return (
      <Shell>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-[20px] font-semibold">Term sheet · {company}</h1>
          <p className="mt-1 text-[13px] text-slate-500">View only{expires ? ` · available until ${expires}` : ""}</p>
          <a href={`/dr/${token}/d/${fileId}${q}`} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-indigo-800">View {name}</a>
        </div>
      </Shell>
    );
  }

  const docs = link.company_id ? await companyDocuments(link.company_id) : [];
  const groups = new Map<string, typeof docs>();
  for (const d of docs) { const k = typeLabel(d.type); groups.set(k, [...(groups.get(k) ?? []), d]); }
  return (
    <Shell>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-[20px] font-semibold">{company} data room</h1>
        <p className="mt-1 text-[13px] text-slate-500">{docs.length} document{docs.length === 1 ? "" : "s"} · view only{expires ? ` · available until ${expires}` : ""}</p>
        {docs.length === 0 ? <p className="mt-5 text-[14px] text-slate-500">No documents are in the data room right now.</p> : [...groups.entries()].map(([g, list]) => (
          <section key={g} className="mt-5">
            <h2 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">{g}</h2>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {list.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 text-[13.5px]">
                  <span className="min-w-0 flex-1 truncate">{d.name}</span>
                  <span className="text-[11.5px] text-slate-400">{fmtSize(d.size)}</span>
                  <a href={`/dr/${token}/d/${d.id}${q}`} className="rounded-md border border-slate-200 px-2.5 py-1 text-[12.5px] font-medium text-indigo-700 hover:bg-indigo-50">View</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Shell>
  );
}
