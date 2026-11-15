import type { Block, BlockType, CustomFont, ImageRef, Itinerary, Page, TextStyle } from '../types';
import { ColorInput, Field, Img, NumberInput } from './common';
import { FONT_OPTIONS } from '../lib/fonts';
import { pickImages } from '../lib/images';
import { uid } from '../lib/store';

// ---------------------------------------------------------------- fonts
export function FontSelect({
  value,
  onChange,
  customFonts,
  allowDefault,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  customFonts: CustomFont[];
  allowDefault?: boolean;
}) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || undefined)}>
      {allowDefault && <option value="">Theme default</option>}
      {customFonts.length > 0 && (
        <optgroup label="Your uploaded fonts">
          {customFonts.map((f) => (
            <option key={f.id} value={f.family}>
              {f.family}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Google Fonts">
        {FONT_OPTIONS.map((f) => (
          <option key={f.family} value={f.family}>
            {f.family} — {f.note}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

// ---------------------------------------------------------------- images
function ImageEditor({ image, onChange, onRemove }: { image: ImageRef; onChange: (i: ImageRef) => void; onRemove?: () => void }) {
  const [x, y] = (image.position || '50% 50%').split(' ').map((v) => parseFloat(v));
  return (
    <div className="img-editor">
      <div className="img-thumb">
        <Img image={image} />
      </div>
      <div className="img-controls">
        <div className="row">
          <button
            onClick={async () => {
              const [src] = await pickImages();
              if (src) onChange({ ...image, src });
            }}
          >
            {image.src ? 'Replace photo…' : 'Upload photo…'}
          </button>
          {onRemove && (
            <button className="danger" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
        <label className="slider">
          ↔ <input type="range" min={0} max={100} value={x} onChange={(e) => onChange({ ...image, position: `${e.target.value}% ${y}%` })} />
        </label>
        <label className="slider">
          ↕ <input type="range" min={0} max={100} value={y} onChange={(e) => onChange({ ...image, position: `${x}% ${e.target.value}%` })} />
        </label>
        <input
          type="text"
          placeholder="…or paste an image web address"
          value={image.src.startsWith('asset:') ? '' : image.src}
          onChange={(e) => onChange({ ...image, src: e.target.value })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- new blocks
export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Heading',
  text: 'Paragraph',
  time: 'Time slot (9AM…)',
  tip: 'Tip',
  note: 'Taped note card',
  images: 'Photos',
  map: 'Interactive map',
  addresses: "Today's addresses + QR",
  table: 'Table',
  spacer: 'Empty space',
  divider: 'Line',
};

export function newBlock(type: BlockType, doc: Itinerary): Block {
  const id = uid();
  const firstRoute = doc.routes[0]?.id || '';
  switch (type) {
    case 'heading':
      return { id, type, kind: 'title', html: 'NEW HEADING' };
    case 'text':
      return { id, type, html: 'Write something lovely…' };
    case 'time':
      return { id, type, label: '9AM', html: 'What happens at this time…' };
    case 'tip':
      return { id, type, html: 'TIP: …' };
    case 'note':
      return { id, type, html: 'A little note…' };
    case 'images':
      return { id, type, images: [], layout: 'single', height: 80, frame: true };
    case 'map':
      return { id, type, routeId: firstRoute, height: 150, showDistance: true, showLinks: true };
    case 'addresses':
      return { id, type, title: "TODAY'S ADDRESSES", routeIds: firstRoute ? [firstRoute] : [], showQr: true, qrRouteId: firstRoute };
    case 'table':
      return { id, type, header: ['DAY', 'CITIES'], rows: [['DAY 1', '…']] };
    case 'spacer':
      return { id, type, height: 10 };
    case 'divider':
      return { id, type };
  }
}

// ---------------------------------------------------------------- text style
function StyleEditor({ style, onChange, customFonts }: { style?: TextStyle; onChange: (s: TextStyle) => void; customFonts: CustomFont[] }) {
  const s = style || {};
  const set = (p: Partial<TextStyle>) => onChange({ ...s, ...p });
  return (
    <div className="group">
      <div className="group-title">Text style</div>
      <Field label="Font">
        <FontSelect value={s.font} onChange={(font) => set({ font })} customFonts={customFonts} allowDefault />
      </Field>
      <div className="grid2">
        <Field label="Size (pt)">
          <NumberInput value={s.size} onChange={(size) => set({ size })} min={5} max={200} step={0.5} placeholder="auto" />
        </Field>
        <Field label="Weight">
          <select value={s.weight || ''} onChange={(e) => set({ weight: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">auto</option>
            <option value="300">Light</option>
            <option value="400">Regular</option>
            <option value="600">Semi-bold</option>
            <option value="700">Bold</option>
          </select>
        </Field>
        <Field label="Align">
          <select value={s.align || ''} onChange={(e) => set({ align: (e.target.value || undefined) as TextStyle['align'] })}>
            <option value="">auto</option>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
            <option value="justify">Justify</option>
          </select>
        </Field>
        <Field label="Letter spacing">
          <NumberInput value={s.letterSpacing} onChange={(letterSpacing) => set({ letterSpacing })} step={0.01} placeholder="auto" />
        </Field>
      </div>
      <Field label="Color">
        <ColorInput value={s.color} onChange={(color) => set({ color })} allowEmpty />
      </Field>
      <label className="check">
        <input type="checkbox" checked={!!s.uppercase} onChange={(e) => set({ uppercase: e.target.checked || undefined })} /> ALL CAPS
      </label>
    </div>
  );
}

// ---------------------------------------------------------------- block panel
export function BlockPanel({
  block,
  doc,
  customFonts,
  onChange,
  onAction,
}: {
  block: Block;
  doc: Itinerary;
  customFonts: CustomFont[];
  onChange: (b: Block) => void;
  onAction: (a: 'up' | 'down' | 'prevPage' | 'nextPage' | 'newPageAfter' | 'duplicate' | 'delete') => void;
}) {
  const set = (p: Partial<Block>) => onChange({ ...block, ...p } as Block);
  const hasText = ['heading', 'text', 'time', 'tip', 'note', 'addresses', 'table'].includes(block.type);

  return (
    <div className="panel">
      <div className="panel-title">{BLOCK_LABELS[block.type]}</div>
      <div className="btn-grid">
        <button onClick={() => onAction('up')}>↑ Move up</button>
        <button onClick={() => onAction('down')}>↓ Move down</button>
        <button onClick={() => onAction('prevPage')}>⇡ To previous page</button>
        <button onClick={() => onAction('nextPage')}>⇣ To next page</button>
        <button onClick={() => onAction('newPageAfter')} title="Moves this block and everything after it onto a new page">
          ✂ Split page here
        </button>
        <button onClick={() => onAction('duplicate')}>⧉ Duplicate</button>
        <button className="danger" onClick={() => onAction('delete')}>
          ✕ Delete
        </button>
      </div>

      {block.type === 'heading' && (
        <Field label="Heading type">
          <select value={block.kind} onChange={(e) => set({ kind: e.target.value as typeof block.kind })}>
            <option value="display">Display (big decorative)</option>
            <option value="title">Title</option>
            <option value="subtitle">Subtitle</option>
            <option value="eyebrow">Small caps label</option>
          </select>
        </Field>
      )}

      {block.type === 'images' && (
        <div className="group">
          <div className="group-title">Photos</div>
          <div className="grid2">
            <Field label="Layout">
              <select value={block.layout} onChange={(e) => set({ layout: e.target.value as typeof block.layout })}>
                <option value="single">Single / stacked</option>
                <option value="row">Side by side</option>
                <option value="collage">Collage</option>
                <option value="polaroids">Taped polaroids</option>
              </select>
            </Field>
            <Field label="Height (mm)">
              <NumberInput value={block.height} onChange={(h) => set({ height: h || 60 })} min={10} max={290} />
            </Field>
          </div>
          <label className="check">
            <input type="checkbox" checked={block.frame} onChange={(e) => set({ frame: e.target.checked })} /> White frame
          </label>
          {block.images.map((im, i) => (
            <ImageEditor
              key={i}
              image={im}
              onChange={(ni) => set({ images: block.images.map((x, j) => (j === i ? ni : x)) })}
              onRemove={() => set({ images: block.images.filter((_, j) => j !== i) })}
            />
          ))}
          <button
            onClick={async () => {
              const srcs = await pickImages(true);
              if (srcs.length) set({ images: [...block.images, ...srcs.map((src) => ({ src }))] });
            }}
          >
            + Add photos…
          </button>
        </div>
      )}

      {block.type === 'map' && (
        <div className="group">
          <Field label="Route shown" hint="Edit the places of each route in the Places tab.">
            <select value={block.routeId} onChange={(e) => set({ routeId: e.target.value })}>
              <option value="">— choose —</option>
              {doc.routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Map height (mm)">
            <NumberInput value={block.height} onChange={(h) => set({ height: h || 120 })} min={40} max={260} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={block.showDistance} onChange={(e) => set({ showDistance: e.target.checked })} /> Show distance
          </label>
          <label className="check">
            <input type="checkbox" checked={block.showLinks !== false} onChange={(e) => set({ showLinks: e.target.checked })} /> Show “Open in Google
            Maps · Apple Maps” links
          </label>
        </div>
      )}

      {block.type === 'addresses' && (
        <div className="group">
          <div className="group-title">Places listed</div>
          {doc.routes.map((r) => (
            <label className="check" key={r.id}>
              <input
                type="checkbox"
                checked={block.routeIds.includes(r.id)}
                onChange={(e) =>
                  set({ routeIds: e.target.checked ? [...block.routeIds, r.id] : block.routeIds.filter((x) => x !== r.id) })
                }
              />{' '}
              {r.name}
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={block.showQr} onChange={(e) => set({ showQr: e.target.checked })} /> Show QR code (opens the route in
            Google Maps)
          </label>
          {block.showQr && (
            <Field label="QR code route">
              <select value={block.qrRouteId || ''} onChange={(e) => set({ qrRouteId: e.target.value })}>
                {doc.routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}

      {block.type === 'table' && (
        <div className="group">
          <div className="group-title">Rows</div>
          {block.rows.map((row, i) => (
            <div className="row" key={i}>
              <span className="muted">Row {i + 1}</span>
              <button className="link-btn danger" onClick={() => set({ rows: block.rows.filter((_, j) => j !== i) })}>
                remove
              </button>
            </div>
          ))}
          <button onClick={() => set({ rows: [...block.rows, ['DAY', '…']] })}>+ Add row</button>
        </div>
      )}

      {block.type === 'spacer' && (
        <Field label="Height (mm)">
          <NumberInput value={block.height} onChange={(h) => set({ height: h ?? 5 })} min={0} max={250} />
        </Field>
      )}

      <Field label="Space above (mm)">
        <NumberInput value={block.spaceBefore} onChange={(spaceBefore) => set({ spaceBefore })} min={-50} max={150} placeholder="0" />
      </Field>

      {hasText && <StyleEditor style={block.style} onChange={(style) => set({ style })} customFonts={customFonts} />}
      {hasText && (
        <p className="help">
          Click into the text on the page to type. Select words to make them <b>bold</b>, <i>italic</i> or a link with the toolbar at the top.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- page panel
export function PagePanel({
  page,
  onChange,
  onAction,
}: {
  page: Page;
  onChange: (p: Page) => void;
  onAction: (a: 'up' | 'down' | 'duplicate' | 'delete') => void;
}) {
  const set = (p: Partial<Page>) => onChange({ ...page, ...p });
  return (
    <div className="panel">
      <div className="panel-title">Page</div>
      <Field label="Name (only shown here)">
        <input type="text" value={page.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <div className="btn-grid">
        <button onClick={() => onAction('up')}>↑ Move page up</button>
        <button onClick={() => onAction('down')}>↓ Move page down</button>
        <button onClick={() => onAction('duplicate')}>⧉ Duplicate page</button>
        <button className="danger" onClick={() => onAction('delete')}>
          ✕ Delete page
        </button>
      </div>
      <Field label="Background">
        <ColorInput value={page.background} onChange={(background) => set({ background: background || '#ffffff' })} />
      </Field>
      <div className="grid2">
        <Field label="Margins (mm)">
          <NumberInput value={page.padding ?? 16} onChange={(padding) => set({ padding })} min={0} max={60} />
        </Field>
        <Field label="Vertical position">
          <select value={page.valign || 'top'} onChange={(e) => set({ valign: e.target.value as Page['valign'] })}>
            <option value="top">Top</option>
            <option value="center">Middle</option>
            <option value="bottom">Bottom</option>
          </select>
        </Field>
      </div>

      <div className="group">
        <label className="check">
          <input
            type="checkbox"
            checked={!!page.band}
            onChange={(e) => set({ band: e.target.checked ? { color: '#dcbab1', fromPct: 60 } : undefined })}
          />{' '}
          Colored band at the bottom
        </label>
        {page.band && (
          <div className="grid2">
            <Field label="Band color">
              <ColorInput value={page.band.color} onChange={(color) => set({ band: { ...page.band!, color: color || '#dcbab1' } })} />
            </Field>
            <Field label="Starts at (% of height)">
              <NumberInput value={page.band.fromPct} onChange={(v) => set({ band: { ...page.band!, fromPct: v ?? 60 } })} min={0} max={100} />
            </Field>
          </div>
        )}
      </div>

      <div className="group">
        <label className="check">
          <input
            type="checkbox"
            checked={page.layout === 'split'}
            onChange={(e) =>
              set(
                e.target.checked
                  ? { layout: 'split', side: page.side || { image: { src: '' }, position: 'right', widthPct: 37, edge: true } }
                  : { layout: 'plain' },
              )
            }
          />{' '}
          Tall photo on the side
        </label>
        {page.layout === 'split' && page.side && (
          <>
            <div className="grid2">
              <Field label="Side">
                <select value={page.side.position} onChange={(e) => set({ side: { ...page.side!, position: e.target.value as 'left' | 'right' } })}>
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                </select>
              </Field>
              <Field label="Width (%)">
                <NumberInput value={page.side.widthPct} onChange={(w) => set({ side: { ...page.side!, widthPct: w ?? 37 } })} min={10} max={80} />
              </Field>
            </div>
            <label className="check">
              <input type="checkbox" checked={page.side.edge} onChange={(e) => set({ side: { ...page.side!, edge: e.target.checked } })} /> Bleed to the
              page edge
            </label>
            <ImageEditor image={page.side.image} onChange={(image) => set({ side: { ...page.side!, image } })} />
          </>
        )}
      </div>
    </div>
  );
}
