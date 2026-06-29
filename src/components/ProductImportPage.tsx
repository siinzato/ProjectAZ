// Product Import Page Component - Full Featured

import React, { useState, useCallback, useMemo } from 'react';
import { FileSpreadsheet, ArrowLeft, Lock } from 'lucide-react';
import { ProductUploadArea } from './ProductUploadArea';
import { ColumnMappingWizard } from './ColumnMappingWizard';
import { ProductImportPreview } from './ProductImportPreview';
import { ProductImportProgress } from './ProductImportProgress';
import { ProductImportSummary } from './ProductImportSummary';
import type { ProductValidated, ImportSummary, ImportProgress, ImportError, ImportStatus, ColumnMapping, ProductFromDB } from '../lib/productImportTypes';
import {
  parseCSV,
  processRawProducts,
  calculateImportSummary,
} from '../lib/productImportUtils';
import { supabase } from '../lib/supabase';

interface ProductImportPageProps {
  onBack: () => void;
  isAdmin: boolean;
  onRequestAdmin: () => void;
}

export const ProductImportPage: React.FC<ProductImportPageProps> = ({
  onBack,
  isAdmin,
  onRequestAdmin,
}) => {
  const [status, setStatus] = useState<ImportStatus>('upload');
  const [isReading, setIsReading] = useState(false);
  const [products, setProducts] = useState<ProductValidated[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    status: 'idle',
    message: '',
  });
  const [existingProducts, setExistingProducts] = useState<Map<string, ProductFromDB>>(new Map());

  // File data
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Array<{ [key: string]: string | number | undefined }>>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);

  // Load existing products from database
  const loadExistingProducts = async (): Promise<Map<string, ProductFromDB>> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*');

      if (error) throw error;

      const productsMap = new Map<string, ProductFromDB>();
      data?.forEach((item: ProductFromDB) => {
        productsMap.set(item.sku.toUpperCase(), item);
      });

      return productsMap;
    } catch (err) {
      console.error('Error loading existing products:', err);
      return new Map();
    }
  };

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    // Check admin
    if (!isAdmin) {
      alert('Voce precisa estar logado como admin para importar produtos.');
      onRequestAdmin();
      return;
    }

    setIsReading(true);
    setStatus('upload');

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let headers: string[] = [];
      let rows: Array<{ [key: string]: string | number | undefined }> = [];
      let content = '';

      if (extension === 'csv') {
        content = await file.text();
        const parsed = parseCSV(content);
        headers = parsed.headers;
        rows = parsed.rows;
      } else {
        // Parse Excel
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        content = jsonData.map(row => (row as string[]).join(';')).join('\n');

        if (jsonData.length > 0) {
          headers = (jsonData[0] as string[]).map(String);
          rows = (jsonData.slice(1) as string[][]).map(row => {
            const obj: { [key: string]: string | number | undefined } = {};
            headers.forEach((header, idx) => {
              obj[header] = row[idx];
            });
            return obj;
          });
        }
      }

      if (rows.length === 0) {
        alert('Nenhuma linha encontrada na planilha.');
        setIsReading(false);
        return;
      }

      setCurrentFile(file);
      setFileContent(content);
      setRawHeaders(headers);
      setRawRows(rows);
      setIsReading(false);
      setStatus('mapping');
    } catch (err) {
      console.error('Error reading file:', err);
      alert('Erro ao ler o arquivo.');
      setStatus('upload');
    }

    setIsReading(false);
  }, [isAdmin, onRequestAdmin]);

  // Handle column mapping confirmation
  const handleMappingConfirm = useCallback(async (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    setStatus('validating');

    // Load existing products
    const existing = await loadExistingProducts();
    setExistingProducts(existing);

    // Process with mapping
    const { products: validated, errors: importErrors } = processRawProducts(rawRows, existing, mapping);

    const nonEmptyEntries = validated.filter(p =>
      p.sku?.trim() || p.name?.trim()
    );

    setProducts(nonEmptyEntries);
    setErrors(importErrors);
    setSummary(calculateImportSummary(nonEmptyEntries));
    setStatus('preview');
  }, [rawRows]);

  // Confirm import
  const handleConfirmImport = useCallback(async () => {
    if (!summary || summary.validProducts === 0 || !columnMapping || !isAdmin) return;

    setStatus('importing');
    const validProducts = products.filter(p => p.isValid);
    const total = validProducts.length;

    setProgress({
      current: 0,
      total,
      percentage: 0,
      status: 'importing',
      message: 'Preparando para importar...',
    });

    let imported = 0;
    let newCount = 0;
    let updateCount = 0;

    // Create import history record first
    const importRecordId = await createImportHistory();

    if (!importRecordId) {
      alert('Erro ao criar registro de importacao');
      setStatus('preview');
      return;
    }

    const batchSize = 50;
    const batches = Math.ceil(total / batchSize);

    for (let i = 0; i < batches; i++) {
      const batch = validProducts.slice(i * batchSize, (i + 1) * batchSize);

      const newProducts = batch.filter(p => p.isNew);
      const updateProducts = batch.filter(p => !p.isNew);

      // Insert new products
      if (newProducts.length > 0) {
        const insertData = newProducts.map(p => ({
          name: p.name,
          sku: p.sku,
          ean: p.ean || null,
          location: p.location || null,
          price: p.price || null,
        }));

        const { data: insertedProducts, error: insertError } = await supabase
          .from('products')
          .insert(insertData)
          .select('id, sku');

        if (!insertError && insertedProducts) {
          // Record audit
          for (const inserted of insertedProducts) {
            const product = newProducts.find(p => p.sku === inserted.sku);
            if (product) {
              await supabase.from('import_products_audit').insert({
                import_id: importRecordId,
                product_id: inserted.id,
                sku: product.sku,
                action: 'insert',
                old_data: null,
                new_data: { name: product.name, sku: product.sku, ean: product.ean, location: product.location, price: product.price },
              });
            }
          }
          imported += newProducts.length;
          newCount += newProducts.length;
        }
      }

      // Update existing products
      for (const product of updateProducts) {
        const oldProduct = existingProducts.get(product.sku.toUpperCase());

        if (oldProduct) {
          const { error: updateError } = await supabase
            .from('products')
            .update({
              name: product.name,
              ean: product.ean || null,
              location: product.location || null,
              price: product.price || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', oldProduct.id);

          if (!updateError) {
            // Record audit
            await supabase.from('import_products_audit').insert({
              import_id: importRecordId,
              product_id: oldProduct.id,
              sku: product.sku,
              action: 'update',
              old_data: { name: oldProduct.name, sku: oldProduct.sku, ean: oldProduct.ean, location: oldProduct.location, price: oldProduct.price },
              new_data: { name: product.name, sku: product.sku, ean: product.ean, location: product.location, price: product.price },
            });

            imported++;
            updateCount++;
          }
        }
      }

      // Update progress
      const current = Math.min((i + 1) * batchSize, total);
      setProgress({
        current,
        total,
        percentage: Math.round((current / total) * 100),
        status: 'importing',
        message: `Processando ${current} de ${total} produtos...`,
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update import history
    await supabase
      .from('import_history')
      .update({
        total_products: imported,
        new_products: newCount,
        updated_products: updateCount,
        errors: errors.length,
        status: 'completed',
      })
      .eq('id', importRecordId);

    setSummary(prev => prev ? {
      ...prev,
      newProducts: newCount,
      updateProducts: updateCount,
      importedCount: imported,
    } : null);

    setProgress({
      current: total,
      total,
      percentage: 100,
      status: 'completed',
      message: 'Importacao concluida!',
    });

    setStatus('complete');
  }, [products, summary, columnMapping, isAdmin, existingProducts, errors.length]);

  // Create import history record
  const createImportHistory = async (): Promise<string | null> => {
    if (!currentFile) return null;

    try {
      const { data, error } = await supabase
        .from('import_history')
        .insert({
          file_name: currentFile.name,
          file_size: currentFile.size,
          file_content: fileContent,
          total_products: 0,
          new_products: 0,
          updated_products: 0,
          errors: 0,
          imported_by: 'admin',
          status: 'completed',
          column_mapping: columnMapping,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (err) {
      console.error('Error creating import history:', err);
      return null;
    }
  };

  // Reset state
  const handleReset = useCallback(() => {
    setStatus('upload');
    setIsReading(false);
    setProducts([]);
    setErrors([]);
    setSummary(null);
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      status: 'idle',
      message: '',
    });
    setCurrentFile(null);
    setFileContent('');
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping(null);
  }, []);

  const handleCancel = useCallback(() => {
    handleReset();
  }, [handleReset]);

  // Admin check overlay
  const AdminCheckOverlay = () => (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center">
      <div className="flex justify-center mb-4">
        <div className="p-4 bg-amber-100 rounded-full">
          <Lock size={40} className="text-amber-600" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-amber-800 mb-2">Acesso Restrito</h3>
      <p className="text-amber-700 mb-4">
        Somente administradores podem importar produtos.
      </p>
      <button
        onClick={onRequestAdmin}
        className="px-6 py-3 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition"
      >
        Fazer Login como Admin
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-600 hover:text-zinc-800 transition mb-4"
        >
          <ArrowLeft size={20} />
          Voltar
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 rounded-xl">
            <FileSpreadsheet size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-800">Importar Produtos</h1>
            <p className="text-zinc-500">Importe sua planilha de produtos para o sistema</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center mb-8">
        {['upload', 'mapping', 'preview', 'importing', 'complete'].map((step, idx) => {
          const stepLabels: Record<string, string> = {
            upload: 'Enviar',
            mapping: 'Mapear',
            preview: 'Revisar',
            importing: 'Importar',
            complete: 'Concluido',
          };

          const statusOrder = ['upload', 'mapping', 'preview', 'importing', 'complete'];
          const currentIdx = statusOrder.indexOf(status);

          const isComplete = currentIdx > idx;
          const isCurrent = status === step;

          return (
            <React.Fragment key={step}>
              {idx > 0 && (
                <div className={`w-16 h-1 mx-2 rounded ${
                  isComplete || isCurrent ? 'bg-emerald-500' : 'bg-zinc-200'
                }`} />
              )}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  isComplete
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-200 text-zinc-500'
                }`}>
                  {isComplete ? '✓' : idx + 1}
                </div>
                <p className={`text-xs mt-1 font-medium ${
                  isComplete || isCurrent ? 'text-zinc-800' : 'text-zinc-400'
                }`}>
                  {stepLabels[step]}
                </p>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto">
        {!isAdmin ? (
          <AdminCheckOverlay />
        ) : (
          <>
            {status === 'upload' && (
              <ProductUploadArea
                onFileSelect={handleFileSelect}
                isLoading={isReading}
              />
            )}

            {status === 'mapping' && rawHeaders.length > 0 && (
              <ColumnMappingWizard
                headers={rawHeaders}
                sampleRows={rawRows}
                onConfirm={handleMappingConfirm}
                onCancel={handleCancel}
              />
            )}

            {status === 'preview' && summary && (
              <ProductImportPreview
                products={products}
                summary={summary}
                onConfirm={handleConfirmImport}
                onCancel={handleCancel}
                isImporting={false}
                errors={errors}
              />
            )}

            {status === 'importing' && (
              <ProductImportProgress progress={progress} />
            )}

            {status === 'complete' && summary && (
              <ProductImportSummary
                summary={summary}
                onViewProducts={onBack}
                onNewImport={handleReset}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
