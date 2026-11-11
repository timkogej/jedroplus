'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';

// Tokens are what n8n replaces (Slovenian names, keep as is); labels come
// from messages (reminders.templateEditor.vars).
export const TEMPLATE_VARS = [
  { token: '{{ime}}', key: 'firstName' },
  { token: '{{priimek}}', key: 'lastName' },
  { token: '{{datum}}', key: 'date' },
  { token: '{{cas}}', key: 'time' },
  { token: '{{storitev}}', key: 'service' },
  { token: '{{ime_izvajalca}}', key: 'staff' },
  { token: '{{ime_podjetja}}', key: 'company' },
  { token: '{{naslov}}', key: 'address' },
  { token: '{{telefon_podjetja}}', key: 'companyPhone' },
  { token: '{{email_podjetja}}', key: 'companyEmail' },
  { token: '{{leto}}', key: 'year' },
  { token: '{{povezava_prenarocanje}}', key: 'rebookLink' },
] as const;

/**
 * Oznake, ki imajo smisel samo pri sporočilu PO terminu.
 *
 * `{{kdaj_obisk}}` se izpiše kot »danes«, »včeraj«, »v ponedeljek« ali »21. 4.«,
 * odvisno od tega, koliko dni je minilo. Potrebna je, ker se sporočilo pošlje
 * ob zaključku termina, ne na dan obiska — predloge z besedo »danes« so bile
 * zato pogosto napačne.
 */
export const PO_TERMINU_VARS = [
  { token: '{{kdaj_obisk}}', label: 'Kdaj je bil obisk' },
  { token: '{{povezava_ocena}}', label: 'Povezava za oceno' },
] as const;

/**
 * Dolžina povezave, kakršna bo dejansko poslana.
 *
 * V bazi je shranjena s shemo (`https://portal.jedroplus.com/...`), v SMS pa gre
 * ven brez nje — telefoni jo preberejo tudi tako, prihrani pa osem znakov.
 * Števec mora šteti to, kar stranka dobi, sicer odsvetuje povezavo, ki bi se
 * sicer še prilegala.
 */
export function linkLength(url: string | null | undefined, fallback = 30): number {
  const brezSheme = String(url ?? '').trim().replace(/^https?:\/\//i, '');
  return brezSheme.length || fallback;
}

const TOKEN_GROUPS: ReadonlyArray<{ key: string; tokens: ReadonlyArray<string> }> = [
  { key: 'client', tokens: ['{{ime}}', '{{priimek}}'] },
  { key: 'appointment', tokens: ['{{datum}}', '{{cas}}', '{{kdaj_obisk}}', '{{storitev}}', '{{ime_izvajalca}}', '{{leto}}'] },
  { key: 'company', tokens: ['{{ime_podjetja}}', '{{naslov}}', '{{telefon_podjetja}}', '{{email_podjetja}}'] },
  { key: 'links', tokens: ['{{povezava_prenarocanje}}', '{{povezava_ocena}}'] },
];

// Stable default, so an omitted `extraVars` does not change identity on every render.
const NO_EXTRA_VARS: ReadonlyArray<{ token: string; label: string }> = [];

// Migrate old token names when loading from DB
export function migrateTemplate(template: string): string {
  return template
    .replace(/\{\{naziv_podjetja\}\}/g, '{{ime_podjetja}}')
    .replace(/\{\{lokacija\}\}/g, '{{naslov}}')
    // Short forms people type by hand. n8n's sender understands them, the editor
    // did not — so a template with {{telefon}} rendered fine in the SMS but showed
    // up here as an unknown variable. ({{email}} is deliberately absent: the bulk
    // message preview reads it as the client's address, reminders as the company's.)
    .replace(/\{\{salon\}\}/g, '{{ime_podjetja}}')
    .replace(/\{\{telefon\}\}/g, '{{telefon_podjetja}}');
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

/**
 * Computes the effective SMS character count of a template, substituting
 * variable tokens with their estimated real-world lengths.
 */
export function computeEffectiveLength(
  template: string,
  varLengths: Record<string, number> = {}
): number {
  const segments = parseTemplate(template);
  let length = 0;
  for (const seg of segments) {
    if (seg.type === 'token') {
      // Use the estimated length if provided, otherwise count the raw token chars
      length += seg.value in varLengths ? varLengths[seg.value] : seg.value.length;
    } else {
      length += seg.value.length;
    }
  }
  return length;
}

// Inline styles for token spans rendered inside contentEditable.
// Ploščat čip brez gradienta in brez zunanjega odmika: razmik med besedilom in
// čipom naredi presledek, zato je viden, ali presledek je ali ga ni.
const TOKEN_OUTER = [
  'display:inline-flex',
  'align-items:center',
  'border-radius:6px',
  'padding:1px 7px',
  'white-space:nowrap',
  'cursor:default',
  'user-select:none',
  'vertical-align:baseline',
  'margin:0',
  'line-height:1.5',
  'background:#EEF2FF',
  'border:1px solid #C7D2FE',
].join(';');

const TOKEN_INNER = [
  'color:#4338CA',
  'font-weight:600',
  'font-size:12px',
  'line-height:1.4',
].join(';');

// Build HTML string for contentEditable from raw template
function buildHTML(template: string, labels: Record<string, string>): string {
  const segments = parseTemplate(migrateTemplate(template));
  return segments
    .map(seg => {
      if (seg.type === 'token') {
        const label = (labels[seg.value] || seg.value).replace(/&/g, '&amp;').replace(/</g, '&lt;');
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

// Matches emoji glyphs, variation selectors, ZWJ and flag/regional-indicator pairs
const EMOJI_REGEX = /\p{Extended_Pictographic}|\u{FE0F}|\u{200D}|[\u{1F1E6}-\u{1F1FF}]/gu;

// Strips emoji and collapses any newlines so templates stay a single line
export function sanitizeTemplateText(text: string): string {
  return text.replace(EMOJI_REGEX, '').replace(/[\r\n]+/g, ' ');
}

// Email bodies: line breaks and emoji are fine there; only drop \r and
// more than one empty line in a row.
export function sanitizeMultilineText(text: string): string {
  return text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n');
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
  /** Estimated real-world character lengths per token (e.g. { '{{cas}}': 5 }) */
  varLengths?: Record<string, number>;
  /** Oznake, ki veljajo samo za to vrsto sporočila (npr. PO_TERMINU_VARS). */
  extraVars?: ReadonlyArray<{ token: string; label: string }>;
  /** Email body: Enter adds a line break, emoji are kept. SMS stays one line. */
  multiline?: boolean;
}

export function TemplateEditor({
  value,
  onChange,
  maxLength = 155,
  placeholder = '',
  rows = 4,
  varLengths = {},
  extraVars = NO_EXTRA_VARS,
  multiline = false,
}: TemplateEditorProps) {
  const sanitize = multiline ? sanitizeMultilineText : sanitizeTemplateText;
  const t = useTranslations('reminders.templateEditor');
  const labels = useMemo<Record<string, string>>(
    () => ({
      ...Object.fromEntries(TEMPLATE_VARS.map((v) => [v.token, t(`vars.${v.key}`)])),
      ...Object.fromEntries(extraVars.map((v) => [v.token, v.label])),
    }),
    [t, extraVars]
  );
  const vseOznake = [...TEMPLATE_VARS, ...extraVars];
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalRef = useRef(false);
  const lastRawRef = useRef(value);

  // Initialize DOM on mount
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = buildHTML(value, labels);
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
    editorRef.current.innerHTML = buildHTML(value, labels);
  }, [value, labels]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const raw = extractTemplate(editorRef.current);
    const sanitized = sanitize(raw);
    if (sanitized !== raw) {
      // Rebuild the DOM to strip emoji/newlines that slipped in (e.g. via IME or drag-drop)
      editorRef.current.innerHTML = buildHTML(sanitized, labels);
      isInternalRef.current = true;
      lastRawRef.current = sanitized;
      onChange(sanitized);
      // Move caret to the end after rebuilding
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      return;
    }
    isInternalRef.current = true;
    lastRawRef.current = raw;
    onChange(raw);
  }, [onChange, labels, sanitize]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!editorRef.current) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (multiline) {
          // A <br>, not the browser's <div>, so one Enter is one line break.
          document.execCommand('insertLineBreak');
          handleInput();
        }
        // SMS templates must stay on a single line
        return;
      }
      if (!maxLength) return;
      const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (printable) {
        const raw = extractTemplate(editorRef.current);
        const effectiveLen = computeEffectiveLength(raw, varLengths);
        if (effectiveLen >= maxLength) {
          e.preventDefault();
        }
      }
    },
    [maxLength, varLengths, multiline, handleInput]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      if (!editorRef.current) return;
      const pasted = sanitize(e.clipboardData.getData('text/plain'));
      if (!pasted) return;

      const raw = extractTemplate(editorRef.current);
      let toInsert = pasted;
      if (maxLength) {
        const currentEffective = computeEffectiveLength(raw, varLengths);
        const available = maxLength - currentEffective;
        if (available <= 0) return;
        toInsert = pasted.slice(0, Math.max(0, available));
      }
      if (!toInsert) return;

      editorRef.current.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(toInsert);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editorRef.current.appendChild(document.createTextNode(toInsert));
      }

      handleInput();
    },
    [handleInput, maxLength, varLengths, sanitize]
  );

  const tokenEffectiveLenOf = useCallback(
    (token: string) => (token in varLengths ? varLengths[token] : token.length),
    [varLengths]
  );

  const insertToken = useCallback(
    (token: string) => {
      if (!editorRef.current) return;

      if (maxLength) {
        const raw = extractTemplate(editorRef.current);
        const currentEffective = computeEffectiveLength(raw, varLengths);
        if (currentEffective + tokenEffectiveLenOf(token) > maxLength) return;
      }

      const label = labels[token] || token;

      const span = document.createElement('span');
      span.setAttribute('data-token', token);
      (span as HTMLElement & { contentEditable: string }).contentEditable = 'false';
      span.style.cssText = TOKEN_OUTER;

      const inner = document.createElement('span');
      inner.style.cssText = TOKEN_INNER;
      inner.textContent = label;
      span.appendChild(inner);

      editorRef.current.focus();

      // Presledek pred in za spremenljivko, kjer manjkata — da besedilo ne
      // sprime ob čip ("Pozdravljeni{{ime}}!").
      const sel = window.getSelection();
      const inside =
        !!sel && sel.rangeCount > 0 && editorRef.current.contains(sel.getRangeAt(0).commonAncestorContainer);
      const raw0 = extractTemplate(editorRef.current);
      let before = '';
      let after = '';
      if (inside && sel) {
        const r = sel.getRangeAt(0);
        const pre = document.createRange();
        pre.selectNodeContents(editorRef.current);
        pre.setEnd(r.startContainer, r.startOffset);
        const post = document.createRange();
        post.selectNodeContents(editorRef.current);
        post.setStart(r.endContainer, r.endOffset);
        const holder = document.createElement('div');
        holder.appendChild(pre.cloneContents());
        before = extractTemplate(holder);
        const holder2 = document.createElement('div');
        holder2.appendChild(post.cloneContents());
        after = extractTemplate(holder2);
      } else {
        before = raw0;
      }
      let needSpaceBefore = before.length > 0 && !/\s$/.test(before);
      let needSpaceAfter = after.length > 0 ? !/^[\s.,!?:;)]/.test(after) : false;
      const extra = (needSpaceBefore ? 1 : 0) + (needSpaceAfter ? 1 : 0);
      if (maxLength && computeEffectiveLength(raw0, varLengths) + tokenEffectiveLenOf(token) + extra > maxLength) {
        // Presledki ne smejo pregnati meje; brez njih se spremenljivka še prilega.
        needSpaceBefore = false;
        needSpaceAfter = false;
      }
      const nodes: Node[] = [];
      if (needSpaceBefore) nodes.push(document.createTextNode(' '));
      nodes.push(span);
      if (needSpaceAfter) nodes.push(document.createTextNode(' '));

      if (inside && sel) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        let last: Node | null = null;
        for (const n of nodes) {
          range.insertNode(n);
          range.setStartAfter(n);
          range.collapse(true);
          last = n;
        }
        // Kazalec za čip, pred zadnjim presledkom ne, da lahko pišeš naprej.
        if (last) range.setStartAfter(last);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        for (const n of nodes) editorRef.current.appendChild(n);
      }

      handleInput();
    },
    [handleInput, maxLength, varLengths, labels, tokenEffectiveLenOf]
  );

  const currentLength = computeEffectiveLength(value, varLengths);
  const isOverLimit = maxLength ? currentLength > maxLength : false;

  // Katere spremenljivke se sploh še prilegajo. Doslej klik na preveliko
  // spremenljivko ni naredil ničesar in ni povedal zakaj — gumb je izgledal
  // pokvarjen. Pri daljših predlogah je bila prva žrtev ravno povezava, ki je
  // med vsemi najdaljša.
  const prostoZa = (token: string): boolean => {
    if (!maxLength) return true;
    if (value.includes(token)) return true;   // že vstavljena, gumb ostane običajen
    const dolzina = token in varLengths ? varLengths[token] : token.length;
    return currentLength + dolzina <= maxLength;
  };

  return (
    <div className="space-y-3">
      {/* Variable chip buttons */}
      <div>
        <p className="text-xs text-gray-400 mb-2">
          {t('clickToInsert')}
        </p>
        <div className="space-y-2">
          {TOKEN_GROUPS.map((group) => {
            const items = vseOznake.filter((v) => group.tokens.includes(v.token));
            if (items.length === 0) return null;
            return (
              <div key={group.key} className="flex flex-wrap items-center gap-1.5">
                <span className="w-full text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400 sm:w-24 sm:flex-shrink-0">
                  {t(`groups.${group.key}`)}
                </span>
                {items.map((v) => {
                  const seVeljaga = prostoZa(v.token);
                  const dolzina = v.token in varLengths ? varLengths[v.token] : v.token.length;
                  return (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertToken(v.token)}
                      disabled={!seVeljaga}
                      title={
                        seVeljaga
                          ? t('tokenLength', { token: v.token, length: dolzina })
                          : t('tokenTooLong', { label: labels[v.token], length: dolzina, left: Math.max(0, (maxLength ?? 0) - currentLength) })
                      }
                      className={`inline-flex min-h-8 items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        seVeljaga
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200'
                          : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 opacity-60'
                      }`}
                    >
                      {labels[v.token]}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Zakaj je kakšna spremenljivka zbledela — brez tega je videti kot okvara. */}
        {maxLength > 0 && vseOznake.some(v => !prostoZa(v.token)) && (
          <p className="mt-2 text-xs text-amber-600">
            {t('fadedVarsHint')}
          </p>
        )}
      </div>

      {/* Rich text editor area */}
      <div className="relative">
        {!value && (
          <div
            className="absolute top-2.5 left-3.5 text-[15px] leading-7 text-gray-400 pointer-events-none select-none z-10"
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
          onPaste={handlePaste}
          className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] leading-7 text-gray-900 transition-colors focus:outline-none focus:ring-2 ${
            isOverLimit
              ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
              : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'
          }`}
          style={{
            minHeight: `${rows * 1.75}rem`,
            wordBreak: 'break-word',
            // Pasted text keeps its line breaks as \n inside text nodes.
            ...(multiline ? { whiteSpace: 'pre-wrap' as const } : {}),
          }}
        />
      </div>

      {/* Character counter */}
      {maxLength > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">
              {t('estimatedLength')}
            </span>
            <span
              className={`text-xs font-semibold ${
                isOverLimit ? 'text-red-500' : currentLength > maxLength * 0.9 ? 'text-amber-500' : 'text-gray-400'
              }`}
            >
              {currentLength}/{maxLength}
            </span>
          </div>
          {isOverLimit && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="font-semibold">{t('tooLong')}</span>
              <span>{t('tooLongBody', { max: maxLength })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
