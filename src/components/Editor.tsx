import { useCallback, useEffect, useRef, useState } from 'react';
import type { Block, BlockType, CustomFont, Itinerary, Page, Route } from '../types';
import { PageView } from './PageView';
import { BLOCK_LABELS, BlockPanel, PagePanel, newBlock } from './Inspector';
import { PlacesPanel } from './PlacesPanel';
import { ThemePanel, VersionsPanel } from './SidePanels';
import { clone, download, exportDoc, saveDoc, uid } from '../lib/store';
import { ensureGoogleFont } from '../lib/fonts';

type Tab = 'edit' | 'places' | 'theme' | 'versions';

const PAGE_TEMPLATES: { label: string; make: (doc: Itinerary) => Page }[] = [
  {
    label: 'Blank page',
    make: (doc) => ({ id: uid(), name: 'New page', layout: 'plain', background: doc.theme.cream, padding: 16, blocks: [newBlock('text', doc)] }),
  },
  {
    label: 'Day cover (big DAY N + photos)',
    make: (doc) => ({
      id: uid(),
      name: 'Day cover',
      layout: 'plain',
      background: doc.theme.blush,
      padding: 16,
      blocks: [
        { id: uid(), type: 'spacer', height: 6 },
        { id: uid(), type: 'heading', kind: 'display', html: 'DAY 8', style: { size: 96, align: 'center', color: '#fbeee9' } },
        { id: uid(), type: 'heading', kind: 'subtitle', html: 'Subtitle of the day', style: { align: 'center' } },
        { id: uid(), type: 'spacer', height: 10 },
        { id: uid(), type: 'images', images: [], layout: 'collage', height: 190, frame: true },
      ],
    }),
  },
  {
    label: 'Day text page with side photo',
    make: (doc) => ({
      id: uid(),
      name: 'Day page',
      layout: 'split',
      background: doc.theme.cream,
      padding: 16,
      side: { image: { src: '' }, position: 'right', widthPct: 37, edge: true },
      blocks: [
        { id: uid(), type: 'heading', kind: 'display', html: 'DAY 8', style: { size: 40 } },
        { id: uid(), type: 'heading', kind: 'eyebrow', html: 'MONDAY' },
        { id: uid(), type: 'text', html: 'Introduction…', style: { weight: 600 } },
        newBlock('time', doc),
        newBlock('tip', doc),
      ],
    }),
  },
  {
    label: 'Map page',
    make: (doc) => ({
      id: uid(),
      name: 'Map',
      layout: 'plain',
      background: doc.theme.cream,
      padding: 16,
      band: { color: doc.theme.blush, fromPct: 46 },
      blocks: [
        { id: uid(), type: 'spacer', height: 14 },
        { id: uid(), type: 'heading', kind: 'display', html: 'MAP', style: { size: 60, align: 'center', color: '#d9cbc5' } },
        { id: uid(), type: 'heading', kind: 'title', html: 'DAY 8', style: { align: 'center', size: 26 } },
        { id: uid(), type: 'spacer', height: 6 },
        { ...newBlock('map', doc), height: 165 } as Block,
      ],
    }),
  },
];

function FormatBar() {
  const cmd = (c: string, v?: string) => (e: React.MouseEvent) => {
    e.preventDefault(); // keep the text selection
    document.execCommand(c, false, v);
  };
  return (
    <div className="formatbar" title="Select text on the page, then click">
      <button onMouseDown={cmd('bold')}>
        <b>B</b>
      </button>
      <button onMouseDown={cmd('italic')}>
        <i>I</i>
      </button>
      <button onMouseDown={cmd('underline')}>
        <u>U</u>
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          const url = prompt('Link address (https://… or a Google Maps link):', 'https://');
          if (url) document.execCommand('createLink', false, url);
        }}
      >
        🔗 Link
      </button>
      <button onMouseDown={cmd('unlink')}>Unlink</button>
      <button onMouseDown={cmd('removeFormat')}>Clear</button>
    </div>
  );
}

export function Editor({
  initial,
  customFonts,
  onFontsChanged,
  onClose,
  onOpenDoc,
}: {
  initial: Itinerary;
  customFonts: CustomFont[];
  onFontsChanged: () => void;
  onClose: () => void;
  onOpenDoc: (d: Itinerary) => void;
}) {
  const [doc, setDoc] = useState<Itinerary>(initial);
  const [tab, setTab] = useState<Tab>('edit');
  const [pageId, setPageId] = useState<string>(initial.pages[0]?.id);
  const [blockId, setBlockId] = useState<string | undefined>();
  const [saved, setSaved] = useState(true);
  const [printing, setPrinting] = useState(false);
  const history = useRef<{ past: Itinerary[]; future: Itinerary[] }>({ past: [], future: [] });
  const lastPush = useRef(0);

  // load the theme fonts
  useEffect(() => {
    [doc.theme.displayFont, doc.theme.headingFont, doc.theme.bodyFont].forEach(ensureGoogleFont);
    JSON.stringify(doc.pages)
      .match(/"font":"([^"]+)"/g)
      ?.forEach((m) => ensureGoogleFont(m.slice(8, -1)));
  }, [doc.theme, doc.pages]);

  // save immediately when leaving the editor
  const latest = useRef(doc);
  latest.current = doc;
  useEffect(() => () => void saveDoc(latest.current), []);

  // autosave
  useEffect(() => {
    if (doc === initial) return;
    setSaved(false);
    const t = setTimeout(() => saveDoc(doc).then(() => setSaved(true)), 500);
    return () => clearTimeout(t);
  }, [doc, initial]);

  /** every change goes through here (keeps undo history) */
  const update = useCallback((fn: (d: Itinerary) => Itinerary) => {
    setDoc((prev) => {
      const next = { ...fn(prev), updatedAt: Date.now() };
      const now = Date.now();
      if (now - lastPush.current > 800) {
        history.current.past.push(prev);
        if (history.current.past.length > 80) history.current.past.shift();
        history.current.future = [];
      }
      lastPush.current = now;
      return next;
    });
  }, []);

  const undo = () => {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push(doc);
    lastPush.current = 0;
    setDoc(prev);
  };
  const redo = () => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(doc);
    lastPush.current = 0;
    setDoc(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inText = (e.target as HTMLElement).isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !inText) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const page = doc.pages.find((p) => p.id === pageId) || doc.pages[0];
  const block = page?.blocks.find((b) => b.id === blockId);

  // ---------- mutations ----------
  const setPage = (p: Page) => update((d) => ({ ...d, pages: d.pages.map((x) => (x.id === p.id ? p : x)) }));
  const setBlock = (pid: string, b: Block) =>
    update((d) => ({ ...d, pages: d.pages.map((p) => (p.id === pid ? { ...p, blocks: p.blocks.map((x) => (x.id === b.id ? b : x)) } : p)) }));
  const setRoute = (r: Route) => update((d) => ({ ...d, routes: d.routes.map((x) => (x.id === r.id ? r : x)) }));

  const pageAction = (a: 'up' | 'down' | 'duplicate' | 'delete') => {
    if (a === 'delete' && !confirm(`Delete page “${page.name}”?`)) return;
    update((d) => {
      const i = d.pages.findIndex((p) => p.id === page.id);
      const pages = d.pages.slice();
      if (a === 'up' && i > 0) [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]];
      if (a === 'down' && i < pages.length - 1) [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]];
      if (a === 'duplicate') {
        const c = clone(page);
        c.id = uid();
        c.name += ' (copy)';
        c.blocks.forEach((b) => (b.id = uid()));
        pages.splice(i + 1, 0, c);
      }
      if (a === 'delete') {
        pages.splice(i, 1);
        setPageId(pages[Math.max(0, i - 1)]?.id);
      }
      return { ...d, pages };
    });
  };

  const blockAction = (a: 'up' | 'down' | 'prevPage' | 'nextPage' | 'newPageAfter' | 'duplicate' | 'delete') => {
    if (!block) return;
    update((d) => {
      const pi = d.pages.findIndex((p) => p.id === page.id);
      const pages = d.pages.map((p) => ({ ...p, blocks: p.blocks.slice() }));
      const cur = pages[pi];
      const bi = cur.blocks.findIndex((b) => b.id === block.id);
      if (a === 'up' && bi > 0) [cur.blocks[bi - 1], cur.blocks[bi]] = [cur.blocks[bi], cur.blocks[bi - 1]];
      if (a === 'down' && bi < cur.blocks.length - 1) [cur.blocks[bi + 1], cur.blocks[bi]] = [cur.blocks[bi], cur.blocks[bi + 1]];
      if (a === 'duplicate') cur.blocks.splice(bi + 1, 0, { ...clone(block), id: uid() });
      if (a === 'delete') {
        cur.blocks.splice(bi, 1);
        setBlockId(undefined);
      }
      if (a === 'prevPage' && pi > 0) {
        cur.blocks.splice(bi, 1);
        pages[pi - 1].blocks.push(block);
        setPageId(pages[pi - 1].id);
      }
      if (a === 'nextPage') {
        cur.blocks.splice(bi, 1);
        if (pi === pages.length - 1) pages.push({ ...clone(cur), id: uid(), name: cur.name + ' (cont.)', blocks: [] });
        pages[pi + 1].blocks.unshift(block);
        setPageId(pages[pi + 1].id);
      }
      if (a === 'newPageAfter') {
        const moved = cur.blocks.splice(bi);
        const np: Page = { ...clone(cur), id: uid(), name: cur.name + ' (cont.)', blocks: moved };
        if (np.side) np.side = { ...np.side, image: { src: '' } };
        pages.splice(pi + 1, 0, np);
        setPageId(np.id);
      }
      return { ...d, pages };
    });
  };

  const addBlock = (type: BlockType) => {
    const nb = newBlock(type, doc);
    update((d) => ({
      ...d,
      pages: d.pages.map((p) => {
        if (p.id !== page.id) return p;
        const i = block ? p.blocks.findIndex((b) => b.id === block.id) + 1 : p.blocks.length;
        const blocks = p.blocks.slice();
        blocks.splice(i, 0, nb);
        return { ...p, blocks };
      }),
    }));
    setBlockId(nb.id);
  };

  const addPage = (make: (d: Itinerary) => Page) => {
    const np = make(doc);
    update((d) => {
      const i = d.pages.findIndex((p) => p.id === page?.id);
      const pages = d.pages.slice();
      pages.splice(i + 1, 0, np);
      return { ...d, pages };
    });
    setPageId(np.id);
    setBlockId(undefined);
    setTimeout(() => document.querySelector(`[data-page-id="${np.id}"]`)?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  // ---------- PDF ----------
  const exportPdf = async () => {
    (document.activeElement as HTMLElement)?.blur();
    setBlockId(undefined);
    setPrinting(true);
    await document.fonts.ready;
    // give maps a moment to finish loading their tiles
    await new Promise((r) => setTimeout(r, 1500));
    const prevTitle = document.title;
    document.title = doc.title;
    window.print();
    document.title = prevTitle;
    setPrinting(false);
  };

  const ctx = {
    doc,
    editable: !printing,
    selectedBlockId: blockId,
    onSelectBlock: (id: string) => {
      setBlockId(id);
      if (tab !== 'edit') setTab('edit');
    },
    onRouteChange: setRoute,
  };

  const mapRouteId = block?.type === 'map' ? block.routeId : block?.type === 'addresses' ? block.routeIds[0] : undefined;

  return (
    <div className={'editor' + (printing ? ' printing' : '')}>
      <header className="topbar no-print">
        <button className="link-btn" onClick={onClose}>
          ← All itineraries
        </button>
        <input className="doc-title" value={doc.title} onChange={(e) => update((d) => ({ ...d, title: e.target.value }))} />
        <span className="small muted">{saved ? 'Saved' : 'Saving…'}</span>
        <div className="spacer" />
        <FormatBar />
        <button onClick={undo} title="Undo (Ctrl/Cmd+Z)">
          ↶
        </button>
        <button onClick={redo} title="Redo (Ctrl/Cmd+Shift+Z)">
          ↷
        </button>
        <button onClick={async () => download(await exportDoc(doc), `${doc.title}.itinerary.json`)} title="Save a file you can back up or send to a colleague">
          Export file
        </button>
        <button className="primary" onClick={exportPdf}>
          Export PDF
        </button>
      </header>

      <div className="workspace">
        <aside className="pagelist no-print">
          <div className="pagelist-title">Pages ({doc.pages.length})</div>
          {doc.pages.map((p, i) => (
            <button
              key={p.id}
              className={'pagelist-item' + (p.id === page?.id ? ' active' : '')}
              onClick={() => {
                setPageId(p.id);
                setBlockId(undefined);
                document.querySelector(`[data-page-id="${p.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <span className="swatch" style={{ background: p.background }} />
              {i + 1}. {p.name}
            </button>
          ))}
          <div className="pagelist-title">Add a page after the selected one</div>
          {PAGE_TEMPLATES.map((t) => (
            <button key={t.label} className="pagelist-add" onClick={() => addPage(t.make)}>
              + {t.label}
            </button>
          ))}
        </aside>

        <main className="pages" onMouseDown={() => setBlockId(undefined)}>
          {doc.pages.map((p, i) => (
            <PageView
              key={p.id}
              page={p}
              index={i}
              selected={p.id === page?.id && !printing}
              onSelectPage={() => setPageId(p.id)}
              ctx={{ ...ctx, onBlockChange: (b) => setBlock(p.id, b) }}
            />
          ))}
        </main>

        <aside className="inspector no-print">
          <nav className="tabs">
            {(
              [
                ['edit', 'Edit'],
                ['places', 'Places & maps'],
                ['theme', 'Fonts & colors'],
                ['versions', 'Versions'],
              ] as [Tab, string][]
            ).map(([k, l]) => (
              <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </nav>
          <div className="inspector-body">
            {tab === 'edit' && page && (
              <>
                {block ? (
                  <>
                    <button className="link-btn" onClick={() => setBlockId(undefined)}>
                      ← Page settings
                    </button>
                    <BlockPanel block={block} doc={doc} customFonts={customFonts} onChange={(b) => setBlock(page.id, b)} onAction={blockAction} />
                    {(block.type === 'map' || block.type === 'addresses') && (
                      <button onClick={() => setTab('places')}>Edit the places on this route →</button>
                    )}
                  </>
                ) : (
                  <PagePanel page={page} onChange={setPage} onAction={pageAction} />
                )}
                <div className="panel">
                  <div className="panel-title">Add to this page</div>
                  <p className="help">{block ? 'Inserted after the selected block.' : 'Added at the end of the page.'}</p>
                  <div className="btn-grid">
                    {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
                      <button key={t} onClick={() => addBlock(t)}>
                        + {BLOCK_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {tab === 'places' && (
              <PlacesPanel
                doc={doc}
                focusRouteId={mapRouteId}
                onRouteChange={setRoute}
                onRoutesChange={(routes) => update((d) => ({ ...d, routes }))}
              />
            )}
            {tab === 'theme' && (
              <ThemePanel
                theme={doc.theme}
                onChange={(theme) => update((d) => ({ ...d, theme }))}
                customFonts={customFonts}
                onFontsChanged={onFontsChanged}
              />
            )}
            {tab === 'versions' && (
              <VersionsPanel
                doc={doc}
                onRestore={(v) => update(() => ({ ...clone(v.data), id: doc.id }))}
                onDuplicate={async () => {
                  const copy = { ...clone(doc), id: uid(), title: doc.title + ' (copy)', updatedAt: Date.now() };
                  await saveDoc(copy);
                  onOpenDoc(copy);
                }}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
