"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabaseReadOnly } from "@/src/lib/supabaseReadOnly";
import {
  getBillingStatus,
  type SubscriptionInfo,
  type SMSQuotaInfo,
} from "@/lib/api/billingClient";

const STORAGE_KEY = "jedroplus_company_id";

export type CompanySettings = {
  "ID Podjetja"?: string;
  "Naziv Podjetja"?: string;
  Panoga?: string;
  valuta?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  channel?: string;
  chanel_pred?: string;
  channel_po?: string;
  channel_lost_l?: string;
  koledar_ure?: string;
  "Tabela stranke"?: string;
  "Tabela termini"?: string;
  "Tabela osebe"?: string;
  "Tabela storitve"?: string;
  sendgrid_api_key?: string;
  [key: string]: unknown;
};

type CompanyContextValue = {
  companyId: string | null;
  companyUuid: string | null; // Long UUID from companies.id (used for billing)
  companySettings: CompanySettings | null;
  setCompany: (companyId: string, settings: CompanySettings, companyUuid?: string) => void;
  clearCompany: () => void;
  reloadSettings: () => Promise<void>;
  switchCompany: () => void;
  isCompanySelected: boolean;
  loading: boolean;
  // Subscription & Billing
  subscription: SubscriptionInfo | null;
  smsQuota: SMSQuotaInfo | null;
  refreshSubscription: (uuid?: string) => Promise<void>;
  isPlanActive: boolean;
  planCode: string;
};

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

const STORAGE_KEY_UUID = "jedroplus_company_uuid";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [companyId, setCompanyIdState] = useState<string | null>(null);
  const [companyUuid, setCompanyUuidState] = useState<string | null>(null);
  const [companySettings, setCompanySettings] =
    useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscription state
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [smsQuota, setSmsQuota] = useState<SMSQuotaInfo | null>(null);

  // Fetch subscription info using billing status endpoint
  const refreshSubscription = useCallback(async (uuid?: string) => {
    const targetUuid = uuid || companyUuid;
    if (!targetUuid) return;

    try {
      const result = await getBillingStatus(true);

      if (result.ok && result.subscription && result.plan) {
        setSubscription({
          status: result.subscription.status,
          plan_code: result.plan.code,
          plan_name: result.plan.name,
          sms_blocked: result.subscription.sms_blocked || false,
          current_period_end: result.subscription.current_period_end,
        });

        // Set SMS quota from usage if available
        if (result.usage) {
          const smsUsage = result.usage as { sms_used?: number; sms_quota?: number };
          setSmsQuota({
            enabled_effective: (smsUsage.sms_quota || 0) > 0,
            quota_effective: smsUsage.sms_quota || 0,
            used_current_month: smsUsage.sms_used || 0,
            remaining: Math.max(0, (smsUsage.sms_quota || 0) - (smsUsage.sms_used || 0)),
          });
        } else {
          setSmsQuota(null);
        }
      } else {
        // Set defaults for free plan if status check fails
        setSubscription({
          status: 'active',
          plan_code: 'FREE',
          plan_name: 'Free',
          sms_blocked: false,
        });
        setSmsQuota({
          enabled_effective: false,
          quota_effective: 0,
          used_current_month: 0,
          remaining: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      // Set defaults on error
      setSubscription({
        status: 'active',
        plan_code: 'FREE',
        plan_name: 'Free',
        sms_blocked: false,
      });
    }
  }, [companyUuid]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedUuid = localStorage.getItem(STORAGE_KEY_UUID);
    if (!stored || stored.trim() === "") {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabaseReadOnly
          .from("Podatki podjetij")
          .select("*")
          .eq("ID Podjetja", stored)
          .maybeSingle();

        if (error || !data) {
          setCompanyIdState(null);
          setCompanyUuidState(null);
          setCompanySettings(null);
          setSubscription(null);
          setSmsQuota(null);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_KEY_UUID);
          document.cookie = "company_id=; path=/; max-age=0";
          setLoading(false);
          // Don't redirect automatically - let individual pages handle this
          return;
        }

        setCompanyIdState(stored);
        setCompanySettings(data as CompanySettings);

        // Fetch the long UUID from companies table if not already stored
        let uuid: string | null = storedUuid;
        if (!uuid) {
          const { data: companyData } = await supabaseReadOnly
            .from("companies")
            .select("id")
            .eq("company_id", stored)
            .maybeSingle();

          if (companyData?.id) {
            uuid = companyData.id;
            localStorage.setItem(STORAGE_KEY_UUID, companyData.id);
          }
        }
        setCompanyUuidState(uuid);

        // Fetch billing status using UUID
        if (uuid) {
          await refreshSubscription(uuid);
        }

        setLoading(false);
      } catch (err) {
        // Handle CORS or network errors gracefully
        console.warn("[CompanyProvider] Error loading company settings:", err);
        setLoading(false);
      }
    };

    loadSettings();
  }, [router, refreshSubscription]);

  const setCompany = (value: string, settings: CompanySettings, uuid?: string) => {
    const normalized = value.trim().toUpperCase();
    setCompanyIdState(normalized);
    setCompanySettings(settings);
    localStorage.setItem(STORAGE_KEY, normalized);
    document.cookie = `company_id=${normalized}; path=/; max-age=31536000`;

    if (uuid) {
      setCompanyUuidState(uuid);
      localStorage.setItem(STORAGE_KEY_UUID, uuid);
      // Fetch billing status for new company using UUID
      refreshSubscription(uuid);
    } else {
      refreshSubscription(normalized);
    }
  };

  const clearCompany = () => {
    setCompanyIdState(null);
    setCompanyUuidState(null);
    setCompanySettings(null);
    setSubscription(null);
    setSmsQuota(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_UUID);
    document.cookie = "company_id=; path=/; max-age=0";
  };

  const switchCompany = () => {
    clearCompany();
    router.replace("/onboarding");
  };

  const reloadSettings = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabaseReadOnly
      .from("Podatki podjetij")
      .select("*")
      .eq("ID Podjetja", companyId)
      .maybeSingle();

    if (error || !data) {
      clearCompany();
      setLoading(false);
      router.replace("/onboarding");
      return;
    }

    setCompanySettings(data as CompanySettings);

    // Also refresh subscription
    await refreshSubscription();

    setLoading(false);
  };

  // Derived values
  const isPlanActive = subscription?.status === 'active';
  const planCode = subscription?.plan_code || 'FREE';

  const value = useMemo(
    () => ({
      companyId,
      companyUuid,
      companySettings,
      setCompany,
      clearCompany,
      reloadSettings,
      switchCompany,
      isCompanySelected: Boolean(companyId),
      loading,
      // Subscription
      subscription,
      smsQuota,
      refreshSubscription,
      isPlanActive,
      planCode,
    }),
    [companyId, companyUuid, companySettings, loading, subscription, smsQuota, isPlanActive, planCode, refreshSubscription]
  );

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompany must be used within CompanyProvider");
  }
  return context;
}
