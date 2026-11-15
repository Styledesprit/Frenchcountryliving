import { useEffect, useState } from 'react';
import type { CustomFont, Itinerary, Theme, Version } from '../types';
import { ColorInput, Field, NumberInput } from './common';
import { FontSelect } from './Inspector';
import { addFont, deleteFont, deleteVersion, listVersions, saveVersion } from '../lib/store';
import { pickFiles } from '../lib/images';
import { registerCustomFont } from '../lib/fonts';
import { DEFAULT_THEME } from '../seed/luberon';

export function ThemePanel({
  theme,
  onChange,
  customFonts,
  onFontsChanged,
}: {
  theme: Theme;
  onChange: (t: Theme) => void;
  customFonts: CustomFont[];
  onFontsChanged: () => void;
}) {
  const set = (p: Partial<Theme>) => onChange({ ...theme, ...p });
  const [family, setFamily] = useState('');

  const upload = async () => {
    const [file] = await pickFiles('.ttf,.otf,.woff,.woff2');
    if (!file) return;
    const name = family.trim() || file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]/g, ' ');
    const f = await addFont(file, name);
    await registerCustomFont(f);
    setFamily('');
    onFontsChanged();
  };

  return (
    <div className="panel">
      <div className="panel-title">Fonts &amp; colors</div>
      <p className="help">These apply to the whole itinerary. You can still change the font of a single block in its own settings.</p>
      <Field label="Display font (DAY 1, 9AM, MAP…)">
        <FontSelect value={theme.displayFont} onChange={(v) => set({ displayFont: v || DEFAULT_THEME.displayFont })} customFonts={customFonts} />
      </Field>
      <Field label="Heading font">
        <FontSelect value={theme.headingFont} onChange={(v) => set({ headingFont: v || DEFAULT_THEME.headingFont })} customFonts={customFonts} />
      </Field>
      <Field label="Body text font">
        <FontSelect value={theme.bodyFont} onChange={(v) => set({ bodyFont: v || DEFAULT_THEME.bodyFont })} customFonts={customFonts} />
      </Field>
      <Field label="Body text size (pt)">
        <NumberInput value={theme.bodySize} onChange={(v) => set({ bodySize: v || 11.5 })} min={6} max={20} step={0.5} />
      </Field>

      <div className="group">
        <div className="group-title">Use your own fonts</div>
        <p className="help">
          The original guide uses <b>Hatton</b> and <b>Minion Pro</b>. If you have the font files (.otf / .ttf / .woff), upload them here and they
          appear at the top of every font list. They're stored in this browser and included in exported itinerary files.
        </p>
        <div className="row">
          <input type="text" placeholder="Font name (optional)" value={family} onChange={(e) => setFamily(e.target.value)} />
          <button onClick={upload}>Upload font…</button>
        </div>
        {customFonts.map((f) => (
          <div className="row" key={f.id}>
            <span style={{ fontFamily: `"${f.family}"`, fontSize: 18 }}>{f.family}</span>
            <button
              className="link-btn danger"
              onClick={async () => {
                await deleteFont(f.id);
                onFontsChanged();
              }}
            >
              remove
            </button>
          </div>
        ))}
      </div>

      <div className="group">
        <div className="group-title">Colors</div>
        <Field label="Text">
          <ColorInput value={theme.ink} onChange={(v) => set({ ink: v || DEFAULT_THEME.ink })} />
        </Field>
        <Field label="Links & highlights">
          <ColorInput value={theme.accent} onChange={(v) => set({ accent: v || DEFAULT_THEME.accent })} />
        </Field>
        <Field label="Time labels (9AM…)">
          <ColorInput value={theme.soft} onChange={(v) => set({ soft: v || DEFAULT_THEME.soft })} />
        </Field>
        <p className="help">Page and band colors are set per page (click a page's background).</p>
      </div>
      <Field label="Map style">
        <select value={theme.mapStyle || 'rose'} onChange={(e) => set({ mapStyle: e.target.value as Theme['mapStyle'] })}>
          <option value="rose">Rosé (soft pink, like the original)</option>
          <option value="voyager">Classic colors</option>
          <option value="positron">Light grey</option>
          <option value="osm">OpenStreetMap</option>
        </select>
      </Field>
    </div>
  );
}

export function VersionsPanel({
  doc,
  onRestore,
  onDuplicate,
}: {
  doc: Itinerary;
  onRestore: (v: Version) => void;
  onDuplicate: () => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [label, setLabel] = useState('');
  const refresh = () => listVersions(doc.id).then(setVersions);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  return (
    <div className="panel">
      <div className="panel-title">Versions</div>
      <p className="help">
        Your changes save automatically. Save a <b>version</b> to keep a snapshot you can go back to (e.g. “Sent to Flipsnack – June 2025”).
      </p>
      <div className="row">
        <input type="text" placeholder="Version name" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button
          className="primary"
          onClick={async () => {
            await saveVersion(doc, label.trim() || new Date().toLocaleString());
            setLabel('');
            refresh();
          }}
        >
          Save version
        </button>
      </div>
      <button onClick={onDuplicate}>⧉ Make a copy as a new itinerary</button>
      <div className="versions">
        {versions.map((v) => (
          <div className="version" key={v.id}>
            <div>
              <div className="version-label">{v.label}</div>
              <div className="small muted">
                {new Date(v.createdAt).toLocaleString()} · {v.data.pages.length} pages
              </div>
            </div>
            <div className="row">
              <button
                onClick={async () => {
                  if (!confirm(`Go back to “${v.label}”? Your current state is saved as a version first.`)) return;
                  await saveVersion(doc, 'Before restoring “' + v.label + '”');
                  onRestore(v);
                  refresh();
                }}
              >
                Restore
              </button>
              <button
                className="link-btn danger"
                onClick={async () => {
                  if (!confirm('Delete this version?')) return;
                  await deleteVersion(v.id);
                  refresh();
                }}
              >
                delete
              </button>
            </div>
          </div>
        ))}
        {versions.length === 0 && <div className="small muted">No saved versions yet.</div>}
      </div>
    </div>
  );
}
