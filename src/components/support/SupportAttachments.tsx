import type { SupportAttachment } from "@/lib/support/support";

/** PDF links on a support message. Each opens through an access check and a short signed link. */
export function SupportAttachments({
  messageId,
  files,
  onDark = false,
}: Readonly<{ messageId: string; files: SupportAttachment[] | null | undefined; onDark?: boolean }>) {
  if (!files?.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {files.map((f, i) => (
        <a
          key={f.path}
          href={`/api/support/attachment?message=${messageId}&i=${i}`}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ${onDark ? "bg-indigo-500 text-white hover:bg-indigo-400" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
        >
          <i className="ti ti-file-type-pdf" aria-hidden="true" /> {f.name}
        </a>
      ))}
    </div>
  );
}
