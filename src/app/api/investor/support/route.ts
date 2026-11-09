// Investors share the founder support handlers: same tickets, same queue, same assistant.
// They sit under /api/investor/ because the proxy only lets investors reach that zone.
export const dynamic = "force-dynamic";
export { GET, POST } from "@/app/api/founder/support/route";
