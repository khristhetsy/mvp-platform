import fs from "node:fs";
import path from "node:path";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isGoogleOAuthConfigured } from "@/lib/integrations/google-env";
import { getAppEnv, getAppUrl, getPublicSupabaseEnv } from "@/lib/env";

const BACKUP_AUDIT_ACTIONS = [
  "backup.database.completed",
  "backup.database.failed",
  "backup.storage.manifest.completed",
  "backup.storage.failed",
  "backup.verification.passed",
  "backup.verification.failed",
] as const;

const REQUIRED_STORAGE_BUCKETS = ["pitch-decks", "spv-investor-documents", "company-documents"] as const;

export type OperationalSystemSnapshot = {
  generatedAt: string;
  environment: {
    appEnv: string;
    nodeEnv: string | null;
    vercelEnv: string | null;
    appUrl: string | null;
    supabasePublicConfigured: boolean;
    supabaseProjectHost: string | null;
    serviceRoleConfigured: boolean;
    databaseUrlConfigured: boolean;
    googleOAuthConfigured: boolean;
    openAiConfigured: boolean;
    siteUrl: string | null;
    googleRedirectHost: string | null;
  };
  migrations: {
    latest: string | null;
    total: number;
    files: string[];
  };
  storage: {
    buckets: { name: string; public: boolean }[];
    requiredBucketsPresent: Record<string, boolean>;
  };
  integrations: {
    googleOAuthConfigured: boolean;
    googleConnectedAccounts: number;
  };
  automation: {
    lastAutomationRun: { id: string; status: string | null; triggerType: string | null; startedAt: string | null } | null;
    lastOrchestrationRun: { id: string; status: string | null; triggerSource: string | null; startedAt: string | null } | null;
  };
  counts: {
    profiles: number | null;
    companies: number | null;
    documents: number | null;
    notifications: number | null;
    spvOpportunities: number | null;
  };
  backup: {
    lastEvents: {
      action: string;
      createdAt: string;
      level: string | null;
      metadata: Record<string, unknown>;
    }[];
    verificationRecommended: boolean;
  };
};

function listMigrationFiles() {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  if (!fs.existsSync(dir)) {
    return { files: [] as string[], latest: null, total: 0 };
  }

  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  return {
    files,
    latest: files.at(-1) ?? null,
    total: files.length,
  };
}

function hostFromUrl(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export async function buildOperationalSnapshot(): Promise<OperationalSystemSnapshot> {
  const admin = createServiceRoleClient();
  const { configured: supabasePublicConfigured, url: supabaseUrl } = getPublicSupabaseEnv();
  const migrations = listMigrationFiles();

  const [
    bucketsRes,
    googleAccountsRes,
    profilesRes,
    companiesRes,
    documentsRes,
    notificationsRes,
    spvRes,
    lastAutomationRunRes,
    lastOrchestrationRunRes,
    backupLogsRes,
  ] = await Promise.all([
    admin.storage.listBuckets(),
    admin.from("connected_accounts").select("id", { count: "exact", head: true }).eq("provider", "google"),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("companies").select("id", { count: "exact", head: true }),
    admin.from("documents").select("id", { count: "exact", head: true }),
    admin.from("notifications").select("id", { count: "exact", head: true }),
    admin.from("spv_opportunities").select("id", { count: "exact", head: true }),
    admin
      .from("automation_runs")
      .select("id, status, trigger_type, started_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("orchestration_runs")
      .select("id, status, trigger_source, started_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("audit_logs")
      .select("action, created_at, metadata")
      .in("action", [...BACKUP_AUDIT_ACTIONS])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const bucketNames = new Set((bucketsRes.data ?? []).map((b) => b.name ?? b.id));
  const requiredBucketsPresent = Object.fromEntries(
    REQUIRED_STORAGE_BUCKETS.map((name) => [name, bucketNames.has(name)]),
  ) as Record<(typeof REQUIRED_STORAGE_BUCKETS)[number], boolean>;

  const lastEvents = (backupLogsRes.data ?? []).map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const level = typeof metadata.level === "string" ? metadata.level : null;
    return {
      action: String(row.action ?? ""),
      createdAt: String(row.created_at ?? ""),
      level,
      metadata: {
        ...metadata,
      },
    };
  });

  const latestSuccess = lastEvents.find(
    (e) => e.action === "backup.verification.passed" || e.action === "backup.database.completed",
  );

  return {
    generatedAt: new Date().toISOString(),
    environment: {
      appEnv: getAppEnv(),
      nodeEnv: process.env.NODE_ENV ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      appUrl: getAppUrl(),
      supabasePublicConfigured,
      supabaseProjectHost: hostFromUrl(supabaseUrl),
      serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL?.trim()),
      googleOAuthConfigured: isGoogleOAuthConfigured(),
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? null,
      googleRedirectHost: hostFromUrl(process.env.GOOGLE_REDIRECT_URI),
    },
    migrations,
    storage: {
      buckets: (bucketsRes.data ?? []).map((b) => ({
        name: b.name ?? b.id,
        public: b.public ?? false,
      })),
      requiredBucketsPresent,
    },
    integrations: {
      googleOAuthConfigured: isGoogleOAuthConfigured(),
      googleConnectedAccounts: googleAccountsRes.count ?? 0,
    },
    automation: {
      lastAutomationRun: lastAutomationRunRes.data
        ? {
            id: String(lastAutomationRunRes.data.id),
            status: (lastAutomationRunRes.data.status as string | null) ?? null,
            triggerType: (lastAutomationRunRes.data.trigger_type as string | null) ?? null,
            startedAt: (lastAutomationRunRes.data.started_at as string | null) ?? null,
          }
        : null,
      lastOrchestrationRun: lastOrchestrationRunRes.data
        ? {
            id: String(lastOrchestrationRunRes.data.id),
            status: (lastOrchestrationRunRes.data.status as string | null) ?? null,
            triggerSource: (lastOrchestrationRunRes.data.trigger_source as string | null) ?? null,
            startedAt: (lastOrchestrationRunRes.data.started_at as string | null) ?? null,
          }
        : null,
    },
    counts: {
      profiles: profilesRes.count,
      companies: companiesRes.count,
      documents: documentsRes.count,
      notifications: notificationsRes.count,
      spvOpportunities: spvRes.count,
    },
    backup: {
      lastEvents,
      verificationRecommended: !latestSuccess,
    },
  };
}
