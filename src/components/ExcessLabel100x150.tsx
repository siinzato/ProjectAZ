/**
 * ExcessLabel100x150
 * Tamanho real: 100mm × 150mm via CSS.
 * Capturado pelo html2canvas no tamanho real.
 */

import React from 'react';
import type { LabelProduct } from './ShelfLabel100x40';

export type QtySize = 'sm' | 'md' | 'lg' | 'xl';

const qtySizePx: Record<QtySize, number> = {
  sm: 28,
  md: 38,
  lg: 50,
  xl: 64,
};

function qtyFontPx(size: QtySize, digits: number): number {
  const base = qtySizePx[size];
  if (digits >= 6) return Math.round(base * 0.5);
  if (digits >= 5) return Math.round(base * 0.62);
  if (digits >= 4) return Math.round(base * 0.78);
  return base;
}

function nameFontPx(name: string): number {
  const n = name.length;
  if (n > 60) return 13;
  if (n > 45) return 15;
  if (n > 30) return 17;
  return 19;
}

const FONT = 'Arial, Helvetica, sans-serif';
const CELL_LABEL: React.CSSProperties = {
  fontSize: 8,
  fontWeight: '700',
  color: '#666',
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  lineHeight: 1,
  marginBottom: 2,
};
const CELL_VALUE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: '900',
  color: '#111',
  textAlign: 'center',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
  lineHeight: 1.1,
};

interface ExcessLabelProps {
  product: LabelProduct;
  excessQty: number | string;
  qtySize?: QtySize;
}

const ExcessLabel100x150 = React.forwardRef<HTMLDivElement, ExcessLabelProps>(
  ({ product, excessQty, qtySize = 'lg' }, ref) => {
    const qty = String(excessQty ?? '0');
    const digits = qty.replace(/\D/g, '').length || 1;
    const qpx = qtyFontPx(qtySize, digits);
    const npx = nameFontPx(product.name);

    return (
      <div
        ref={ref}
        style={{
          width: '100mm',
          height: '150mm',
          border: '2px solid #111',
          backgroundColor: '#ffffff',
          fontFamily: FONT,
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        } as React.CSSProperties}
      >
        {/* HEADER — red */}
        <div
          style={{
            flex: '0 0 13%',
            backgroundColor: '#dc2626',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '2px solid #111',
            padding: '3px 8px',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: '0.4px', textAlign: 'center', lineHeight: 1.15 }}>
            ⚠ EXCESSO DE ESTOQUE
          </span>
          <span style={{ fontSize: 8, color: '#fca5a5', letterSpacing: '1px', marginTop: 2, textAlign: 'center' }}>
            ESTOQUE FISICO MAIOR QUE O SISTEMA
          </span>
        </div>

        {/* NAME */}
        <div
          style={{
            flex: '0 0 20%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 10px',
            borderBottom: '1.5px solid #333',
            backgroundColor: '#fafafa',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: npx,
              fontWeight: '900',
              textAlign: 'center',
              color: '#111',
              lineHeight: '1.3',
              wordBreak: 'break-word',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 3,
            } as React.CSSProperties}
          >
            {product.name || '—'}
          </span>
        </div>

        {/* LOCATION + SKU grid */}
        <div
          style={{
            flex: '0 0 15%',
            display: 'flex',
            borderBottom: '1px solid #555',
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3px 6px', borderRight: '1px solid #555', overflow: 'hidden' }}>
            <span style={CELL_LABEL}>Localização</span>
            <span style={{ ...CELL_VALUE, fontSize: 14 }}>{product.location || '—'}</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3px 6px', overflow: 'hidden' }}>
            <span style={CELL_LABEL}>SKU</span>
            <span style={{ ...CELL_VALUE, fontSize: 12, letterSpacing: '0.3px' }}>{product.sku || '—'}</span>
          </div>
        </div>

        {/* EAN */}
        <div
          style={{
            flex: '0 0 14%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3px 8px',
            borderBottom: '1.5px solid #333',
            overflow: 'hidden',
          }}
        >
          <span style={CELL_LABEL}>EAN / GTIN</span>
          <span style={{ fontSize: 18, fontWeight: '900', letterSpacing: '1.5px', color: '#111' }}>
            {product.ean || '—'}
          </span>
        </div>

        {/* QTY EXCESS — remaining */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff7ed',
            padding: '6px 8px',
            overflow: 'hidden',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: '700', color: '#ea580c', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            Quantidade em Excesso
          </span>
          <span style={{ fontSize: qpx, fontWeight: '900', color: '#dc2626', lineHeight: 1 }}>
            {qty}
          </span>
          <span style={{ fontSize: 9, fontWeight: '600', color: '#ea580c', marginTop: 4, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            Unidades
          </span>
        </div>
      </div>
    );
  }
);

ExcessLabel100x150.displayName = 'ExcessLabel100x150';

export default ExcessLabel100x150;
