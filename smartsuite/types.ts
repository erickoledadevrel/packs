export interface Solution {
  name: string;
  id: string;
}

export interface Table {
  name: string;
  id: string;
  primary_field: string;
  structure: SmartSuiteColumn[];
  structure_layout: {
    single_column: {
      rows: string[];
    };
  };
}

export interface SmartSuiteColumn {
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
    entries_allowed: string;
  };
  nested?: SmartSuiteColumn[];
}

export interface SmartSuiteRecord extends Record<string, any> {
  id: string;
}

export interface SmartSuiteDateField {
  date: string;
	include_time?: boolean;
}

export interface SmartSuitePhoneField {
  phone_number: string;
  sys_title?: string;
}

export interface SmartSuiteDatePersonField {
  by: string,
  on: string,
}

export interface SmartSuiteRichTextField {
  html: string;
}

export interface SmartSuiteMember {
  id: string;
  full_name: {
    sys_root: string;
  },
  email: string[];
  timezone: string;
}

export interface SmartSuiteStatus {
  value: string;
}



export interface CodaRow extends Record<string, any> {
  id: string;
}

export interface CodaPerson {
  name: string;
  email: string;
}

export interface CodaMember {
  name: string;
  id: string;
}

export interface CodaOption {
  label: string;
  value: string;
}