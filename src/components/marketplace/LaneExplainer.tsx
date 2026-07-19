import { marketplaceCopy } from "@/lib/marketplace/copy";

export function LaneExplainer() {
  const { cf, rd } = marketplaceCopy.lanes;
  return (
    <div className="my-8 grid grid-cols-1 gap-3.5 md:grid-cols-2">
      <div className="flex items-start gap-3 rounded-xl border border-[#E3E8F2] bg-white px-4.5 py-4 text-[13px] leading-[1.55] text-[#5A6782]">
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-[#E6F7F0]" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#0E9F6E" strokeWidth="1.8" />
            <path d="M6.5 10.2l2.3 2.3 4.7-4.8" stroke="#0E9F6E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>
          <strong className="mb-0.5 block text-[13.5px] text-[#16223F]">{cf.heading}</strong>
          {cf.body}
        </span>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-[#E3E8F2] bg-white px-4.5 py-4 text-[13px] leading-[1.55] text-[#5A6782]">
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-[#EEF1F7]" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="9" width="12" height="8" rx="2" fill="#47546E" />
            <path d="M7 9V6.5a3 3 0 016 0V9" stroke="#47546E" strokeWidth="1.8" fill="none" />
          </svg>
        </span>
        <span>
          <strong className="mb-0.5 block text-[13.5px] text-[#16223F]">{rd.heading}</strong>
          {rd.body}
        </span>
      </div>
    </div>
  );
}
