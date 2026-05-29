import { getCompanyStatusBadge, getCompanyStatusBadgeClass } from "@/lib/data/marketplace";

type Props = {
  reviewStatus: string | null;
  isPublished?: boolean | null;
  marketplaceVisible?: boolean | null;
  publishedAt?: string | null;
};

export function CompanyStatusBadge({ reviewStatus, isPublished, marketplaceVisible, publishedAt }: Props) {
  const label = getCompanyStatusBadge({
    review_status: reviewStatus,
    is_published: isPublished,
    marketplace_visible: marketplaceVisible,
    published_at: publishedAt,
  });

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getCompanyStatusBadgeClass(label)}`}
    >
      {label}
    </span>
  );
}
