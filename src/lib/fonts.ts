// Font handling: a curated list of Google Fonts plus fonts you upload yourself
// (e.g. your licensed Hatton / Minion Pro files from the original design).
import type { CustomFont } from '../types';

export interface FontOption {
  family: string;
  note: string;
  google?: string; // Google Fonts css2 family spec
}

export const FONT_OPTIONS: FontOption[] = [
  { family: 'Italiana', note: 'Thin display (close to Hatton)', google: 'Italiana' },
  { family: 'Poiret One', note: 'Art-deco display', google: 'Poiret+One' },
  { family: 'Forum', note: 'Roman display', google: 'Forum' },
  { family: 'Gilda Display', note: 'Didone display', google: 'Gilda+Display' },
  { family: 'Bodoni Moda', note: 'Bodoni', google: 'Bodoni+Moda:wght@400;600' },
  { family: 'Tenor Sans', note: 'Elegant sans caps', google: 'Tenor+Sans' },
  { family: 'Marcellus', note: 'Classic Roman capitals', google: 'Marcellus' },
  { family: 'Cinzel', note: 'Engraved capitals', google: 'Cinzel:wght@400;600' },
  { family: 'Cormorant Garamond', note: 'Elegant serif', google: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400' },
  { family: 'Crimson Pro', note: 'Book serif (close to Minion)', google: 'Crimson+Pro:ital,wght@0,400;0,600;1,400' },
  { family: 'EB Garamond', note: 'Garamond book serif', google: 'EB+Garamond:ital,wght@0,400;0,600;1,400' },
  { family: 'Libre Baskerville', note: 'Baskerville', google: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400' },
  { family: 'Playfair Display', note: 'High-contrast serif', google: 'Playfair+Display:ital,wght@0,400;0,600;1,400' },
  { family: 'Lora', note: 'Friendly serif', google: 'Lora:ital,wght@0,400;0,600;1,400' },
  { family: 'Josefin Sans', note: 'Geometric sans', google: 'Josefin+Sans:wght@300;400;600' },
  { family: 'Montserrat', note: 'Modern sans', google: 'Montserrat:wght@300;400;600' },
  { family: 'Raleway', note: 'Light sans', google: 'Raleway:wght@300;400;600' },
  { family: 'Great Vibes', note: 'Script', google: 'Great+Vibes' },
  { family: 'Parisienne', note: 'Script', google: 'Parisienne' },
];

const loaded = new Set<string>();

export function ensureGoogleFont(family: string) {
  const opt = FONT_OPTIONS.find((f) => f.family === family);
  if (!opt?.google || loaded.has(family)) return;
  loaded.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${opt.google}&display=swap`;
  document.head.appendChild(link);
}

const registered = new Set<string>();
export async function registerCustomFont(f: CustomFont) {
  if (registered.has(f.id)) return;
  registered.add(f.id);
  try {
    const face = new FontFace(f.family, `url(${f.dataUrl})`);
    await face.load();
    document.fonts.add(face);
  } catch (e) {
    console.warn('Could not load font', f.family, e);
  }
}

/** CSS font-family value with sensible fallbacks */
export const fontStack = (family: string) => `"${family}", "Crimson Pro", Georgia, serif`;
