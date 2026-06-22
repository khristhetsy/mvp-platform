import { PageBuilderLab } from "@/components/page-builder/PageBuilderLab";
import { requirePageBuilderPage } from "@/lib/api/permissions";

export const dynamic = "force-dynamic";

export default async function PageBuilderLabPage() {
  await requirePageBuilderPage();
  return <PageBuilderLab />;
}
