import { arrayMove } from "@dnd-kit/sortable";

export function reorderByIndex<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return [...items];
  }
  return arrayMove([...items], fromIndex, toIndex);
}

export function reorderByStableId<T extends { id: string }>(
  items: readonly T[],
  activeId: string,
  overId: string,
): T[] {
  const fromIndex = items.findIndex((item) => item.id === activeId);
  const toIndex = items.findIndex((item) => item.id === overId);
  return reorderByIndex(items, fromIndex, toIndex);
}

export function findSortableIndex<T extends { id: string }>(items: readonly T[], id: string) {
  return items.findIndex((item) => item.id === id);
}
