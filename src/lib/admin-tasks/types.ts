// Admin Tasks — domain types. Tables aren't in generated Supabase types yet, so
// these mirror the migration (20260622001_admin_tasks.sql).

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "high" | "medium" | "low";
export type TaskVisibility = "admin_only" | "admin_assigned";
export type TaskActivityEvent =
  | "created"
  | "updated"
  | "status_changed"
  | "priority_changed"
  | "attachment_added"
  | "attachment_removed"
  | "comment_added"
  | "archived"
  | "reopened";

export type SourceFormat = "pdf" | "docx" | "pptx";

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "done"];
export const TASK_PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export interface AdminTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  owner_label: string | null;
  due_date: string | null;
  visibility: TaskVisibility;
  tags: string[];
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface AdminTaskAttachment {
  id: string;
  task_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  source_format: SourceFormat;
  converted_to_pdf: boolean;
  original_storage_path: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface AdminTaskActivity {
  id: string;
  task_id: string;
  actor_id: string;
  event_type: TaskActivityEvent;
  payload: Record<string, unknown>;
  comment_text: string | null;
  created_at: string;
}

/** List item augmented with the attachment count (for badges in the list/board). */
export type AdminTaskListItem = AdminTask & { attachment_count: number };

/** Full task view returned by the detail endpoint. */
export interface AdminTaskDetail {
  task: AdminTask;
  attachments: AdminTaskAttachment[];
  activity: AdminTaskActivity[];
}

export const STORAGE_BUCKET = "admin-task-files";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const ACCEPTED_MIME: Record<string, SourceFormat> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};
