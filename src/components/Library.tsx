import { useEffect, useState } from 'react';
import type { Itinerary } from '../types';
import { clone, deleteDoc, download, exportDoc, importDoc, listDocs, saveDoc, uid } from '../lib/store';
import { buildBlank, buildLuberon } from '../seed/luberon';
import { pickFiles } from '../lib/images';
import { Img } from './common';

const firstImage = (d: Itinerary) => {
  for (const p of d.pages) {
    for (const b of p.blocks) if (b.type === 'images' && b.images[0]?.src) return b.images[0];
    if (p.side?.image.src) return p.side.image;
  }
  return { src: '' };
};

export function Library({ onOpen }: { onOpen: (d: Itinerary) => void }) {
  const [docs, setDocs] = useState<Itinerary[] | null>(null);
  const refresh = () => listDocs().then(setDocs);
  useEffect(() => {
    refresh();
  }, []);

  const create = async (d: Itinerary) => {
    await saveDoc(d);
    onOpen(d);
  };

  return (
    <div className="library">
      <header className="lib-head">
        <div>
          <h1>Itinerary Studio</h1>
          <p className="muted">Edit your travel guides, add interactive maps, and export a PDF for Flipsnack.</p>
        </div>
        <div className="row wrap">
          <button className="primary" onClick={() => create(buildLuberon())}>
            + New from the Luberon guide
          </button>
          <button onClick={() => create(buildBlank())}>+ New blank itinerary</button>
          <button
            onClick={async () => {
              const [f] = await pickFiles('.json,application/json');
              if (!f) return;
              try {
                onOpen(await importDoc(await f.text()));
              } catch (e) {
                alert('Could not open this file: ' + (e as Error).message);
              }
            }}
          >
            Open a file…
          </button>
        </div>
      </header>

      <div className="cards">
        {docs?.map((d) => (
          <div className="card" key={d.id}>
            <button className="card-img" onClick={() => onOpen(d)}>
              <Img image={firstImage(d)} />
            </button>
            <div className="card-body">
              <div className="card-title">{d.title}</div>
              <div className="small muted">
                {d.pages.length} pages · edited {new Date(d.updatedAt).toLocaleString()}
              </div>
              <div className="row wrap">
                <button className="primary" onClick={() => onOpen(d)}>
                  Open
                </button>
                <button
                  onClick={async () => {
                    await saveDoc({ ...clone(d), id: uid(), title: d.title + ' (copy)', updatedAt: Date.now() });
                    refresh();
                  }}
                >
                  Duplicate
                </button>
                <button onClick={async () => download(await exportDoc(d), `${d.title}.itinerary.json`)}>Export file</button>
                <button
                  className="danger"
                  onClick={async () => {
                    if (!confirm(`Delete “${d.title}” and all its saved versions? This can't be undone.`)) return;
                    await deleteDoc(d.id);
                    refresh();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {docs?.length === 0 && <p className="muted">No itineraries yet: start from the Luberon guide above.</p>}
      </div>
      <footer className="small muted lib-foot">
        Everything is saved in this browser on this computer. Use <b>Export file</b> to back up an itinerary or move it to another computer.
      </footer>
    </div>
  );
}
