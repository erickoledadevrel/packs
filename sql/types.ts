export interface QueryOptions {
  load: string[];
  query: string;
  values?: string[];
  asObject: boolean;
}

export interface LoadTableSpec {
  doc?: string;
  table: string;
  destination?: string;
  columns?: any[],
}
