import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskEditRow } from "@/components/sales/TaskEditRow";

const staff = [{ id: "u1", name: "Johnny Rivera" }, { id: "u2", name: "Khris Thetsy" }];
const task = { id: "t1", title: "Schedule follow up meeting", task_type: "Call", due_date: "2026-10-08", assignee_id: "u1" };
const html = (t = task) => renderToStaticMarkup(createElement(TaskEditRow, { task: t, staff, onSaved: () => undefined, onCancel: () => undefined }));

describe("Edit task row", () => {
  it("opens with the task's current title, type, due date and assignee", () => {
    const h = html();
    expect(h).toContain('value="Schedule follow up meeting"');
    expect(h).toContain('value="2026-10-08"');
    expect(h).toMatch(/<option selected="">Call<\/option>|<option value="Call" selected="">|selected[^>]*>Call</);
    expect(h).toMatch(/<option value="u1" selected="">Johnny Rivera<\/option>/);
  });

  it("keeps a type that is not in the usual list selectable", () => {
    expect(html({ ...task, task_type: "Odoo meeting" })).toContain("Odoo meeting");
  });

  it("starts unassigned when the task has no assignee", () => {
    expect(html({ ...task, assignee_id: null })).toMatch(/<option value="" selected="">Unassigned<\/option>/);
  });
});
