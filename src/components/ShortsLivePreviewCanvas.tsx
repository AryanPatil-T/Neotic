import React, { useRef, useState } from 'react';
import { GradientsConfig, LogoConfig, QuoteStyleConfig } from '../shared/types';
import { Image as ImageIcon } from 'lucide-react';

interface ShortsLivePreviewCanvasProps {
  backgroundImageUrl: string;
  quoteText: string;
  logoConfig: LogoConfig;
  gradientsConfig: GradientsConfig;
  quoteStyleConfig: QuoteStyleConfig;
  activeEditor?: 'logo' | 'gradient' | 'quote';
  onLogoMove?: (xPct: number, yPct: number) => void;
  onQuoteMove?: (xPct: number, yPct: number) => void;
  widthClass?: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(9,9,14,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildEdgeGradientCss(
  direction: 'to bottom' | 'to top' | 'to right' | 'to left',
  color: string,
  opacity: number,
  featherPct: number
): string {
  const cFull = hexToRgba(color, opacity);
  const cMid = hexToRgba(color, opacity * 0.35);
  const cZero = hexToRgba(color, 0);
  const midStop = Math.max(8, Math.min(92, 100 - featherPct * 0.7));
  return `linear-gradient(${direction}, ${cFull} 0%, ${cMid} ${midStop}%, ${cZero} 100%)`;
}

export const ShortsLivePreviewCanvas: React.FC<ShortsLivePreviewCanvasProps> = ({
  backgroundImageUrl,
  quoteText,
  logoConfig,
  gradientsConfig,
  quoteStyleConfig,
  activeEditor,
  onLogoMove,
  onQuoteMove,
  widthClass = 'w-[300px] sm:w-[340px]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'logo' | 'quote' | null>(null);
  const [imgError, setImgError] = useState(false);

  const updateDragPosition = (e: React.PointerEvent, target: 'logo' | 'quote') => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.max(8, Math.min(92, Math.round(rawX * 10) / 10));
    const clampedY = Math.max(6, Math.min(94, Math.round(rawY * 10) / 10));

    // Subtle center snap within 2.5%
    const snappedX = Math.abs(clampedX - 50) < 2.5 ? 50 : clampedX;

    if (target === 'logo' && onLogoMove) {
      onLogoMove(snappedX, clampedY);
    } else if (target === 'quote' && onQuoteMove) {
      onQuoteMove(snappedX, clampedY);
    }
  };

  // Scale font size relative to 1080px reference width -> container width (~320px)
  const previewScale = 320 / 1080;
  const scaledFontPx = Math.max(11, Math.round(quoteStyleConfig.fontSize * previewScale));
  const scaledSpacingPx = quoteStyleConfig.letterSpacing * previewScale;
  const scaledShadowBlur = quoteStyleConfig.shadowBlur * previewScale;

  const fontFamilyCss =
    quoteStyleConfig.fontFamily === 'Playfair Display'
      ? '"Playfair Display", Georgia, serif'
      : quoteStyleConfig.fontFamily === 'Cinzel'
      ? '"Cinzel", Georgia, serif'
      : quoteStyleConfig.fontFamily === 'Cormorant Garamond'
      ? '"Cormorant Garamond", Georgia, serif'
      : '"Inter", sans-serif';

  return (
    <div className="flex flex-col items-center">
      <div
        ref={containerRef}
        className={`relative aspect-[9/16] ${widthClass} rounded-xl overflow-hidden border border-[#27293A] bg-[#09090E] select-none shadow-2xl`}
        onPointerMove={(e) => {
          if (dragging) updateDragPosition(e, dragging);
        }}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
      >
        {/* Background Media */}
        {backgroundImageUrl && !imgError ? (
          <img
            src={backgroundImageUrl}
            alt="9:16 Studio Preview"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#181924] via-[#12131A] to-[#09090E] flex flex-col items-center justify-center gap-2 text-[#6E728A]">
            <ImageIcon className="w-8 h-8 opacity-50" />
            <span className="text-xs">9:16 Canvas Frame</span>
          </div>
        )}

        {/* 4-Sided Independent Gradients */}
        {gradientsConfig.top.enabled && (
          <div
            className="absolute top-0 left-0 right-0 pointer-events-none"
            style={{
              height: `${gradientsConfig.top.widthPct}%`,
              background: buildEdgeGradientCss(
                'to bottom',
                gradientsConfig.top.color,
                gradientsConfig.top.opacity,
                gradientsConfig.top.featherPct
              ),
            }}
          />
        )}
        {gradientsConfig.bottom.enabled && (
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{
              height: `${gradientsConfig.bottom.widthPct}%`,
              background: buildEdgeGradientCss(
                'to top',
                gradientsConfig.bottom.color,
                gradientsConfig.bottom.opacity,
                gradientsConfig.bottom.featherPct
              ),
            }}
          />
        )}
        {gradientsConfig.left.enabled && (
          <div
            className="absolute top-0 bottom-0 left-0 pointer-events-none"
            style={{
              width: `${gradientsConfig.left.widthPct}%`,
              background: buildEdgeGradientCss(
                'to right',
                gradientsConfig.left.color,
                gradientsConfig.left.opacity,
                gradientsConfig.left.featherPct
              ),
            }}
          />
        )}
        {gradientsConfig.right.enabled && (
          <div
            className="absolute top-0 bottom-0 right-0 pointer-events-none"
            style={{
              width: `${gradientsConfig.right.widthPct}%`,
              background: buildEdgeGradientCss(
                'to left',
                gradientsConfig.right.color,
                gradientsConfig.right.opacity,
                gradientsConfig.right.featherPct
              ),
            }}
          />
        )}

        {/* Center alignment snap guide during drag */}
        {dragging && (
          <div className="absolute inset-y-0 left-1/2 w-px bg-[#8B5CF6]/50 pointer-events-none" />
        )}

        {/* Draggable Logo / Watermark */}
        {logoConfig.imageUrl && (
          <div
            onPointerDown={(e) => {
              if (!onLogoMove) return;
              e.stopPropagation();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              setDragging('logo');
            }}
            style={{
              left: `${logoConfig.xPct}%`,
              top: `${logoConfig.yPct}%`,
              width: `${logoConfig.sizePct}%`,
              opacity: logoConfig.opacity,
              transform: 'translate(-50%, -50%)',
              borderRadius: logoConfig.circularCrop ? '9999px' : '4px',
              border:
                logoConfig.borderThickness > 0
                  ? `${Math.max(1, logoConfig.borderThickness * previewScale)}px solid ${logoConfig.borderColor}`
                  : 'none',
              boxShadow: logoConfig.shadowEnabled
                ? `0 4px ${Math.round(logoConfig.shadowIntensity * previewScale * 1.4)}px rgba(0,0,0,0.8)`
                : 'none',
            }}
            className={`absolute aspect-square overflow-hidden ${
              onLogoMove ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
            } ${
              activeEditor === 'logo'
                ? 'ring-1 ring-[#8B5CF6] ring-offset-2 ring-offset-transparent'
                : ''
            }`}
            title="Drag to position watermark"
          >
            <img
              src={logoConfig.imageUrl}
              alt="Logo watermark"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover pointer-events-none"
              style={{
                transform: `scale(${logoConfig.cropZoom}) translate(${logoConfig.cropOffsetX}%, ${logoConfig.cropOffsetY}%)`,
              }}
            />
          </div>
        )}

        {/* Dedicated Quote Legibility Backdrop Scrim */}
        {quoteStyleConfig.backdropEnabled !== false && (
          <div
            className="absolute pointer-events-none"
            style={(() => {
              const bColor = quoteStyleConfig.backdropColor || '#050509';
              const bOpacity = quoteStyleConfig.backdropOpacity ?? 0.78;
              const padPct = quoteStyleConfig.backdropPaddingPct ?? 14;
              const styleType = quoteStyleConfig.backdropStyle || 'cinematic_band';

              if (styleType === 'radial_glow') {
                return {
                  left: `${quoteStyleConfig.xPct}%`,
                  top: `${quoteStyleConfig.yPct}%`,
                  width: `${Math.min(100, quoteStyleConfig.maxWidthPct * 1.25)}%`,
                  height: `${Math.min(70, padPct * 2.5)}%`,
                  transform: 'translate(-50%, -50%)',
                  background: `radial-gradient(ellipse at center, ${hexToRgba(
                    bColor,
                    bOpacity
                  )} 0%, ${hexToRgba(bColor, bOpacity * 0.7)} 58%, ${hexToRgba(bColor, 0)} 100%)`,
                };
              }

              if (styleType === 'solid_soft') {
                return {
                  left: `${quoteStyleConfig.xPct}%`,
                  top: `${quoteStyleConfig.yPct}%`,
                  width: `${Math.min(94, quoteStyleConfig.maxWidthPct + 8)}%`,
                  minHeight: `${Math.min(55, padPct * 1.8)}%`,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '10px',
                  backgroundColor: hexToRgba(bColor, bOpacity * 0.85),
                };
              }

              return {
                left: 0,
                right: 0,
                top: `${quoteStyleConfig.yPct}%`,
                height: `${Math.min(72, padPct * 2.4)}%`,
                transform: 'translateY(-50%)',
                background: `linear-gradient(to bottom, ${hexToRgba(bColor, 0)} 0%, ${hexToRgba(
                  bColor,
                  bOpacity * 0.85
                )} 28%, ${hexToRgba(bColor, bOpacity)} 50%, ${hexToRgba(
                  bColor,
                  bOpacity * 0.85
                )} 72%, ${hexToRgba(bColor, 0)} 100%)`,
              };
            })()}
          />
        )}

        {/* Draggable Quote Typography Block */}
        <div
          onPointerDown={(e) => {
            if (!onQuoteMove) return;
            e.stopPropagation();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDragging('quote');
          }}
          style={{
            left: `${quoteStyleConfig.xPct}%`,
            top: `${quoteStyleConfig.yPct}%`,
            width: `${quoteStyleConfig.maxWidthPct}%`,
            transform: 'translate(-50%, -50%)',
            fontFamily: fontFamilyCss,
            fontSize: `${scaledFontPx}px`,
            fontWeight: quoteStyleConfig.fontWeight,
            color: quoteStyleConfig.color,
            textAlign: quoteStyleConfig.align,
            letterSpacing: `${scaledSpacingPx}px`,
            lineHeight: quoteStyleConfig.lineHeight,
            textShadow: quoteStyleConfig.shadowEnabled
              ? `0 2px ${Math.max(2, scaledShadowBlur)}px ${quoteStyleConfig.shadowColor}`
              : 'none',
          }}
          className={`absolute px-1.5 py-1 rounded transition-shadow ${
            onQuoteMove ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
          } ${
            activeEditor === 'quote'
              ? 'ring-1 ring-[#8B5CF6]/70'
              : ''
          }`}
          title="Drag to position quote"
        >
          {quoteText || 'Silence is the forge where discipline becomes power.'}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2 text-xs text-[#8E92A8] font-mono-tabular">
        <span>9:16 Vertical Canvas</span>
        <span aria-hidden="true">·</span>
        <span>Drag elements to reposition</span>
      </div>
    </div>
  );
};
