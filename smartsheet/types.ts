export interface Cell<T> {
  columnId: number;
  value: T;
  displayValue?: string;
}

export interface Row {
  id: number;
  rowNumber?: number;
  cells: Cell<any>[];
  attachments?: Attachment[];
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
  columns: Column[];
  filters: Filter[];
  rows: Row[];
  totalRowCount: number;
  filteredRowCount: number;
}

export interface Attachment {
  id: number;
  attachmentType: "BOX_COM" | "DROPBOX*" | "EGNYTE*" | "EVERNOTE*" | "FILE" | "GOOGLE_DRIVE" | "LINK" | "ONEDRIVE";
  mimeType: string;
  name: string;
  url: string;
  parentType: string;
  parentId: number;
}

export interface CodaRow extends Record<string, any> {
  id: string;
  rowNumber: number;
  attachments?: string[];
}

export interface CodaPerson {
  name: string;
  email: string;
}

export interface SheetFormatSettings {
  filterId?: number;
  columnIds?: number[];
  useColumnTypes?: boolean;
  includeAttachments?: boolean;
  page?: number;
}
