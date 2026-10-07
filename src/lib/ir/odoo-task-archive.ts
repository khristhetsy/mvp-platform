/**
 * Archive / unarchive Investor Relations tasks in Odoo (project.task.active), so an Odoo
 * task archived or deleted in iCapOS isn't brought back by the next Odoo import, which
 * only reads active Odoo tasks. Best effort: returns how many Odoo tasks it couldn't reach.
 */
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";

export async function setOdooTasksActive(odooTaskIds: number[], active: boolean): Promise<{ failed: number }> {
  const ids = [...new Set(odooTaskIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return { failed: 0 };
  if (!odooConfigured()) return { failed: ids.length };
  try {
    await executeKw("project.task", "write", [ids, { active }]);
    return { failed: 0 };
  } catch {
    return { failed: ids.length };
  }
}
