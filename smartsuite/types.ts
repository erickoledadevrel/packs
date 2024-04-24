export interface Solution {
  name: string;
  id: string;
}

export interface Table {
  name: string;
  id: string;
  primary_field: string;
  structure: Column[];
  structure_layout: {
    single_column: {
      rows: string[];
    };
  };
}

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
  };
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
  }
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