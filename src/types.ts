// Data model for an itinerary document.
// A document is a list of fixed-size A4 pages (one page here = one page in the PDF / Flipsnack),
// plus a list of routes (the places for each day) that map + address blocks refer to.

export type TravelMode = 'driving' | 'walking' | 'cycling';

export interface Stop {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  /** Website for the place. If empty, links go to the place in Google Maps. */
  url?: string;
  /** false = listed in addresses but not part of the drawn route (e.g. the hotel at the end of a walking tour) */
  inRoute: boolean;
  /** true once the position was checked (geocoded or dragged on the map) */
  verified?: boolean;
}

export interface Route {
  id: string;
  name: string; // "Day 1", "Day 6 – Option 1"
  mode: TravelMode;
  stops: Stop[];
  /** Text shown under the map. Leave empty to show the computed distance. */
  distanceLabel?: string;
  /** Cached road geometry [lat,lng][] from the routing service */
  geometry?: [number, number][];
  geometryKey?: string;
  distanceMeters?: number;
}

export interface ImageRef {
  /** either a URL (seed images, web images) or "asset:<id>" for uploaded images stored in the browser */
  src: string;
  /** CSS object-position, e.g. "50% 30%" */
  position?: string;
  caption?: string;
}

export interface TextStyle {
  font?: string; // font family name, overrides theme
  size?: number; // pt
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  uppercase?: boolean;
  letterSpacing?: number; // em
  weight?: number;
}

interface BlockBase {
  id: string;
  style?: TextStyle;
  /** extra space above, mm */
  spaceBefore?: number;
}

export type HeadingKind = 'display' | 'title' | 'subtitle' | 'eyebrow';

export type Block =
  | (BlockBase & { type: 'heading'; kind: HeadingKind; html: string })
  | (BlockBase & { type: 'text'; html: string })
  | (BlockBase & { type: 'time'; label: string; html: string })
  | (BlockBase & { type: 'tip'; html: string })
  | (BlockBase & { type: 'note'; html: string })
  | (BlockBase & {
      type: 'images';
      images: ImageRef[];
      layout: 'single' | 'row' | 'collage' | 'polaroids';
      height: number; // mm
      frame: boolean;
    })
  | (BlockBase & { type: 'map'; routeId: string; height: number; showDistance: boolean; showLinks?: boolean })
  | (BlockBase & { type: 'addresses'; title: string; routeIds: string[]; showQr: boolean; qrRouteId?: string })
  | (BlockBase & { type: 'table'; header: [string, string]; rows: [string, string][] })
  | (BlockBase & { type: 'spacer'; height: number })
  | (BlockBase & { type: 'divider' });

export type BlockType = Block['type'];

export interface Page {
  id: string;
  /** label shown in the page list only */
  name: string;
  layout: 'plain' | 'split';
  background: string; // css color
  /** optional colored band at the bottom of the page */
  band?: { color: string; fromPct: number };
  /** split layout: the tall image column */
  side?: { image: ImageRef; position: 'left' | 'right'; widthPct: number; edge: boolean };
  /** vertical alignment of the content */
  valign?: 'top' | 'center' | 'bottom';
  padding?: number; // mm
  blocks: Block[];
}

export interface Theme {
  displayFont: string; // big "DAY 1", "9AM"
  headingFont: string; // titles
  bodyFont: string;
  bodySize: number; // pt
  ink: string;
  accent: string; // link / highlight color
  soft: string; // light display text (time labels)
  cream: string;
  blush: string;
  /** look of the maps: 'rose' = soft pink tint like the original guide */
  mapStyle?: 'rose' | 'voyager' | 'positron' | 'osm';
}

export interface Itinerary {
  id: string;
  title: string;
  theme: Theme;
  pages: Page[];
  routes: Route[];
  updatedAt: number;
}

export interface Version {
  id: string;
  docId: string;
  label: string;
  createdAt: number;
  data: Itinerary;
}

export interface CustomFont {
  id: string;
  family: string;
  dataUrl: string;
}
