"use client";

type Props = {
  profileName: string;
  profileSubtitle?: string;
};

export function WorkspaceHeader({ profileName, profileSubtitle }: Readonly<Props>) {
  const initials = profileName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 px-6 py-3.5 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative flex-1 lg:max-w-xl">
          <span className="sr-only">Search workspace</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search companies, deals, investors, documents..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-11 pr-4 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
          />
        </label>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-600 transition hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 17H9c0 1.657 1.343 3 3 3s3-1.343 3-3ZM18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-zinc-400" />
          </button>
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950 text-xs font-semibold text-white shadow-sm">
              {initials || "CO"}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold text-zinc-950">{profileName}</p>
              {profileSubtitle ? <p className="text-xs text-zinc-500">{profileSubtitle}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
