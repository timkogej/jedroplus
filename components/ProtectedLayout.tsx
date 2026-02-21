"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCompany } from "@/app/company-context";
import { useAuth } from "@/app/auth-context";
import { Sidebar, AppBar, SearchModal, SidebarProvider, useSidebar } from "@/components/layout";
import { useCompanyPlan } from "@/hooks/useCompanyPlan";
import { hasAccessToRoute, getRequiredPlan, type PlanCode } from "@/lib/planAccess";
import UpgradePlanGate from "@/components/UpgradePlanGate";
import { supabase } from "@/lib/supabaseClient";

// ============================================================================
// Inner layout that uses sidebar context
// ============================================================================

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, sidebarWidth, isMobile, setNotificationCount } = useSidebar();
  const { companyUuid } = useCompany();

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
        <main className="flex-1 pt-16">
          {children}
        </main>
      </div>

      {/* Search Modal */}
      <SearchModal />
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

  const isLoading = companyLoading || authLoading || planLoading;

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
  // planLoading is already handled above (shows spinner). Once loaded,
  // if the route requires a higher plan, show the upgrade screen.
  const accessAllowed = hasAccessToRoute(pathname, planCode);
  const requiredPlan = getRequiredPlan(pathname);

  return (
    <SidebarProvider>
      <LayoutContent>
        {accessAllowed ? children : <UpgradePlanGate requiredPlan={requiredPlan as PlanCode} />}
      </LayoutContent>
    </SidebarProvider>
  );
}
