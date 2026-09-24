"use client";

import { stripLocalePrefix } from '@/i18n/config';
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useCompany } from "@/app/company-context";
import { useAuth } from "@/app/auth-context";
import { Sidebar, AppBar, SearchModal, SidebarProvider, useSidebar } from "@/components/layout";
import { useCompanyPlan } from "@/hooks/useCompanyPlan";
import { hasAccessToRoute, getRequiredPlan, type PlanCode } from "@/lib/planAccess";
import UpgradePlanGate from "@/components/UpgradePlanGate";
import RoleAccessGate from "@/components/RoleAccessGate";
import { useRolePermissions } from "@/app/role-permission-context";
import { supabase } from "@/lib/supabaseClient";
import type { StaffPermissions } from "@/types/roles";
import FreeTrialModal, { wasShownRecently } from "@/components/FreeTrialModal";
import QuotaBanner from "@/components/billing/QuotaBanner";
import { useBillingUsage } from "@/hooks/useBillingUsage";
import { TourProvider, useOptionalTour } from "@/components/guide/TourProvider";
import { useTranslations } from "next-intl";

// ============================================================================
// Inner layout that uses sidebar context
// ============================================================================

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isMobile, isCollapsed, setNotificationCount } = useSidebar();
  const { companyId, companyUuid, planCode, loading: companyLoading } = useCompany();
  const { role } = useRolePermissions();
  const pathname = usePathname();
  const tour = useOptionalTour();
  const tourActive = Boolean(tour?.activeTour);
  // Once someone has taken a tour in this visit, don't follow it with a sales pop-up.
  const [hadTour, setHadTour] = useState(false);
  useEffect(() => {
    if (tourActive) setHadTour(true);
  }, [tourActive]);
  const [showTrialModal, setShowTrialModal] = useState(false);

  // Offer the Jedro Plus trial only to owners on the free plan who haven't
  // used it — never to paying customers, never to staff.
  useEffect(() => {
    if (!companyId || companyLoading) return;
    if (planCode !== 'FREE' || role !== 'owner') return;
    if (wasShownRecently()) return;

    const checkTrial = async () => {
      const { data } = await supabase
        .from('companies')
        .select('has_used_trial')
        .eq('company_id', companyId)
        .maybeSingle();
      if (data && data.has_used_trial === false) {
        setShowTrialModal(true);
      }
    };
    checkTrial();
  }, [companyId, companyLoading, planCode, role]);

  const contentMargin = isMobile ? 0 : isCollapsed ? 64 : 240;

  // Fetch unread notification count and keep badge updated
  useEffect(() => {
    if (!companyUuid) return;

    const fetchCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyUuid)
        .eq("is_read", false)
        .eq("is_archived", false);

      setNotificationCount(count ?? 0);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [companyUuid, setNotificationCount]);

  return (
    <div className="min-h-screen bg-gray-50/30">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div
        className="flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: contentMargin }}
      >
        {/* App Bar */}
        <AppBar />

        {/* Main content with padding for app bar */}
        <main className="flex-1 pt-14 overflow-hidden">
          {(role === 'owner' || role === 'admin') && <QuotaBanner />}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={pathname}
              initial={isMobile ? { opacity: 0, y: 48 } : undefined}
              animate={{ opacity: 1, y: 0 }}
              exit={isMobile ? { opacity: 0, y: 24 } : undefined}
              transition={
                isMobile
                  ? { type: 'spring', stiffness: 380, damping: 32 }
                  : { duration: 0 }
              }
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Search Modal */}
      <SearchModal />

      {/* Free Trial Modal */}
      {/* Never stack the sales offer on top of a guided tour. */}
      <FreeTrialModal show={showTrialModal && !tourActive && !hadTour} onDismiss={() => setShowTrialModal(false)} />
    </div>
  );
}

// ============================================================================
// Main protected layout component
// ============================================================================

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('billing');
  const { companyId, loading: companyLoading } = useCompany();
  const { user, loading: authLoading } = useAuth();
  const { planCode, loading: planLoading } = useCompanyPlan();
  const { role, permissions, loading: roleLoading } = useRolePermissions();
  const { usage: billingUsage, loading: billingLoading } = useBillingUsage();

  // Strip locale prefix so route checks work with or without /sl/, /en/ prefix
  const pathnameWithoutLocale = stripLocalePrefix(pathname).replace(/\/$/, '') || '/';

  // Free accounts may use reminders while their one-time free quota lasts
  // (plans.FREE sms/email quota > 0). The gate opens only when that quota exists.
  const isRemindersPath = pathnameWithoutLocale === '/reminders' || pathnameWithoutLocale.startsWith('/reminders/');
  const freeReminderTrial =
    planCode === 'FREE' && Boolean(billingUsage && (billingUsage.sms.total > 0 || billingUsage.email.total > 0));

  const isLoading =
    companyLoading || authLoading || planLoading || roleLoading ||
    (isRemindersPath && planCode === 'FREE' && billingLoading);

  useEffect(() => {
    if (companyLoading || authLoading) return;

    // Check authentication first
    if (!user) {
      // Preserve the intended destination for redirect after login
      const redirectUrl = encodeURIComponent(pathname);
      router.replace(`/login?redirect=${redirectUrl}`);
      return;
    }

    // Then check company selection
    if (!companyId) {
      router.replace("/onboarding");
    }
  }, [user, companyId, companyLoading, authLoading, router, pathname]);

  // While auth/company/plan load, show the outline of the app instead of a
  // blank spinner, so a refresh doesn't feel like the app is starting over.
  if (isLoading || !user || !companyId) {
    return <AppShellSkeleton />;
  }

  // ── Plan-based access gate ──────────────────────────────────────────────
  const accessAllowed =
    hasAccessToRoute(pathnameWithoutLocale, planCode) || (isRemindersPath && freeReminderTrial);
  const requiredPlan = getRequiredPlan(pathnameWithoutLocale);

  // ── Role-based access gate ──────────────────────────────────────────────
  // Admin/staff cannot manage billing plans.
  // Staff access to certain routes depends on staff_role_permissions.
  // NOTE: plan is checked FIRST; role gate only applies when the plan allows the route.
  function getRoleGate(): React.ReactNode | null {
    if (role === 'owner' || role === null) return null;

    if (role === 'admin') {
      if (
        pathnameWithoutLocale === '/billing' ||
        pathnameWithoutLocale.startsWith('/billing/') ||
        pathnameWithoutLocale === '/nastavitve/paketi'
      ) {
        return <RoleAccessGate message={t('roleAccessGate.billingOwnerOnly')} />;
      }
      if (pathnameWithoutLocale === '/receptionist-plus') {
        return <RoleAccessGate message={t('roleAccessGate.receptionistPlusOwnerOnly')} />;
      }
      return null;
    }

    if (role === 'staff') {
      const p = permissions;

      if (pathnameWithoutLocale === '/nastavitve/paketi') {
        return <RoleAccessGate message={t('roleAccessGate.billingOwnerOnly')} />;
      }

      if (pathnameWithoutLocale === '/receptionist-plus') {
        return <RoleAccessGate message={t('roleAccessGate.receptionistPlusOwnerOnly')} />;
      }

      // Stripe checkout status pages stay accessible for staff if they land there from an existing flow.
      if (pathnameWithoutLocale.startsWith('/billing/')) return null;

      const routePermMap: { prefix: string; key: keyof StaffPermissions }[] = [
        { prefix: '/analytics', key: 'can_view_analytics' },
        { prefix: '/asistent', key: 'can_access_asistent_plus' },
        { prefix: '/chatbot-plus', key: 'can_access_chatbot_plus' },
        { prefix: '/komunikacija', key: 'can_access_komunikacija' },
        { prefix: '/reminders', key: 'can_access_opomniki' },
        { prefix: '/rezervacije', key: 'can_access_rezervacije' },
        { prefix: '/lost-leads', key: 'can_access_lost_leads' },
        { prefix: '/nastavitve/zgodovina', key: 'can_view_zgodovina' },
      ];

      for (const { prefix, key } of routePermMap) {
        if (pathnameWithoutLocale === prefix || pathnameWithoutLocale.startsWith(prefix + '/')) {
          if (p && p[key] === false) {
            return (
              <RoleAccessGate message={t('roleAccessGate.staffRestricted')} />
            );
          }
        }
      }
    }

    return null;
  }

  const roleGate = getRoleGate();
  // Staff and admin cannot manage billing — hide the upgrade button for them
  const hideUpgradeButton = role === 'staff' || role === 'admin';

  return (
    <SidebarProvider>
      <TourProvider>
      <LayoutContent>
        {/* Plan is checked FIRST — it always takes precedence over role */}
        {!accessAllowed
          ? <UpgradePlanGate requiredPlan={requiredPlan as PlanCode} hideUpgradeButton={hideUpgradeButton} pathname={pathnameWithoutLocale} />
          : roleGate
          ? roleGate
          : children}
      </LayoutContent>
      </TourProvider>
    </SidebarProvider>
  );
}

function AppShellSkeleton() {
  const bar = 'animate-pulse rounded-md bg-gray-100';
  return (
    <div className="min-h-screen bg-gray-50/30" aria-busy="true" aria-live="polite">
      <span className="sr-only">Nalaganje …</span>
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-gray-100 bg-white p-5 md:flex" aria-hidden="true">
        <div className={`h-7 w-28 ${bar}`} />
        <div className="mt-8 flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-gray-100" />
          <div className="flex-1 space-y-2">
            <div className={`h-3 w-24 ${bar}`} />
            <div className={`h-2.5 w-32 ${bar}`} />
          </div>
        </div>
        <div className="mt-8 space-y-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`h-4 w-4 ${bar}`} />
              <div className={`h-3 ${bar}`} style={{ width: `${55 + ((i * 17) % 40)}%` }} />
            </div>
          ))}
        </div>
      </aside>
      <div className="md:ml-[240px]" aria-hidden="true">
        <div className="flex h-14 items-center justify-between border-b border-gray-100 bg-white px-6">
          <div className={`h-3.5 w-40 ${bar}`} />
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-100" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className={`h-7 w-56 ${bar}`} />
          <div className={`mt-3 h-4 w-80 max-w-full ${bar}`} />
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white ring-1 ring-gray-100" />
            ))}
          </div>
          <div className="mt-6 h-72 animate-pulse rounded-2xl bg-white ring-1 ring-gray-100" />
        </div>
      </div>
    </div>
  );
}
