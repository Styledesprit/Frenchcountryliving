// Persistence in the browser's IndexedDB (no server needed).
// Everything stays on this computer until you export a file.
import { createStore, get, set, del, values, keys } from 'idb-keyval';
import type { CustomFont, Itinerary, Version } from '../types';

const docsStore = createStore('itinerary-studio-docs', 'docs');
const versionsStore = createStore('itinerary-studio-versions', 'versions');
const assetsStore = createStore('itinerary-studio-assets', 'assets');
const fontsStore = createStore('itinerary-studio-fonts', 'fonts');

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// ---------- documents ----------
export async function listDocs(): Promise<Itinerary[]> {
  const all = (await values(docsStore)) as Itinerary[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}
export const getDoc = (id: string) => get<Itinerary>(id, docsStore);
export const saveDoc = (doc: Itinerary) => set(doc.id, doc, docsStore);
export async function deleteDoc(id: string) {
  await del(id, docsStore);
  for (const v of await listVersions(id)) await del(v.id, versionsStore);
}

// ---------- versions ----------
export async function listVersions(docId: string): Promise<Version[]> {
  const all = (await values(versionsStore)) as Version[];
  return all.filter((v) => v.docId === docId).sort((a, b) => b.createdAt - a.createdAt);
}
export async function saveVersion(doc: Itinerary, label: string): Promise<Version> {
  const v: Version = { id: uid(), docId: doc.id, label, createdAt: Date.now(), data: clone(doc) };
  await set(v.id, v, versionsStore);
  return v;
}
export const deleteVersion = (id: string) => del(id, versionsStore);

// ---------- uploaded images ----------
const urlCache = new Map<string, string>();

export async function putAsset(file: Blob): Promise<string> {
  const id = uid();
  await set(id, file, assetsStore);
  return 'asset:' + id;
}

/** Resolve an image src ("asset:xyz" or a normal URL) to something an <img> can show. */
export async function resolveSrc(src: string): Promise<string> {
  if (!src.startsWith('asset:')) return src;
  const id = src.slice(6);
  if (urlCache.has(id)) return urlCache.get(id)!;
  const blob = await get<Blob>(id, assetsStore);
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });

// ---------- custom fonts ----------
export const listFonts = async () => (await values(fontsStore)) as CustomFont[];
export async function addFont(file: File, family: string): Promise<CustomFont> {
  const f: CustomFont = { id: uid(), family, dataUrl: await blobToDataUrl(file) };
  await set(f.id, f, fontsStore);
  return f;
}
export const deleteFont = (id: string) => del(id, fontsStore);

// ---------- export / import of a whole itinerary (with its images) ----------
interface ExportFile {
  format: 'itinerary-studio';
  version: 1;
  doc: Itinerary;
  assets: Record<string, string>; // id -> data URL
  fonts: CustomFont[];
}

export async function exportDoc(doc: Itinerary): Promise<Blob> {
  const json = JSON.stringify(doc);
  const ids = Array.from(new Set(Array.from(json.matchAll(/asset:([a-z0-9]+)/g)).map((m) => m[1])));
  const assets: Record<string, string> = {};
  for (const id of ids) {
    const blob = await get<Blob>(id, assetsStore);
    if (blob) assets[id] = await blobToDataUrl(blob);
  }
  const usedFamilies = new Set([doc.theme.bodyFont, doc.theme.headingFont, doc.theme.displayFont]);
  for (const m of json.matchAll(/"font":"([^"]+)"/g)) usedFamilies.add(m[1]);
  const fonts = (await listFonts()).filter((f) => usedFamilies.has(f.family));
  const file: ExportFile = { format: 'itinerary-studio', version: 1, doc, assets, fonts };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export async function importDoc(text: string): Promise<Itinerary> {
  const file = JSON.parse(text) as ExportFile;
  if (file.format !== 'itinerary-studio') throw new Error('This is not an Itinerary Studio file.');
  let json = JSON.stringify(file.doc);
  for (const [oldId, dataUrl] of Object.entries(file.assets || {})) {
    const blob = await (await fetch(dataUrl)).blob();
    const newSrc = await putAsset(blob);
    json = json.split('asset:' + oldId).join(newSrc);
  }
  const existing = new Set((await listFonts()).map((f) => f.family));
  for (const f of file.fonts || []) if (!existing.has(f.family)) await set(f.id, f, fontsStore);
  const doc = JSON.parse(json) as Itinerary;
  doc.id = uid();
  doc.updatedAt = Date.now();
  await saveDoc(doc);
  return doc;
}

export async function hasAnyDoc() {
  return (await keys(docsStore)).length > 0;
}

export function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
