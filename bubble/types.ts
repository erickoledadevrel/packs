export interface FieldDefinition {
  name: string;
  type: string;
  list?: boolean;
  ref?: string;
}

export interface DataSourceDefinition {
  type: string;
  live: boolean;
}