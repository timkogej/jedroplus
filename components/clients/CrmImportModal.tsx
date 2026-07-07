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
  onSendToN8n,
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
      setMapping({});
    }
  }, [isOpen]);

  const parseFile = useCallback((f: File) => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: '' });
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
    if (!allRows.length) return;
    setIsProcessing(true);
    setStep(3);

    try {
      const parsed: MappedClient[] = allRows.map((row) => {
        const imeRaw = mapping['Ime'] ? (row[mapping['Ime']] ?? '') : '';
        const priimekRaw = mapping['Priimek ali celotno ime'] ? (row[mapping['Priimek ali celotno ime']] ?? '') : '';

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
          email: mapping['Email'] ? (row[mapping['Email']] ?? '').trim() : '',
          telefon: mapping['Telefon'] ? (row[mapping['Telefon']] ?? '').trim() : '',
          spol: normalizeSpol(mapping['Spol'] ? (row[mapping['Spol']] ?? '') : ''),
          opombe: mapping['Opombe'] ? (row[mapping['Opombe']] ?? '').trim() : '',
          datum_vpisa: mapping['Datum vpisa'] ? (row[mapping['Datum vpisa']] ?? '').trim() : '',
        };
      });

      // Skip completely empty rows
      const valid = parsed.filter((c) => c.ime || c.email || c.telefon);

      // Deduplicate against existing clients
      const nove: MappedClient[] = [];
      const posodobi: MappedClient[] = [];
      const preskoci: MappedClient[] = [];

      for (const c of valid) {
        const emailMatch = c.email
          ? existingClients.find((e) => e.email?.toLowerCase() === c.email.toLowerCase())
          : null;
        const phoneMatch = c.telefon
          ? existingClients.find((e) => e.telefon?.replace(/\s/g, '') === c.telefon.replace(/\s/g, ''))
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

      const res = await onSendToN8n({
        event: 'UVOZ_CRM',
        entity: 'Stranke',
        data: {
          nove,
          posodobi,
          preskoci,
          company_id: companyId,
        },
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        meta: { app: 'Integrate', version: '1.0' },
      });

      if (!res.ok) throw new Error(res.error ?? 'Napaka pri uvozu');
      setStep(4);
    } catch {
      setParseError('Napaka pri pošiljanju podatkov. Poskusite znova.');
      setStep(2);
    } finally {
      setIsProcessing(false);
    }
  }, [allRows, mapping, existingClients, companyId, actor, onSendToN8n]);

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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-[#F7F8FA] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-100 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className="text-xl font-semibold text-transparent bg-clip-text"
                    style={{ backgroundImage: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
                  >
                    Uvozi stranke
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
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
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <X className="h-5 w-5" weight="bold" />
                </motion.button>
              </div>

              {/* Step dots */}
              <div className="mt-3 flex items-center gap-1.5">
                {([1, 2, 3, 4] as const).map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${
                      s === step ? 'w-6 bg-violet-500' : s < step ? 'w-4 bg-violet-300' : 'w-4 bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">

              {/* ── Step 1: File upload ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 px-6 cursor-pointer transition-all ${
                      isDragging
                        ? 'border-violet-400 bg-violet-50'
                        : 'border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/30'
                    }`}
                  >
                    <UploadSimple
                      className={`mb-3 h-10 w-10 ${isDragging ? 'text-violet-500' : 'text-gray-400'}`}
                      weight="duotone"
                    />
                    <p className="text-sm font-medium text-gray-700">
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
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4"
                    >
                      <FileText className="h-8 w-8 flex-shrink-0 text-violet-500" weight="duotone" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{file.name}</p>
                        <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
                      </div>
                      {headers.length > 0 && (
                        <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-500" weight="fill" />
                      )}
                    </motion.div>
                  )}

                  {parseError && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                      <Warning className="h-4 w-4 flex-shrink-0 text-red-500" weight="fill" />
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
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Predogled (prvih 5 vrstic)
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            {headers.map((h) => (
                              <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-gray-600">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, i) => (
                            <tr key={i} className="border-b border-gray-50 last:border-0">
                              {headers.map((h) => (
                                <td key={h} className="max-w-[120px] truncate px-3 py-2 text-gray-700">
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
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Povežite stolpce
                    </p>
                    <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
                      {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => {
                        const isRequired = REQUIRED_FIELDS.includes(field);
                        return (
                          <div key={field} className="flex items-center gap-3 px-4 py-3">
                            <span className="w-40 flex-shrink-0 text-sm text-gray-700">
                              {field}
                              {isRequired && <span className="ml-1 text-xs text-gray-400">(zahtevano)</span>}
                            </span>
                            <select
                              value={mapping[field] ?? ''}
                              onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))}
                              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
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

                  <p className="text-xs text-gray-400 text-center">
                    Skupaj vrstic za uvoz: <span className="font-semibold text-gray-600">{allRows.length}</span>
                  </p>

                  {parseError && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                      <Warning className="h-4 w-4 flex-shrink-0 text-red-500" weight="fill" />
                      <p className="text-sm text-red-700">{parseError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 3: Processing ── */}
              {step === 3 && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <SpinnerGap className="h-10 w-10 animate-spin text-violet-500" weight="bold" />
                  <p className="text-sm font-medium text-gray-700">Uvažam stranke...</p>
                  <p className="text-xs text-gray-400">To lahko traja nekaj sekund.</p>
                </div>
              )}

              {/* ── Step 4: Result ── */}
              {step === 4 && result && (
                <div className="space-y-3">
                  <div className="flex flex-col items-center pb-2">
                    <CheckCircle className="mb-3 h-12 w-12 text-emerald-500" weight="duotone" />
                    <p className="text-lg font-semibold text-gray-800">Uvoz zaključen</p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-500" weight="fill" />
                      <span className="flex-1 text-sm text-gray-700">Novih strank uvoženih</span>
                      <span className="text-sm font-semibold text-gray-900">{result.nove.length}</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <ArrowsClockwise className="h-5 w-5 flex-shrink-0 text-blue-500" weight="fill" />
                      <span className="flex-1 text-sm text-gray-700">Strank posodobljenih</span>
                      <span className="text-sm font-semibold text-gray-900">{result.posodobi.length}</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <SkipForward className="h-5 w-5 flex-shrink-0 text-gray-400" weight="fill" />
                      <span className="flex-1 text-sm text-gray-700">Strank preskočenih (duplikati)</span>
                      <span className="text-sm font-semibold text-gray-900">{result.preskoci.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-white px-5 py-4">
              {/* Back / cancel */}
              {step === 1 && (
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
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
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
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
                  className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
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
                  className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-70"
                  style={{ background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
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
                  className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
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
