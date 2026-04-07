"use client";

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
import FreeTrialModal, { TRIAL_MODAL_SESSION_KEY } from "@/components/FreeTrialModal";

// ============================================================================
// Inner layout that uses sidebar context
// ============================================================================

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, sidebarWidth, isMobile, setNotificationCount } = useSidebar();
  const { companyId, companyUuid } = useCompany();
  const pathname = usePathname();
  const [showTrialModal, setShowTrialModal] = useState(false);

  // Check has_used_trial once company is loaded
  useEffect(() => {
    if (!companyId) return;
    if (sessionStorage.getItem(TRIAL_MODAL_SESSION_KEY)) return;

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
  }, [companyId]);

  // Calculate content margin based on sidebar state
  const contentMargin = isMobile ? 0 : (isCollapsed ? 80 : sidebarWidth);

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
        <main className="flex-1 pt-16 overflow-hidden">
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
      <FreeTrialModal show={showTrialModal} onDismiss={() => setShowTrialModal(false)} />
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
  const { companyId, loading: companyLoading } = useCompany();
  const { user, loading: authLoading } = useAuth();
  const { planCode, loading: planLoading } = useCompanyPlan();
  const { role, permissions, loading: roleLoading } = useRolePermissions();

  const isLoading = companyLoading || authLoading || planLoading || roleLoading;

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

  // Show loading while checking auth/company/plan - minimalist white bg + gradient spinner
  if (isLoading || !user || !companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="w-10 h-10">
            <svg className="w-10 h-10 animate-spin" viewBox="0 0 50 50">
              <defs>
                <linearGradient id="protected-spinner" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="50%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
              <circle cx="25" cy="25" r="20" fill="none" stroke="url(#protected-spinner)" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 50" />
            </svg>
          </div>
      </div>
    );
  }

  // ── Plan-based access gate ──────────────────────────────────────────────
  const accessAllowed = hasAccessToRoute(pathname, planCode);
  const requiredPlan = getRequiredPlan(pathname);

  // ── Role-based access gate ──────────────────────────────────────────────
  // Admin cannot access /billing at all.
  // Staff access to certain routes depends on staff_role_permissions.
  // NOTE: plan is checked FIRST; role gate only applies when the plan allows the route.
  function getRoleGate(): React.ReactNode | null {
    if (role === 'owner' || role === null) return null;

    if (role === 'admin') {
      if (pathname === '/billing' || pathname.startsWith('/billing/')) {
        return <RoleAccessGate message="Stran 'Paketi in kvote' je dostopna samo lastniku podjetja." />;
      }
      return null;
    }

    if (role === 'staff') {
      const p = permissions;

      // /billing is always accessible for staff (page itself handles the restricted view)
      if (pathname === '/billing' || pathname.startsWith('/billing/')) return null;

      const routePermMap: { prefix: string; key: keyof StaffPermissions }[] = [
        { prefix: '/analytics', key: 'can_view_analytics' },
        { prefix: '/asistent', key: 'can_access_asistent_plus' },
        { prefix: '/chatbot-plus', key: 'can_access_chatbot_plus' },
        { prefix: '/komunikacija', key: 'can_access_komunikacija' },
        { prefix: '/reminders', key: 'can_access_opomniki' },
        { prefix: '/rezervacije', key: 'can_access_rezervacije' },
        { prefix: '/lost-leads', key: 'can_access_lost_leads' },
      ];

      for (const { prefix, key } of routePermMap) {
        if (pathname === prefix || pathname.startsWith(prefix + '/')) {
          if (p && p[key] === false) {
            return (
              <RoleAccessGate message="Ta funkcija je za vaš račun onemogočena. Za dostop kontaktirajte lastnika podjetja." />
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
      <LayoutContent>
        {/* Plan is checked FIRST — it always takes precedence over role */}
        {!accessAllowed
          ? <UpgradePlanGate requiredPlan={requiredPlan as PlanCode} hideUpgradeButton={hideUpgradeButton} />
          : roleGate
          ? roleGate
          : children}
      </LayoutContent>
    </SidebarProvider>
  );
}
