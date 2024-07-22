export interface Row extends Record<string, any> {
    id: string;
  }
  
  export interface Person {
    name: string;
    email: string;
  }
  
  export interface MemberReference {
    name: string;
    id: string;
  }
  
  export interface Option {
    label: string;
    value: string;
  }
  
  export interface DatePersonField {
    by: MemberReference,
    on: string,
  }
  
  export interface Vote {
    total_votes: number;
    votes: MemberReference[];
  }
  
  export interface Checklist {
    summary: string;
    items: Array<{
      preview: string;
      label: string;
      completed: boolean;
      assignee?: MemberReference;
      due_date?: string;
      completed_at?: string;
    }>
  }
  
  export interface TimeTrackingLog {
    total: string;
    entries: Array<{
      user: MemberReference;
      created: string;
      duration: string;
      note?: string;
    }>;
  }