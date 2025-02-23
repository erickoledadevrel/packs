export interface Cell<T> {
  columnId: number;
  value: T;
  displayValue?: string;
  strict?: boolean;
}

export interface Row {
  id: number;
  rowNumber?: number;
  permalink?: string;
  cells: Cell<any>[];
}

export interface Column {
  id: number;
  title: string;
  type: "ABSTRACT_DATETIME" | "CHECKBOX" | "CONTACT_LIST" | "DATE" | "DATETIME" | "DURATION" | "MULTI_CONTACT_LIST" | "MULTI_PICKLIST" |"PICKLIST" | "PREDECESSOR" | "TEXT_NUMBER";
  systemColumnType: string;
  hidden: boolean;
  description?: string;
  options?: string[];
  primary: boolean;
}

interface Filter {
  name: string;
  id: number;
}

export interface Sheet {
  name: string;
  permalink: string;
  columns: Column[];
  filters: Filter[];
  rows: Row[];
  totalRowCount: number;
  filteredRowCount: number;
}

export interface CodaRow extends Record<string, any> {
  id: string;
  rowNumber: number;
}

export interface CodaPerson {
  name: string;
  email: string;
}

export interface SheetFormatSettings {
  filterId?: number;
  columnIds?: number[];
  useColumnTypes?: boolean;
  page?: number;
}

export interface SheetResult {
  name: string;
  parent?: string;
  id: string;
  url: string;
}