import type { MessageThreadListItem } from "@/lib/messaging/types";
import { useTranslations } from "next-intl";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function AdminMessageThreadsPanel({
  threads,
}: Readonly<{ threads: MessageThreadListItem[] }>) {
  const t = useTranslations("sharedCmp");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">{t("message_threads")}</h2>
        <p className="text-sm text-slate-500">
          Founder–investor conversations, intro context, and meeting status (read-only).
        </p>
      </div>
      {threads.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-600">{t("no_message_threads_yet")}</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {threads.map((thread) => (
            <article key={thread.id} className="px-5 py-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-950">{thread.company_name ?? "Company"}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {thread.status}
                </span>
                {thread.meeting_status ? (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                    Meeting: {thread.meeting_status}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-slate-600">
                Founder: {thread.founder_name ?? "—"} · Investor: {thread.investor_name ?? "—"}
              </p>
              {thread.last_message_preview ? (
                <p className="mt-2 line-clamp-2 text-slate-600">{thread.last_message_preview}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-400">
                Updated {formatDate(thread.updated_at)}
                {thread.intro_request_id ? " · Linked intro request" : ""}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
