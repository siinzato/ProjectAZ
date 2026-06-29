// Product Import Page Component

import React, { useState, useCallback, useMemo } from 'react';
import { FileSpreadsheet, ArrowLeft, HelpCircle, AlertCircle } from 'lucide-react';
import { ProductUploadArea } from './ProductUploadArea';
import { ProductImportPreview } from './ProductImportPreview';
import { ProductImportProgress } from './ProductImportProgress';
import { ProductImportSummary } from './ProductImportSummary';
import type { ProductValidated, ImportSummary, ImportProgress, ImportError, ImportStatus } from '../lib/productImportTypes';
import {
  parseCSV,
  processRawProducts,
  calculateImportSummary,
} from '../lib/productImportUtils';
import { supabase } from '../lib/supabase';

interface ProductImportPageProps {
  onBack: () => void;
}

export const ProductImportPage: React.FC<ProductImportPageProps> = ({ onBack }) => {
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
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set());

  // Load existing SKUs from database
  const loadExistingSkus = async (): Promise<Set<string>> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('sku');

      if (error) throw error;

      const skus = new Set<string>();
      data?.forEach((item: { sku: string }) => {
        skus.add(item.sku.toUpperCase());
      });

      return skus;
    } catch (err) {
      console.error('Error loading existing SKUs:', err);
      return new Set();
    }
  };

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    setIsReading(true);
    setStatus('upload');

    try {
      // Load existing SKUs
      const skus = await loadExistingSkus();
      setExistingSkus(skus);

      // Read file
      const extension = file.name.split('.').pop()?.toLowerCase();
      let rawProducts: Array<{ [key: string]: string | number | undefined }> = [];

      if (extension === 'csv') {
        // Parse CSV
        const content = await file.text();
        rawProducts = parseCSV(content);
      } else {
        // Parse Excel using xlsx library (we'll use a simple approach with SheetJS)
        // For now, we'll need to dynamically import it or use a different approach
        // Let's use a workaround - read as array buffer and parse
        rawProducts = await parseExcel(file);
      }

      if (rawProducts.length === 0) {
        alert('Nenhuma linha encontrada na planilha. Verifique se o arquivo está vazio.');
        setIsReading(false);
        return;
      }

      // Process and validate products
      const { products: validated, errors: importErrors } = processRawProducts(rawProducts, skus);

      // Filter out empty rows (rows with only whitespace)
      const nonEmptyEntries = validated.filter(p =>
        p.sku?.trim() || p.name?.trim() || p.ean?.trim()
      );

      setProducts(nonEmptyEntries);
      setErrors(importErrors);
      setSummary(calculateImportSummary(nonEmptyEntries));
      setStatus('preview');
    } catch (err) {
      console.error('Error reading file:', err);
      alert('Erro ao ler o arquivo. Verifique se o formato está correto.');
      setStatus('upload');
    }

    setIsReading(false);
  }, []);

  // Parse Excel file (using SheetJS via CDN or similar)
  const parseExcel = async (file: File): Promise<Array<{ [key: string]: string | number | undefined }>> => {
    // We'll use the XLSX library that we need to install
    // For now, return empty array and show message
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return jsonData as Array<{ [key: string]: string | number | undefined }>;
  };

  // Confirm import
  const handleConfirmImport = useCallback(async () => {
    if (!summary || summary.validProducts === 0) return;

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

    // Import in batches of 50
    const batchSize = 50;
    const batches = Math.ceil(total / batchSize);

    for (let i = 0; i < batches; i++) {
      const batch = validProducts.slice(i * batchSize, (i + 1) * batchSize);

      // Separate new and update
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

        const { error: insertError } = await supabase
          .from('products')
          .insert(insertData);

        if (insertError) {
          console.error('Insert error:', insertError);
          // Continue with next batch
        } else {
          imported += newProducts.length;
          newCount += newProducts.length;
        }
      }

      // Update existing products
      if (updateProducts.length > 0) {
        for (const product of updateProducts) {
          const { error: updateError } = await supabase
            .from('products')
            .update({
              name: product.name,
              ean: product.ean || null,
              location: product.location || null,
              price: product.price || null,
              updated_at: new Date().toISOString(),
            })
            .eq('sku', product.sku);

          if (!updateError) {
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

      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update summary with actual counts
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
      message: 'Importação concluída!',
    });

    setStatus('complete');
  }, [products, summary]);

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
  }, []);

  const handleCancel = useCallback(() => {
    handleReset();
  }, [handleReset]);

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
        {['upload', 'preview', 'importing', 'complete'].filter(s =>
          s === 'upload' || s === 'preview' || s === 'importing' || s === 'complete'
        ).map((step, idx) => {
          const stepLabels = {
            upload: 'Enviar Planilha',
            preview: 'Revisar Dados',
            importing: 'Importando',
            complete: 'Concluído',
          };

          const isComplete =
            (status === 'preview' && idx < 1) ||
            (status === 'importing' && idx < 2) ||
            (status === 'complete' && idx < 4) ||
            false;

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
                  {isComplete ? idx + 1 : idx + 1}
                </div>
                <p className={`text-xs mt-1 font-medium ${
                  isComplete || isCurrent ? 'text-zinc-800' : 'text-zinc-400'
                }`}>
                  {stepLabels[step as keyof typeof stepLabels]}
                </p>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto">
        {status === 'upload' && (
          <ProductUploadArea
            onFileSelect={handleFileSelect}
            isLoading={isReading}
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
      </div>
    </div>
  );
};
