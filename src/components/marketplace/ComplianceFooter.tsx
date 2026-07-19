import { marketplaceCopy } from "@/lib/marketplace/copy";

export function ComplianceFooter() {
  return (
    <footer className="border-t border-[#E3E8F2] pb-10 pt-6 text-[11.5px] leading-[1.65] text-[#8B96AC]">
      <strong className="text-[#5A6782]">{marketplaceCopy.footer.lead}</strong> {marketplaceCopy.footer.body}
    </footer>
  );
}
