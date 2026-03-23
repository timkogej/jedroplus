'use client';

import { useRef, useEffect, useCallback } from 'react';

export const TEMPLATE_VARS = [
  { token: '{{ime}}', label: 'Ime stranke' },
  { token: '{{priimek}}', label: 'Priimek stranke' },
  { token: '{{datum}}', label: 'Datum termina' },
  { token: '{{cas}}', label: 'Čas termina' },
  { token: '{{storitev}}', label: 'Storitev termina' },
  { token: '{{ime_izvajalca}}', label: 'Ime izvajalca' },
  { token: '{{ime_podjetja}}', label: 'Ime podjetja' },
  { token: '{{naslov}}', label: 'Naslov podjetja' },
  { token: '{{telefon_podjetja}}', label: 'Telefon podjetja' },
  { token: '{{email_podjetja}}', label: 'Email podjetja' },
  { token: '{{leto}}', label: 'Leto' },
  { token: '{{povezava_prenarocanje}}', label: 'Povezava za prenaročanje' },
] as const;

export const VAR_LABEL_MAP: Record<string, string> = Object.fromEntries(
  TEMPLATE_VARS.map(v => [v.token, v.label])
);

// Migrate old token names when loading from DB
export function migrateTemplate(template: string): string {
  return template
    .replace(/\{\{naziv_podjetja\}\}/g, '{{ime_podjetja}}')
    .replace(/\{\{lokacija\}\}/g, '{{naslov}}');
}

// Parse template string into text/token segments
function parseTemplate(template: string): Array<{ type: 'text' | 'token'; value: string }> {
  const segments: Array<{ type: 'text' | 'token'; value: string }> = [];
  const regex = /(\{\{[^}]+\}\})/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: template.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'token', value: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < template.length) {
    segments.push({ type: 'text', value: template.slice(lastIndex) });
  }
  return segments;
}

// Inline styles for token spans rendered inside contentEditable
const TOKEN_OUTER = [
  'display:inline-flex',
  'align-items:center',
  'border-radius:999px',
  'padding:3px 10px',
  'white-space:nowrap',
  'cursor:default',
  'user-select:none',
  'vertical-align:middle',
  'margin:0 2px',
  'line-height:1.4',
  'background-image:linear-gradient(white, white), linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
  'background-origin:padding-box, border-box',
  'background-clip:padding-box, border-box',
  'border:1.5px solid transparent',
].join(';');

const TOKEN_INNER = [
  'background:linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
  '-webkit-background-clip:text',
  '-webkit-text-fill-color:transparent',
  'background-clip:text',
  'font-weight:600',
  'font-size:11px',
  'letter-spacing:0.01em',
  'line-height:1',
].join(';');

// Build HTML string for contentEditable from raw template
function buildHTML(template: string): string {
  const segments = parseTemplate(migrateTemplate(template));
  return segments
    .map(seg => {
      if (seg.type === 'token') {
        const label = VAR_LABEL_MAP[seg.value] || seg.value;
        const safeToken = seg.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        return `<span data-token="${safeToken}" contenteditable="false" style="${TOKEN_OUTER}"><span style="${TOKEN_INNER}">${label}</span></span>`;
      }
      return (seg.value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    })
    .join('');
}

// Extract raw template string from contentEditable DOM
function extractTemplate(el: HTMLElement): string {
  let result = '';
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += (node.textContent || '').replace(/\u00A0/g, ' ');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement;
      const token = elem.getAttribute('data-token');
      if (token) {
        result += token;
      } else if (elem.tagName === 'BR') {
        result += '\n';
      } else if (elem.tagName === 'DIV') {
        if (result.length > 0 && !result.endsWith('\n')) result += '\n';
        for (const child of Array.from(elem.childNodes)) walk(child);
      } else {
        for (const child of Array.from(elem.childNodes)) walk(child);
      }
    }
  }
  walk(el);
  return result;
}

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  rows?: number;
}

export function TemplateEditor({
  value,
  onChange,
  maxLength = 160,
  placeholder = '',
  rows = 4,
}: TemplateEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalRef = useRef(false);
  const lastRawRef = useRef(value);

  // Initialize DOM on mount
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = buildHTML(value);
    lastRawRef.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync when external value changes (e.g., loading from DB)
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalRef.current) {
      isInternalRef.current = false;
      return;
    }
    if (lastRawRef.current === value) return;
    lastRawRef.current = value;
    editorRef.current.innerHTML = buildHTML(value);
  }, [value]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const raw = extractTemplate(editorRef.current);
    isInternalRef.current = true;
    lastRawRef.current = raw;
    onChange(raw);
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!editorRef.current || !maxLength) return;
      const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (printable) {
        const raw = extractTemplate(editorRef.current);
        if (raw.length >= maxLength) {
          e.preventDefault();
        }
      }
    },
    [maxLength]
  );

  const insertToken = useCallback(
    (token: string) => {
      if (!editorRef.current) return;

      if (maxLength) {
        const raw = extractTemplate(editorRef.current);
        if (raw.length + token.length > maxLength) return;
      }

      const label = VAR_LABEL_MAP[token] || token;

      const span = document.createElement('span');
      span.setAttribute('data-token', token);
      (span as HTMLElement & { contentEditable: string }).contentEditable = 'false';
      span.style.cssText = TOKEN_OUTER;

      const inner = document.createElement('span');
      inner.style.cssText = TOKEN_INNER;
      inner.textContent = label;
      span.appendChild(inner);

      editorRef.current.focus();

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          range.insertNode(span);
          range.setStartAfter(span);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          editorRef.current.appendChild(span);
        }
      } else {
        editorRef.current.appendChild(span);
      }

      handleInput();
    },
    [handleInput, maxLength]
  );

  const currentLength = value.length;
  const isOverLimit = maxLength ? currentLength > maxLength : false;

  return (
    <div className="space-y-3">
      {/* Variable chip buttons */}
      <div>
        <p className="text-xs text-gray-400 mb-2">
          Kliknite na spremenljivko da jo dodate v besedilo:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARS.map(v => (
            <button
              key={v.token}
              type="button"
              onClick={() => insertToken(v.token)}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-all hover:shadow-sm active:scale-95"
              style={{
                backgroundImage:
                  'linear-gradient(white, white), linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                backgroundOrigin: 'padding-box, border-box',
                backgroundClip: 'padding-box, border-box',
                border: '1.5px solid transparent',
              }}
            >
              <span
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {v.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Rich text editor area */}
      <div className="relative">
        {!value && (
          <div
            className="absolute top-2 left-3 text-sm text-gray-400 pointer-events-none select-none z-10"
            aria-hidden="true"
          >
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-xl border-2 px-3 py-2 text-sm text-gray-900 focus:outline-none leading-7 ${
            isOverLimit
              ? 'border-red-300 focus:border-red-400'
              : 'border-gray-200 focus:border-violet-300'
          }`}
          style={{ minHeight: `${rows * 1.75}rem`, wordBreak: 'break-word' }}
        />
      </div>

      {/* Character counter */}
      {maxLength && (
        <div className="flex justify-end">
          <span
            className={`text-xs font-medium ${
              isOverLimit ? 'text-red-500' : 'text-gray-400'
            }`}
          >
            {currentLength}/{maxLength}
          </span>
        </div>
      )}
    </div>
  );
}
