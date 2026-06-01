import { NextResponse } from "next/server";

export function getCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret || null;
}

export function validateCronSecret(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export function cronUnauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export function cronMisconfiguredResponse(): NextResponse {
  return NextResponse.json(
    { error: "Cron is not configured. Set CRON_SECRET in the deployment environment." },
    { status: 503 },
  );
}
