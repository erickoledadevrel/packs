import * as sdk from "@superhuman/plugins-sdk";
import type * as sst from "./types/smartsuite";

export interface ConversionSettings {
  table: sst.Table;
  membersTable: sst.Table;
  relatedTables: Record<string, sst.Table>;
  context: sdk.ExecutionContext;
}