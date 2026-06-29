// Product Import Utilities

import type { ProductRaw, ProductValidated, ImportError, ImportSummary } from './productImportTypes';

// Normalize column name (case insensitive)
const normalizeColumnName = (name: string): string => {
  const lower = name.toLowerCase().trim();
  if (lower === 'nome' || lower === 'name') return 'name';
  if (lower === 'sku') return 'sku';
  if (lower === 'ean' || lower === 'barcode' || lower === 'codbarras') return 'ean';
  if (lower === 'local' || lower === 'location' || lower === 'localização') return 'location';
  if (lower === 'preço' || lower === 'preco' || lower === 'price' || lower === 'valor') return 'price';
  return lower;
};

// Normalize raw data from spreadsheet
export const normalizeProductData = (raw: ProductRaw, rowIndex: number): { data: Partial<ProductValidated>; row: number } => {
  const normalized: Partial<ProductValidated> = {};

  // Map all possible column names to normalized names
  const mapping: Record<string, string> = {
    name: 'name',
    nome: 'name',
    sku: 'sku',
    ean: 'ean',
    local: 'location',
    location: 'location',
    price: 'price',
    preço: 'price',
    preco: 'price',
    valor: 'price',
  };

  // Process each column
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = normalizeColumnName(key);
    if (mapping[normalizedKey]) {
      const targetField = mapping[normalizedKey];
      if (targetField === 'price') {
        normalized[targetField] = parsePrice(value);
      } else {
        normalized[targetField] = cleanText(value);
      }
    }
  }

  return { data: normalized, row: rowIndex };
};

// Clean and trim text
const cleanText = (value: string | number | undefined | null): string => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  // Remove extra spaces
  return str.replace(/\s+/g, ' ');
};

// Parse price to number
const parsePrice = (value: string | number | undefined | null): number | null => {
  if (value === null || value === undefined || value === '') return null;

  // If already a number
  if (typeof value === 'number') {
    return isNaN(value) ? null : Math.round(value * 100) / 100;
  }

  // Clean string
  const cleaned = String(value).trim();

  // Handle empty
  if (!cleaned) return null;

  // Replace comma with dot for decimal
  // Handle cases like "1.234,56" (Brazilian format) or "1,234.56" (US format)
  let normalized = cleaned;

  // If has both comma and dot, assume Brazilian format (1.234,56)
  if (normalized.includes(',') && normalized.includes('.')) {
    // Remove thousand separators (dots) and replace comma with dot
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    // Only comma, treat as decimal separator
    normalized = normalized.replace(',', '.');
  }

  const num = parseFloat(normalized);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
};

// Validate a single product
export const validateProduct = (
  normalized: Partial<ProductValidated>,
  existingSkus: Set<string>,
  rowIndex: number
): ProductValidated => {
  const errors: string[] = [];

  // Check required fields
  const sku = normalized.sku || '';
  const name = normalized.name || '';

  // Validate SKU (required)
  if (!sku) {
    errors.push('SKU é obrigatório');
  }

  // Validate Name (required)
  if (!name) {
    errors.push('Nome é obrigatório');
  }

  // Validate price if present
  if (normalized.price !== null && normalized.price !== undefined) {
    if (normalized.price < 0) {
      errors.push('Preço não pode ser negativo');
    }
  }

  // Normalize SKU and EAN as text (preserve leading zeros)
  const cleanSku = sku ? String(sku).trim() : '';
  const cleanEan = normalized.ean ? String(normalized.ean).trim() : null;

  // Determine if new or update
  let isNew = false;
  let status: 'new' | 'update' | 'error' = 'new';

  if (errors.length > 0) {
    status = 'error';
  } else if (existingSkus.has(cleanSku.toUpperCase())) {
    status = 'update';
    isNew = false;
  } else {
    status = 'new';
    isNew = true;
  }

  return {
    name: name || '',
    sku: cleanSku,
    ean: cleanEan,
    location: normalized.location || null,
    price: normalized.price ?? null,
    isNew,
    isValid: errors.length === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    status,
  };
};

// Parse CSV content
export const parseCSV = (content: string): ProductRaw[] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  // Detect delimiter (comma or semicolon)
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';

  // Parse header
  const headers = parseCSVLine(lines[0], delimiter);

  // Parse data rows
  const products: ProductRaw[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCSVLine(line, delimiter);
    const product: ProductRaw = {};

    headers.forEach((header, index) => {
      if (index < values.length) {
        product[header] = values[index];
      }
    });

    products.push(product);
  }

  return products;
};

// Parse a single CSV line (handles quoted values)
const parseCSVLine = (line: string, delimiter: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map(v => v.trim());
};

// Convert raw data to validated products
export const processRawProducts = (
  rawProducts: ProductRaw[],
  existingSkus: Set<string>
): { products: ProductValidated[]; errors: ImportError[] } => {
  const products: ProductValidated[] = [];
  const errors: ImportError[] = [];

  rawProducts.forEach((raw, index) => {
    const { data: normalized, row } = normalizeProductData(raw, index + 2); // +2 because of header
    const validated = validateProduct(normalized, existingSkus, row);

    if (validated.status === 'error') {
      errors.push({
        row,
        sku: validated.sku || undefined,
        name: validated.name || undefined,
        error: validated.error || 'Erro desconhecido',
      });
    }

    products.push(validated);
  });

  return { products, errors };
};

// Calculate import summary
export const calculateImportSummary = (products: ProductValidated[]): ImportSummary => ({
  totalRows: products.length,
  validProducts: products.filter(p => p.isValid).length,
  invalidProducts: products.filter(p => !p.isValid).length,
  newProducts: products.filter(p => p.status === 'new').length,
  updateProducts: products.filter(p => p.status === 'update').length,
  skippedRows: products.filter(p => p.status === 'skip').length,
  importedCount: 0,
});

// Export errors to CSV
export const exportErrorsToCSV = (errors: ImportError[]): string => {
  const headers = ['Linha', 'SKU', 'Nome', 'Erro'];
  const lines = [headers.join(';')];

  errors.forEach(error => {
    const line = [
      String(error.row),
      error.sku || '',
      error.name || '',
      error.error,
    ].map(v => v.includes(';') ? `"${v}"` : v);
    lines.push(line.join(';'));
  });

  return lines.join('\n');
};

// Download a string as file
export const downloadFile = (content: string, filename: string, type: string = 'text/csv;charset=utf-8') => {
  // Add BOM for Excel compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Format price for display
export const formatPrice = (price: number | null): string => {
  if (price === null || price === undefined) return '-';
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Check if two products are identical
export const productsAreIdentical = (a: ProductValidated, b: ProductValidated): boolean => {
  return (
    a.name === b.name &&
    a.sku === b.sku &&
    a.ean === b.ean &&
    a.location === b.location &&
    a.price === b.price
  );
};
