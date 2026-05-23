// TODO(i18n-review): confirm if this dev page should be removed, kept English-only, or included in i18n.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { useCompany } from "@/app/company-context";
import { fetchTableRows, resolveCompanyTables } from "@/lib/companyScope";
import { TABLES } from "@/lib/data";

type DataState = {
  data: Record<string, unknown>[] | null;
  error: string | null;
  loading: boolean;
};

const initialState: DataState = {
  data: null,
  error: null,
  loading: false,
};

export default function AppPage() {
  const router = useRouter();
  const { companyId, companySettings, loading: companyLoading } = useCompany();
  const [stranke, setStranke] = useState<DataState>(initialState);
  const [termini, setTermini] = useState<DataState>(initialState);
  const [storitve, setStoritve] = useState<DataState>(initialState);
  const [osebe, setOsebe] = useState<DataState>(initialState);

  const tables = {
    ...resolveCompanyTables(companySettings),
    strankeTable: TABLES.clients,
    terminiTable: TABLES.bookings,
  };

  useEffect(() => {
    if (companyLoading) return;
    if (!companyId) {
      router.replace("/onboarding");
    }
  }, [companyId, companyLoading, router]);

  const loadStranke = async () => {
    if (!companyId) return;
    setStranke({ data: null, error: null, loading: true });
    const result = await fetchTableRows<Record<string, unknown>>(
      tables.strankeTable,
      companyId
    );
    setStranke({ data: result.data, error: result.error, loading: false });
  };

  const loadTermini = async () => {
    if (!companyId) return;
    setTermini({ data: null, error: null, loading: true });
    const result = await fetchTableRows<Record<string, unknown>>(
      tables.terminiTable,
      companyId
    );
    setTermini({ data: result.data, error: result.error, loading: false });
  };

  const loadStoritve = async () => {
    if (!companyId) return;
    setStoritve({ data: null, error: null, loading: true });
    const result = await fetchTableRows<Record<string, unknown>>(
      tables.storitveTable,
      companyId
    );
    setStoritve({ data: result.data, error: result.error, loading: false });
  };

  const loadOsebe = async () => {
    if (!companyId) return;
    setOsebe({ data: null, error: null, loading: true });
    const result = await fetchTableRows<Record<string, unknown>>(
      tables.osebeTable,
      companyId
    );
    setOsebe({ data: result.data, error: result.error, loading: false });
  };

  const maskSecret = (value?: string) => {
    if (!value) return undefined;
    if (value.length <= 8) return `${value.slice(0, 2)}...${value.slice(-2)}`;
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  };

  const settingsPreview = companySettings
    ? {
        ...companySettings,
        sendgrid_api_key: maskSecret(
          typeof companySettings.sendgrid_api_key === "string"
            ? companySettings.sendgrid_api_key
            : undefined
        ),
      }
    : null;

  const renderSection = (
    label: string,
    state: DataState,
    onLoad: () => void,
    tableName: string
  ) => {
    const preview = state.data ? state.data.slice(0, 20) : null;
    return (
      <div className="border border-black p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest">
            {label}
          </h2>
          <span className="text-xs uppercase tracking-widest">
            {state.data ? `Rezultati: ${state.data.length}` : "Rezultati: —"}
          </span>
        </div>
        <p className="mt-2 text-xs uppercase tracking-widest">
          Tabela: {tableName}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onLoad}
            className="border border-black px-4 py-2 text-xs uppercase tracking-widest transition hover:bg-black hover:text-white"
          >
            {state.loading ? "Nalagam ..." : "Naloži"}
          </button>
          {state.error ? (
            <span className="text-xs uppercase text-red-600">
              {state.error}
            </span>
          ) : null}
        </div>
        <pre className="mt-4 max-h-72 overflow-auto border border-black p-3 text-xs">
          {preview ? JSON.stringify(preview, null, 2) : "Ni podatkov."}
        </pre>
      </div>
    );
  };

  if (companyLoading || !companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm uppercase tracking-widest">Nalagam ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold uppercase tracking-wide">
            Jedroplus podatki
          </h1>
          <p className="mt-2 text-xs uppercase tracking-widest">
            Company filter: &quot;ID podjetja&quot; = {companyId}
          </p>
        </div>
        <div className="border border-black p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest">
            Nastavitve podjetja
          </h2>
          <pre className="mt-4 max-h-72 overflow-auto border border-black p-3 text-xs">
            {settingsPreview ? JSON.stringify(settingsPreview, null, 2) : "Ni podatkov."}
          </pre>
        </div>
        {renderSection("Stranke", stranke, loadStranke, tables.strankeTable)}
        {renderSection("Termini", termini, loadTermini, tables.terminiTable)}
        {renderSection("Storitve", storitve, loadStoritve, tables.storitveTable)}
        {renderSection("Osebe", osebe, loadOsebe, tables.osebeTable)}
      </main>
    </div>
  );
}
