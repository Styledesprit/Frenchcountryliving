import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Route, Stop, Theme } from '../types';
import {
  applePlaceUrl,
  fetchRouteGeometry,
  geometryKey,
  googlePlaceUrl,
  hasCoords,
  routeStops,
  wazePlaceUrl,
} from '../lib/maps';

const TILES: Record<string, { url: string; attribution: string }> = {
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO',
  },
  positron: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO',
  },
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
};

const tried = new Set<string>();

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function popupHtml(s: Stop) {
  return `<div class="pop">
    <strong>${escapeHtml(s.name)}</strong>
    ${s.address ? `<div class="pop-addr">${escapeHtml(s.address)}</div>` : ''}
    <div class="pop-links">
      <a href="${applePlaceUrl(s)}" target="_blank" rel="noopener">Apple Maps</a>
      <a href="${googlePlaceUrl(s)}" target="_blank" rel="noopener">Google Maps</a>
      <a href="${wazePlaceUrl(s)}" target="_blank" rel="noopener">Waze</a>
      ${s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">Website</a>` : ''}
    </div></div>`;
}

export function MapView({
  route,
  theme,
  editable,
  onRouteChange,
  height,
}: {
  route: Route;
  theme: Theme;
  editable: boolean;
  onRouteChange?: (r: Route) => void;
  height: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const routeRef = useRef(route);
  routeRef.current = route;
  const onChangeRef = useRef(onRouteChange);
  onChangeRef.current = onRouteChange;

  // create the map once
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    m.setView([43.83, 5.2], 9);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // base map style
  const style = theme.mapStyle || 'rose';
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    tiles.current?.remove();
    const t = TILES[style === 'rose' ? 'voyager' : style] || TILES.voyager;
    tiles.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19, crossOrigin: true }).addTo(m);
  }, [style]);

  // markers + line
  const key = JSON.stringify([route.stops, route.geometry, route.mode, editable, theme.accent]);
  const lastFitKey = useRef('');
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const all = route.stops.filter(hasCoords) as (Stop & { lat: number; lng: number })[];
    const inRoute = routeStops(route);
    const useGeometry = route.geometry && route.geometryKey === geometryKey(route);
    const line: L.LatLngExpression[] = useGeometry ? route.geometry! : inRoute.map((s) => [s.lat, s.lng]);
    if (line.length > 1) {
      L.polyline(line, { color: '#ffffff', weight: 7, opacity: 0.9 }).addTo(g);
      L.polyline(line, {
        color: theme.accent,
        weight: 4,
        opacity: 0.95,
        dashArray: route.mode === 'walking' ? '1 7' : undefined,
        lineCap: 'round',
      }).addTo(g);
    }
    let n = 0;
    all.forEach((s) => {
      const label = s.inRoute ? String(++n) : '•';
      const icon = L.divIcon({
        className: 'pin-wrap',
        html: `<div class="pin ${s.inRoute ? '' : 'pin-extra'}" style="background:${theme.accent}">${label}</div><div class="pin-label">${escapeHtml(s.name)}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const mk = L.marker([s.lat, s.lng], { icon, draggable: editable, title: s.name }).addTo(g);
      mk.bindPopup(popupHtml(s));
      if (editable)
        mk.on('dragend', () => {
          const p = mk.getLatLng();
          const r = routeRef.current;
          onChangeRef.current?.({
            ...r,
            stops: r.stops.map((x) => (x.id === s.id ? { ...x, lat: p.lat, lng: p.lng, verified: true } : x)),
          });
        });
    });
    // frame the route itself (places that are only listed may fall outside the view)
    const focus = inRoute.length ? inRoute : all;
    const fitKey = focus.map((s) => s.id + s.lat + s.lng).join();
    if (focus.length && fitKey !== lastFitKey.current) {
      lastFitKey.current = fitKey;
      const b = L.latLngBounds(focus.map((s) => [s.lat, s.lng] as [number, number]));
      if (useGeometry) route.geometry!.forEach((p) => b.extend(p));
      m.fitBounds(b, { padding: [36, 36], maxZoom: 16 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // fetch the real road / footpath line when the stops change
  useEffect(() => {
    if (!editable || !onRouteChange) return;
    const k = geometryKey(route);
    if (route.geometryKey === k || routeStops(route).length < 2 || tried.has(k)) return;
    tried.add(k);
    fetchRouteGeometry(route).then((res) => {
      if (!res) return;
      const r = routeRef.current;
      if (geometryKey(r) !== k) return;
      onChangeRef.current?.({ ...r, geometry: res.geometry, geometryKey: k, distanceMeters: res.distance });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryKey(route), editable]);

  return <div ref={el} className={'map-el map-style-' + style} style={{ height }} />;
}
