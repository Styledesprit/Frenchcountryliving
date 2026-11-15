// Map helpers: links that open Apple Maps / Google Maps / Waze, GPX export,
// road routing (OpenStreetMap routing service) and address search (Nominatim).
import type { Route, Stop, TravelMode } from '../types';

export const hasCoords = (s: Stop): s is Stop & { lat: number; lng: number } =>
  typeof s.lat === 'number' && typeof s.lng === 'number';

export const routeStops = (r: Route) => r.stops.filter((s) => s.inRoute && hasCoords(s)) as (Stop & {
  lat: number;
  lng: number;
})[];

const placeQuery = (s: Stop) => [s.name, s.address].filter(Boolean).join(', ');
const ll = (s: Stop) => `${s.lat},${s.lng}`;

// ---------- single place ----------
export const googlePlaceUrl = (s: Stop) =>
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent(placeQuery(s) || ll(s));

export const applePlaceUrl = (s: Stop) =>
  hasCoords(s)
    ? `https://maps.apple.com/?q=${encodeURIComponent(s.name)}&ll=${ll(s)}`
    : `https://maps.apple.com/?q=${encodeURIComponent(placeQuery(s))}`;

export const wazePlaceUrl = (s: Stop) =>
  hasCoords(s)
    ? `https://waze.com/ul?ll=${ll(s)}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(placeQuery(s))}&navigate=yes`;

/** The link printed on a place's name in the PDF */
export const stopLink = (s: Stop) => (s.url && s.url.trim() ? s.url.trim() : googlePlaceUrl(s));

// ---------- whole route ----------
const googleMode: Record<TravelMode, string> = { driving: 'driving', walking: 'walking', cycling: 'bicycling' };
const appleMode: Record<TravelMode, string> = { driving: 'd', walking: 'w', cycling: 'c' };

/** Google Maps accepts an origin, a destination and up to 9 stops in between. */
export const GOOGLE_MAX_STOPS = 11;

export function googleRouteUrl(r: Route): string {
  const stops = routeStops(r).slice(0, GOOGLE_MAX_STOPS);
  if (stops.length === 0) return 'https://www.google.com/maps';
  if (stops.length === 1) return googlePlaceUrl(stops[0]);
  const q = (s: Stop) => (s.address ? placeQuery(s) : ll(s));
  const params = new URLSearchParams({
    api: '1',
    origin: q(stops[0]),
    destination: q(stops[stops.length - 1]),
    travelmode: googleMode[r.mode],
  });
  const mid = stops.slice(1, -1);
  if (mid.length) params.set('waypoints', mid.map(q).join('|'));
  return 'https://www.google.com/maps/dir/?' + params.toString();
}

/**
 * Apple Maps: start + destination, extra stops chained with "to:".
 * Recent iOS/macOS versions show every stop; older versions only route to the first one.
 */
export function appleRouteUrl(r: Route): string {
  const stops = routeStops(r);
  if (stops.length === 0) return 'https://maps.apple.com/';
  if (stops.length === 1) return applePlaceUrl(stops[0]);
  const daddr = stops.slice(1).map(ll).join('+to:');
  return `https://maps.apple.com/?saddr=${ll(stops[0])}&daddr=${daddr}&dirflg=${appleMode[r.mode]}`;
}

// ---------- GPX ----------
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function routeToGpx(r: Route, docTitle: string): string {
  const all = r.stops.filter(hasCoords) as (Stop & { lat: number; lng: number })[];
  const inRoute = routeStops(r);
  const wpts = all
    .map(
      (s) =>
        `  <wpt lat="${s.lat}" lon="${s.lng}">\n    <name>${esc(s.name)}</name>\n` +
        (s.address ? `    <desc>${esc(s.address)}</desc>\n` : '') +
        (s.url ? `    <link href="${esc(s.url)}"/>\n` : '') +
        `  </wpt>`,
    )
    .join('\n');
  const rte =
    `  <rte>\n    <name>${esc(r.name)}</name>\n` +
    inRoute.map((s) => `    <rtept lat="${s.lat}" lon="${s.lng}"><name>${esc(s.name)}</name></rtept>`).join('\n') +
    `\n  </rte>`;
  const trk = r.geometry?.length
    ? `\n  <trk>\n    <name>${esc(r.name)}</name>\n    <trkseg>\n` +
      r.geometry.map(([la, ln]) => `      <trkpt lat="${la.toFixed(6)}" lon="${ln.toFixed(6)}"/>`).join('\n') +
      `\n    </trkseg>\n  </trk>`
    : '';
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Itinerary Studio" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata><name>${esc(docTitle + ' – ' + r.name)}</name></metadata>\n` +
    `${wpts}\n${rte}${trk}\n</gpx>\n`
  );
}

// ---------- distance ----------
function haversine(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function routeDistance(r: Route): number {
  if (r.distanceMeters && r.geometryKey === geometryKey(r)) return r.distanceMeters;
  const pts = routeStops(r).map((s) => [s.lat, s.lng] as [number, number]);
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i]);
  return d;
}

export function formatDistance(meters: number) {
  const km = meters / 1000;
  const mi = km / 1.609344;
  const f = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toString());
  return `${f(mi)} MILES / ${f(km)}KM`;
}

export const distanceText = (r: Route) => r.distanceLabel?.trim() || formatDistance(routeDistance(r));

// ---------- road routing ----------
export const geometryKey = (r: Route) =>
  r.mode + ':' + routeStops(r).map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join(';');

const routingProfile: Record<TravelMode, string> = {
  driving: 'routed-car',
  walking: 'routed-foot',
  cycling: 'routed-bike',
};

/** Fetch the real road/footpath line between the stops. Returns null if the service can't be reached. */
export async function fetchRouteGeometry(
  r: Route,
): Promise<{ geometry: [number, number][]; distance: number } | null> {
  const stops = routeStops(r);
  if (stops.length < 2) return null;
  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(';');
  const url = `https://routing.openstreetmap.de/${routingProfile[r.mode]}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) return null;
    return {
      geometry: (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]),
      distance: route.distance,
    };
  } catch {
    return null;
  }
}

// ---------- address search ----------
let lastGeocode = 0;
export interface GeocodeHit {
  lat: number;
  lng: number;
  label: string;
}

/** Search an address with OpenStreetMap's Nominatim (max 1 request / second). */
export async function geocode(query: string): Promise<GeocodeHit[]> {
  const wait = lastGeocode + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocode = Date.now();
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=en&q=' +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Address search failed (' + res.status + ')');
  const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return json.map((h) => ({ lat: parseFloat(h.lat), lng: parseFloat(h.lon), label: h.display_name }));
}

/** Try "name, address", then the address alone, then the name alone. */
export async function geocodeStop(s: Stop): Promise<GeocodeHit | null> {
  const tries = [placeQuery(s), s.address, s.name].filter((q, i, a) => q && a.indexOf(q) === i);
  for (const q of tries) {
    const hits = await geocode(q + (/france/i.test(q) ? '' : ', France'));
    if (hits.length) return hits[0];
  }
  return null;
}
