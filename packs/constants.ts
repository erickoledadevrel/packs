import { MetadataSettings, addBuildingBlocks, addPublished, addReleases, addFeaturedDocs, addManifest } from "./helpers";
import { BuildingBlockPoperties, FeaturedDocsProperties, PublishedProperties, ReleasesProperties } from "./schemas";

export const PageSize = 20;

export const PackUrlRegexes = [
  new RegExp("^(https://(?:[^.]+\\.)?coda.io)/p/(\\d+)"),
  new RegExp("^(https://(?:[^.]+\\.)?coda.io)/packs/(?:\\w+-)*(\\d+)"),
];

export const MetadataTypes: Record<string, MetadataSettings> = {
  blocks: {
    name: "Building blocks",
    callback: addBuildingBlocks,
    properties: BuildingBlockPoperties,
  },
  published: {
    name: "Published status",
    callback: addPublished,
    properties: PublishedProperties,
  },
  releases: {
    name: "Releases",
    callback: addReleases,
    properties: ReleasesProperties,
    maxPageSize: 5,
  },
  featuredDocs: {
    name: "Featured docs",
    callback: addFeaturedDocs,
    properties: FeaturedDocsProperties,
    maxPageSize: 5,
  },
};