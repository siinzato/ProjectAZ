// Product Import Types

export interface ProductRaw {
  Nome?: string;
  nome?: string;
  SKU?: string;
  sku?: string;
  EAN?: string;
  ean?: string;
  Local?: string;
  local?: string;
  Preço?: string | number;
  preço?: string | number;
  preco?: string | number;
  Price?: string | number;
  price?: string | number;
  [key: string]: string | number | undefined;
}

export interface ProductValidated {
  id?: string;
  name: string;
  sku: string;
  ean: string | null;
  location: string | null;
  price: number | null;
  isNew: boolean;
  isValid: boolean;
  error?: string;
  status: 'new' | 'update' | 'error' | 'skip';
}

export interface ImportSummary {
  totalRows: number;
  validProducts: number;
  invalidProducts: number;
  newProducts: number;
  updateProducts: number;
  skippedRows: number;
  importedCount: number;
}

export interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
  status: 'idle' | 'reading' | 'validating' | 'importing' | 'completed' | 'error';
  message: string;
}

export interface ImportError {
  row: number;
  sku?: string;
  name?: string;
  error: string;
}

export type ImportStatus = 'upload' | 'preview' | 'importing' | 'complete' | 'error';
