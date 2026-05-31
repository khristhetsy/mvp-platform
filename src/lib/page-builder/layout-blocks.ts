import type { PageBlock, PageBlockType } from "@/lib/page-builder/types";

export const LAYOUT_BLOCK_TYPES = ["columns_2", "columns_3", "sidebar_layout", "metric_grid"] as const;

export type LayoutBlockType = (typeof LAYOUT_BLOCK_TYPES)[number];

/** Content blocks allowed inside layout regions (no nested layouts). */
export const REGION_CHILD_BLOCK_TYPES = [
  "text_section",
  "metric",
  "testimonial",
  "faq",
  "process_steps",
  "logo_cloud",
  "stats_comparison",
  "team",
  "compliance_notice",
  "pricing_plan",
] as const;

export type RegionChildBlockType = (typeof REGION_CHILD_BLOCK_TYPES)[number];

export type LayoutRegionDescriptor = {
  key: string;
  label: string;
};

function asBlockArray(value: unknown): PageBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is PageBlock =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as PageBlock).id === "string" &&
      typeof (item as PageBlock).type === "string",
  );
}

export function isLayoutBlockType(type: PageBlockType | string): type is LayoutBlockType {
  return (LAYOUT_BLOCK_TYPES as readonly string[]).includes(type);
}

export function canPlaceInLayoutRegion(type: PageBlockType | string): type is RegionChildBlockType {
  return (REGION_CHILD_BLOCK_TYPES as readonly string[]).includes(type);
}

export function regionDropId(layoutBlockId: string, regionKey: string) {
  return `region:${layoutBlockId}:${regionKey}`;
}

export function parseRegionDropId(id: string): { layoutBlockId: string; regionKey: string } | null {
  if (!id.startsWith("region:")) return null;
  const parts = id.split(":");
  if (parts.length < 3) return null;
  return { layoutBlockId: parts[1], regionKey: parts.slice(2).join(":") };
}

export function getLayoutRegionDescriptors(block: PageBlock): LayoutRegionDescriptor[] {
  switch (block.type) {
    case "columns_2":
      return [
        { key: "left", label: "Left column" },
        { key: "right", label: "Right column" },
      ];
    case "columns_3":
      return [
        { key: "column_0", label: "Column 1" },
        { key: "column_1", label: "Column 2" },
        { key: "column_2", label: "Column 3" },
      ];
    case "sidebar_layout":
      return [
        { key: "sidebar", label: "Sidebar" },
        { key: "content", label: "Main content" },
      ];
    case "metric_grid":
      return [{ key: "items", label: "Metrics" }];
    default:
      return [];
  }
}

export function getRegionBlocks(block: PageBlock, regionKey: string): PageBlock[] {
  if (!isLayoutBlockType(block.type)) return [];

  if (block.type === "columns_2") {
    if (regionKey === "left") return asBlockArray(block.props.left);
    if (regionKey === "right") return asBlockArray(block.props.right);
    return [];
  }

  if (block.type === "columns_3") {
    const columns = block.props.columns;
    if (!Array.isArray(columns)) return [];
    const index = Number(regionKey.replace("column_", ""));
    if (Number.isNaN(index)) return [];
    return asBlockArray(columns[index]);
  }

  if (block.type === "sidebar_layout") {
    if (regionKey === "sidebar") return asBlockArray(block.props.sidebar);
    if (regionKey === "content") return asBlockArray(block.props.content);
    return [];
  }

  if (block.type === "metric_grid" && regionKey === "items") {
    return asBlockArray(block.props.items);
  }

  return [];
}

export function setRegionBlocks(block: PageBlock, regionKey: string, blocks: PageBlock[]): PageBlock {
  if (!isLayoutBlockType(block.type)) return block;

  if (block.type === "columns_2") {
    if (regionKey === "left") return { ...block, props: { ...block.props, left: blocks } };
    if (regionKey === "right") return { ...block, props: { ...block.props, right: blocks } };
    return block;
  }

  if (block.type === "columns_3") {
    const index = Number(regionKey.replace("column_", ""));
    if (Number.isNaN(index)) return block;
    const columns = Array.isArray(block.props.columns) ? [...(block.props.columns as unknown[])] : [[], [], []];
    while (columns.length < 3) columns.push([]);
    columns[index] = blocks;
    return { ...block, props: { ...block.props, columns } };
  }

  if (block.type === "sidebar_layout") {
    if (regionKey === "sidebar") return { ...block, props: { ...block.props, sidebar: blocks } };
    if (regionKey === "content") return { ...block, props: { ...block.props, content: blocks } };
    return block;
  }

  if (block.type === "metric_grid" && regionKey === "items") {
    return { ...block, props: { ...block.props, items: blocks } };
  }

  return block;
}

export function findRegionForBlockId(layoutBlock: PageBlock, blockId: string): string | null {
  for (const region of getLayoutRegionDescriptors(layoutBlock)) {
    if (getRegionBlocks(layoutBlock, region.key).some((child) => child.id === blockId)) {
      return region.key;
    }
  }
  return null;
}

export function findBlockById(blocks: PageBlock[], blockId: string): PageBlock | null {
  for (const block of blocks) {
    if (block.id === blockId) return block;
    if (isLayoutBlockType(block.type)) {
      for (const region of getLayoutRegionDescriptors(block)) {
        const found = findBlockById(getRegionBlocks(block, region.key), blockId);
        if (found) return found;
      }
    }
  }
  return null;
}

export function updateBlockById(
  blocks: PageBlock[],
  blockId: string,
  updater: (block: PageBlock) => PageBlock,
): PageBlock[] {
  return blocks.map((block) => {
    if (block.id === blockId) return updater(block);
    if (!isLayoutBlockType(block.type)) return block;

    let next = block;
    for (const region of getLayoutRegionDescriptors(block)) {
      const children = getRegionBlocks(next, region.key);
      const nextChildren = updateBlockById(children, blockId, updater);
      if (nextChildren !== children) {
        next = setRegionBlocks(next, region.key, nextChildren);
      }
    }
    return next;
  });
}

export function removeBlockById(blocks: PageBlock[], blockId: string): PageBlock[] {
  return blocks
    .filter((block) => block.id !== blockId)
    .map((block) => {
      if (!isLayoutBlockType(block.type)) return block;
      let next = block;
      for (const region of getLayoutRegionDescriptors(block)) {
        const children = getRegionBlocks(next, region.key);
        const nextChildren = removeBlockById(children, blockId);
        if (nextChildren.length !== children.length) {
          next = setRegionBlocks(next, region.key, nextChildren);
        }
      }
      return next;
    });
}

export function moveBlockInLayout(
  layoutBlock: PageBlock,
  activeBlockId: string,
  overId: string,
): PageBlock {
  const activeRegionKey = findRegionForBlockId(layoutBlock, activeBlockId);
  if (!activeRegionKey) return layoutBlock;

  let overRegionKey = parseRegionDropId(overId)?.regionKey ?? findRegionForBlockId(layoutBlock, overId);
  if (!overRegionKey) return layoutBlock;

  let working = layoutBlock;
  const sourceBlocks = [...getRegionBlocks(working, activeRegionKey)];
  const fromIndex = sourceBlocks.findIndex((b) => b.id === activeBlockId);
  if (fromIndex === -1) return layoutBlock;

  const [moving] = sourceBlocks.splice(fromIndex, 1);
  working = setRegionBlocks(working, activeRegionKey, sourceBlocks);

  const targetBlocks = [...getRegionBlocks(working, overRegionKey)];
  let toIndex = targetBlocks.length;

  if (!overId.startsWith("region:")) {
    const overIndex = targetBlocks.findIndex((b) => b.id === overId);
    if (overIndex >= 0) toIndex = overIndex;
  }

  if (activeRegionKey === overRegionKey && fromIndex < toIndex) {
    toIndex -= 1;
  }

  targetBlocks.splice(toIndex, 0, moving);
  return setRegionBlocks(working, overRegionKey, targetBlocks);
}

export function countAllBlocks(blocks: PageBlock[]): number {
  let count = 0;
  for (const block of blocks) {
    count += 1;
    if (isLayoutBlockType(block.type)) {
      for (const region of getLayoutRegionDescriptors(block)) {
        count += countAllBlocks(getRegionBlocks(block, region.key));
      }
    }
  }
  return count;
}

export function flattenVisibleBlocks(blocks: PageBlock[]): PageBlock[] {
  const out: PageBlock[] = [];
  for (const block of blocks) {
    if (!block.visible) continue;
    out.push(block);
    if (isLayoutBlockType(block.type)) {
      for (const region of getLayoutRegionDescriptors(block)) {
        out.push(...flattenVisibleBlocks(getRegionBlocks(block, region.key)));
      }
    }
  }
  return out;
}

export function normalizeLayoutBlockProps(block: PageBlock): PageBlock {
  if (!isLayoutBlockType(block.type)) return block;

  if (block.type === "columns_2") {
    return {
      ...block,
      props: {
        title: block.props.title ?? "",
        left: asBlockArray(block.props.left),
        right: asBlockArray(block.props.right),
      },
    };
  }

  if (block.type === "columns_3") {
    const raw = block.props.columns;
    const columns = Array.isArray(raw) ? raw.map((col) => asBlockArray(col)) : [[], [], []];
    while (columns.length < 3) columns.push([]);
    return { ...block, props: { title: block.props.title ?? "", columns: columns.slice(0, 3) } };
  }

  if (block.type === "sidebar_layout") {
    return {
      ...block,
      props: {
        title: block.props.title ?? "",
        sidebar: asBlockArray(block.props.sidebar),
        content: asBlockArray(block.props.content),
      },
    };
  }

  if (block.type === "metric_grid") {
    return {
      ...block,
      props: {
        title: block.props.title ?? "",
        items: asBlockArray(block.props.items),
      },
    };
  }

  return block;
}

export function normalizeLayoutBlocks(blocks: PageBlock[]): PageBlock[] {
  return blocks.map((block) => {
    const normalized = normalizeLayoutBlockProps(block);
    if (!isLayoutBlockType(normalized.type)) return normalized;
    let next = normalized;
    for (const region of getLayoutRegionDescriptors(next)) {
      const children = normalizeLayoutBlocks(getRegionBlocks(next, region.key));
      next = setRegionBlocks(next, region.key, children);
    }
    return next;
  });
}
