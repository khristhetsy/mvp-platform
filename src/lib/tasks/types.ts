export type TaskStatus   = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type TaskContext  = "personal" | "company" | "deal" | "internal" | "marketing_plan";
export type TaskCategory = "marketing" | "ir_dept" | "admin_dept" | "sales_dept";
export type TaskType     = "learning" | "operations" | "investor_outreach" | "deal_diligence";

export interface Task {
  id:                      string;
  title:                   string;
  description:             string | null;
  created_by:              string;
  assigned_to:             string | null;
  status:                  TaskStatus;
  priority:                TaskPriority;
  due_date:                string | null;
  context_type:            TaskContext | null;
  context_id:              string | null;
  task_category:           TaskCategory | null;
  task_type:               TaskType | null;
  google_calendar_event_id: string | null;
  created_at:              string;
  updated_at:              string;
}

export interface CreateTaskInput {
  title:         string;
  description?:  string;
  assigned_to?:  string | null;
  priority?:     TaskPriority;
  due_date?:     string | null;
  context_type?: TaskContext;
  context_id?:   string;
  task_category?: TaskCategory | null;
  task_type?:     TaskType | null;
}

export interface UpdateTaskInput {
  title?:                    string;
  description?:              string | null;
  assigned_to?:              string | null;
  status?:                   TaskStatus;
  priority?:                 TaskPriority;
  due_date?:                 string | null;
  task_category?:            TaskCategory | null;
  task_type?:                TaskType | null;
  google_calendar_event_id?: string | null;
}

/** Lightweight profile used in assignee dropdowns */
export interface InternalUser {
  id:        string;
  full_name: string | null;
  email:     string | null;
  role:      string;
}
