// Shared-secret check for the voice runtime webhooks (agent, call-end,
// call-status). The same secret lives in VOICE_AGENT_SECRET and in the runtime's
// server config. Accepts either our own `x-voice-secret` header or Vapi's native
// `x-vapi-secret` (from Vapi's "Server URL Secret" field), so setup is one step.

export function voiceWebhookAuthorized(req: Request): boolean {
  const secret = process.env.VOICE_AGENT_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("x-voice-secret") === secret || req.headers.get("x-vapi-secret") === secret;
}
