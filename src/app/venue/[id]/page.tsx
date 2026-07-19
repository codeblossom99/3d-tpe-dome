import VenueViewer from "@/components/VenueViewer";

export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main style={{ width: "100vw", height: "100vh" }}>
      <VenueViewer venueId={id} />
    </main>
  );
}
