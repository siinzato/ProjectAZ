/**
 * LabelGeneratorPage
 *
 * Arquitetura de captura:
 *   captureRef → elemento REAL (100mm×40mm ou 100mm×150mm), posicionado fora
 *                da tela via position:fixed; left:-9999px. html2canvas lê
 *                este elemento diretamente.
 *   Preview   → mesmo componente, envolvido em wrapper com transform:scale()
 *                para aumentar a exibição na tela.
 *
 * Impressão: CSS @media print sem popup (window.print() na própria página).
 * PNG:       html2canvas no captureRef, scale:4 → alta resolução.
 * PDF:       html2canvas + jsPDF, formato exato em mm.
 */

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
import ShelfLabel100x40 from './ShelfLabel100x40';
import ExcessLabel100x150 from './ExcessLabel100x150';
import type { LabelProduct } from './ShelfLabel100x40';
import type { QtySize } from './ExcessLabel100x150';

// ─── Types ────────────────────────────────────────────────────────────────────

type LabelType = 'shelf' | 'excess';
type ToastType = 'success' | 'error' | 'info';

interface Toast { id: number; message: string; type: ToastType }
interface DbProduct extends LabelProduct { id: string; price: number | null }

let _tid = 0;

// ── Pixel equivalents of mm at 96dpi (for scale calculations) ─────────────────
// 1mm = 3.7795px → 100mm ≈ 378px, 40mm ≈ 151px, 150mm ≈ 567px
const SHELF_PX_W = 378;
const SHELF_PX_H = 151;
const EXCESS_PX_W = 378;
const EXCESS_PX_H = 567;

// ── Print styles injected into <head> ────────────────────────────────────────

function injectPrintStyle(labelType: LabelType) {
  const existing = document.getElementById('_label_print_style');
  if (existing) existing.remove();

  const size = labelType === 'shelf' ? '100mm 40mm' : '100mm 150mm';
  const el = document.createElement('style');
  el.id = '_label_print_style';
  el.textContent = `
    @media print {
      @page { size: ${size}; margin: 0; }
      body > * { display: none !important; }
      #_label_print_area { display: flex !important; }
    }
    #_label_print_area {
      display: none;
      position: fixed;
      left: 0;
      top: 0;
      z-index: 99999;
      width: ${labelType === 'shelf' ? '100mm' : '100mm'};
      background: white;
      flex-direction: column;
    }
  `;
  document.head.appendChild(el);
}

function removePrintStyle() {
  document.getElementById('_label_print_style')?.remove();
  document.getElementById('_label_print_area')?.remove();
}

// ── Render label copies into a temporary DOM area and print ──────────────────

function printLabels(
  product: LabelProduct,
  labelType: LabelType,
  copies: number,
  excessQty: number,
  qtySize: QtySize
) {
  removePrintStyle();
  injectPrintStyle(labelType);

  // Build print area
  const area = document.createElement('div');
  area.id = '_label_print_area';
  document.body.appendChild(area);

  const root = createRoot(area);
  const items = Array.from({ length: copies });

  root.render(
    React.createElement(React.Fragment, null,
      ...items.map((_, i) =>
        React.createElement(
          'div',
          {
            key: i,
            style: {
              pageBreakAfter: i < copies - 1 ? 'always' : 'auto',
              pageBreakInside: 'avoid',
            }
          },
          labelType === 'shelf'
            ? React.createElement(ShelfLabel100x40, { product })
            : React.createElement(ExcessLabel100x150, { product, excessQty, qtySize })
        )
      )
    )
  );

  // Wait for render then print
  setTimeout(() => {
    window.print();
    window.addEventListener('afterprint', () => {
      root.unmount();
      removePrintStyle();
    }, { once: true });
  }, 200);
}

// ── html2canvas capture ──────────────────────────────────────────────────────

async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  console.log('[LabelGen] Capturing element:', el.id || el.className, 'rect:', el.getBoundingClientRect());
  const canvas = await html2canvas(el, {
    scale: 4,
    useCORS: true,
    logging: true,
    backgroundColor: '#ffffff',
    allowTaint: false,
    removeContainer: false,
  });
  console.log('[LabelGen] Canvas size:', canvas.width, 'x', canvas.height);
  return canvas;
}

// ── PNG download ─────────────────────────────────────────────────────────────

async function downloadPNG(el: HTMLElement, sku: string, labelType: LabelType) {
  const canvas = await captureElement(el);
  const link = document.createElement('a');
  link.download = `etiqueta-${labelType === 'shelf' ? 'vao' : 'excesso'}-${sku.replace(/[^a-z0-9]/gi, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ── PDF download ─────────────────────────────────────────────────────────────

async function downloadPDF(
  el: HTMLElement,
  sku: string,
  labelType: LabelType,
  copies: number
) {
  const canvas = await captureElement(el);
  const imgData = canvas.toDataURL('image/png');

  const wMM = 100;
  const hMM = labelType === 'shelf' ? 40 : 150;

  const pdf = new jsPDF({
    orientation: wMM >= hMM ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [wMM, hMM],
  });

  for (let i = 0; i < copies; i++) {
    if (i > 0) pdf.addPage([wMM, hMM], wMM >= hMM ? 'landscape' : 'portrait');
    pdf.addImage(imgData, 'PNG', 0, 0, wMM, hMM);
  }

  pdf.save(`etiqueta-${labelType === 'shelf' ? 'vao' : 'excesso'}-${sku.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}

// ── Render a label off-screen, capture it, unmount ───────────────────────────

async function captureProductLabel(
  product: LabelProduct,
  labelType: LabelType,
  excessQty: number,
  qtySize: QtySize
): Promise<HTMLCanvasElement> {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;background:white;';
  document.body.appendChild(container);
  const root = createRoot(container);

  const canvas = await new Promise<HTMLCanvasElement>((resolve, reject) => {
    root.render(
      React.createElement(
        'div',
        { id: '__batch_capture' },
        labelType === 'shelf'
          ? React.createElement(ShelfLabel100x40, { product })
          : React.createElement(ExcessLabel100x150, { product, excessQty, qtySize })
      )
    );
    setTimeout(async () => {
      const el = container.firstElementChild as HTMLElement;
      if (!el) { reject(new Error('element not rendered')); return; }
      try { resolve(await captureElement(el)); }
      catch (e) { reject(e); }
    }, 150);
  });

  root.unmount();
  document.body.removeChild(container);
  return canvas;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface LabelGeneratorPageProps {
  onBack: () => void;
}

// Preview scale — wraps the label visually (captureRef points to INNER element)
const SHELF_SCALE = 2.4;   // 378px → preview ~907px wide
const EXCESS_SCALE = 1.15; // 378px → preview ~435px, 567px → ~652px tall

export const LabelGeneratorPage: React.FC<LabelGeneratorPageProps> = ({ onBack }) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Single mode state
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

  // Batch state
  const [batchProducts, setBatchProducts] = useState<DbProduct[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchLocation, setBatchLocation] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLabelType, setBatchLabelType] = useState<LabelType>('shelf');
  const [batchCopies, setBatchCopies] = useState(1);
  const [batchExcessQty, setBatchExcessQty] = useState(0);

  // captureRef → the real-size element, positioned off-screen
  const captureRef = useRef<HTMLDivElement>(null);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_tid;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  }, []);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setNotFound(false);
    setProduct(null);
    console.log('[LabelGen] Search:', searchType, '=', q);

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, ean, location, price')
        .ilike(searchType, q)
        .limit(1)
        .maybeSingle();

      console.log('[LabelGen] Result:', data, 'error:', error);
      if (error) throw error;
      if (data) { setProduct(data as DbProduct); toast('Produto encontrado.', 'success'); }
      else { setNotFound(true); toast('Produto não encontrado. Verifique SKU ou EAN.', 'error'); }
    } catch (err) {
      console.error('[LabelGen] Search error:', err);
      setNotFound(true);
      toast('Erro ao buscar produto.', 'error');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, searchType, toast]);

  // ── Print (no popup) ─────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    if (!product) { toast('Selecione um produto primeiro.', 'error'); return; }
    console.log('[LabelGen] Print type:', labelType, 'copies:', copies);
    try {
      printLabels(labelAsProduct(product), labelType, copies, excessQty, qtySize);
      toast('Impressão enviada.', 'success');
    } catch (err) {
      console.error('[LabelGen] Print error:', err);
      toast('Erro ao imprimir.', 'error');
    }
  }, [product, labelType, copies, excessQty, qtySize, toast]);

  // ── PNG ───────────────────────────────────────────────────────────────────
  const handlePNG = useCallback(async () => {
    if (!product || !captureRef.current) { toast('Produto não selecionado.', 'error'); return; }
    setBusy(true);
    try {
      console.log('[LabelGen] PNG capture start');
      await downloadPNG(captureRef.current, product.sku, labelType);
      toast('PNG baixado com sucesso.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[LabelGen] PNG error:', err);
      toast(`Erro ao gerar PNG: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [product, labelType, toast]);

  // ── PDF ───────────────────────────────────────────────────────────────────
  const handlePDF = useCallback(async () => {
    if (!product || !captureRef.current) { toast('Produto não selecionado.', 'error'); return; }
    setBusy(true);
    try {
      console.log('[LabelGen] PDF capture start, copies:', copies);
      await downloadPDF(captureRef.current, product.sku, labelType, copies);
      toast('PDF gerado com sucesso.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[LabelGen] PDF error:', err);
      toast(`Erro ao gerar PDF: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [product, labelType, copies, toast]);

  // ── Batch load ────────────────────────────────────────────────────────────
  const loadBatch = useCallback(async () => {
    setBatchLoading(true);
    try {
      let q = supabase.from('products').select('id, name, sku, ean, location, price').order('name').limit(300);
      if (batchSearch.trim()) q = q.or(`name.ilike.%${batchSearch.trim()}%,sku.ilike.%${batchSearch.trim()}%,ean.ilike.%${batchSearch.trim()}%`);
      if (batchLocation.trim()) q = q.ilike('location', `%${batchLocation.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      setBatchProducts((data as DbProduct[]) || []);
    } catch (err) {
      console.error('[LabelGen] Batch load error:', err);
      toast('Erro ao carregar produtos.', 'error');
    } finally {
      setBatchLoading(false);
    }
  }, [batchSearch, batchLocation, toast]);

  useEffect(() => { if (mode === 'batch') loadBatch(); }, [mode, loadBatch]);

  // ── Batch print ───────────────────────────────────────────────────────────
  const handleBatchPrint = useCallback(() => {
    const selected = batchProducts.filter(p => selectedIds.has(p.id));
    if (!selected.length) { toast('Selecione ao menos um produto.', 'error'); return; }

    removePrintStyle();
    injectPrintStyle(batchLabelType);

    const area = document.createElement('div');
    area.id = '_label_print_area';
    document.body.appendChild(area);
    const root = createRoot(area);

    const allLabels = selected.flatMap(p =>
      Array.from({ length: batchCopies }, (_, i) => ({ p, i }))
    );

    root.render(
      React.createElement(React.Fragment, null,
        ...allLabels.map(({ p, i }, globalIdx) =>
          React.createElement(
            'div',
            { key: `${p.id}-${i}`, style: { pageBreakAfter: globalIdx < allLabels.length - 1 ? 'always' : 'auto', pageBreakInside: 'avoid' } },
            batchLabelType === 'shelf'
              ? React.createElement(ShelfLabel100x40, { product: labelAsProduct(p) })
              : React.createElement(ExcessLabel100x150, { product: labelAsProduct(p), excessQty: batchExcessQty, qtySize })
          )
        )
      )
    );

    setTimeout(() => {
      window.print();
      window.addEventListener('afterprint', () => { root.unmount(); removePrintStyle(); }, { once: true });
      toast(`Imprimindo ${allLabels.length} etiqueta(s).`, 'success');
    }, 250);
  }, [batchProducts, selectedIds, batchLabelType, batchCopies, batchExcessQty, qtySize, toast]);

  // ── Batch PDF ─────────────────────────────────────────────────────────────
  const handleBatchPDF = useCallback(async () => {
    const selected = batchProducts.filter(p => selectedIds.has(p.id));
    if (!selected.length) { toast('Selecione ao menos um produto.', 'error'); return; }
    setBusy(true);
    try {
      const wMM = 100;
      const hMM = batchLabelType === 'shelf' ? 40 : 150;
      const pdf = new jsPDF({ orientation: wMM >= hMM ? 'landscape' : 'portrait', unit: 'mm', format: [wMM, hMM] });
      let pageIdx = 0;

      for (const p of selected) {
        const canvas = await captureProductLabel(labelAsProduct(p), batchLabelType, batchExcessQty, qtySize);
        const imgData = canvas.toDataURL('image/png');
        for (let c = 0; c < batchCopies; c++) {
          if (pageIdx > 0) pdf.addPage([wMM, hMM], wMM >= hMM ? 'landscape' : 'portrait');
          pdf.addImage(imgData, 'PNG', 0, 0, wMM, hMM);
          pageIdx++;
        }
      }

      pdf.save(`etiquetas-lote-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast(`PDF com ${pageIdx} etiqueta(s) gerado.`, 'success');
    } catch (err: unknown) {
      console.error('[LabelGen] Batch PDF error:', err);
      toast('Erro ao gerar PDF em lote.', 'error');
    } finally {
      setBusy(false);
    }
  }, [batchProducts, selectedIds, batchLabelType, batchCopies, batchExcessQty, qtySize, toast]);

  const handleClear = () => { setProduct(null); setNotFound(false); setSearchQuery(''); setExcessQty(0); setCopies(1); };
  const toggleSelect = (id: string) => setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelectedIds(p => p.size === batchProducts.length ? new Set() : new Set(batchProducts.map(x => x.id)));

  const labelProduct = product ? labelAsProduct(product) : null;

  return (
    <div className="min-h-screen bg-zinc-50">

      {/* ── OFF-SCREEN CAPTURE TARGET ──────────────────────────────────────────
          This element is the actual-size label. html2canvas reads from here.
          Must NOT be display:none or visibility:hidden (html2canvas won't render).
          position:fixed + left:-9999px keeps it out of view. */}
      {labelProduct && (
        <div
          style={{
            position: 'fixed',
            left: '-9999px',
            top: '0',
            zIndex: -1,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          {labelType === 'shelf' ? (
            <ShelfLabel100x40 ref={captureRef} product={labelProduct} />
          ) : (
            <ExcessLabel100x150 ref={captureRef} product={labelProduct} excessQty={excessQty} qtySize={qtySize} />
          )}
        </div>
      )}

      {/* ── TOASTS ──────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold max-w-xs pointer-events-auto transition-all ${
            t.type === 'success' ? 'bg-emerald-600 text-white' :
            t.type === 'error' ? 'bg-red-600 text-white' :
            'bg-zinc-800 text-white'}`}>
            {t.type === 'success' ? <CheckCircle2 size={15} /> : t.type === 'error' ? <AlertCircle size={15} /> : null}
            {t.message}
          </div>
        ))}
      </div>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-zinc-950 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition text-sm font-medium">
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            <div className="flex items-center gap-2">
              <Tag size={22} className="text-emerald-400" />
              <div>
                <h1 className="font-bold text-base leading-tight">Gerador de Etiquetas</h1>
                <p className="text-xs text-zinc-400 hidden sm:block">Vão 100×40mm · Excesso 100×150mm</p>
              </div>
            </div>
          </div>
          <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1">
            {(['single', 'batch'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${mode === m ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
                {m === 'batch' ? <><Layers size={14} /> Lote</> : 'Unitário'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ══ SINGLE MODE ════════════════════════════════════════════════════ */}
        {mode === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* LEFT */}
            <div className="space-y-4">

              {/* Search */}
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
                  <Search size={16} className="text-zinc-500" /> Buscar Produto
                </h2>
                <div className="flex gap-2 mb-3">
                  {(['sku', 'ean'] as const).map(t => (
                    <button key={t} onClick={() => setSearchType(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${searchType === t ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'}`}>
                      Por {t.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={searchType === 'sku' ? 'Digite o SKU...' : 'Digite o EAN...'}
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setNotFound(false); }}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="flex-1 px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                  <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
                    className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2 transition">
                    {searching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                  </button>
                </div>
                {notFound && (
                  <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertTriangle size={16} /> Produto não encontrado. Verifique o SKU ou EAN.
                  </div>
                )}
              </div>

              {/* Product found */}
              {product && (
                <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-emerald-800 text-sm flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" /> Produto Encontrado
                    </h2>
                    <button onClick={handleClear} className="text-zinc-400 hover:text-zinc-700"><X size={16} /></button>
                  </div>
                  <div className="p-2.5 bg-zinc-50 rounded-lg mb-2">
                    <p className="text-xs text-zinc-400 font-semibold uppercase mb-0.5">Nome</p>
                    <p className="font-bold text-zinc-800 text-sm">{product.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[['SKU', product.sku], ['EAN', product.ean || '—'], ['Local', product.location || '—']].map(([l, v]) => (
                      <div key={l} className="p-2.5 bg-zinc-50 rounded-lg">
                        <p className="text-xs text-zinc-400 font-semibold uppercase mb-0.5">{l}</p>
                        <p className="font-mono font-bold text-zinc-800 text-sm">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Label settings */}
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
                  <Tag size={16} className="text-zinc-500" /> Configurações
                </h2>

                {/* Type selector */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Tipo de Etiqueta</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: 'shelf' as LabelType, label: 'Etiqueta de Vão', sub: '100 × 40mm', col: 'emerald' },
                      { v: 'excess' as LabelType, label: 'Excesso de Estoque', sub: '100 × 150mm', col: 'red' },
                    ]).map(({ v, label, sub, col }) => (
                      <button key={v} onClick={() => setLabelType(v)}
                        className={`p-3 rounded-lg border-2 text-left transition ${labelType === v ? `border-${col}-500 bg-${col}-50` : 'border-zinc-200 bg-white hover:border-zinc-300'}`}>
                        <p className={`font-bold text-xs ${labelType === v ? `text-${col}-700` : 'text-zinc-700'}`}>{label}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Excess settings */}
                {labelType === 'excess' && (
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Quantidade em Excesso</label>
                      <input type="number" min="0" value={excessQty} onChange={e => setExcessQty(Number(e.target.value))}
                        className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Tamanho da Quantidade</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['sm', 'md', 'lg', 'xl'] as QtySize[]).map(s => (
                          <button key={s} onClick={() => setQtySize(s)}
                            className={`py-2 rounded-lg text-xs font-bold border transition ${qtySize === s ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'}`}>
                            {s.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Copies */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Quantidade de Cópias</label>
                  <input type="number" min="1" max="999" value={copies} onChange={e => setCopies(Math.max(1, Number(e.target.value)))}
                    className="w-full px-4 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono" />
                </div>
              </div>

              {/* Actions */}
              {product && (
                <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                  <h2 className="font-bold text-zinc-800 text-sm mb-3">Ações</h2>
                  <div className="space-y-2">
                    <button onClick={handlePrint} disabled={busy}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-bold transition disabled:opacity-60">
                      <Printer size={16} /> Imprimir {copies > 1 ? `(${copies} cópias)` : ''}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={handlePNG} disabled={busy}
                        className="flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60">
                        {busy ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                        Download PNG
                      </button>
                      <button onClick={handlePDF} disabled={busy}
                        className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60">
                        {busy ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                        Download PDF
                      </button>
                    </div>
                    <button onClick={handleClear}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-sm font-semibold transition">
                      <X size={14} /> Limpar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — PREVIEW */}
            <div>
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 sticky top-28">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-zinc-800 text-sm">Pré-visualização</h2>
                  <span className="text-xs text-zinc-400">{labelType === 'shelf' ? '100 × 40mm' : '100 × 150mm'}</span>
                </div>

                {!labelProduct ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-300">
                    <Tag size={48} className="mb-3 opacity-20" />
                    <p className="text-sm text-center">Busque um produto para visualizar</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    {/* PREVIEW WRAPPER — scales up for display only */}
                    <div
                      style={{
                        width: labelType === 'shelf' ? SHELF_PX_W * SHELF_SCALE : EXCESS_PX_W * EXCESS_SCALE,
                        height: labelType === 'shelf' ? SHELF_PX_H * SHELF_SCALE : EXCESS_PX_H * EXCESS_SCALE,
                        overflow: 'hidden',
                        position: 'relative',
                        borderRadius: 4,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          transform: `scale(${labelType === 'shelf' ? SHELF_SCALE : EXCESS_SCALE})`,
                          transformOrigin: 'top left',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                        }}
                      >
                        {/* Preview renders the same component — NOT the captureRef one */}
                        {labelType === 'shelf' ? (
                          <ShelfLabel100x40 product={labelProduct} />
                        ) : (
                          <ExcessLabel100x150 product={labelProduct} excessQty={excessQty} qtySize={qtySize} />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 text-center">
                      Visualização ampliada. Download e impressão saem em tamanho real.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ BATCH MODE ════════════════════════════════════════════════════ */}
        {mode === 'batch' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
              <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
                <Search size={16} className="text-zinc-500" /> Filtros
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Buscar', value: batchSearch, onChange: setBatchSearch, placeholder: 'Nome, SKU ou EAN...' },
                  { label: 'Localização', value: batchLocation, onChange: setBatchLocation, placeholder: 'Ex: A-01...' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">{f.label}</label>
                    <input type="text" value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Tipo</label>
                  <select value={batchLabelType} onChange={e => setBatchLabelType(e.target.value as LabelType)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white">
                    <option value="shelf">Vão — 100×40mm</option>
                    <option value="excess">Excesso — 100×150mm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Cópias/produto</label>
                  <input type="number" min="1" max="99" value={batchCopies} onChange={e => setBatchCopies(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono" />
                </div>
              </div>
              {batchLabelType === 'excess' && (
                <div className="mt-3 max-w-xs">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Qtd em Excesso (padrão)</label>
                  <input type="number" min="0" value={batchExcessQty} onChange={e => setBatchExcessQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono" />
                </div>
              )}
              <div className="mt-4">
                <button onClick={loadBatch} disabled={batchLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
                  {batchLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />} Buscar
                </button>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-emerald-800">
                  {selectedIds.size} produto(s) · {selectedIds.size * batchCopies} etiqueta(s)
                </p>
                <div className="flex gap-2">
                  <button onClick={handleBatchPrint} disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60">
                    {busy ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={14} />} Imprimir
                  </button>
                  <button onClick={handleBatchPDF} disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60">
                    {busy ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />} PDF
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} className="px-3 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-lg text-sm">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
                <h2 className="font-bold text-zinc-800 text-sm">Produtos ({batchProducts.length})</h2>
                <button onClick={toggleAll} className="text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 font-medium">
                  {selectedIds.size === batchProducts.length && batchProducts.length > 0
                    ? <><CheckSquare size={14} /> Desmarcar todos</>
                    : <><Square size={14} /> Marcar todos</>}
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
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        {['', 'Nome', 'SKU', 'EAN', 'Local'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {batchProducts.map(p => (
                        <tr key={p.id} onClick={() => toggleSelect(p.id)}
                          className={`cursor-pointer transition ${selectedIds.has(p.id) ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-zinc-50'}`}>
                          <td className="px-4 py-3">
                            {selectedIds.has(p.id) ? <CheckSquare size={16} className="text-emerald-600" /> : <Square size={16} className="text-zinc-300" />}
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

// ── Helper ────────────────────────────────────────────────────────────────────

function labelAsProduct(p: DbProduct | LabelProduct): LabelProduct {
  return { name: p.name, sku: p.sku, ean: p.ean || '', location: p.location || '' };
}
