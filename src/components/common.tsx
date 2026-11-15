import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { resolveSrc } from '../lib/store';
import type { ImageRef } from '../types';

/** <img> that understands "asset:" sources stored in the browser */
export function Img({ image, style, className }: { image: ImageRef; style?: CSSProperties; className?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    if (!image.src) setUrl('');
    else resolveSrc(image.src).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [image.src]);
  if (!url)
    return (
      <div className={'img-empty ' + (className || '')} style={style}>
        <span>Add a photo</span>
      </div>
    );
  return (
    <img
      src={url}
      className={className}
      style={{ objectFit: 'cover', objectPosition: image.position || '50% 50%', ...style }}
      alt={image.caption || ''}
      draggable={false}
    />
  );
}

/**
 * Inline-editable rich text. Keeps the caret stable by only writing innerHTML
 * when the element is not being edited.
 */
export function RichText({
  html,
  editable,
  onChange,
  className,
  style,
  tag = 'div',
}: {
  html: string;
  editable: boolean;
  onChange: (html: string) => void;
  className?: string;
  style?: CSSProperties;
  tag?: 'div' | 'span';
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== html) el.innerHTML = html;
  }, [html]);
  const Tag = tag as 'div';
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      className={'rt ' + (className || '')}
      style={style}
      contentEditable={editable}
      suppressContentEditableWarning
      onBlur={(e) => {
        const v = (e.currentTarget as HTMLElement).innerHTML;
        if (v !== html) onChange(v);
      }}
      onClick={(e) => {
        // links: follow them when not editing; in the editor, ctrl/cmd-click opens them
        const a = (e.target as HTMLElement).closest('a');
        if (a && editable) {
          e.preventDefault();
          if (e.metaKey || e.ctrlKey) window.open(a.href, '_blank');
        }
      }}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

export function ColorInput({ value, onChange, allowEmpty }: { value?: string; onChange: (v: string | undefined) => void; allowEmpty?: boolean }) {
  return (
    <span className="color-input">
      <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} />
      <input type="text" value={value || ''} placeholder={allowEmpty ? 'default' : ''} onChange={(e) => onChange(e.target.value || undefined)} />
      {allowEmpty && value && (
        <button className="link-btn" onClick={() => onChange(undefined)} title="Use the default color">
          reset
        </button>
      )}
    </span>
  );
}
