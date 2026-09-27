export interface Env {
  GOOGLE_SHEET_ID?: string;
}

export interface SheetRow {
  section_id: string;
  field: string;
  value: string;
  type: string;
}

export interface ContentResponse {
  status: 'success';
  slug: string;
  content: Record<string, Record<string, any>>;
}

export interface ErrorResponse {
  status: 'error';
  message: string;
  slug?: string;
  details?: string;
}
