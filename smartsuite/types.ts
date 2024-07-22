import * as coda from "@codahq/packs-sdk";
import type * as sst from "./types/smartsuite";

export interface ConversionSettings {
  table: sst.Table;
  membersTable: sst.Table;
  relatedTables: Record<string, sst.Table>;
  context: coda.ExecutionContext;
}