export const metadata = { title: "Test email · iCFO Events" };

/**
 * Where a test send's buttons land.
 *
 * A test carries no introduction, so its Accept button has nothing to accept.
 * Rather than leave a dead link or one that errors, it comes here and says so.
 */
export default function IntroTestPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
        <h1 className="text-lg font-semibold text-[var(--navy)]">That was a test email</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Nothing was sent to anyone, no introduction was created, and this button had nothing to accept.
        </p>
        <p className="mt-3 text-[12.5px] text-[var(--text-muted)]">
          In a real invitation this page names the founder, records your answer, and asks them to pick a time.
        </p>
      </div>
    </main>
  );
}
