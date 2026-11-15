import { useEffect, useState } from 'react';
import type { CustomFont, Itinerary } from './types';
import { Library } from './components/Library';
import { Editor } from './components/Editor';
import { getDoc, hasAnyDoc, listFonts, saveDoc } from './lib/store';
import { registerCustomFont } from './lib/fonts';
import { buildLuberon } from './seed/luberon';

export default function App() {
  const [doc, setDoc] = useState<Itinerary | null>(null);
  const [ready, setReady] = useState(false);
  const [fonts, setFonts] = useState<CustomFont[]>([]);

  const loadFonts = async () => {
    const f = await listFonts();
    await Promise.all(f.map(registerCustomFont));
    setFonts(f);
  };

  useEffect(() => {
    (async () => {
      await loadFonts();
      // first visit: start with the Luberon guide
      if (!(await hasAnyDoc())) await saveDoc(buildLuberon());
      const id = location.hash.match(/^#\/edit\/(.+)$/)?.[1];
      if (id) setDoc((await getDoc(id)) || null);
      setReady(true);
    })();
    const onHash = async () => {
      const id = location.hash.match(/^#\/edit\/(.+)$/)?.[1];
      setDoc(id ? (await getDoc(id)) || null : null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!ready) return null;
  if (doc)
    return (
      <Editor
        key={doc.id}
        initial={doc}
        customFonts={fonts}
        onFontsChanged={loadFonts}
        onClose={() => (location.hash = '')}
        onOpenDoc={(d) => (location.hash = '#/edit/' + d.id)}
      />
    );
  return <Library onOpen={(d) => (location.hash = '#/edit/' + d.id)} />;
}
