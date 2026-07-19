import VenueViewer from "@/components/VenueViewer";

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { id } = await params;
  const { stage } = await searchParams;
  return (
    <main style={{ width: "100vw", height: "100vh" }}>
      <VenueViewer venueId={id} stageId={stage ?? "end-stage"} />
    </main>
  );
}
