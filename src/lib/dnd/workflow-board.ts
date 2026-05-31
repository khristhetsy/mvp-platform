/** Shared identifiers for future enterprise workflow boards (Phase 2+). */
export type WorkflowBoardColumnId = string;
export type WorkflowBoardItemId = string;

export type WorkflowBoardColumn = {
  id: WorkflowBoardColumnId;
  title: string;
  description?: string;
};

/** Minimal item shape for kanban-style boards (investor pipeline, admin review queue, SPV workflow). */
export type WorkflowBoardItem = {
  id: WorkflowBoardItemId;
  columnId: WorkflowBoardColumnId;
  title: string;
  subtitle?: string;
};

export type WorkflowBoardLayout = {
  boardId: string;
  columns: WorkflowBoardColumn[];
  items: WorkflowBoardItem[];
};

/** Reserved board keys — wire DnD columns/items in a later phase. */
export const WORKFLOW_BOARD_IDS = {
  investorPipeline: "investor-pipeline",
  adminReviewQueue: "admin-review-queue",
  spvWorkflow: "spv-workflow",
} as const;

export type WorkflowBoardId = (typeof WORKFLOW_BOARD_IDS)[keyof typeof WORKFLOW_BOARD_IDS];

export function groupWorkflowItemsByColumn(layout: WorkflowBoardLayout) {
  const grouped = new Map<WorkflowBoardColumnId, WorkflowBoardItem[]>();
  for (const column of layout.columns) {
    grouped.set(column.id, []);
  }
  for (const item of layout.items) {
    const list = grouped.get(item.columnId);
    if (list) list.push(item);
    else grouped.set(item.columnId, [item]);
  }
  return grouped;
}
