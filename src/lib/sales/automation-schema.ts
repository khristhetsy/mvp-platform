import { z } from "zod";
import { TRIGGER_KEYS } from "@/lib/sales/automation-core";

export const ruleSchema = z.object({
  stageId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  action: z.enum(["create", "move"]),
  triggers: z.array(z.enum(TRIGGER_KEYS as [string, ...string[]])).min(1).max(6),
  matchMode: z.enum(["any", "all"]),
  mode: z.enum(["ask", "auto"]),
  waitDays: z.number().int().min(0).max(90),
  fromStageIds: z.array(z.string().uuid()).max(20),
  enabled: z.boolean(),
});

export function toRow(r: z.infer<typeof ruleSchema>) {
  return {
    stage_id: r.stageId, name: r.name, action: r.action, triggers: r.triggers, match_mode: r.matchMode,
    mode: r.mode, wait_days: r.waitDays, from_stage_ids: r.fromStageIds, enabled: r.enabled,
  };
}
