import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  ArrowLeft, Search, Printer, Download, Tag, Package,
  AlertTriangle, X, CheckSquare, Square, RefreshCw, Layers,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ShelfLabel100x40, { ShelfLabel100x40Inner, SHELF_W, SHELF_H } from './ShelfLabel100x40';
import ExcessLabel100x150, { ExcessLabel100x150Inner, EXCESS_W, EXCESS_H } from './ExcessLabel100x150';
import type { LabelProduct } from './ShelfLabel100x40';
import type { QtySize } from './ExcessLabel100x150';

// ─── Types ───────────────────────────────────────────────────────────────────

type LabelType = 'shelf' | 'excess';
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface DbProduct extends LabelProduct {
  id: string;
  price: number | null;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastId = 0;

// ─── html2canvas capture utility ─────────────────────────────────────────────

async function captureElement(el: HTMLElement, scale = 4): Promise<HTMLCanvasElement> {
  console.log('[LabelGen] Capturing element:', el, 'scale:', scale);
  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    allowTaint: false,
  });
  console.log('[LabelGen] Canvas captured:', canvas.width, 'x', canvas.height);
  return canvas;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Print via canvas image ──────────────────────────────────────────────────

async function printLabelElement(
  el: HTMLElement,
  labelType: LabelType,
  copies: number
): Promise<void> {
  const canvas = await captureElement(el, 4);
  const dataUrl = canvas.toDataURL('image/png');

  const w = labelType === 'shelf' ? '100mm' : '100mm';
  const h = labelType === 'shelf' ? '40mm' : '150mm';

  const imagesHtml = Array.from({ length: copies })
    .map(() => `<div class="page"><img src="${dataUrl}" /></div>`)
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size: ${w} ${h}; margin: 0; }
    html, body { margin: 0; padding: 0; background: white; }
    .page {
      width: ${w};
      height: ${h};
      page-break-after: always;
      page-break-inside: avoid;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }
    img { width: ${w}; height: ${h}; display: block; object-fit: fill; }
  </style>
</head>
<body>
  ${imagesHtml}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 300);
    };
  <\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=600,height=400');
  if (!win) {
    throw new Error('Popup bloqueado. Permita popups para este site e tente novamente.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function generatePDF(
  el: HTMLElement,
  labelType: LabelType,
  copies: number,
  sku: string
): Promise<void> {
  const canvas = await captureElement(el, 4);
  const dataUrl = canvas.toDataURL('image/png');

  const wMM = 100;
  const hMM = labelType === 'shelf' ? 40 : 150;

  const pdf = new jsPDF({
    orientation: wMM >= hMM ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [wMM, hMM],
  });

  for (let i = 0; i < copies; i++) {
    if (i > 0) pdf.addPage([wMM, hMM]);
    pdf.addImage(dataUrl, 'PNG', 0, 0, wMM, hMM);
  }

  const safeSku = sku.replace(/[^a-z0-9]/gi, '_');
  pdf.save(`etiqueta-${labelType === 'shelf' ? 'vao' : 'excesso'}-${safeSku}.pdf`);
  console.log('[LabelGen] PDF saved for SKU:', sku, 'copies:', copies);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface LabelGeneratorPageProps {
  onBack: () => void;
}

export const LabelGeneratorPage: React.FC<LabelGeneratorPageProps> = ({ onBack }) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Single mode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'sku' | 'ean'>('sku');
  const [searching, setSearching] = useState(false);
  const [product, setProduct] = useState<DbProduct | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [labelType, setLabelType] = useState<LabelType>('shelf');
  const [excessQty, setExcessQty] = useState(0);
  const [qtySize, setQtySize] = useState<QtySize>('lg');
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);

  // Batch mode
  const [batchProducts, setBatchProducts] = useState<DbProduct[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchLocation, setBatchLocation] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLabelType, setBatchLabelType] = useState<LabelType>('shelf');
  const [batchCopies, setBatchCopies] = useState(1);
  const [batchExcessQty, setBatchExcessQty] = useState(0);

  // Refs for capture — point to the actual-size (non-scaled) inner div
  const captureRef = useRef<HTMLDivElement>(null);

  // ── Toast helpers ─────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setNotFound(false);
    setProduct(null);
    console.log('[LabelGen] Searching:', searchType, '=', q);

    try {
      const field = searchType === 'sku' ? 'sku' : 'ean';
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, ean, location, price')
        .ilike(field, q)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[LabelGen] Supabase error:', error);
        throw error;
      }

      console.log('[LabelGen] Result:', data);

      if (data) {
        setProduct(data as DbProduct);
        showToast('Produto encontrado.', 'success');
      } else {
        setNotFound(true);
        showToast('Produto não encontrado. Verifique SKU ou EAN.', 'error');
      }
    } catch (err) {
      console.error('[LabelGen] Search failed:', err);
      setNotFound(true);
      showToast('Erro ao buscar produto. Tente novamente.', 'error');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, searchType, showToast]);

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    if (!product) { showToast('Selecione um produto primeiro.', 'error'); return; }
    if (!captureRef.current) { showToast('Erro interno: elemento não encontrado.', 'error'); return; }
    setBusy(true);
    try {
      console.log('[LabelGen] Printing type:', labelType, 'copies:', copies);
      await printLabelElement(captureRef.current, labelType, copies);
      showToast('Janela de impressão aberta.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[LabelGen] Print error:', err);
      showToast(`Erro ao imprimir: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  // ── PNG Download ──────────────────────────────────────────────────────────
  const handleDownloadPNG = async () => {
    if (!product) { showToast('Selecione um produto primeiro.', 'error'); return; }
    if (!captureRef.current) { showToast('Erro interno: elemento não encontrado.', 'error'); return; }
    setBusy(true);
    try {
      console.log('[LabelGen] Generating PNG for SKU:', product.sku);
      const canvas = await captureElement(captureRef.current, 4);
      const dataUrl = canvas.toDataURL('image/png');
      const safeSku = product.sku.replace(/[^a-z0-9]/gi, '_');
      downloadDataUrl(dataUrl, `etiqueta-${labelType === 'shelf' ? 'vao' : 'excesso'}-${safeSku}.png`);
      showToast('Imagem PNG baixada com sucesso.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[LabelGen] PNG error:', err);
      showToast(`Erro ao gerar PNG: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  // ── PDF Download ──────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!product) { showToast('Selecione um produto primeiro.', 'error'); return; }
    if (!captureRef.current) { showToast('Erro interno: elemento não encontrado.', 'error'); return; }
    setBusy(true);
    try {
      console.log('[LabelGen] Generating PDF for SKU:', product.sku, 'copies:', copies);
      await generatePDF(captureRef.current, labelType, copies, product.sku);
      showToast('PDF gerado e baixado com sucesso.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[LabelGen] PDF error:', err);
      showToast(`Erro ao gerar PDF: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    setProduct(null);
    setNotFound(false);
    setSearchQuery('');
    setExcessQty(0);
    setCopies(1);
  };

  // ── Batch load ────────────────────────────────────────────────────────────
  const loadBatch = useCallback(async () => {
    setBatchLoading(true);
    console.log('[LabelGen] Loading batch products, search:', batchSearch, 'location:', batchLocation);
    try {
      let q = supabase
        .from('products')
        .select('id, name, sku, ean, location, price')
        .order('name')
        .limit(300);

      if (batchSearch.trim()) {
        q = q.or(`name.ilike.%${batchSearch.trim()}%,sku.ilike.%${batchSearch.trim()}%,ean.ilike.%${batchSearch.trim()}%`);
      }
      if (batchLocation.trim()) {
        q = q.ilike('location', `%${batchLocation.trim()}%`);
      }

      const { data, error } = await q;
      if (error) { console.error('[LabelGen] Batch load error:', error); throw error; }
      console.log('[LabelGen] Batch loaded:', data?.length, 'products');
      setBatchProducts((data as DbProduct[]) || []);
    } catch (err) {
      showToast('Erro ao carregar produtos.', 'error');
    } finally {
      setBatchLoading(false);
    }
  }, [batchSearch, batchLocation, showToast]);

  useEffect(() => {
    if (mode === 'batch') loadBatch();
  }, [mode, loadBatch]);

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelectedIds(prev =>
      prev.size === batchProducts.length
        ? new Set()
        : new Set(batchProducts.map(p => p.id))
    );

  // ── Batch print (sequential capture via hidden DOM) ───────────────────────
  const handleBatchPrint = async () => {
    const selected = batchProducts.filter(p => selectedIds.has(p.id));
    if (!selected.length) { showToast('Selecione ao menos um produto.', 'error'); return; }
    setBusy(true);
    try {
      // Capture first product as sample then build multi-page print
      // Create a temporary container
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;z-index:-1;';
      document.body.appendChild(container);

      const dataUrls: string[] = [];
      for (const p of selected) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:inline-block;background:white;';
        container.appendChild(wrapper);

        // Render label to DOM temporarily
        const { createRoot } = { createRoot }; // already imported above
        const root = createRoot(wrapper);

        await new Promise<void>(resolve => {
          const labelProduct: LabelProduct = { name: p.name, sku: p.sku, ean: p.ean || '', location: p.location || '' };
          if (batchLabelType === 'shelf') {
            root.render(React.createElement(ShelfLabel100x40Inner, { product: labelProduct }));
          } else {
            root.render(React.createElement(ExcessLabel100x150Inner, { product: labelProduct, excessQty: batchExcessQty, qtySize }));
          }
          setTimeout(resolve, 80);
        });

        for (let c = 0; c < batchCopies; c++) {
          const canvas = await captureElement(wrapper.firstElementChild as HTMLElement, 4);
          dataUrls.push(canvas.toDataURL('image/png'));
        }
        root.unmount();
        container.removeChild(wrapper);
      }
      document.body.removeChild(container);

      const w = batchLabelType === 'shelf' ? '100mm' : '100mm';
      const h = batchLabelType === 'shelf' ? '40mm' : '150mm';

      const imagesHtml = dataUrls.map(u => `<div class="page"><img src="${u}" /></div>`).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: ${w} ${h}; margin: 0; }
  html, body { margin: 0; background: white; }
  .page { width: ${w}; height: ${h}; page-break-after: always; page-break-inside: avoid; display: flex; align-items: center; justify-content: center; }
  .page:last-child { page-break-after: auto; }
  img { width: ${w}; height: ${h}; display: block; object-fit: fill; }
</style></head><body>
${imagesHtml}
<script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close();};},300);};<\/script>
</body></html>`;

      const win = window.open('', '_blank', 'width=600,height=400');
      if (!win) throw new Error('Popup bloqueado. Permita popups e tente novamente.');
      win.document.write(html);
      win.document.close();
      showToast(`Impressão de ${dataUrls.length} etiqueta(s) aberta.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[LabelGen] Batch print error:', err);
      showToast(`Erro na impressão em lote: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Current label product from state
  const labelProduct: LabelProduct | null = product
    ? { name: product.name, sku: product.sku, ean: product.ean || '', location: product.location || '' }
    : null;

  const SHELF_PREVIEW = 2.3;
  const EXCESS_PREVIEW = 1.0;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold max-w-xs pointer-events-auto ${
              t.type === 'success' ? 'bg-emerald-600 text-white' :
              t.type === 'error' ? 'bg-red-600 text-white' :
              'bg-zinc-800 text-white'
            }`}
          >
            {t.type === 'success' ? <CheckCircle2 size={16} /> : t.type === 'error' ? <AlertCircle size={16} /> : null}
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-zinc-950 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition text-sm font-medium"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="flex items-center gap-2">
              <Tag size={22} className="text-emerald-400" />
              <div>
                <h1 className="font-bold text-base leading-tight">Gerador de Etiquetas</h1>
                <p className="text-xs text-zinc-400 hidden sm:block">
                  Etiqueta de Vão 100×40mm · Etiqueta de Excesso 100×150mm
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${mode === 'single' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Unitário
            </button>
            <button
              onClick={() => setMode('batch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${mode === 'batch' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              <Layers size={14} /> Lote
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── SINGLE MODE ────────────────────────────────────────── */}
        {mode === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* LEFT: search + settings + actions */}
            <div className="space-y-4">

              {/* Search */}
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
                  <Search size={16} className="text-zinc-500" />
                  Buscar Produto
                </h2>
                <div className="flex gap-2 mb-3">
                  {(['sku', 'ean'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setSearchType(t)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border transition ${
                        searchType === t
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      Por {t.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={searchType === 'sku' ? 'Digite o SKU...' : 'Digite o EAN / código de barras...'}
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setNotFound(false); }}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="flex-1 px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || !searchQuery.trim()}
                    className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {searching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                  </button>
                </div>
                {notFound && (
                  <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertTriangle size={16} />
                    Produto não encontrado. Verifique o SKU ou EAN.
                  </div>
                )}
              </div>

              {/* Product info */}
              {product && (
                <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-emerald-800 text-sm flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Produto Encontrado
                    </h2>
                    <button onClick={handleClear} className="text-zinc-400 hover:text-zinc-700">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2.5 bg-zinc-50 rounded-lg">
                      <p className="text-xs text-zinc-400 font-semibold uppercase mb-0.5">Nome</p>
                      <p className="font-bold text-zinc-800 text-sm">{product.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'SKU', value: product.sku },
                        { label: 'EAN', value: product.ean || '—' },
                        { label: 'Local', value: product.location || '—' },
                        ...(product.price != null ? [{ label: 'Preço', value: product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }] : []),
                      ].map(({ label, value }) => (
                        <div key={label} className="p-2.5 bg-zinc-50 rounded-lg">
                          <p className="text-xs text-zinc-400 font-semibold uppercase mb-0.5">{label}</p>
                          <p className="font-mono font-bold text-zinc-800 text-sm">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Label settings */}
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
                  <Tag size={16} className="text-zinc-500" />
                  Configurações da Etiqueta
                </h2>
                {/* Type */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Tipo</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLabelType('shelf')}
                      className={`p-3 rounded-lg border-2 text-left transition ${
                        labelType === 'shelf' ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <p className={`font-bold text-xs ${labelType === 'shelf' ? 'text-emerald-700' : 'text-zinc-700'}`}>Etiqueta de Vão</p>
                      <p className="text-xs text-zinc-400 mt-0.5">100 × 40mm</p>
                    </button>
                    <button
                      onClick={() => setLabelType('excess')}
                      className={`p-3 rounded-lg border-2 text-left transition ${
                        labelType === 'excess' ? 'border-red-500 bg-red-50' : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <p className={`font-bold text-xs ${labelType === 'excess' ? 'text-red-700' : 'text-zinc-700'}`}>Excesso de Estoque</p>
                      <p className="text-xs text-zinc-400 mt-0.5">100 × 150mm</p>
                    </button>
                  </div>
                </div>

                {/* Excess fields */}
                {labelType === 'excess' && (
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">
                        Quantidade em Excesso
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={excessQty}
                        onChange={e => setExcessQty(Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">
                        Tamanho da Quantidade
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['sm', 'md', 'lg', 'xl'] as QtySize[]).map(s => (
                          <button
                            key={s}
                            onClick={() => setQtySize(s)}
                            className={`py-2 rounded-lg text-xs font-bold border transition ${
                              qtySize === s
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                            }`}
                          >
                            {s.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Copies */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">
                    Quantidade de Cópias
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={copies}
                    onChange={e => setCopies(Math.max(1, Number(e.target.value)))}
                    className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono"
                  />
                </div>
              </div>

              {/* Actions */}
              {product && (
                <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                  <h2 className="font-bold text-zinc-800 text-sm mb-4">Ações</h2>
                  <div className="space-y-2">
                    <button
                      onClick={handlePrint}
                      disabled={busy}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-bold transition disabled:opacity-60"
                    >
                      {busy ? <RefreshCw size={16} className="animate-spin" /> : <Printer size={16} />}
                      Imprimir {copies > 1 ? `(${copies} cópias)` : ''}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleDownloadPNG}
                        disabled={busy}
                        className="flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
                      >
                        {busy ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                        Download PNG
                      </button>
                      <button
                        onClick={handleDownloadPDF}
                        disabled={busy}
                        className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
                      >
                        {busy ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                        Download PDF
                      </button>
                    </div>
                    <button
                      onClick={handleClear}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-sm font-semibold transition"
                    >
                      <X size={14} />
                      Limpar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: preview */}
            <div>
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 sticky top-28">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-zinc-800 text-sm flex items-center gap-2">
                    <Tag size={16} className="text-zinc-400" />
                    Pré-visualização
                  </h2>
                  <span className="text-xs text-zinc-400">
                    {labelType === 'shelf' ? '100 × 40mm' : '100 × 150mm'}
                  </span>
                </div>

                {!labelProduct ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-300">
                    <Tag size={48} className="mb-3 opacity-20" />
                    <p className="text-sm text-center">Busque um produto para ver a pré-visualização</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="rounded-lg overflow-hidden shadow-lg">
                      {labelType === 'shelf' ? (
                        <ShelfLabel100x40 product={labelProduct} previewScale={SHELF_PREVIEW} innerRef={captureRef} />
                      ) : (
                        <ExcessLabel100x150 product={labelProduct} excessQty={excessQty} qtySize={qtySize} previewScale={EXCESS_PREVIEW} innerRef={captureRef} />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 text-center">
                      {labelType === 'shelf'
                        ? 'Visualização aumentada. Imprime em 100×40mm real.'
                        : 'Visualização em tamanho real (100×150mm).'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BATCH MODE ─────────────────────────────────────────── */}
        {mode === 'batch' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
              <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
                <Search size={16} className="text-zinc-500" />
                Filtros e Configurações
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Buscar</label>
                  <input
                    type="text"
                    placeholder="Nome, SKU ou EAN..."
                    value={batchSearch}
                    onChange={e => setBatchSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Localização</label>
                  <input
                    type="text"
                    placeholder="Ex: A-01..."
                    value={batchLocation}
                    onChange={e => setBatchLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Tipo de Etiqueta</label>
                  <select
                    value={batchLabelType}
                    onChange={e => setBatchLabelType(e.target.value as LabelType)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
                  >
                    <option value="shelf">Vão — 100×40mm</option>
                    <option value="excess">Excesso — 100×150mm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Cópias por produto</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={batchCopies}
                    onChange={e => setBatchCopies(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono"
                  />
                </div>
              </div>
              {batchLabelType === 'excess' && (
                <div className="mt-3 max-w-xs">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Qtd em Excesso (padrão)</label>
                  <input
                    type="number"
                    min="0"
                    value={batchExcessQty}
                    onChange={e => setBatchExcessQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono"
                  />
                </div>
              )}
              <div className="mt-4">
                <button
                  onClick={loadBatch}
                  disabled={batchLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  {batchLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                  Buscar Produtos
                </button>
              </div>
            </div>

            {/* Selected actions */}
            {selectedIds.size > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-emerald-800">
                  {selectedIds.size} produto(s) · {selectedIds.size * batchCopies} etiqueta(s)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleBatchPrint}
                    disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
                  >
                    {busy ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={14} />}
                    Imprimir Selecionadas
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} className="px-3 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-lg text-sm">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Products table */}
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
                <h2 className="font-bold text-zinc-800 text-sm">Produtos ({batchProducts.length})</h2>
                <button
                  onClick={toggleAll}
                  className="text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 font-medium"
                >
                  {selectedIds.size === batchProducts.length && batchProducts.length > 0
                    ? <><CheckSquare size={14} /> Desmarcar todos</>
                    : <><Square size={14} /> Marcar todos</>
                  }
                </button>
              </div>

              {batchLoading ? (
                <div className="flex items-center justify-center py-12 text-zinc-400 gap-2">
                  <RefreshCw size={20} className="animate-spin" /> Carregando...
                </div>
              ) : batchProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-300">
                  <Package size={40} className="mb-2 opacity-30" />
                  <p className="text-sm">Nenhum produto encontrado.</p>
                  <p className="text-xs mt-1">Importe produtos primeiro ou ajuste os filtros.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-4 py-3 w-10"></th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Nome</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">SKU</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">EAN</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Local</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {batchProducts.map(p => (
                        <tr
                          key={p.id}
                          onClick={() => toggleSelect(p.id)}
                          className={`cursor-pointer transition ${selectedIds.has(p.id) ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-zinc-50'}`}
                        >
                          <td className="px-4 py-3">
                            {selectedIds.has(p.id)
                              ? <CheckSquare size={16} className="text-emerald-600" />
                              : <Square size={16} className="text-zinc-300" />
                            }
                          </td>
                          <td className="px-4 py-3 font-medium text-zinc-800 max-w-[200px] truncate">{p.name}</td>
                          <td className="px-4 py-3 font-mono text-zinc-600 text-xs">{p.sku}</td>
                          <td className="px-4 py-3 font-mono text-zinc-500 text-xs">{p.ean || '—'}</td>
                          <td className="px-4 py-3 text-zinc-600">{p.location || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
