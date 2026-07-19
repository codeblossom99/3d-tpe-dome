"use client";

import dynamic from "next/dynamic";

// ssr: false must live in a Client Component (Next 16 rule) — hence this wrapper.
const VenueScene = dynamic(() => import("./VenueScene"), { ssr: false });

export default function VenueViewer({
  venueId,
  stageId,
}: {
  venueId: string;
  stageId?: string;
}) {
  return <VenueScene venueId={venueId} stageId={stageId} />;
}
