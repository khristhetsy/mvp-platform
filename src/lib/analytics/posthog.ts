type PostHogClient = typeof import("posthog-js").default;

let initialized = false;

function posthogHost() {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
}

function getBrowserPostHog(): PostHogClient | null {
  if (typeof window === "undefined") {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("posthog-js").default as PostHogClient;
}

export function initPostHog() {
  const posthog = getBrowserPostHog();
  if (!posthog || initialized) {
    return;
  }

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) {
    return;
  }

  posthog.init(key, {
    api_host: posthogHost(),
    capture_pageview: false,
  });
  initialized = true;
}

export function getPostHogClient() {
  return getBrowserPostHog();
}

export function track(event: string, properties?: Record<string, unknown>) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) {
    return;
  }

  if (typeof window !== "undefined") {
    if (!initialized) {
      initPostHog();
    }
    getBrowserPostHog()?.capture(event, properties);
    return;
  }

  const distinctId =
    (typeof properties?.founderId === "string" && properties.founderId) ||
    (typeof properties?.userId === "string" && properties.userId) ||
    "server";

  void fetch(`${posthogHost()}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event,
      distinct_id: distinctId,
      properties: {
        ...properties,
        $lib: "posthog-server",
      },
    }),
  }).catch(() => undefined);
}
