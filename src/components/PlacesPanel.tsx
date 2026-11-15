import { useState } from 'react';
import type { Itinerary, Route, Stop } from '../types';
import { Field } from './common';
import {
  appleRouteUrl,
  distanceText,
  geocode,
  geocodeStop,
  googleRouteUrl,
  GOOGLE_MAX_STOPS,
  routeStops,
  routeToGpx,
  type GeocodeHit,
} from '../lib/maps';
import { download, uid } from '../lib/store';

const move = <T,>(arr: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const a = arr.slice();
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};

function StopRow({
  stop,
  index,
  onChange,
  onMove,
  onDelete,
}: {
  stop: Stop;
  index: number;
  onChange: (s: Stop) => void;
  onMove: (d: number) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (p: Partial<Stop>) => onChange({ ...stop, ...p });

  const locate = async () => {
    setBusy(true);
    setMsg('');
    try {
      const hit = await geocodeStop(stop);
      if (hit) {
        set({ lat: hit.lat, lng: hit.lng, verified: true });
        setMsg('Found: ' + hit.label);
      } else setMsg('Not found: try a simpler address, or drag the pin on the map.');
    } catch (e) {
      setMsg(String(e));
    }
    setBusy(false);
  };

  return (
    <div className={'stop' + (stop.inRoute ? '' : ' stop-extra')}>
      <div className="stop-head" onClick={() => setOpen(!open)}>
        <span className="stop-num">{stop.inRoute ? index : '•'}</span>
        <span className="stop-name">{stop.name || 'Untitled place'}</span>
        <span className={'chip ' + (stop.lat == null ? 'chip-bad' : stop.verified ? 'chip-ok' : 'chip-warn')}>
          {stop.lat == null ? 'no position' : stop.verified ? 'checked' : 'approx.'}
        </span>
        <span className="caret">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="stop-body">
          <Field label="Name">
            <input type="text" value={stop.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Address">
            <input type="text" value={stop.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="Website (optional)" hint="Without a website, the name links to the place in Google Maps.">
            <input type="url" value={stop.url || ''} placeholder="https://…" onChange={(e) => set({ url: e.target.value })} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={stop.inRoute} onChange={(e) => set({ inRoute: e.target.checked })} /> Part of the drawn route
            (untick for places that are only listed)
          </label>
          <div className="row">
            <button disabled={busy} onClick={locate}>
              {busy ? 'Searching…' : '⌖ Find on map from address'}
            </button>
            <span className="muted small">{stop.lat != null ? `${stop.lat.toFixed(5)}, ${stop.lng!.toFixed(5)}` : ''}</span>
          </div>
          {msg && <div className="small muted">{msg}</div>}
          <div className="small muted">Tip: you can also drag the numbered pin on the map.</div>
          <div className="row">
            <button onClick={() => onMove(-1)}>↑</button>
            <button onClick={() => onMove(1)}>↓</button>
            <button className="danger" onClick={onDelete}>
              Remove place
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddPlace({ onAdd }: { onAdd: (s: Stop) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<GeocodeHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const search = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setHits(await geocode(q));
    } catch {
      setHits([]);
    }
    setBusy(false);
  };
  const add = (h?: GeocodeHit) => {
    const parts = h?.label.split(',').map((x) => x.trim()) || [];
    onAdd({
      id: uid(),
      name: q.split(',')[0].trim() || parts[0] || 'New place',
      address: h ? parts.slice(1, 5).join(', ') : q,
      lat: h?.lat ?? null,
      lng: h?.lng ?? null,
      inRoute: true,
      verified: !!h,
    });
    setQ('');
    setHits(null);
  };
  return (
    <div className="add-place">
      <div className="row">
        <input
          type="text"
          value={q}
          placeholder="Add a place: name, town or address"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button onClick={search} disabled={busy}>
          {busy ? '…' : 'Search'}
        </button>
      </div>
      {hits && (
        <div className="hits">
          {hits.map((h, i) => (
            <button key={i} className="hit" onClick={() => add(h)}>
              {h.label}
            </button>
          ))}
          {hits.length === 0 && <div className="small muted">Nothing found.</div>}
          <button className="link-btn" onClick={() => add()}>
            Add “{q}” without a map position
          </button>
        </div>
      )}
    </div>
  );
}

function RouteEditor({ route, doc, onChange, onDelete }: { route: Route; doc: Itinerary; onChange: (r: Route) => void; onDelete: () => void }) {
  const [locating, setLocating] = useState('');
  const set = (p: Partial<Route>) => onChange({ ...route, ...p });
  const setStops = (stops: Stop[]) => set({ stops });
  let n = 0;
  const unverified = route.stops.filter((s) => !s.verified).length;

  const locateAll = async () => {
    let stops = route.stops;
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      if (s.verified) continue;
      setLocating(`Locating ${i + 1}/${stops.length}: ${s.name}`);
      try {
        const hit = await geocodeStop(s);
        if (hit) {
          stops = stops.map((x) => (x.id === s.id ? { ...x, lat: hit.lat, lng: hit.lng, verified: true } : x));
          onChange({ ...route, stops });
        }
      } catch {
        /* keep the approximate position */
      }
    }
    setLocating('');
  };

  return (
    <div className="route">
      <div className="grid2">
        <Field label="Route name">
          <input type="text" value={route.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Travel by">
          <select value={route.mode} onChange={(e) => set({ mode: e.target.value as Route['mode'] })}>
            <option value="driving">Car</option>
            <option value="walking">Walking</option>
            <option value="cycling">Bicycle</option>
          </select>
        </Field>
      </div>
      <Field label="Distance text under the map" hint={`Leave empty to use the calculated distance: ${distanceText({ ...route, distanceLabel: '' })}`}>
        <input type="text" value={route.distanceLabel || ''} onChange={(e) => set({ distanceLabel: e.target.value })} />
      </Field>

      <div className="stops">
        {route.stops.map((s, i) => (
          <StopRow
            key={s.id}
            stop={s}
            index={s.inRoute ? ++n : 0}
            onChange={(ns) => setStops(route.stops.map((x) => (x.id === s.id ? ns : x)))}
            onMove={(d) => setStops(move(route.stops, i, d))}
            onDelete={() => setStops(route.stops.filter((x) => x.id !== s.id))}
          />
        ))}
      </div>
      <AddPlace onAdd={(s) => setStops([...route.stops, s])} />

      {unverified > 0 && (
        <button disabled={!!locating} onClick={locateAll}>
          {locating || `⌖ Find all ${unverified} unchecked places from their addresses`}
        </button>
      )}

      <div className="group">
        <div className="group-title">Send this route to a phone</div>
        <div className="btn-grid">
          <a className="btn" href={googleRouteUrl(route)} target="_blank" rel="noopener">
            Open in Google Maps
          </a>
          <a className="btn" href={appleRouteUrl(route)} target="_blank" rel="noopener">
            Open in Apple Maps
          </a>
          <button
            onClick={() =>
              download(
                new Blob([routeToGpx(route, doc.title)], { type: 'application/gpx+xml' }),
                `${doc.title} - ${route.name}.gpx`.replace(/[\\/:*?"<>|]/g, ''),
              )
            }
          >
            Download GPX
          </button>
        </div>
        {routeStops(route).length > GOOGLE_MAX_STOPS && (
          <div className="small warn">Google Maps only takes {GOOGLE_MAX_STOPS} stops in one link: the rest are left out of that link.</div>
        )}
      </div>
      <button className="danger link-btn" onClick={onDelete}>
        Delete this route
      </button>
    </div>
  );
}

export function PlacesPanel({
  doc,
  onRouteChange,
  onRoutesChange,
  focusRouteId,
}: {
  doc: Itinerary;
  onRouteChange: (r: Route) => void;
  onRoutesChange: (r: Route[]) => void;
  focusRouteId?: string;
}) {
  const [openId, setOpenId] = useState<string | undefined>(focusRouteId || doc.routes[0]?.id);
  const route = doc.routes.find((r) => r.id === openId);
  return (
    <div className="panel">
      <div className="panel-title">Places &amp; routes</div>
      <p className="help">
        Each map and “Today's addresses” block uses one of these routes. Pins marked <span className="chip chip-warn">approx.</span> were placed from
        memory: click “Find all…” to check them from the addresses.
      </p>
      <div className="row wrap">
        <select value={openId} onChange={(e) => setOpenId(e.target.value)}>
          {doc.routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.stops.length} places)
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            const r: Route = { id: uid(), name: `Day ${doc.routes.length + 1}`, mode: 'driving', stops: [] };
            onRoutesChange([...doc.routes, r]);
            setOpenId(r.id);
          }}
        >
          + New route
        </button>
      </div>
      {route && (
        <RouteEditor
          key={route.id}
          route={route}
          doc={doc}
          onChange={onRouteChange}
          onDelete={() => {
            if (!confirm(`Delete the route “${route.name}”? Maps that use it will be empty.`)) return;
            onRoutesChange(doc.routes.filter((r) => r.id !== route.id));
            setOpenId(doc.routes.find((r) => r.id !== route.id)?.id);
          }}
        />
      )}
    </div>
  );
}
