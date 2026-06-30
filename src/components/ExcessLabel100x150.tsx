// ExcessLabel100x150 - Etiqueta de Excesso 100mm x 150mm
// Layout: Cabeçalho vermelho, nome grande, blocos com borda, QTD grande

import React from 'react';
import type { LabelProduct } from './ShelfLabel100x40';

const EW = 378;  // 100mm at 96dpi
const EH = 567;  // 150mm at 96dpi

type QtySize = 'sm' | 'md' | 'lg' | 'xl';

const qtySizeMap: Record<QtySize, number> = {
  sm: 42,
  md: 56,
  lg: 72,
  xl: 90,
};

function getQtyFontSize(size: QtySize, digits: number): number {
  const base = qtySizeMap[size];
  if (digits >= 5) return Math.round(base * 0.55);
  if (digits >= 4) return Math.round(base * 0.7);
  if (digits >= 3) return Math.round(base * 0.85);
  return base;
}

interface ExcessLabel100x150Props {
  product: LabelProduct;
  excessQty: number | string;
  qtySize?: QtySize;
  previewScale?: number;
  innerRef?: React.RefObject<HTMLDivElement>;
}

const ExcessLabel100x150Inner = React.forwardRef<
  HTMLDivElement,
  { product: LabelProduct; excessQty: number | string; qtySize: QtySize }
>(({ product, excessQty, qtySize }, ref) => {
  const qty = String(excessQty || '0');
  const digits = qty.replace(/\D/g, '').length || 1;
  const qtyFontSize = getQtyFontSize(qtySize, digits);

  const nameFontSize = (() => {
    const len = product.name.length;
    if (len > 55) return 13;
    if (len > 40) return 15;
    if (len > 25) return 17;
    return 19;
  })();

  const cell: React.CSSProperties = {
    border: '1px solid #555',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3px 6px',
    flex: 1,
    overflow: 'hidden',
  };

  const cellLabel: React.CSSProperties = {
    fontSize: 9,
    fontWeight: '700',
    color: '#666',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    lineHeight: 1,
    marginBottom: 2,
  };

  const cellValue: React.CSSProperties = {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
    textAlign: 'center',
    letterSpacing: '0.5px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    lineHeight: 1.1,
  };

  return (
    <div
      ref={ref}
      style={{
        width: EW,
        height: EH,
        border: '2px solid #111',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* HEADER — red alert, ~12% */}
      <div
        style={{
          flex: '0 0 68px',
          backgroundColor: '#dc2626',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '2px solid #111',
          padding: '4px 8px',
        }}
      >
        <span style={{
          fontSize: 18,
          fontWeight: '900',
          color: '#ffffff',
          letterSpacing: '0.5px',
          textAlign: 'center',
          lineHeight: 1.2,
        }}>
          ⚠ EXCESSO DE ESTOQUE
        </span>
        <span style={{
          fontSize: 10,
          color: '#fca5a5',
          letterSpacing: '1px',
          marginTop: 3,
          textAlign: 'center',
        }}>
          ESTOQUE FISICO MAIOR QUE O SISTEMA
        </span>
      </div>

      {/* PRODUCT NAME — ~20% */}
      <div
        style={{
          flex: '0 0 112px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 10px',
          borderBottom: '1.5px solid #333',
          backgroundColor: '#fafafa',
        }}
      >
        <span
          style={{
            fontSize: nameFontSize,
            fontWeight: '900',
            textAlign: 'center',
            color: '#111',
            lineHeight: '1.3',
            wordBreak: 'break-word',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          } as React.CSSProperties}
        >
          {product.name || '—'}
        </span>
      </div>

      {/* INFO GRID: Location + SKU side by side — ~15% */}
      <div
        style={{
          flex: '0 0 85px',
          display: 'flex',
          borderBottom: '1px solid #555',
        }}
      >
        <div style={{ ...cell, borderRight: '1px solid #555' }}>
          <span style={cellLabel}>Localização</span>
          <span style={{ ...cellValue, fontSize: 15 }}>{product.location || '—'}</span>
        </div>
        <div style={cell}>
          <span style={cellLabel}>SKU</span>
          <span style={{ ...cellValue, fontSize: 13, letterSpacing: '0.3px' }}>{product.sku || '—'}</span>
        </div>
      </div>

      {/* EAN row — ~15% */}
      <div
        style={{
          flex: '0 0 85px',
          display: 'flex',
          ...cell,
          borderBottom: '1.5px solid #333',
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
        }}
      >
        <span style={cellLabel}>EAN / GTIN</span>
        <span
          style={{
            fontSize: 20,
            fontWeight: '900',
            letterSpacing: '2px',
            color: '#111',
            marginTop: 2,
          }}
        >
          {product.ean || '—'}
        </span>
      </div>

      {/* EXCESS QTY — remaining (~38%) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff7ed',
          padding: '6px 8px',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: '#ea580c',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Quantidade em Excesso
        </span>
        <span
          style={{
            fontSize: qtyFontSize,
            fontWeight: '900',
            color: '#dc2626',
            lineHeight: 1,
            letterSpacing: digits >= 4 ? '2px' : '4px',
          }}
        >
          {qty}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: '600',
            color: '#ea580c',
            marginTop: 4,
            letterSpacing: '1px',
          }}
        >
          UNIDADES
        </span>
      </div>
    </div>
  );
});

const ExcessLabel100x150: React.FC<ExcessLabel100x150Props> = ({
  product,
  excessQty,
  qtySize = 'lg',
  previewScale = 1,
  innerRef,
}) => {
  if (previewScale === 1) {
    return <ExcessLabel100x150Inner ref={innerRef} product={product} excessQty={excessQty} qtySize={qtySize} />;
  }

  return (
    <div
      style={{
        width: EW * previewScale,
        height: EH * previewScale,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          transform: `scale(${previewScale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <ExcessLabel100x150Inner ref={innerRef} product={product} excessQty={excessQty} qtySize={qtySize} />
      </div>
    </div>
  );
};

export type { QtySize };
export { EW as EXCESS_W, EH as EXCESS_H };
export { ExcessLabel100x150Inner };
export default ExcessLabel100x150;
