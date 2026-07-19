import type { VenueConfig } from "./types";
import taipeiDome from "../../../data/venues/taipei-dome/venue.json";

// Data is bundled via import (not served from public/).
// Swap this for a DB / API call later — callers only depend on loadVenue().
// TODO: add ajv validation against schemas/venue-config.schema.json.

const venues: Record<string, VenueConfig> = {
  "taipei-dome": taipeiDome as VenueConfig,
};

export function loadVenue(id: string): VenueConfig {
  const venue = venues[id];
  if (!venue) throw new Error(`Unknown venue: ${id}`);
  return venue;
}
