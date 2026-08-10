/**
 * Shown on a founder-raise page when the ACTIVE account has no company (e.g. a
 * Deal Company / spv account). Keeps raise scaffolding — checklists, score rings,
 * empty panels — from rendering for an account that has no raise.
 */
export function DealCompanyEmptyState({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-[#E3E8F2] bg-white p-8 text-center">
      <p className="text-sm text-[#5A6782]">
        {message ??
          "This account doesn't have an active raise. Switch to a Founder account to access this."}
      </p>
    </div>
  );
}
