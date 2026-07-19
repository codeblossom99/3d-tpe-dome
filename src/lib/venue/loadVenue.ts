import type { Stage, VenueConfig } from "./types";
import taipeiDome from "../../../data/venues/taipei-dome/venue.json";
import endStage from "../../../data/venues/taipei-dome/stages/end-stage.json";
import centerStage from "../../../data/venues/taipei-dome/stages/center-stage.json";

// Data is bundled via import (not served from public/).
// Swap this for a DB / API call later — callers only depend on loadVenue().
// TODO: add ajv validation against schemas/venue-config.schema.json.

const venues: Record<string, VenueConfig> = {
  "taipei-dome": taipeiDome as VenueConfig,
};

const stages: Record<string, Record<string, Stage>> = {
  "taipei-dome": {
    "end-stage": endStage as Stage,
    "center-stage": centerStage as Stage,
  },
};

export function loadVenue(id: string): VenueConfig {
  const venue = venues[id];
  if (!venue) throw new Error(`Unknown venue: ${id}`);
  return venue;
}

export function loadStage(venueId: string, stageId = "end-stage"): Stage {
  const stage = stages[venueId]?.[stageId];
  if (!stage) throw new Error(`Unknown stage: ${venueId}/${stageId}`);
  return stage;
}
