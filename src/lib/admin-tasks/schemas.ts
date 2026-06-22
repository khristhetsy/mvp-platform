import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(["todo", "in_progress", "review", "done"]).default("todo"),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  assigneeId: z.string().uuid().nullable().optional(),
  ownerLabel: z.string().max(60).nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  visibility: z.enum(["admin_only", "admin_assigned"]).default("admin_only"),
  tags: z.array(z.string().max(40)).max(12).default([]),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  position: z.number().optional(),
});

export const commentSchema = z.object({ text: z.string().min(1).max(2000) });

export const listQuerySchema = z.object({
  status: z.enum(["todo", "in_progress", "review", "done"]).optional(),
  assignee: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
