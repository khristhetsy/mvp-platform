import type { CollaborationCommentView } from "@/lib/collaboration/types";
import { CollaborationVisibilityBadge } from "@/components/collaboration/CollaborationVisibilityBadge";

export function CollaborationCommentList({ comments }: Readonly<{ comments: CollaborationCommentView[] }>) {
  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto">
      {comments.map((comment) => (
        <li key={comment.id} className="rounded-lg border border-slate-200/80 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-900">
              {comment.authorName}
              <span className="ml-1 font-normal text-slate-500">({comment.authorRole})</span>
            </p>
            <CollaborationVisibilityBadge
              visibility={comment.visibility}
              isInternalNote={comment.isInternalNote}
            />
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{comment.body}</p>
          {comment.mentions.length > 0 ? (
            <p className="mt-1 text-[10px] text-slate-500">
              Mentions: {comment.mentions.map((m) => `@${m.label}`).join(", ")}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] text-slate-400">
            {new Date(comment.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
