"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { reorderByStableId } from "@/lib/dnd/reorder";

export type SortableHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  setActivatorNodeRef: ReturnType<typeof useSortable>["setActivatorNodeRef"];
  isDragging: boolean;
};

export type SortableItemRenderState = {
  handleProps: SortableHandleProps;
  isDragging: boolean;
  isOverlay: boolean;
};

export function SortableDragHandle({
  label,
  disabled,
  handleProps,
  className = "",
}: Readonly<{
  label: string;
  disabled?: boolean;
  handleProps: SortableHandleProps;
  className?: string;
}>) {
  return (
    <button
      type="button"
      ref={handleProps.setActivatorNodeRef}
      aria-label={label}
      disabled={disabled}
      className={`cursor-grab touch-none p-0.5 text-slate-400 hover:text-[var(--navy)] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...handleProps.attributes}
      {...handleProps.listeners}
    >
      <GripVertical className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

export function SortableItem({
  id,
  disabled,
  className,
  children,
}: Readonly<{
  id: string;
  disabled?: boolean;
  className?: string;
  children: (state: SortableItemRenderState) => ReactNode;
}>) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleProps: SortableHandleProps = {
    attributes,
    listeners,
    setActivatorNodeRef,
    isDragging,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`list-none rounded-lg transition ${isDragging ? "z-10 opacity-50" : ""} ${className ?? ""}`}
    >
      {children({ handleProps, isDragging, isOverlay: false })}
    </li>
  );
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  disabled,
  className,
  listClassName,
  ariaLabel = "Sortable list",
  renderItem,
  renderOverlay,
}: Readonly<{
  items: T[];
  onReorder: (items: T[]) => void;
  disabled?: boolean;
  className?: string;
  listClassName?: string;
  ariaLabel?: string;
  renderItem: (item: T, index: number, state: SortableItemRenderState) => ReactNode;
  renderOverlay?: (item: T, index: number) => ReactNode;
}>) {
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;
  const activeIndex = activeItem ? items.findIndex((item) => item.id === activeItem.id) : -1;

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (disabled) return;
    setActiveId(active.id);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (disabled || !over || active.id === over.id) return;
    onReorder(reorderByStableId(items, String(active.id), String(over.id)));
  };

  const handleDragCancel = () => setActiveId(null);

  return (
    <div className={className}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy} disabled={disabled}>
          <ul className={listClassName} aria-label={ariaLabel}>
            {items.map((item, index) => (
              <SortableItem key={item.id} id={item.id} disabled={disabled}>
                {(state) => renderItem(item, index, state)}
              </SortableItem>
            ))}
          </ul>
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activeItem && renderOverlay ? renderOverlay(activeItem, activeIndex) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
