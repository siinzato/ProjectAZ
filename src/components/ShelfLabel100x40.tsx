// ShelfLabel100x40 - Etiqueta de Vão 100mm x 40mm
// Layout: Valores apenas (sem títulos), fonte grande para EAN
// Renderização com inline styles para compatibilidade com html2canvas

import React from 'react';

export interface LabelProduct {
  name: string;
  sku: string;
  ean: string;
  location: string;
}

// Pixel constants for 96dpi screen rendering
// 1mm = 3.7795px at 96dpi
const W = 378; // 100mm
const H = 151; // 40mm

// Font size auto-fit for product name
function getNameStyle(name: string): React.CSSProperties {
  const len = name.length;
  let fontSize = 16;
  if (len > 60) fontSize = 11;
  else if (len > 45) fontSize = 12;
  else if (len > 30) fontSize = 14;
  else if (len > 20) fontSize = 15;
  return {
    fontSize,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: '1.25',
    wordBreak: 'break-word',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    maxHeight: '2.6em',
    color: '#111',
    letterSpacing: '-0.01em',
  } as React.CSSProperties;
}

const divider: React.CSSProperties = {
  width: '100%',
  height: '1px',
  backgroundColor: '#555',
  flexShrink: 0,
};

interface ShelfLabel100x40Props {
  product: LabelProduct;
  previewScale?: number; // scale for display (default 1 = actual mm size)
}

// Inner label component — actual pixel size for html2canvas capture
export const ShelfLabel100x40Inner = React.forwardRef<HTMLDivElement, { product: LabelProduct }>(
  ({ product }, ref) => {
    const nameFontSize = (() => {
      const len = product.name.length;
      if (len > 60) return 11;
      if (len > 45) return 12;
      if (len > 30) return 14;
      if (len > 20) return 15;
      return 16;
    })();

    const eanFontSize = (() => {
      const len = (product.ean || '').length;
      if (len > 14) return 17;
      if (len > 12) return 19;
      return 21;
    })();

    return (
      <div
        ref={ref}
        style={{
          width: W,
          height: H,
          border: '1.5px solid #222',
          backgroundColor: '#ffffff',
          fontFamily: 'Arial, Helvetica, sans-serif',
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* NAME — top section, ~37% height */}
        <div
          style={{
            flex: '0 0 54px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 8px',
            borderBottom: '1px solid #555',
          }}
        >
          <span
            style={{
              fontSize: nameFontSize,
              fontWeight: '900',
              textAlign: 'center',
              lineHeight: '1.25',
              wordBreak: 'break-word',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              color: '#111',
              letterSpacing: '-0.01em',
            } as React.CSSProperties}
          >
            {product.name || '—'}
          </span>
        </div>

        {/* LOCATION — ~17% height */}
        <div
          style={{
            flex: '0 0 26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            borderBottom: '1px solid #555',
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: '800',
              textAlign: 'center',
              color: '#111',
              letterSpacing: '0.5px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {product.location || '—'}
          </span>
        </div>

        {/* SKU — ~17% height */}
        <div
          style={{
            flex: '0 0 26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            borderBottom: '1px solid #555',
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: '800',
              textAlign: 'center',
              color: '#111',
              letterSpacing: '0.8px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {product.sku || '—'}
          </span>
        </div>

        {/* EAN — remaining height, biggest text */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}
        >
          <span
            style={{
              fontSize: eanFontSize,
              fontWeight: '900',
              textAlign: 'center',
              color: '#000',
              letterSpacing: '1.5px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {product.ean || '—'}
          </span>
        </div>
      </div>
    );
  }
);

// Wrapper with preview scale
const ShelfLabel100x40: React.FC<ShelfLabel100x40Props & { innerRef?: React.RefObject<HTMLDivElement> }> = ({
  product,
  previewScale = 1,
  innerRef,
}) => {
  if (previewScale === 1) {
    return <ShelfLabel100x40Inner ref={innerRef} product={product} />;
  }

  return (
    <div
      style={{
        width: W * previewScale,
        height: H * previewScale,
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
        <ShelfLabel100x40Inner ref={innerRef} product={product} />
      </div>
    </div>
  );
};

export { W as SHELF_W, H as SHELF_H };
export default ShelfLabel100x40;
