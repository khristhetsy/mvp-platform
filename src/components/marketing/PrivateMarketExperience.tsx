"use client";

import { useMemo, useState } from "react";
import { NseBoard } from "@/components/marketing/NseBoard";
import { PrivateMarketListings, type ListingBoardStats } from "@/components/marketing/PrivateMarketListings";
import type { MarketBoardData } from "@/lib/data/market-board";
import type { ListedCompany } from "@/lib/listing/private-market";
import { companyInSector } from "@/lib/marketplace/market-board";

/**
 * Holds the shared state of the signed in Private Market: the chosen sector
 * (clicking a sector on the board filters the table) and the open company one
 * pager (clicking a gainer or a row opens it).
 */
export function PrivateMarketExperience({
  companies,
  stats,
  board,
  canRequest,
  outreachWindowDays,
}: Readonly<{
  companies: ListedCompany[];
  stats: Record<string, ListingBoardStats>;
  board: MarketBoardData | null;
  canRequest: boolean;
  outreachWindowDays: number;
}>) {
  const [sector, setSector] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => companies.filter((c) => companyInSector(c.industry, sector)), [companies, sector]);
  const selected = companies.find((c) => c.id === selectedId) ?? null;
  const toggleSector = (s: string) => setSector((cur) => (cur?.toLowerCase() === s.toLowerCase() ? null : s));

  return (
    <>
      {board ? (
        <NseBoard data={board} companies={companies} activeSector={sector} onSector={toggleSector} onOpenCompany={setSelectedId} />
      ) : null}
      <PrivateMarketListings
        companies={visible}
        stats={stats}
        selected={selected}
        onSelect={setSelectedId}
        canRequest={canRequest}
        sector={sector}
        onClearSector={() => setSector(null)}
        approvedCount={companies.length}
        optedInCount={companies.filter((c) => c.optedIn).length}
        outreachWindowDays={outreachWindowDays}
      />
    </>
  );
}
