/**
 * Which scheduled job (and which run) the current code is running inside.
 * Set by the cron gate around each scheduled run, so the email sender and the
 * notification writer can record what a job sent without every job passing it
 * along. Outside a job, currentJob() is null and nothing is recorded.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type JobContext = { job: string; runId: number | null };

const storage = new AsyncLocalStorage<JobContext>();

export function runInJob<T>(ctx: JobContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function currentJob(): JobContext | null {
  return storage.getStore() ?? null;
}
