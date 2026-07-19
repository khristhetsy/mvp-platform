import { addUnsubscribe, verifyUnsubscribeToken } from "@/lib/outreach/unsubscribe";

export const dynamic = "force-dynamic";

function page(title: string, message: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f5f9;color:#1a1f2e">
<div style="max-width:460px;margin:80px auto;background:#fff;border:1px solid #e6e9f0;border-radius:14px;padding:28px 30px;text-align:center">
  <div style="font-weight:800;font-size:18px;color:#1e2a5a;margin-bottom:8px">iCapOS</div>
  <h1 style="font-size:18px;margin:0 0 8px">${title}</h1>
  <p style="font-size:14px;line-height:1.6;color:#5b6478;margin:0">${message}</p>
</div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const email = url.searchParams.get("e");
  const token = url.searchParams.get("t");

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return page("Invalid unsubscribe link", "This unsubscribe link is invalid or has expired. If you continue to receive messages, reply to any email and we'll remove you.");
  }

  await addUnsubscribe(email);
  return page("You're unsubscribed", "You won't receive further introduction emails from iCapOS. It may take a moment to take effect across in-flight sends.");
}
