/** Note log and Tasks on the founder contact page. Client safe. */
import type { ReminderKind } from "@/lib/reminders/types";

export type ContactNote = {
  id: string;
  body: string;
  pinned: boolean;
  created_at: string;
};

/** A task is one of the founder's own reminders, linked to this contact. */
export type ContactTask = {
  id: string;
  title: string;
  kind: ReminderKind;
  due_at: string;
  done_at: string | null;
};
