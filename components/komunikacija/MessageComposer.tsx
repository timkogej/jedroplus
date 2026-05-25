'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';

const TOKEN_KEYS = [
  { token: '{{ime}}', tKey: 'varClientFirstName' },
  { token: '{{priimek}}', tKey: 'varClientLastName' },
  { token: '{{ime_podjetja}}', tKey: 'varCompanyName' },
  { token: '{{naslov}}', tKey: 'varCompanyAddress' },
  { token: '{{telefon_podjetja}}', tKey: 'varCompanyPhone' },
  { token: '{{email_podjetja}}', tKey: 'varCompanyEmail' },
  { token: '{{leto}}', tKey: 'varYear' },
  { token: '{{povezava_prenarocanje}}', tKey: 'varRescheduleLink' },
] as const;

const TOKEN_OUTER = [
  'display:inline-block',
  'border-radius:999px',
  'padding:2px 10px',
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
].join(';');

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

function buildHTML(template: string, labelMap: Record<string, string>): string {
  const segments = parseTemplate(template);
  return segments
    .map((seg) => {
      if (seg.type === 'token') {
        const label = labelMap[seg.value] || seg.value;
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

function extractTemplate(el: HTMLElement): string {
  let result = '';
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += (node.textContent || '').replace(/ /g, ' ');
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

interface MessageComposerProps {
  subject: string;
  onSubjectChange: (value: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  availableVariables?: string[];
}

export default function MessageComposer({
  subject,
  onSubjectChange,
  message,
  onMessageChange,
}: MessageComposerProps) {
  const t = useTranslations('communication');
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalRef = useRef(false);
  const lastRawRef = useRef(message);

  const varLabelMap = useMemo(
    () => Object.fromEntries(TOKEN_KEYS.map((v) => [v.token, t(`composer.${v.tKey}`)])),
    [t]
  );
  const varLabelMapRef = useRef(varLabelMap);
  varLabelMapRef.current = varLabelMap;

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = buildHTML(message, varLabelMapRef.current);
    lastRawRef.current = message;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalRef.current) {
      isInternalRef.current = false;
      return;
    }
    if (lastRawRef.current === message) return;
    lastRawRef.current = message;
    editorRef.current.innerHTML = buildHTML(message, varLabelMapRef.current);
  }, [message]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const raw = extractTemplate(editorRef.current);
    isInternalRef.current = true;
    lastRawRef.current = raw;
    onMessageChange(raw);
  }, [onMessageChange]);

  const insertToken = useCallback(
    (token: string) => {
      if (!editorRef.current) return;

      const label = varLabelMapRef.current[token] || token;

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
    [handleInput]
  );

  const charCount = message.length;

  return (
    <div className="space-y-4">
      {/* Subject line */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">
          {t('composer.subjectLabel')}
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder={t('composer.subjectPlaceholder')}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-[#1A1F36] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
        />
      </div>

      {/* Message body */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">{t('composer.messageLabel')}</label>

        <div className="relative">
          {!message && (
            <div
              className="absolute top-3 left-4 text-sm text-gray-400 pointer-events-none select-none z-10"
              aria-hidden="true"
            >
              {t('composer.messagePlaceholder')}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            className="w-full min-h-56 px-4 py-4 rounded-xl border-2 border-gray-200 bg-white text-sm text-[#1A1F36] focus:outline-none focus:border-violet-300 leading-7 transition-all"
            style={{ wordBreak: 'break-word' }}
          />
        </div>

        <div className="flex justify-end text-xs text-gray-400 mt-1.5">
          <span>{t('composer.charCount', { count: charCount })}</span>
        </div>
      </div>

      {/* Variable chips */}
      <div>
        <p className="text-xs text-gray-400 mb-2">
          {t('composer.variableHint')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TOKEN_KEYS.map((v) => (
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
                {varLabelMap[v.token]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
