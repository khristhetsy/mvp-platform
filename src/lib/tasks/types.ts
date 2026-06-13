export type TaskStatus   = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type TaskContext  = "personal" | "company" | "deal" | "internal";

export interface Task {
  id:           string;
  title:        string;
  description:  string | null;
  created_by:   string;
  assigned_to:  string | null;
  status:       TaskStatus;
  priority:     TaskPriority;
  due_date:     string | null;
  context_type: TaskContext | null;
  context_id:   string | null;
  created_at:   string;
  updated_at:   string;
}

export interface CreateTaskInput {
  title:        string;
  description?: string;
  assigned_to?: string | null;
  priority?:    TaskPriority;
  due_date?:    string | null;
  context_type?: TaskContext;
  context_id?:  string;
}

export interface UpdateTaskInput {
  title?:       string;
  description?: string | null;
  assigned_to?: string | null;
  status?:      TaskStatus;
  priority?:    TaskPriority;
  due_date?:    string | null;
}

/** Lightweight profile used in assignee dropdowns */
export interface InternalUser {
  id:        string;
  full_name: string | null;
  email:     string | null;
  role:      string;
}
