/**
 * ShelfLabel100x40
 * Tamanho real: 100mm × 40mm (width: 100mm; height: 40mm via CSS)
 * Capturado pelo html2canvas no tamanho real.
 * Preview usa wrapper com transform scale – este componente NÃO escala.
 */

import React from 'react';

export interface LabelProduct {
  name: string;
  sku: string;
  ean: string;
  location: string;
}

// ── Font auto-size for name ─────────────────────────────────────────────────

function nameFontSize(name: string): number {
  const n = name.length;
  if (n > 65) return 11;
  if (n > 50) return 12;
  if (n > 35) return 13;
  if (n > 22) return 14;
  return 15;
}

function eanFontSize(ean: string): number {
  const n = ean.length;
  if (n > 14) return 18;
  if (n > 12) return 20;
  return 22;
}

// ── Shared CSS values ────────────────────────────────────────────────────────

const FONT = 'Arial, Helvetica, sans-serif';
const BORDER = '1px solid #333';

// ── Component ────────────────────────────────────────────────────────────────

interface ShelfLabelProps {
  product: LabelProduct;
}

const ShelfLabel100x40 = React.forwardRef<HTMLDivElement, ShelfLabelProps>(
  ({ product }, ref) => {
    const nfs = nameFontSize(product.name);
    const efs = eanFontSize(product.ean || '');

    return (
      <div
        ref={ref}
        style={{
          width: '100mm',
          height: '40mm',
          border: '1.5px solid #222',
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
        {/* ── NAME ── ~37% height */}
        <div
          style={{
            flex: '0 0 37%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 6px 2px 6px',
            borderBottom: BORDER,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: nfs,
              fontWeight: '900',
              textAlign: 'center',
              lineHeight: '1.2',
              color: '#111',
              wordBreak: 'break-word',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
            } as React.CSSProperties}
          >
            {product.name || '—'}
          </span>
        </div>

        {/* ── LOCATION ── ~18% height */}
        <div
          style={{
            flex: '0 0 18%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            borderBottom: BORDER,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: '800',
              textAlign: 'center',
              color: '#111',
              letterSpacing: '0.4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {product.location || '—'}
          </span>
        </div>

        {/* ── SKU ── ~18% height */}
        <div
          style={{
            flex: '0 0 18%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            borderBottom: BORDER,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: '800',
              textAlign: 'center',
              color: '#111',
              letterSpacing: '0.6px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {product.sku || '—'}
          </span>
        </div>

        {/* ── EAN ── remaining ~27% height — BIGGEST text */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: efs,
              fontWeight: '900',
              textAlign: 'center',
              color: '#000',
              letterSpacing: '1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {product.ean || '—'}
          </span>
        </div>
      </div>
    );
  }
);

ShelfLabel100x40.displayName = 'ShelfLabel100x40';

export default ShelfLabel100x40;
