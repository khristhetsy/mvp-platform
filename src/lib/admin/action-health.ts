export type AdminActionHealthSnapshot = {
  userId: string;
  userRole: string;
  serviceRoleConfigured: boolean;
  lastButtonClicked: string | null;
  lastApiUrl: string | null;
  lastHttpStatus: number | null;
  lastResponseBody: string | null;
  lastErrorMessage: string | null;
  healthCheckLoading: boolean;
  healthCheckResult: string | null;
  healthCheckError: string | null;
};

export type AdminActionHealthUpdate = Partial<
  Pick<
    AdminActionHealthSnapshot,
    | "lastButtonClicked"
    | "lastApiUrl"
    | "lastHttpStatus"
    | "lastResponseBody"
    | "lastErrorMessage"
    | "healthCheckLoading"
    | "healthCheckResult"
    | "healthCheckError"
  >
>;

export function formatResponseBody(payload: unknown) {
  if (payload == null) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}
