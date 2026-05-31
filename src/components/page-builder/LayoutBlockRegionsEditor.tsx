"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { createBlock, getBlockDefinition } from "@/lib/page-builder/blocks";
import {
  REGION_CHILD_BLOCK_TYPES,
  getLayoutRegionDescriptors,
  getRegionBlocks,
  isLayoutBlockType,
  moveBlockInLayout,
  regionDropId,
  setRegionBlocks,
  type RegionChildBlockType,
} from "@/lib/page-builder/layout-blocks";
import type { PageBlock, PageBlockType } from "@/lib/page-builder/types";

function RegionDropZone({
  layoutBlockId,
  regionKey,
  isOver,
  children,
}: Readonly<{
  layoutBlockId: string;
  regionKey: string;
  isOver: boolean;
  children: ReactNode;
}>) {
  const { setNodeRef, isOver: droppableOver } = useDroppable({
    id: regionDropId(layoutBlockId, regionKey),
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[88px] rounded-lg border border-dashed p-2 transition ${
        isOver || droppableOver
          ? "border-[var(--gold)] bg-[var(--gold-muted)]/40 ring-1 ring-[var(--gold)]/30"
          : "border-slate-200 bg-[var(--surface-sunken)]/60"
      }`}
    >
      {children}
    </div>
  );
}

function SortableRegionBlock({
  block,
  selectedBlockId,
  onSelect,
  onRemove,
}: Readonly<{
  block: PageBlock;
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}>) {
  const def = getBlockDefinition(block.type);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] ${
        selectedBlockId === block.id ? "border-[var(--navy)] bg-[var(--navy-muted)]" : "border-slate-200 bg-white"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="cursor-grab touch-none p-0.5 text-slate-400 active:cursor-grabbing"
        aria-label={`Drag ${def?.label ?? block.type}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" aria-hidden />
      </button>
      <button type="button" className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => onSelect(block.id)}>
        {def?.label ?? block.type}
      </button>
      <button type="button" aria-label="Remove block" className="text-red-600" onClick={() => onRemove(block.id)}>
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function LayoutBlockRegionsEditor({
  layoutBlock,
  selectedBlockId,
  disabled,
  onChange,
  onSelectBlock,
}: Readonly<{
  layoutBlock: PageBlock;
  selectedBlockId: string | null;
  disabled?: boolean;
  onChange: (block: PageBlock) => void;
  onSelectBlock: (blockId: string) => void;
}>) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const regions = useMemo(() => {
    if (!isLayoutBlockType(layoutBlock.type)) return [];
    return getLayoutRegionDescriptors(layoutBlock).map((region) => ({
      ...region,
      blocks: getRegionBlocks(layoutBlock, region.key),
    }));
  }, [layoutBlock]);

  const allChildIds = useMemo(() => regions.flatMap((region) => region.blocks.map((b) => b.id)), [regions]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeBlock = activeId ? regions.flatMap((r) => r.blocks).find((b) => b.id === activeId) : null;

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (disabled || !event.over) return;
    const activeBlockId = String(event.active.id);
    const overId = String(event.over.id);
    if (activeBlockId === overId) return;
    onChange(moveBlockInLayout(layoutBlock, activeBlockId, overId));
  };

  const addChild = (regionKey: string, type: RegionChildBlockType) => {
    const child = createBlock(type);
    const next = setRegionBlocks(layoutBlock, regionKey, [...getRegionBlocks(layoutBlock, regionKey), child]);
    onChange(next);
    onSelectBlock(child.id);
  };

  const removeChild = (regionKey: string, blockId: string) => {
    const next = setRegionBlocks(
      layoutBlock,
      regionKey,
      getRegionBlocks(layoutBlock, regionKey).filter((b) => b.id !== blockId),
    );
    onChange(next);
  };

  const gridClass =
    layoutBlock.type === "columns_3"
      ? "grid gap-3 md:grid-cols-3"
      : layoutBlock.type === "sidebar_layout"
        ? "grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]"
        : layoutBlock.type === "metric_grid"
          ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          : "grid gap-3 md:grid-cols-2";

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Drag blocks between regions or use add buttons. Layout nesting is limited to one level.</p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }: DragStartEvent) => setActiveId(String(active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={allChildIds} strategy={verticalListSortingStrategy} disabled={disabled}>
          <div className={gridClass}>
            {regions.map((region) => (
              <div key={region.key} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--navy)]">{region.label}</p>
                  <select
                    className="max-w-[140px] rounded-md border border-slate-200 px-1.5 py-1 text-[10px]"
                    defaultValue=""
                    disabled={disabled}
                    onChange={(e) => {
                      const type = e.target.value as RegionChildBlockType;
                      if (!type) return;
                      addChild(region.key, type);
                      e.currentTarget.value = "";
                    }}
                  >
                    <option value="">Add block…</option>
                    {REGION_CHILD_BLOCK_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {getBlockDefinition(type as PageBlockType)?.label ?? type}
                      </option>
                    ))}
                  </select>
                </div>

                <RegionDropZone layoutBlockId={layoutBlock.id} regionKey={region.key} isOver={Boolean(activeId)}>
                  <div className="space-y-1.5">
                    {region.blocks.length === 0 ? (
                      <p className="py-4 text-center text-[11px] text-slate-500">Drop block here</p>
                    ) : (
                      region.blocks.map((child) => (
                        <SortableRegionBlock
                          key={child.id}
                          block={child}
                          selectedBlockId={selectedBlockId}
                          onSelect={onSelectBlock}
                          onRemove={(id) => removeChild(region.key, id)}
                        />
                      ))
                    )}
                  </div>
                </RegionDropZone>

                <button
                  type="button"
                  disabled={disabled}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                  onClick={() => addChild(region.key, "text_section")}
                >
                  <Plus className="h-3 w-3" aria-hidden />
                  Add text block
                </button>
              </div>
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeBlock ? (
            <div className="flex items-center gap-2 rounded-md border border-[var(--gold)] bg-white px-2 py-1.5 text-[11px] font-medium text-[var(--navy)] shadow-lg">
              <GripVertical className="h-3 w-3 text-slate-400" aria-hidden />
              {getBlockDefinition(activeBlock.type)?.label ?? activeBlock.type}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
