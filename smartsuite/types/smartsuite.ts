export interface Account {
  slug: string;
  name: string;
}

export interface Solution {
  name: string;
  id: string;
  slug: string;
}

export interface Table {
  name: string;
  id: string;
  slug: string;
  solution: string;
  primary_field: string;
  structure: Column[];
  structure_layout: {
    single_column: {
      rows: string[];
    };
  };
}

export type SimpleTable = Pick<Table, "name" | "id" | "slug">;

export interface Column {
  slug: string;
  label: string;
  field_type: string; // TODO: Fill in types.
  params: {
    is_auto_generated?: boolean;
    primary?: boolean;
    edit_values?: boolean;
    new_choices_allowed?: boolean;
    choices: Array<{
      label: string;
      value: string;
    }>;
    required: boolean;
    hidden: boolean;
    system: boolean;
    help_text: string;
    precision: number;
    separator: boolean;
    min_value: number;
    max_value: number;
    value_increment: number;
    currency: string;
    linked_application?: string;
    entries_allowed: string;
    display_format: string;
    scale: number;
  };
  nested?: Column[];
}

export interface Row extends Record<string, any> {
  id: string;
}

export interface Date {
  date: string;
  include_time?: boolean;
}

export interface PhoneField {
  phone_number: string;
  sys_title?: string;
}

export interface DatePersonField {
  by: string,
  on: string,
}

export interface RichTextField {
  html: string;
}

export interface Member {
  id: string;
  full_name: {
    sys_root: string;
  },
  email: string[];
  timezone: string;
}

export interface Status {
  value: string;
}

export interface DateRange {
  from_date: Date;
  to_date: Date;
}

export interface File {
  handle: string;
  metadata: {
    filename: string;
    mimetype: string;
  };
}

export interface SharedFile {
  url: string;
}

export interface Dependency {
  predecessor?: {
    type: "fs";
    lag: 0;
    application: string;
    record: string;
  }[];
}

export interface Vote {
  total_votes: number;
  votes: {
    user_id: string;
    date: string;
  }[];
}

export interface Checklist {
  completed_items: number;
  total_items: number;
  items: Array<{
    content: {
      preview: string;
    };
    completed: boolean;
    assignee?: string;
    due_date?: string;
    completed_at?: string;
  }>
}

export interface TimeTrackingLog {
  total_duration: number;
  time_track_logs: Array<{
    user_id: string;
    date_time: string;
    timer_start?: string;
    duration: number;
    note?: string;
    time_range?: DateRange;
  }>;
}

export interface Color {
  value: string;
  name?: string;
}

export interface IpAddress {
  address: string;
  country_code: string;
}
  
export interface Filter {
  field: string;
  comparison: string;
  value: any;
}