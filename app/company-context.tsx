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
  companyUuid: string | null;
  companySettings: CompanySettings | null;
  setCompany: (companyId: string, settings: CompanySettings, companyUuid?: string) => void;
  clearCompany: () => void;
  reloadSettings: () => Promise<void>;
  switchCompany: () => void;
  isCompanySelected: boolean;
  loading: boolean;
  subscription: SubscriptionInfo | null;
  smsQuota: SMSQuotaInfo | null;
  refreshSubscription: () => Promise<void>;
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

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [smsQuota, setSmsQuota] = useState<SMSQuotaInfo | null>(null);
  const [directPlanCode, setDirectPlanCode] = useState<string | null>(null);
  const refreshSubscription = useCallback(async (companyUuid?: string) => {
    try {
      const result = await getBillingStatus(true, companyUuid);

      console.log('[Subscription] getBillingStatus result:', { companyUuid, ok: result.ok, plan: result.plan, subscription: result.subscription });

      if (result.ok && result.subscription && result.plan) {
        const normalizedCode = (result.plan.code || 'FREE').toUpperCase().replace(/[\s-]+/g, '_');
        setSubscription({
          status: result.subscription.status,
          plan_code: normalizedCode,
          plan_name: result.plan.name,
          sms_blocked: result.subscription.sms_blocked || false,
          current_period_end: result.subscription.current_period_end,
        });

        if (result.usage) {          const smsUsage = result.usage as { sms_used?: number; sms_quota?: number };
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
      setSubscription({
        status: 'active',
        plan_code: 'FREE',
        plan_name: 'Free',
        sms_blocked: false,
      });
    }
  }, []);
  const fetchAndSetDirectPlanCode = useCallback(async (uuid: string) => {
    try {
      const { data: subData, error: subError } = await supabaseReadOnly
        .from('company_subscriptions')
        .select('plan_id')
        .eq('company_id', uuid)
        .maybeSingle();

      console.log('[Plan] company_subscriptions:', { uuid, subData, subError });

      if (subData?.plan_id) {
        const { data: planData, error: planError } = await supabaseReadOnly
          .from('plans')
          .select('code')
          .eq('id', subData.plan_id)
          .maybeSingle();

        console.log('[Plan] plans:', { plan_id: subData.plan_id, planData, planError });

        if (planData?.code) {
          const normalized = String(planData.code).toUpperCase().replace(/[\s-]+/g, '_');
          console.log('[Plan] directPlanCode set to:', normalized);
          setDirectPlanCode(normalized);
          return normalized;
        }
      }
      console.warn('[Plan] No plan found for UUID:', uuid);
      return null;
    } catch (e) {
      console.error('[Plan] fetchAndSetDirectPlanCode error:', e);
      return null;
    }
  }, []);
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
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
          setDirectPlanCode(null);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_KEY_UUID);
          document.cookie = "company_id=; path=/; max-age=0";
          setLoading(false);
          return;
        }
        setCompanyIdState(stored);
        setCompanySettings(data as CompanySettings);

        const { data: companyData } = await supabaseReadOnly
          .from("companies")
          .select("id")
          .eq("company_id", stored)
          .maybeSingle();

        const uuid: string | null = companyData?.id ?? null;
        if (uuid) {
          localStorage.setItem(STORAGE_KEY_UUID, uuid);
        }
        setCompanyUuidState(uuid);

        if (uuid) {
          await fetchAndSetDirectPlanCode(uuid);
        }
        await refreshSubscription(uuid || undefined);

        setLoading(false);
      } catch (err) {
        console.warn("[CompanyProvider] Error loading company settings:", err);
        setLoading(false);
      }
    };

    loadSettings();
  }, [router, refreshSubscription, fetchAndSetDirectPlanCode]);
  const setCompany = (value: string, settings: CompanySettings, uuid?: string) => {
    const normalized = value.trim().toUpperCase();
    setCompanyIdState(normalized);
    setCompanySettings(settings);
    localStorage.setItem(STORAGE_KEY, normalized);
    document.cookie = `company_id=${normalized}; path=/; max-age=31536000`;

    if (uuid) {
      setCompanyUuidState(uuid);
      localStorage.setItem(STORAGE_KEY_UUID, uuid);
      fetchAndSetDirectPlanCode(uuid);
    }
    refreshSubscription(uuid || undefined);
  };
  const clearCompany = () => {
    setCompanyIdState(null);
    setCompanyUuidState(null);
    setCompanySettings(null);
    setSubscription(null);
    setSmsQuota(null);
    setDirectPlanCode(null);
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

    if (companyUuid) {
      await fetchAndSetDirectPlanCode(companyUuid);
    }
    await refreshSubscription(companyUuid || undefined);

    setLoading(false);
  };
  const isPlanActive = subscription?.status === 'active';
  const planCode = directPlanCode || subscription?.plan_code || 'FREE';
  console.log('[Plan] planCode computed:', { directPlanCode, subscriptionPlanCode: subscription?.plan_code, planCode });

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
      subscription,
      smsQuota,
      refreshSubscription,
      isPlanActive,
      planCode,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyId, companyUuid, companySettings, loading, subscription, smsQuota, isPlanActive, planCode, refreshSubscription, fetchAndSetDirectPlanCode]
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
