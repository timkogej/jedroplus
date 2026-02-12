"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import Link from "next/link";
import {
  CalendarCheck,
  UsersThree,
  CurrencyCircleDollar,
  Clock,
  Plus,
  UserPlus,
  ArrowRight,
  SpinnerGap,
  Warning,
} from "@phosphor-icons/react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { useCompany } from "@/app/company-context";
import { useAuth } from "@/app/auth-context";
import {
  MetricCard,
  AppointmentListCard,
  TopServicesCard,
  TopEmployeesCard,
  RecentActivityCard,
  WeeklyChart,
} from "@/components/dashboard";
import {
  fetchDashboardData,
  type DashboardData,
} from "@/lib/dashboard/fetchDashboardData";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { sl } from "date-fns/locale";

export default function DashboardPage() {
  const router = useRouter();
  const { companyId, companySettings, loading: companyLoading, reloadSettings } = useCompany();
  const { user, loading: authLoading } = useAuth();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Initial auth and company check - runs once on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (!currentUser) {
          window.location.href = '/login';
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('default_company_id')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (!profile?.default_company_id) {
          window.location.href = '/onboarding';
          return;
        }

        setInitialCheckDone(true);
      } catch (err) {
        console.error('Access check error:', err);
        window.location.href = '/login';
      }
    };

    checkAccess();
  }, []);

  // Check company context (after initial check passes)
  useEffect(() => {
    if (!initialCheckDone) return;
    if (companyLoading || authLoading) return;
    if (!companyId) {
      window.location.href = "/onboarding";
      return;
    }
    if (companyId && !companySettings) {
      reloadSettings();
    }
  }, [companyId, companyLoading, authLoading, companySettings, reloadSettings, initialCheckDone]);

  // Fetch dashboard data
  useEffect(() => {
    if (!companyId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDashboardData(companyId);
        setDashboardData(data);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
        setError("Napaka pri nalaganju podatkov");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [companyId]);

  // Get user display name from Supabase Auth metadata
  const displayName = useMemo(() => {
    // First try to get from user metadata (Supabase Auth)
    if (user?.user_metadata) {
      const metadata = user.user_metadata;
      // Try full_name first (common in OAuth providers)
      if (metadata.full_name && typeof metadata.full_name === 'string') {
        return metadata.full_name;
      }
      // Try name field
      if (metadata.name && typeof metadata.name === 'string') {
        return metadata.name;
      }
      // Try first_name + last_name combination
      if (metadata.first_name || metadata.last_name) {
        const firstName = metadata.first_name || '';
        const lastName = metadata.last_name || '';
        const combined = `${firstName} ${lastName}`.trim();
        if (combined) return combined;
      }
      // Try ime + priimek (Slovenian)
      if (metadata.ime || metadata.priimek) {
        const ime = metadata.ime || '';
        const priimek = metadata.priimek || '';
        const combined = `${ime} ${priimek}`.trim();
        if (combined) return combined;
      }
    }
    // Fallback to user email prefix
    if (!user?.email) return "Uporabnik";
    const emailPrefix = user.email.split("@")[0];
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }, [user]);

  const todayFormatted = format(new Date(), "EEEE, d. MMMM yyyy", { locale: sl });

  // Loading state - white background with simple black spinner
  if (!initialCheckDone || companyLoading || loading) {
    return (
      <ProtectedLayout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
        </div>
      </ProtectedLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <ProtectedLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Warning size={48} className="text-red-500 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-2">Prišlo je do napake</p>
            <p className="text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors"
            >
              Poskusi znova
            </button>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Dobrodošli nazaj,{" "}
                  <span className="bg-gradient-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent">
                    {displayName}
                  </span>
                </h1>
                <p className="mt-1 text-gray-500 capitalize">{todayFormatted}</p>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3">
                <Link
                  href="/termini"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-xl font-medium shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all"
                >
                  <Plus size={18} weight="bold" />
                  <span className="hidden sm:inline">Nov Termin</span>
                </Link>
                <Link
                  href="/clients"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  <UserPlus size={18} weight="bold" />
                  <span className="hidden sm:inline">Nova Stranka</span>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Metrics Cards - New Order: 1. Termini danes, 2. Aktivni termini, 3. Nove stranke, 4. Prihodki */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* 1. Termini danes */}
            <MetricCard
              title="Termini danes"
              value={dashboardData?.stats.todayAppointments ?? 0}
              subtitle="Načrtovanih terminov"
              icon={CalendarCheck}
              iconColor="black"
              gradientOutline
            />
            {/* 2. Aktivni termini */}
            <MetricCard
              title="Aktivni termini"
              value={dashboardData?.stats.activeAppointments ?? 0}
              subtitle="Status: načrtovan"
              icon={Clock}
              iconColor="darkGray"
            />
            {/* 3. Nove stranke ta mesec */}
            <MetricCard
              title="Nove stranke ta mesec"
              value={dashboardData?.stats.newClientsThisMonth ?? 0}
              subtitle="Ta mesec"
              icon={UsersThree}
              iconColor="mediumGray"
            />
            {/* 4. Prihodki ta mesec */}
            <MetricCard
              title="Prihodki ta mesec"
              value={`${(dashboardData?.stats.revenueThisMonth ?? 0).toFixed(2)} €`}
              subtitle="Ta mesec"
              icon={CurrencyCircleDollar}
              iconColor="slate"
            />
          </div>

          {/* Today and Tomorrow Appointments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <AppointmentListCard
              title="Termini Danes"
              subtitle={format(new Date(), "d. MMMM", { locale: sl })}
              appointments={dashboardData?.todayAppointments ?? []}
              emptyMessage="Danes ni terminov"
              gradientOutline
            />
            <AppointmentListCard
              title="Termini Jutri"
              subtitle={format(new Date(Date.now() + 86400000), "d. MMMM", { locale: sl })}
              appointments={dashboardData?.tomorrowAppointments ?? []}
              emptyMessage="Jutri ni terminov"
            />
          </div>

          {/* Weekly Chart */}
          <div className="mb-8">
            <WeeklyChart data={dashboardData?.weeklyChart ?? []} />
          </div>

          {/* Bottom Row: Top Services, Top Employees, Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TopServicesCard services={dashboardData?.topServices ?? []} />
            <TopEmployeesCard employees={dashboardData?.topEmployees ?? []} />
            <RecentActivityCard activities={dashboardData?.recentActivity ?? []} />
          </div>

          {/* Quick Navigation Footer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-violet-500/5 to-cyan-500/5 border border-violet-100"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">Potrebujete več podrobnosti?</h3>
                <p className="text-sm text-gray-500">
                  Preglejte celoten koledar ali analitiko za podrobnejši vpogled
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/koledar"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
                >
                  Odpri Koledar
                  <ArrowRight size={16} weight="bold" />
                </Link>
                <Link
                  href="/analytics"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-600 hover:text-cyan-700 transition-colors"
                >
                  Odpri Analitiko
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
