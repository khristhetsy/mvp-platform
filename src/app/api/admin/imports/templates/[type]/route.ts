import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api/admin";
import { buildImportTemplateCsv, getTemplateFilename } from "@/lib/imports/templates";
import type { ImportType } from "@/lib/imports/types";
import { IMPORT_TYPES } from "@/lib/imports/types";

type RouteContext = { params: Promise<{ type: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireStaffApi(["admin", "analyst"]);
  if ("error" in auth) {
    return auth.error;
  }

  const { type } = await context.params;
  if (!IMPORT_TYPES.includes(type as ImportType)) {
    return NextResponse.json({ error: "Unknown import template type." }, { status: 404 });
  }

  const importType = type as ImportType;
  const csv = buildImportTemplateCsv(importType);
  const filename = getTemplateFilename(importType);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
