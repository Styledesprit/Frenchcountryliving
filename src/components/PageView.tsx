import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import QRCode from 'qrcode';
import type { Block, Itinerary, Page, Route, TextStyle } from '../types';
import { Img, RichText } from './common';
import { MapView } from './MapView';
import { appleRouteUrl, distanceText, googleRouteUrl, stopLink } from '../lib/maps';
import { fontStack } from '../lib/fonts';

export const PAGE_W = 210; // mm (A4)
export const PAGE_H = 297;

interface Ctx {
  doc: Itinerary;
  editable: boolean;
  selectedBlockId?: string;
  onSelectBlock?: (id: string) => void;
  onBlockChange?: (b: Block) => void;
  onRouteChange?: (r: Route) => void;
}

function textStyle(s: TextStyle | undefined, doc: Itinerary): CSSProperties {
  if (!s) return {};
  return {
    fontFamily: s.font ? fontStack(s.font) : undefined,
    fontSize: s.size ? `${s.size}pt` : undefined,
    color: s.color,
    textAlign: s.align,
    textTransform: s.uppercase ? 'uppercase' : undefined,
    letterSpacing: s.letterSpacing !== undefined ? `${s.letterSpacing}em` : undefined,
    fontWeight: s.weight,
    ['--accent' as string]: doc.theme.accent,
  };
}

function QR({ text }: { text: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 300, errorCorrectionLevel: 'L', color: { dark: '#5b5755', light: '#00000000' } }).then(setUrl);
  }, [text]);
  return url ? <img src={url} alt="QR code" /> : null;
}

function BlockView({ block, ctx }: { block: Block; ctx: Ctx }) {
  const { doc, editable } = ctx;
  const set = (patch: Partial<Block>) => ctx.onBlockChange?.({ ...block, ...patch } as Block);
  const st = textStyle(block.style, doc);
  const routeById = (id?: string) => doc.routes.find((r) => r.id === id);

  switch (block.type) {
    case 'heading':
      return <RichText className={'b-heading h-' + block.kind} style={st} html={block.html} editable={editable} onChange={(html) => set({ html })} />;
    case 'text':
      return <RichText className="b-text" style={st} html={block.html} editable={editable} onChange={(html) => set({ html })} />;
    case 'tip':
      return <RichText className="b-tip" style={st} html={block.html} editable={editable} onChange={(html) => set({ html })} />;
    case 'time':
      return (
        <div className="b-time">
          <RichText className="time-label" tag="div" html={block.label} editable={editable} onChange={(label) => set({ label: label.replace(/<[^>]+>/g, '') })} />
          <div className="time-rule" />
          <RichText className="b-text" style={st} html={block.html} editable={editable} onChange={(html) => set({ html })} />
        </div>
      );
    case 'note':
      return (
        <div className="b-note">
          <div className="note-back" />
          <div className="note-card">
            <div className="note-tape" />
            <RichText className="b-text" style={st} html={block.html} editable={editable} onChange={(html) => set({ html })} />
          </div>
        </div>
      );
    case 'images': {
      const imgs = block.images.length ? block.images : [{ src: '' }];
      const cls = `b-images layout-${block.layout} n-${Math.min(imgs.length, 3)} ${block.frame ? 'framed' : ''}`;
      return (
        <div className={cls} style={{ height: `${block.height}mm` }}>
          {imgs.map((im, i) => (
            <div className="img-cell" key={i}>
              <Img image={im} />
              {block.layout === 'polaroids' && <div className="tape" />}
            </div>
          ))}
        </div>
      );
    }
    case 'map': {
      const r = routeById(block.routeId);
      if (!r) return <div className="b-missing">Choose a route for this map in the panel on the right →</div>;
      const g = googleRouteUrl(r);
      return (
        <div className="b-map">
          <div className="map-frame">
            <MapView route={r} theme={doc.theme} editable={editable} onRouteChange={ctx.onRouteChange} height={`${block.height}mm`} />
            {/* In the PDF the whole map is a link that opens the route in Google Maps */}
            <a className="print-only map-link-overlay" href={g} aria-label="Open this route in Google Maps" />
          </div>
          {block.showLinks !== false && (
            <div className="map-links">
              <span>OPEN THIS ROUTE IN</span>
              <a href={g} target="_blank" rel="noopener">
                Google Maps
              </a>
              <span>·</span>
              <a href={appleRouteUrl(r)} target="_blank" rel="noopener">
                Apple Maps
              </a>
            </div>
          )}
          {block.showDistance && (
            <div className="map-distance">
              <div className="dist-value">{distanceText(r)}</div>
              <div className="dist-label">D I S T A N C E</div>
            </div>
          )}
        </div>
      );
    }
    case 'addresses': {
      const routes = block.routeIds.map(routeById).filter(Boolean) as Route[];
      const qrRoute = routeById(block.qrRouteId) || routes[0];
      return (
        <div className="b-addresses">
          <RichText className="addr-title" html={block.title} editable={editable} onChange={(title) => set({ title })} />
          <div className="addr-body">
            {block.showQr && qrRoute && (
              <a className="addr-qr" href={googleRouteUrl(qrRoute)} target="_blank" rel="noopener">
                <div className="qr-box">
                  <QR text={googleRouteUrl(qrRoute)} />
                </div>
                <div className="qr-caption">INTERACTIVE MAP</div>
              </a>
            )}
            <div className={'addr-list' + (routes.length > 1 ? ' addr-cols' : '')} style={st}>
              {routes.map((r) => (
                <div key={r.id}>
                  {routes.length > 1 && <div className="addr-route">{r.name.replace(/^Day \d+\s*[–-]\s*/, '').toUpperCase()}</div>}
                  {r.stops.map((s) => (
                    <div className="addr-line" key={s.id}>
                      <a href={stopLink(s)} target="_blank" rel="noopener">
                        {s.name}
                      </a>
                      {s.address ? ` - ${s.address}` : ''}
                    </div>
                  ))}
                </div>
              ))}
              {routes.length === 0 && <div className="b-missing">Choose which day's places to list →</div>}
            </div>
          </div>
        </div>
      );
    }
    case 'table':
      return (
        <table className="b-table" style={st}>
          <thead>
            <tr>
              {block.header.map((h, i) => (
                <th key={i}>
                  <RichText html={h} editable={editable} onChange={(v) => set({ header: block.header.map((x, j) => (j === i ? v : x)) as [string, string] })} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>
                    <RichText
                      html={cell}
                      editable={editable}
                      onChange={(v) =>
                        set({ rows: block.rows.map((r, j) => (j === ri ? (r.map((c, k) => (k === ci ? v : c)) as [string, string]) : r)) })
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'spacer':
      return <div className="b-spacer" style={{ height: `${block.height}mm` }} />;
    case 'divider':
      return <hr className="b-divider" />;
  }
}

export function PageView({
  page,
  index,
  ctx,
  selected,
  onSelectPage,
}: {
  page: Page;
  index: number;
  ctx: Ctx;
  selected?: boolean;
  onSelectPage?: () => void;
}) {
  const { doc } = ctx;
  const t = doc.theme;
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // compare the bottom of the last block with the bottom margin of the page
    const check = () => {
      const limit = el.getBoundingClientRect().bottom - parseFloat(getComputedStyle(el).paddingBottom);
      const blocks = el.querySelectorAll(':scope > .page-flow > .block');
      let bottom = 0;
      blocks.forEach((b) => (bottom = Math.max(bottom, b.getBoundingClientRect().bottom)));
      setOverflow(bottom > limit + 2);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  });

  const pad = page.padding ?? 16;
  const vars = {
    '--display': fontStack(t.displayFont),
    '--heading': fontStack(t.headingFont),
    '--body': fontStack(t.bodyFont),
    '--body-size': `${t.bodySize}pt`,
    '--ink': t.ink,
    '--accent': t.accent,
    '--soft': t.soft,
    '--cream': t.cream,
    '--blush': t.blush,
    '--pad': `${pad}mm`,
    background: page.background,
  } as CSSProperties;

  const side = page.layout === 'split' && page.side;
  const sideHeight = side ? (page.band ? (PAGE_H * page.band.fromPct) / 100 : PAGE_H) : 0;

  return (
    <div className={'page-wrap' + (selected ? ' page-selected' : '')} data-page-id={page.id}>
      <div className="page-meta no-print">
        <span>
          {index + 1}. {page.name}
        </span>
        {overflow && <span className="overflow-badge">Text doesn't fit: shorten it or move a block to the next page</span>}
      </div>
      <div className="page" style={vars} onMouseDown={onSelectPage}>
        {page.band && <div className="page-band" style={{ top: `${page.band.fromPct}%`, background: page.band.color }} />}
        <div ref={contentRef} className={`page-content valign-${side ? 'top' : page.valign || 'top'}`}>
          <div className="page-flow">
            {side && (
              <div
                className={`side-img side-${side.position} ${side.edge ? 'edge' : ''}`}
                style={{ width: `${side.widthPct}%`, height: side.edge ? `${sideHeight}mm` : `${sideHeight - 2 * pad}mm` }}
              >
                <Img image={side.image} />
              </div>
            )}
            {page.blocks.map((b) => (
              <div
                key={b.id}
                className={'block block-' + b.type + (ctx.selectedBlockId === b.id ? ' block-selected' : '')}
                style={{ marginTop: b.spaceBefore ? `${b.spaceBefore}mm` : undefined }}
                onMouseDown={(e) => {
                  if (!ctx.editable) return;
                  e.stopPropagation();
                  onSelectPage?.();
                  ctx.onSelectBlock?.(b.id);
                }}
              >
                <BlockView block={b} ctx={ctx} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
