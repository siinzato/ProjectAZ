import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowLeft, Search, Printer, Download, Tag, Package,
  AlertTriangle, X, CheckSquare, Square, RefreshCw, Layers,
  MapPin, Hash, Barcode, ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  sku: string;
  ean: string | null;
  location: string | null;
  price: number | null;
}

type LabelType = 'shelf' | 'excess';

interface BatchItem {
  product: Product;
  labelType: LabelType;
  copies: number;
  excessQty: number;
}

// ─── SVG Label: Etiqueta de Vão 100×40mm ─────────────────────────────────────

interface ShelfLabelProps {
  product: Product;
  scale?: number;
}

const PX_PER_MM = 3.7795;

export const ShelfLabelSVG = React.forwardRef<SVGSVGElement, ShelfLabelProps>(
  ({ product, scale = 1 }, ref) => {
    const W = 100 * PX_PER_MM;
    const H = 40 * PX_PER_MM;
    const sw = W * scale;
    const sh = H * scale;

    const name = product.name || 'SEM NOME';
    const sku = product.sku || '—';
    const ean = product.ean || '—';
    const loc = product.location || '—';

    // truncate long name for display
    const nameDisplay = name.length > 38 ? name.slice(0, 36) + '…' : name;

    return (
      <svg
        ref={ref}
        width={sw}
        height={sh}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Background */}
        <rect x="0" y="0" width={W} height={H} fill="white" />
        {/* Outer border */}
        <rect x="0.5" y="0.5" width={W - 1} height={H - 1} fill="none" stroke="#111" strokeWidth="1" />

        {/* Name row */}
        <rect x="0.5" y="0.5" width={W - 1} height="9.5" fill="#111" />
        <text x={W / 2} y="7.8" textAnchor="middle" fill="white"
          fontWeight="700" fontSize="5.5" letterSpacing="0.2">
          {nameDisplay}
        </text>

        {/* Divider 1 */}
        <line x1="1" y1="10" x2={W - 1} y2="10" stroke="#ccc" strokeWidth="0.4" />

        {/* Location */}
        <text x="4" y="17.5" fill="#333" fontSize="4.2" fontWeight="600">LOCAL:</text>
        <text x="22" y="17.5" fill="#111" fontSize="4.5" fontWeight="700">{loc}</text>

        {/* Divider 2 */}
        <line x1="1" y1="21" x2={W - 1} y2="21" stroke="#ccc" strokeWidth="0.4" />

        {/* SKU */}
        <text x="4" y="27.5" fill="#333" fontSize="4.2" fontWeight="600">SKU:</text>
        <text x="18" y="27.5" fill="#111" fontSize="5.5" fontWeight="800"
          letterSpacing="0.5">{sku}</text>

        {/* Divider 3 */}
        <line x1="1" y1="30.5" x2={W - 1} y2="30.5" stroke="#ccc" strokeWidth="0.4" />

        {/* EAN */}
        <text x="4" y="36.5" fill="#333" fontSize="4.2" fontWeight="600">EAN:</text>
        <text x="20" y="36.5" fill="#000" fontSize="6" fontWeight="900"
          letterSpacing="0.8">{ean}</text>

        {/* Bottom border accent */}
        <rect x="0.5" y={H - 1} width={W - 1} height="0.5" fill="#111" />
      </svg>
    );
  }
);

// ─── SVG Label: Etiqueta de Excesso 100×150mm ────────────────────────────────

interface ExcessLabelProps {
  product: Product;
  excessQty: number | string;
  scale?: number;
}

export const ExcessLabelSVG = React.forwardRef<SVGSVGElement, ExcessLabelProps>(
  ({ product, excessQty, scale = 1 }, ref) => {
    const W = 100 * PX_PER_MM;
    const H = 150 * PX_PER_MM;
    const sw = W * scale;
    const sh = H * scale;

    const name = product.name || 'SEM NOME';
    const sku = product.sku || '—';
    const ean = product.ean || '—';
    const loc = product.location || '—';
    const qty = String(excessQty) || '0';

    // wrap name into max 2 lines
    const words = name.split(' ');
    let line1 = '';
    let line2 = '';
    for (const w of words) {
      if (line1.length + w.length <= 28) line1 += (line1 ? ' ' : '') + w;
      else line2 += (line2 ? ' ' : '') + w;
    }
    const nameLine2 = line2.length > 28 ? line2.slice(0, 26) + '…' : line2;

    return (
      <svg
        ref={ref}
        width={sw}
        height={sh}
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Background */}
        <rect x="0" y="0" width={W} height={H} fill="white" />
        {/* Outer border */}
        <rect x="0.5" y="0.5" width={W - 1} height={H - 1} fill="none" stroke="#111" strokeWidth="1.5" />

        {/* Header - danger red */}
        <rect x="0.5" y="0.5" width={W - 1} height="18" fill="#dc2626" />
        <text x={W / 2} y="8.5" textAnchor="middle" fill="white"
          fontWeight="900" fontSize="6" letterSpacing="0.5">⚠ EXCESSO DE ESTOQUE</text>
        <text x={W / 2} y="15.5" textAnchor="middle" fill="#fecaca"
          fontSize="4" letterSpacing="0.3">ESTOQUE FISICO MAIOR QUE O SISTEMA</text>

        {/* Product name section */}
        <rect x="1" y="18.5" width={W - 2} height="28" fill="#fafafa" />
        <line x1="1" y1="18.5" x2={W - 1} y2="18.5" stroke="#111" strokeWidth="0.6" />
        <text x={W / 2} y={line2 ? '30' : '34'} textAnchor="middle" fill="#111"
          fontWeight="900" fontSize="7.5" letterSpacing="0.2">{line1}</text>
        {line2 && (
          <text x={W / 2} y="41" textAnchor="middle" fill="#111"
            fontWeight="900" fontSize="7.5" letterSpacing="0.2">{nameLine2}</text>
        )}
        <line x1="1" y1="46.5" x2={W - 1} y2="46.5" stroke="#111" strokeWidth="0.6" />

        {/* Info blocks */}
        {/* Localização */}
        <rect x="1" y="46.5" width={(W - 2) / 2} height="20" fill="white" />
        <rect x="1 + (W - 2) / 2" y="46.5" width={(W - 2) / 2} height="20" fill="white" />
        <line x1={W / 2} y1="46.5" x2={W / 2} y2="66.5" stroke="#ccc" strokeWidth="0.4" />
        <text x="5" y="53.5" fill="#666" fontSize="4" fontWeight="600" letterSpacing="0.3">LOCALIZAÇÃO</text>
        <text x="5" y="62.5" fill="#111" fontSize="6" fontWeight="800">{loc}</text>

        {/* SKU */}
        <text x={W / 2 + 4} y="53.5" fill="#666" fontSize="4" fontWeight="600" letterSpacing="0.3">SKU</text>
        <text x={W / 2 + 4} y="62.5" fill="#111" fontSize="6" fontWeight="800">{sku}</text>

        <line x1="1" y1="66.5" x2={W - 1} y2="66.5" stroke="#ccc" strokeWidth="0.4" />

        {/* EAN row */}
        <rect x="1" y="66.5" width={W - 2} height="20" fill="#f8f8f8" />
        <text x="5" y="73.5" fill="#666" fontSize="4" fontWeight="600" letterSpacing="0.3">EAN / GTIN</text>
        <text x={W / 2} y="83" textAnchor="middle" fill="#111" fontSize="8" fontWeight="900"
          letterSpacing="1">{ean}</text>

        <line x1="1" y1="86.5" x2={W - 1} y2="86.5" stroke="#111" strokeWidth="1" />

        {/* Quantidade excesso - destaque */}
        <rect x="1" y="86.5" width={W - 2} height={H - 88} fill="#fff7f0" />
        <text x={W / 2} y="101" textAnchor="middle" fill="#ea580c"
          fontSize="5" fontWeight="700" letterSpacing="0.5">QUANTIDADE EM EXCESSO</text>
        <text x={W / 2} y="130" textAnchor="middle" fill="#dc2626"
          fontSize="30" fontWeight="900">{qty}</text>
        <text x={W / 2} y="143" textAnchor="middle" fill="#ea580c"
          fontSize="4.5" fontWeight="600">UNIDADES</text>

        {/* Corner marks */}
        <line x1="1" y1={H - 1} x2={W - 1} y2={H - 1} stroke="#111" strokeWidth="1" />
      </svg>
    );
  }
);

// ─── Utility: SVG → PNG download ─────────────────────────────────────────────

async function svgToPngBlob(svgEl: SVGSVGElement, scale = 4): Promise<Blob> {
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('canvas.toBlob failed')), 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Print helper ─────────────────────────────────────────────────────────────

function printLabels(svgEls: SVGSVGElement[], labelType: LabelType) {
  const w = labelType === 'shelf' ? '100mm' : '100mm';
  const h = labelType === 'shelf' ? '40mm' : '150mm';

  const svgStrings = svgEls
    .map(el => new XMLSerializer().serializeToString(el))
    .join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: ${w} ${h}; margin: 0; }
  body { background: white; }
  .page { width: ${w}; height: ${h}; page-break-after: always; page-break-inside: avoid; display: flex; align-items: center; justify-content: center; }
  .page:last-child { page-break-after: auto; }
  svg { display: block; width: ${w} !important; height: ${h} !important; }
</style>
</head>
<body>
${svgEls.map(el => `<div class="page">${new XMLSerializer().serializeToString(el)}</div>`).join('\n')}
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', `width=400,height=300`);
  if (!win) { alert('Popup bloqueado. Permita popups para imprimir.'); return; }
  win.document.write(html);
  win.document.close();
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface LabelGeneratorPageProps {
  onBack: () => void;
}

export const LabelGeneratorPage: React.FC<LabelGeneratorPageProps> = ({ onBack }) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Single mode state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'sku' | 'ean'>('sku');
  const [searching, setSearching] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [labelType, setLabelType] = useState<LabelType>('shelf');
  const [excessQty, setExcessQty] = useState(0);
  const [copies, setCopies] = useState(1);
  const [generating, setGenerating] = useState(false);

  // Batch mode state
  const [batchProducts, setBatchProducts] = useState<Product[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchLocationFilter, setBatchLocationFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLabelType, setBatchLabelType] = useState<LabelType>('shelf');
  const [batchCopies, setBatchCopies] = useState(1);
  const [batchExcessQty, setBatchExcessQty] = useState(0);

  // SVG refs for export
  const shelfRef = useRef<SVGSVGElement>(null);
  const excessRef = useRef<SVGSVGElement>(null);

  // ── Search product ──────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setNotFound(false);
    setProduct(null);

    try {
      const field = searchType === 'sku' ? 'sku' : 'ean';
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, ean, location, price')
        .ilike(field, q)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProduct(data as Product);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.error('[LabelGenerator] Search error:', err);
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, searchType]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // ── Load batch products ─────────────────────────────────────────────────────
  const loadBatchProducts = useCallback(async () => {
    setBatchLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('id, name, sku, ean, location, price')
        .order('name');

      if (batchSearch.trim()) {
        query = query.or(
          `name.ilike.%${batchSearch.trim()}%,sku.ilike.%${batchSearch.trim()}%,ean.ilike.%${batchSearch.trim()}%`
        );
      }
      if (batchLocationFilter.trim()) {
        query = query.ilike('location', `%${batchLocationFilter.trim()}%`);
      }

      query = query.limit(200);
      const { data } = await query;
      setBatchProducts((data as Product[]) || []);
    } catch (err) {
      console.error('[LabelGenerator] Batch load error:', err);
    } finally {
      setBatchLoading(false);
    }
  }, [batchSearch, batchLocationFilter]);

  useEffect(() => {
    if (mode === 'batch') loadBatchProducts();
  }, [mode, loadBatchProducts]);

  // ── Toggle selection ────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === batchProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(batchProducts.map(p => p.id)));
    }
  };

  // ── Build an off-screen SVG for a product ───────────────────────────────────
  const buildOffscreenSVG = useCallback((
    p: Product, type: LabelType, qty: number
  ): SVGSVGElement => {
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
    document.body.appendChild(container);

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg') as SVGSVGElement;

    const W = 100 * PX_PER_MM;
    const H = type === 'shelf' ? 40 * PX_PER_MM : 150 * PX_PER_MM;

    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('xmlns', ns);

    // We'll render the React SVG to string instead
    // Build label HTML from template strings
    const svgContent = type === 'shelf'
      ? buildShelfSVGString(p, W, H)
      : buildExcessSVGString(p, qty, W, H);

    svg.innerHTML = svgContent;
    container.appendChild(svg);

    // Clone before removing
    const clone = svg.cloneNode(true) as SVGSVGElement;
    document.body.removeChild(container);
    return clone;
  }, []);

  // ── Single mode actions ─────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!product) return;
    const svgs: SVGSVGElement[] = [];
    for (let i = 0; i < copies; i++) {
      svgs.push(buildOffscreenSVG(product, labelType, excessQty));
    }
    printLabels(svgs, labelType);
  };

  const handleDownloadPNG = async () => {
    if (!product) return;
    setGenerating(true);
    try {
      const svg = buildOffscreenSVG(product, labelType, excessQty);
      document.body.appendChild(svg);
      const blob = await svgToPngBlob(svg, 4);
      document.body.removeChild(svg);
      const safeName = product.sku.replace(/[^a-z0-9]/gi, '_');
      downloadBlob(blob, `etiqueta-${labelType === 'shelf' ? 'vao' : 'excesso'}-${safeName}.png`);
    } catch (err) {
      console.error('[LabelGenerator] PNG error:', err);
      alert('Erro ao gerar PNG. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!product) return;
    const svgs: SVGSVGElement[] = [];
    for (let i = 0; i < copies; i++) {
      svgs.push(buildOffscreenSVG(product, labelType, excessQty));
    }
    printLabels(svgs, labelType);
  };

  // ── Batch actions ───────────────────────────────────────────────────────────
  const handleBatchPrint = () => {
    const selected = batchProducts.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) return;

    const svgs: SVGSVGElement[] = [];
    for (const p of selected) {
      for (let i = 0; i < batchCopies; i++) {
        svgs.push(buildOffscreenSVG(p, batchLabelType, batchExcessQty));
      }
    }
    printLabels(svgs, batchLabelType);
  };

  const handleBatchPNG = async () => {
    const selected = batchProducts.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) return;
    setGenerating(true);
    try {
      for (const p of selected) {
        const svg = buildOffscreenSVG(p, batchLabelType, batchExcessQty);
        document.body.appendChild(svg);
        const blob = await svgToPngBlob(svg, 4);
        document.body.removeChild(svg);
        const safeName = p.sku.replace(/[^a-z0-9]/gi, '_');
        downloadBlob(blob, `etiqueta-${safeName}.png`);
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      console.error('[LabelGenerator] Batch PNG error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const clearSingle = () => {
    setProduct(null);
    setNotFound(false);
    setSearchQuery('');
    setExcessQty(0);
    setCopies(1);
  };

  // Unique locations for filter
  const uniqueLocations = Array.from(new Set(batchProducts.map(p => p.location).filter(Boolean)));

  return (
    <div className="min-h-screen bg-zinc-50">
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
                <p className="text-xs text-zinc-400 hidden sm:block">Etiqueta de Vao 100x40mm · Etiqueta de Excesso 100x150mm</p>
              </div>
            </div>
          </div>
          {/* Mode toggle */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                mode === 'single' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Unitario
            </button>
            <button
              onClick={() => setMode('batch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                mode === 'batch' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers size={14} /> Lote
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── SINGLE MODE ──────────────────────────────────────────────── */}
        {mode === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left: Search + Settings */}
            <div className="space-y-4">

              {/* Search card */}
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
                  <Search size={16} className="text-zinc-500" />
                  Buscar Produto
                </h2>

                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setSearchType('sku')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border transition ${
                      searchType === 'sku'
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    Buscar por SKU
                  </button>
                  <button
                    onClick={() => setSearchType('ean')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border transition ${
                      searchType === 'ean'
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    Buscar por EAN
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={searchType === 'sku' ? 'Digite o SKU...' : 'Digite o EAN / codigo de barras...'}
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setNotFound(false); }}
                    onKeyDown={handleSearchKeyDown}
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
                    Produto nao encontrado. Verifique o SKU ou EAN.
                  </div>
                )}
              </div>

              {/* Product info */}
              {product && (
                <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="font-bold text-zinc-800 text-sm flex items-center gap-2">
                      <Package size={16} className="text-emerald-500" />
                      Produto Encontrado
                    </h2>
                    <button onClick={clearSingle} className="text-zinc-400 hover:text-zinc-700">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2.5 bg-zinc-50 rounded-lg">
                      <p className="text-xs text-zinc-400 uppercase font-semibold mb-0.5">Nome</p>
                      <p className="font-bold text-zinc-800 text-sm">{product.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-zinc-50 rounded-lg">
                        <p className="text-xs text-zinc-400 uppercase font-semibold mb-0.5">SKU</p>
                        <p className="font-mono font-bold text-zinc-800 text-sm">{product.sku}</p>
                      </div>
                      <div className="p-2.5 bg-zinc-50 rounded-lg">
                        <p className="text-xs text-zinc-400 uppercase font-semibold mb-0.5">EAN</p>
                        <p className="font-mono font-bold text-zinc-800 text-sm">{product.ean || '—'}</p>
                      </div>
                      <div className="p-2.5 bg-zinc-50 rounded-lg">
                        <p className="text-xs text-zinc-400 uppercase font-semibold mb-0.5">Local</p>
                        <p className="font-bold text-zinc-800 text-sm">{product.location || '—'}</p>
                      </div>
                      {product.price !== null && (
                        <div className="p-2.5 bg-zinc-50 rounded-lg">
                          <p className="text-xs text-zinc-400 uppercase font-semibold mb-0.5">Preco</p>
                          <p className="font-bold text-zinc-800 text-sm">
                            {product.price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Label settings */}
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
                <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
                  <Tag size={16} className="text-zinc-500" />
                  Configuracoes da Etiqueta
                </h2>

                {/* Type selector */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">
                    Tipo de Etiqueta
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLabelType('shelf')}
                      className={`p-3 rounded-lg border-2 text-left transition ${
                        labelType === 'shelf'
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <MapPin size={16} className={labelType === 'shelf' ? 'text-emerald-600' : 'text-zinc-400'} />
                      <p className="font-bold text-xs mt-1">Etiqueta de Vao</p>
                      <p className="text-xs text-zinc-400">100 × 40mm</p>
                    </button>
                    <button
                      onClick={() => setLabelType('excess')}
                      className={`p-3 rounded-lg border-2 text-left transition ${
                        labelType === 'excess'
                          ? 'border-red-500 bg-red-50'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <AlertTriangle size={16} className={labelType === 'excess' ? 'text-red-600' : 'text-zinc-400'} />
                      <p className="font-bold text-xs mt-1">Etiqueta de Excesso</p>
                      <p className="text-xs text-zinc-400">100 × 150mm</p>
                    </button>
                  </div>
                </div>

                {/* Excess quantity */}
                {labelType === 'excess' && (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">
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
                )}

                {/* Copies */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">
                    Quantidade de Copias
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
                  <h2 className="font-bold text-zinc-800 text-sm mb-4">Acoes</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handlePrint}
                      className="flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold transition col-span-2"
                    >
                      <Printer size={16} />
                      Imprimir {copies > 1 ? `(${copies}x)` : ''}
                    </button>
                    <button
                      onClick={handleDownloadPNG}
                      disabled={generating}
                      className="flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                    >
                      {generating ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                      PNG
                    </button>
                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition"
                    >
                      <Download size={14} />
                      PDF
                    </button>
                    <button
                      onClick={clearSingle}
                      className="flex items-center justify-center gap-2 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-sm font-semibold transition col-span-2"
                    >
                      <X size={14} />
                      Limpar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Preview */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 sticky top-28">
                <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
                  <Barcode size={16} className="text-zinc-500" />
                  Pre-visualizacao
                  <span className="ml-auto text-xs font-normal text-zinc-400">
                    {labelType === 'shelf' ? '100 × 40mm' : '100 × 150mm'}
                  </span>
                </h2>

                {!product ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-300">
                    <Tag size={48} className="mb-3 opacity-30" />
                    <p className="text-sm">Busque um produto para pre-visualizar a etiqueta</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    {/* Shadow container */}
                    <div className="rounded-lg overflow-hidden shadow-lg border border-zinc-200">
                      {labelType === 'shelf' ? (
                        <ShelfLabelSVG
                          ref={shelfRef}
                          product={product}
                          scale={2.2}
                        />
                      ) : (
                        <ExcessLabelSVG
                          ref={excessRef}
                          product={product}
                          excessQty={excessQty}
                          scale={2.0}
                        />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 text-center">
                      Visualizacao em escala aumentada.<br />
                      A impressao sera em tamanho real ({labelType === 'shelf' ? '100x40mm' : '100x150mm'}).
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BATCH MODE ───────────────────────────────────────────────── */}
        {mode === 'batch' && (
          <div className="space-y-4">

            {/* Filters */}
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
              <h2 className="font-bold text-zinc-800 text-sm mb-4 flex items-center gap-2">
                <Search size={16} className="text-zinc-500" />
                Filtros
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">
                    Buscar
                  </label>
                  <input
                    type="text"
                    placeholder="Nome, SKU ou EAN..."
                    value={batchSearch}
                    onChange={e => setBatchSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">
                    Localizacao
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: A-01..."
                    value={batchLocationFilter}
                    onChange={e => setBatchLocationFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">
                    Tipo de Etiqueta
                  </label>
                  <select
                    value={batchLabelType}
                    onChange={e => setBatchLabelType(e.target.value as LabelType)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
                  >
                    <option value="shelf">Vao — 100x40mm</option>
                    <option value="excess">Excesso — 100x150mm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">
                    Copias por produto
                  </label>
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
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">
                    Qtd em Excesso (padrao do lote)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={batchExcessQty}
                    onChange={e => setBatchExcessQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 font-mono"
                  />
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={loadBatchProducts}
                  disabled={batchLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  {batchLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                  Buscar
                </button>
              </div>
            </div>

            {/* Batch actions */}
            {selectedIds.size > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-emerald-800">
                  {selectedIds.size} produto{selectedIds.size !== 1 ? 's' : ''} selecionado{selectedIds.size !== 1 ? 's' : ''}
                  {' · '}{selectedIds.size * batchCopies} etiqueta{selectedIds.size * batchCopies !== 1 ? 's' : ''} no total
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleBatchPrint}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-sm font-semibold transition"
                  >
                    <Printer size={14} />
                    Imprimir
                  </button>
                  <button
                    onClick={handleBatchPNG}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                  >
                    {generating ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                    PNG
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-lg text-sm transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Products table */}
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
                <h2 className="font-bold text-zinc-800 text-sm">
                  Produtos ({batchProducts.length})
                </h2>
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
                <div className="flex items-center justify-center py-12 text-zinc-400">
                  <RefreshCw size={24} className="animate-spin mr-2" />
                  Carregando...
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
                          className={`cursor-pointer transition ${
                            selectedIds.has(p.id)
                              ? 'bg-emerald-50 hover:bg-emerald-100'
                              : 'hover:bg-zinc-50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            {selectedIds.has(p.id)
                              ? <CheckSquare size={16} className="text-emerald-600" />
                              : <Square size={16} className="text-zinc-300" />
                            }
                          </td>
                          <td className="px-4 py-3 font-medium text-zinc-800 max-w-[220px] truncate">{p.name}</td>
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

// ─── SVG string builders (for off-screen generation) ─────────────────────────

function buildShelfSVGString(p: Product, W: number, H: number): string {
  const name = (p.name || 'SEM NOME').slice(0, 38);
  const nameD = name.length > 38 ? name.slice(0, 36) + '…' : name;
  const sku = p.sku || '—';
  const ean = p.ean || '—';
  const loc = p.location || '—';
  const cx = W / 2;

  return `
    <rect x="0" y="0" width="${W}" height="${H}" fill="white"/>
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#111" stroke-width="1"/>
    <rect x="0.5" y="0.5" width="${W - 1}" height="9.5" fill="#111"/>
    <text x="${cx}" y="7.8" text-anchor="middle" fill="white" font-weight="700" font-size="5.5" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.2">${escXml(nameD)}</text>
    <line x1="1" y1="10" x2="${W - 1}" y2="10" stroke="#ccc" stroke-width="0.4"/>
    <text x="4" y="17.5" fill="#333" font-size="4.2" font-weight="600" font-family="Arial,Helvetica,sans-serif">LOCAL:</text>
    <text x="22" y="17.5" fill="#111" font-size="4.5" font-weight="700" font-family="Arial,Helvetica,sans-serif">${escXml(loc)}</text>
    <line x1="1" y1="21" x2="${W - 1}" y2="21" stroke="#ccc" stroke-width="0.4"/>
    <text x="4" y="27.5" fill="#333" font-size="4.2" font-weight="600" font-family="Arial,Helvetica,sans-serif">SKU:</text>
    <text x="18" y="27.5" fill="#111" font-size="5.5" font-weight="800" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.5">${escXml(sku)}</text>
    <line x1="1" y1="30.5" x2="${W - 1}" y2="30.5" stroke="#ccc" stroke-width="0.4"/>
    <text x="4" y="36.5" fill="#333" font-size="4.2" font-weight="600" font-family="Arial,Helvetica,sans-serif">EAN:</text>
    <text x="20" y="36.5" fill="#000" font-size="6" font-weight="900" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.8">${escXml(ean)}</text>
    <rect x="0.5" y="${H - 1}" width="${W - 1}" height="0.5" fill="#111"/>
  `;
}

function buildExcessSVGString(p: Product, excessQty: number, W: number, H: number): string {
  const name = p.name || 'SEM NOME';
  const sku = p.sku || '—';
  const ean = p.ean || '—';
  const loc = p.location || '—';
  const qty = String(excessQty);
  const cx = W / 2;

  // word wrap name into 2 lines
  const words = name.split(' ');
  let line1 = '';
  let line2 = '';
  for (const w of words) {
    if (line1.length + w.length <= 28) line1 += (line1 ? ' ' : '') + w;
    else line2 += (line2 ? ' ' : '') + w;
  }
  const l2 = line2.length > 28 ? line2.slice(0, 26) + '…' : line2;
  const nameY1 = l2 ? '30' : '34';

  return `
    <rect x="0" y="0" width="${W}" height="${H}" fill="white"/>
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#111" stroke-width="1.5"/>
    <rect x="0.5" y="0.5" width="${W - 1}" height="18" fill="#dc2626"/>
    <text x="${cx}" y="8.5" text-anchor="middle" fill="white" font-weight="900" font-size="6" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.5">⚠ EXCESSO DE ESTOQUE</text>
    <text x="${cx}" y="15.5" text-anchor="middle" fill="#fecaca" font-size="4" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.3">ESTOQUE FISICO MAIOR QUE O SISTEMA</text>
    <rect x="1" y="18.5" width="${W - 2}" height="28" fill="#fafafa"/>
    <line x1="1" y1="18.5" x2="${W - 1}" y2="18.5" stroke="#111" stroke-width="0.6"/>
    <text x="${cx}" y="${nameY1}" text-anchor="middle" fill="#111" font-weight="900" font-size="7.5" font-family="Arial,Helvetica,sans-serif">${escXml(line1)}</text>
    ${l2 ? `<text x="${cx}" y="41" text-anchor="middle" fill="#111" font-weight="900" font-size="7.5" font-family="Arial,Helvetica,sans-serif">${escXml(l2)}</text>` : ''}
    <line x1="1" y1="46.5" x2="${W - 1}" y2="46.5" stroke="#111" stroke-width="0.6"/>
    <text x="5" y="53.5" fill="#666" font-size="4" font-weight="600" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.3">LOCALIZACAO</text>
    <text x="5" y="62.5" fill="#111" font-size="6" font-weight="800" font-family="Arial,Helvetica,sans-serif">${escXml(loc)}</text>
    <line x1="${W / 2}" y1="46.5" x2="${W / 2}" y2="66.5" stroke="#ccc" stroke-width="0.4"/>
    <text x="${W / 2 + 4}" y="53.5" fill="#666" font-size="4" font-weight="600" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.3">SKU</text>
    <text x="${W / 2 + 4}" y="62.5" fill="#111" font-size="6" font-weight="800" font-family="Arial,Helvetica,sans-serif">${escXml(sku)}</text>
    <line x1="1" y1="66.5" x2="${W - 1}" y2="66.5" stroke="#ccc" stroke-width="0.4"/>
    <rect x="1" y="66.5" width="${W - 2}" height="20" fill="#f8f8f8"/>
    <text x="5" y="73.5" fill="#666" font-size="4" font-weight="600" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.3">EAN / GTIN</text>
    <text x="${cx}" y="83" text-anchor="middle" fill="#111" font-size="8" font-weight="900" font-family="Arial,Helvetica,sans-serif" letter-spacing="1">${escXml(ean)}</text>
    <line x1="1" y1="86.5" x2="${W - 1}" y2="86.5" stroke="#111" stroke-width="1"/>
    <rect x="1" y="86.5" width="${W - 2}" height="${H - 88}" fill="#fff7f0"/>
    <text x="${cx}" y="101" text-anchor="middle" fill="#ea580c" font-size="5" font-weight="700" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.5">QUANTIDADE EM EXCESSO</text>
    <text x="${cx}" y="130" text-anchor="middle" fill="#dc2626" font-size="30" font-weight="900" font-family="Arial,Helvetica,sans-serif">${escXml(qty)}</text>
    <text x="${cx}" y="143" text-anchor="middle" fill="#ea580c" font-size="4.5" font-weight="600" font-family="Arial,Helvetica,sans-serif">UNIDADES</text>
    <line x1="1" y1="${H - 1}" x2="${W - 1}" y2="${H - 1}" stroke="#111" stroke-width="1"/>
  `;
}

function escXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
