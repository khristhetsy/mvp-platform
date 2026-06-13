import { requireRole } from "@/lib/supabase/auth";
import { getContacts, getLists } from "@/lib/marketing/contacts";
import { ContactsTable } from "./ContactsTable";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ search?: string; list_id?: string; tag?: string; page?: string }>;
}

export default async function MarketingContactsPage({ searchParams }: Props) {
  await requireRole(["admin"]);

  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const [{ contacts, total }, lists] = await Promise.all([
    getContacts({ search: params.search, list_id: params.list_id, tag: params.tag, limit, offset }),
    getLists(),
  ]);

  return (
    <ContactsTable
      contacts={contacts}
      lists={lists}
      total={total}
      page={page}
      limit={limit}
      currentSearch={params.search ?? ""}
      currentListId={params.list_id ?? ""}
      currentTag={params.tag ?? ""}
    />
  );
}
