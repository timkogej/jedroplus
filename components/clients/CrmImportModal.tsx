'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  UploadSimple,
  FileText,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  SpinnerGap,
  Warning,
  SkipForward,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import type { Client } from '@/types/clients';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { sheet } from '@/components/ui/sheetClasses';

/**
 * Primerjalni ključ za besedilo: male črke, brez šumnikov, brez odvečnih
 * presledkov. Ujemati se mora z SQL funkcijo jp_kljuc, da aplikacija in baza
 * o dvojnikih ne odločata vsaka po svoje.
 */
const kljuc = (v?: string | null): string =>
  (v ?? '')
    .replace(/ß/g, 'ss')
    // đ in Đ nista osnovna črka s strešico, zato ju normalize('NFD') NE razstavi.
    // Brez te vrstice se hrvaški priimki (Đurić) ne bi ujeli s tem, kar izračuna baza.
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * CSV kot besedilo. Knjižnica xlsx bajte CSV brez BOM bere kot windows-1252,
 * zato bi se »Šušteršič« uvozil kot »Å uÅ¡terÅ¡iÄ«. Najprej poskusimo UTF-8
 * (izvoz večine CRM-jev, Google Sheets), sicer windows-1250 (starejši
 * Excel na Windows s šumniki).
 */
function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1250').decode(bytes);
  }
}

/** Datumske celice iz Excela izpiše kot YYYY-MM-DD (sicer bi xlsx vrnil »3/14/24«). */
function formatDateCells(ws: XLSX.WorkSheet) {
  for (const key of Object.keys(ws)) {
    if (key.startsWith('!')) continue;
    const cell = ws[key] as XLSX.CellObject;
    if (cell.t === 'n' && typeof cell.z === 'string' && XLSX.SSF.is_date(cell.z)) {
      cell.w = XLSX.SSF.format('yyyy-mm-dd', cell.v as number);
    }
  }
}

/**
 * Datum vpisa v obliki, ki jo pričakuje baza in iz katere aplikacija šteje
 * nove stranke (YYYY-MM-DD). Pike in poševnice beremo po slovensko kot
 * dan.mesec.leto. Česar ni mogoče prepoznati, ostane prazno, da v bazo ne
 * gre napačen datum.
 */
function toIsoDate(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const valid = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  };

  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : '';
  }

  m = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : '';
  }

  return '';
}

interface ParsedRow {
  [key: string]: string;
}

interface MappedClient {
  ime: string;
  priimek: string;
  email: string;
  telefon: string;
  spol: string;
  opombe: string;
  datum_vpisa: string;
}

interface ImportResult {
  nove: MappedClient[];
  posodobi: MappedClient[];
  preskoci: MappedClient[];
}

interface CrmImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  actor: string;
  existingClients: Client[];
  onImportComplete: () => void;
  onSendToN8n: (payload: {
    event: string;
    entity: string;
    data: Record<string, unknown>;
    company_id: string;
    actor: string;
    timestamp: string;
    meta: { app: 'Integrate'; version: '1.0' };
  }) => Promise<{ ok: boolean; error?: string }>;
}

const REQUIRED_FIELDS = ['Ime', 'Priimek ali celotno ime', 'Email', 'Telefon', 'Spol'];
const OPTIONAL_FIELDS = ['Opombe', 'Datum vpisa'];

function normalizeSpol(raw: string): string {
  const v = (raw || '').toLowerCase().trim();
  if (v === 'm' || v === 'male' || v === 'moški' || v === 'moski') return 'Moški';
  if (v === 'f' || v === 'female' || v === 'ženska' || v === 'zenska' || v === 'ženski') return 'Ženski';
  return raw || '';
}

export default function CrmImportModal({
  isOpen,
  onClose,
  companyId,
  actor,
  existingClients,
  onImportComplete,
}: CrmImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [allRows, setAllRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  // Summary counts for step 4: from the n8n response when provided, else client-side
  const [counts, setCounts] = useState<{ nove: number; posodobi: number; preskoci: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping state: fieldLabel → selected header
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFile(null);
      setIsDragging(false);
      setHeaders([]);
      setPreviewRows([]);
      setAllRows([]);
      setParseError(null);
      setIsProcessing(false);
      setResult(null);
      setCounts(null);
      setMapping({});
    }
  }, [isOpen]);

  const parseFile = useCallback((f: File) => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const isCsv = /\.csv$/i.test(f.name) || f.type === 'text/csv';
        const wb = isCsv
          ? XLSX.read(decodeCsv(data), { type: 'string', raw: true })
          : XLSX.read(data, { type: 'array', cellNF: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!isCsv) formatDateCells(ws);
        const rows = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: '', raw: false });
        if (rows.length === 0) {
          setParseError('Datoteka je prazna ali nima veljavnih podatkov.');
          return;
        }
        const cols = Object.keys(rows[0]);
        setHeaders(cols);
        setAllRows(rows);
        setPreviewRows(rows.slice(0, 5));
        autoMap(cols);
      } catch {
        setParseError('Napaka pri branju datoteke.');
      }
    };
    reader.onerror = () => setParseError('Napaka pri branju datoteke.');
    reader.readAsArrayBuffer(f);
  }, []);

  const autoMap = (cols: string[]) => {
    const map: Record<string, string> = {};
    const colsLower = cols.map((c) => c.toLowerCase().trim());

    const tryMatch = (candidates: string[]) => {
      for (const cand of candidates) {
        const idx = colsLower.indexOf(cand.toLowerCase());
        if (idx !== -1) return cols[idx];
      }
      return '';
    };

    map['Ime'] = tryMatch(['ime', 'first name', 'firstname', 'name']);
    map['Priimek ali celotno ime'] = tryMatch(['priimek', 'last name', 'lastname', 'surname', 'ime in priimek', 'full name', 'fullname']);
    map['Email'] = tryMatch(['email', 'e-mail', 'elektronska pošta', 'elektronska posta']);
    map['Telefon'] = tryMatch(['telefon', 'phone', 'tel', 'mobile', 'gsm']);
    map['Spol'] = tryMatch(['spol', 'gender', 'sex']);
    map['Opombe'] = tryMatch(['opombe', 'notes', 'opomba', 'comment', 'comments']);
    map['Datum vpisa'] = tryMatch(['datum vpisa', 'created_at', 'created at', 'datum', 'date']);

    setMapping(map);
  };

  const handleFileSelect = useCallback((f: File) => {
    setFile(f);
    parseFile(f);
  }, [parseFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleImport = useCallback(async () => {
    console.log('[CrmImport] handleImport called', {
      step,
      mapping,
      rowCount: allRows.length,
    });

    if (!allRows.length) {
      console.log('[CrmImport] blocked: no rows parsed from file');
      setParseError('Ni vrstic za uvoz. Vrnite se na prejšnji korak in ponovno naložite datoteko.');
      return;
    }

    const unmappedRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
    console.log('[CrmImport] required-field mapping check', { unmappedRequired });
    if (unmappedRequired.length > 0) {
      setParseError(`Povežite še zahtevana polja: ${unmappedRequired.join(', ')}.`);
      return;
    }

    setParseError(null);
    setIsProcessing(true);
    setStep(3);

    try {
      const parsed: MappedClient[] = allRows.map((row) => {
        const imeRaw = mapping['Ime'] ? String(row[mapping['Ime']] ?? '') : '';
        const priimekRaw = mapping['Priimek ali celotno ime'] ? String(row[mapping['Priimek ali celotno ime']] ?? '') : '';

        let ime = imeRaw.trim();
        let priimek = priimekRaw.trim();

        // If priimek field contains full name and ime is empty, split it
        if (!ime && priimek.includes(' ')) {
          const parts = priimek.split(/\s+/).filter(Boolean);
          ime = parts[0];
          priimek = parts.slice(1).join(' ');
        }

        return {
          ime,
          priimek,
          email: mapping['Email'] ? String(row[mapping['Email']] ?? '').trim() : '',
          telefon: mapping['Telefon'] ? String(row[mapping['Telefon']] ?? '').trim() : '',
          spol: normalizeSpol(mapping['Spol'] ? String(row[mapping['Spol']] ?? '') : ''),
          opombe: mapping['Opombe'] ? String(row[mapping['Opombe']] ?? '').trim() : '',
          datum_vpisa: mapping['Datum vpisa'] ? toIsoDate(String(row[mapping['Datum vpisa']] ?? '')) : '',
        };
      });

      // Skip completely empty rows
      const valid = parsed.filter((c) => c.ime || c.email || c.telefon);

      // Deduplicate against existing clients
      const nove: MappedClient[] = [];
      const posodobi: MappedClient[] = [];
      const preskoci: MappedClient[] = [];

      // Telefonske številke spravi v enotno obliko baza, da pravilo živi na
      // enem mestu — isto, po katerem so izračunani obstoječi phone_e164.
      // En klic za vso datoteko, ne en na vrstico.
      let telefoni: (string | null)[] = valid.map(() => null);
      try {
        const { data, error } = await supabaseReadOnly.rpc('jp_normalize_phones', {
          company_id: companyId,
          phones: valid.map((c) => c.telefon || ''),
        });
        if (!error && Array.isArray(data) && data.length === valid.length) {
          telefoni = data as (string | null)[];
        }
      } catch {
        // Brez normalizacije ujemanja po telefonu ne bo. To je namenoma:
        // raje podvojena vrstica, ki jo je videti, kot tiho prepisana stranka.
      }

      for (let i = 0; i < valid.length; i += 1) {
        const c = valid[i];
        const emailMatch = kljuc(c.email)
          ? existingClients.find((e) => kljuc(e.email) === kljuc(c.email))
          : null;

        // Telefon SAM ne zadošča: družine si delijo številko, saloni pa
        // vpišejo svojo za stranke brez telefona. Brez ujemanja celotnega
        // imena bi uvoz prepisal napačno osebo.
        const tel = telefoni[i];
        const phoneMatch =
          tel && kljuc(c.ime) && kljuc(c.priimek)
            ? existingClients.find(
                (e) =>
                  e.phone_e164 === tel &&
                  kljuc(e.ime) === kljuc(c.ime) &&
                  kljuc(e.priimek) === kljuc(c.priimek)
              )
            : null;

        if (emailMatch && phoneMatch) {
          preskoci.push(c);
        } else if (emailMatch || phoneMatch) {
          posodobi.push(c);
        } else {
          nove.push(c);
        }
      }

      const importResult: ImportResult = { nove, posodobi, preskoci };
      setResult(importResult);

      // Dedicated CRM-import workflow, proxied server-side so the n8n URL
      // stays out of the client bundle and company access is verified
      const response = await fetch('/api/webhook-crm-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          data: {
            nove,
            posodobi,
            preskoci,
          },
        }),
      });

      let serverResult: Record<string, unknown> | null = null;
      try {
        serverResult = await response.json();
      } catch {
        serverResult = null; // empty body — fall back to client-side counts
      }
      if (!response.ok || serverResult?.ok === false) {
        throw new Error(
          typeof serverResult?.error === 'string' ? serverResult.error : 'Napaka pri uvozu'
        );
      }

      const asCount = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
      const returned = (serverResult?.counts ?? serverResult) as Record<string, unknown> | null;
      setCounts({
        nove: asCount(returned?.nove) ?? nove.length,
        posodobi: asCount(returned?.posodobi) ?? posodobi.length,
        preskoci: asCount(returned?.preskoci) ?? preskoci.length,
      });
      setStep(4);
    } catch (err) {
      console.log('[CrmImport] import failed', err);
      const message = err instanceof Error && err.message ? err.message : 'Napaka pri pošiljanju podatkov.';
      setParseError(`${message} Poskusite znova.`);
      setStep(2);
    } finally {
      setIsProcessing(false);
    }
  }, [step, allRows, mapping, existingClients, companyId]);

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 400, damping: 36 },
    },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={sheet.backdrop.replace('z-50', 'z-[100]')}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`${sheet.panel} sm:max-w-lg`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={sheet.header}>
              <div className={sheet.grabber} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className={sheet.title}>
                    Uvozi stranke
                  </h2>
                  <p className={sheet.subtitle}>
                    {step === 1 && 'Izberite datoteko za uvoz'}
                    {step === 2 && 'Preglejte podatke in povežite stolpce'}
                    {step === 3 && 'Uvažam stranke...'}
                    {step === 4 && 'Uvoz zaključen'}
                  </p>
                </div>
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={sheet.close}
                >
                  <X className="h-5 w-5" weight="regular" />
                </motion.button>
              </div>

              {/* Step dots */}
              <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
                {([1, 2, 3, 4] as const).map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${
                      s === step ? 'w-6 bg-violet-500' : s < step ? 'w-4 bg-violet-300' : 'w-4 bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">

              {/* ── Step 1: File upload ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-all ${
                      isDragging
                        ? 'border-violet-400 bg-violet-50'
                        : 'border-gray-300 bg-white hover:border-violet-300 hover:bg-violet-50/30'
                    }`}
                  >
                    <UploadSimple
                      className={`mb-3 h-9 w-9 ${isDragging ? 'text-violet-500' : 'text-gray-400'}`}
                      weight="regular"
                    />
                    <p className="text-sm font-medium text-gray-900">
                      Povlecite datoteko sem ali kliknite za izbiro
                    </p>
                    <p className="mt-1 text-xs text-gray-400">Podprte vrste: .csv, .xlsx, .xls</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelect(f);
                      }}
                    />
                  </div>

                  {file && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 rounded-xl bg-white p-4"
                    >
                      <FileText className="h-7 w-7 flex-shrink-0 text-violet-500" weight="regular" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
                      </div>
                      {headers.length > 0 && (
                        <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-500" weight="regular" />
                      )}
                    </motion.div>
                  )}

                  {parseError && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3">
                      <Warning className="h-4 w-4 flex-shrink-0 text-red-500" weight="regular" />
                      <p className="text-sm text-red-700">{parseError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 2: Preview + mapping ── */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* Preview table */}
                  <div>
                    <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Predogled (prvih 5 vrstic)
                    </p>
                    <div className="overflow-x-auto rounded-xl bg-white">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {headers.map((h) => (
                              <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, i) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0">
                              {headers.map((h) => (
                                <td key={h} className="max-w-[120px] truncate px-3 py-2 text-gray-900">
                                  {row[h] ?? ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Column mapping */}
                  <div>
                    <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Povežite stolpce
                    </p>
                    <div className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white">
                      {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => {
                        const isRequired = REQUIRED_FIELDS.includes(field);
                        return (
                          <div key={field} className="flex items-center gap-3 px-4 py-3">
                            <span className="w-40 flex-shrink-0 text-sm text-gray-900">
                              {field}
                              {isRequired && <span className="ml-1 text-xs text-gray-400">(zahtevano)</span>}
                            </span>
                            <select
                              value={mapping[field] ?? ''}
                              onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))}
                              className="min-w-0 flex-1 rounded-[10px] border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
                            >
                              <option value="">— preskoči —</option>
                              {headers.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-center text-[13px] text-gray-500">
                    Skupaj vrstic za uvoz: <span className="tnum font-semibold text-gray-900">{allRows.length}</span>
                  </p>

                  {parseError && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3">
                      <Warning className="h-4 w-4 flex-shrink-0 text-red-500" weight="regular" />
                      <p className="text-sm text-red-700">{parseError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 3: Processing ── */}
              {step === 3 && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <SpinnerGap className="h-10 w-10 animate-spin text-violet-500" weight="bold" />
                  <p className="text-sm font-medium text-gray-900">Uvažam stranke...</p>
                  <p className="text-xs text-gray-400">To lahko traja nekaj sekund.</p>
                </div>
              )}

              {/* ── Step 4: Result ── */}
              {step === 4 && result && (
                <div className="space-y-3">
                  <div className="flex flex-col items-center pb-2">
                    <CheckCircle className="mb-3 h-12 w-12 text-emerald-500" weight="regular" />
                    <p className="text-[17px] font-semibold text-gray-900">Uvoz zaključen</p>
                  </div>

                  <div className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-500" weight="regular" />
                      <span className="flex-1 text-sm text-gray-900">Novih strank uvoženih</span>
                      <span className="tnum text-sm font-semibold text-gray-900">{counts?.nove ?? result.nove.length}</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <ArrowsClockwise className="h-5 w-5 flex-shrink-0 text-blue-500" weight="regular" />
                      <span className="flex-1 text-sm text-gray-900">Strank posodobljenih</span>
                      <span className="tnum text-sm font-semibold text-gray-900">{counts?.posodobi ?? result.posodobi.length}</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <SkipForward className="h-5 w-5 flex-shrink-0 text-gray-400" weight="regular" />
                      <span className="flex-1 text-sm text-gray-900">Strank preskočenih (duplikati)</span>
                      <span className="tnum text-sm font-semibold text-gray-900">{counts?.preskoci ?? result.preskoci.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`${sheet.footer} !justify-between`}>
              {/* Back / cancel */}
              {step === 1 && (
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={sheet.cancel}
                >
                  Prekliči
                </motion.button>
              )}
              {step === 2 && (
                <motion.button
                  type="button"
                  onClick={() => { setStep(1); setParseError(null); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`${sheet.cancel} flex items-center justify-center gap-1.5`}
                >
                  <ArrowLeft className="h-4 w-4" weight="bold" />
                  Nazaj
                </motion.button>
              )}
              {(step === 3 || step === 4) && <div />}

              {/* Forward actions */}
              {step === 1 && (
                <motion.button
                  type="button"
                  disabled={!file || headers.length === 0 || !!parseError}
                  onClick={() => setStep(2)}
                  whileHover={{ scale: (!file || headers.length === 0) ? 1 : 1.02 }}
                  whileTap={{ scale: (!file || headers.length === 0) ? 1 : 0.98 }}
                  className={`${sheet.action} bg-gradient-to-r from-violet-500 to-cyan-500 disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  Naprej
                  <ArrowRight className="h-4 w-4" weight="bold" />
                </motion.button>
              )}
              {step === 2 && (
                <motion.button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleImport}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`${sheet.action} bg-gradient-to-r from-violet-500 to-cyan-500`}
                >
                  <UploadSimple className="h-4 w-4" weight="bold" />
                  Uvozi
                </motion.button>
              )}
              {step === 4 && (
                <motion.button
                  type="button"
                  onClick={() => { onImportComplete(); onClose(); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`${sheet.action} bg-gradient-to-r from-violet-500 to-cyan-500`}
                >
                  <CheckCircle className="h-4 w-4" weight="bold" />
                  Zapri
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
