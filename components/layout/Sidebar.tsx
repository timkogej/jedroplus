'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChartBar,
  CalendarBlank,
  CalendarCheck,
  Users,
  ClipboardText,
  Briefcase,
  UserCircle,
  TrendDown,
  ChartLine,
  Gear,
  CaretLeft,
  CaretRight,
  X,
  SignOut,
  Bell,
  Envelope,
  Sparkle,
  Question,
  Info,
  CreditCard,
  Robot,
  Phone,
  ChatCircleDots,
  Package,
  Lock,
} from '@phosphor-icons/react';
import Image from 'next/image';
import { useSidebar } from './sidebar-context';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { hasAccessToRoute } from '@/lib/planAccess';
import { useRolePermissions } from '@/app/role-permission-context';
import type { StaffPermissions } from '@/types/roles';

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: number | string | null;
}

interface NavSection {
  label: string;
  items: NavItem[];
}


// ============================================================================
// Navigation config
// ============================================================================

const navigationSectionsPaid: NavSection[] = [
  {
    label: 'Glavno',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: ChartBar },
      { name: 'Koledar', href: '/koledar', icon: CalendarBlank },
      { name: 'Termini', href: '/termini', icon: ClipboardText },
      { name: 'Stranke', href: '/clients', icon: Users },
    ],
  },
  {
    label: 'AI',
    items: [
      // Asistent+ - začasno skrito, logika ohranjena v /asistent
      // { name: 'Asistent+', href: '/asistent', icon: Robot, badge: 'Novo' },
      // Chatbot+ - začasno skrito, bo dodano kasneje
      // { name: 'Chatbot+', href: '/chatbot-plus', icon: ChatCircleDots, badge: 'Novo' },
      // Receptionist+ - začasno skrito, logika ohranjena v /receptionist-plus
      // { name: 'Receptionist+', href: '/receptionist-plus', icon: Phone, badge: 'Novo' },
    ],
  },
  {
    label: 'Komunikacija',
    items: [
      { name: 'Komunikacija', href: '/komunikacija', icon: Envelope },
      { name: 'Opomniki', href: '/reminders', icon: Bell },
      { name: 'Rezervacije', href: '/rezervacije', icon: CalendarCheck },
      { name: 'Izgubljene stranke', href: '/lost-leads', icon: TrendDown },
    ],
  },
  {
    label: 'Moduli',
    items: [
      { name: 'Storitve', href: '/services', icon: Briefcase },
      { name: 'Osebje', href: '/staff', icon: UserCircle },
    ],
  },
  {
    label: 'Analitika',
    items: [
      { name: 'Analitika', href: '/analytics', icon: ChartLine },
    ],
  },
  {
    label: 'Račun',
    items: [
      { name: 'Paketi in kvote', href: '/billing', icon: Package },
    ],
  },
];

const navigationSectionsFree: NavSection[] = [
  {
    label: 'Glavno',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: ChartBar },
      { name: 'Koledar', href: '/koledar', icon: CalendarBlank },
      { name: 'Termini', href: '/termini', icon: ClipboardText },
      { name: 'Stranke', href: '/clients', icon: Users },
    ],
  },
  {
    label: 'Moduli',
    items: [
      { name: 'Storitve', href: '/services', icon: Briefcase },
      { name: 'Osebje', href: '/staff', icon: UserCircle },
    ],
  },
  // AI sekcija začasno skrita - bo dodana kasneje
  // { label: 'AI', items: [{ name: 'Chatbot+', href: '/chatbot-plus', icon: ChatCircleDots, badge: 'Novo' }] },
  {
    label: 'Komunikacija',
    items: [
      { name: 'Komunikacija', href: '/komunikacija', icon: Envelope },
      { name: 'Opomniki', href: '/reminders', icon: Bell },
      { name: 'Rezervacije', href: '/rezervacije', icon: CalendarCheck },
      { name: 'Izgubljene stranke', href: '/lost-leads', icon: TrendDown },
    ],
  },
  {
    label: 'Analitika',
    items: [
      { name: 'Analitika', href: '/analytics', icon: ChartLine },
    ],
  },
  {
    label: 'Paketi in kvote',
    items: [
      { name: 'Paketi in kvote', href: '/billing', icon: Package },
    ],
  },
];

// ============================================================================
// Utility
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Animation variants
// ============================================================================

const sidebarVariants = {
  hidden: { x: '-100%' },
  visible: {
    x: 0,
    transition: {
      type: 'spring' as const,
      damping: 25,
      stiffness: 300,
      staggerChildren: 0.05,
      delayChildren: 0.1,
    }
  },
  exit: {
    x: '-100%',
    transition: {
      type: 'spring' as const,
      damping: 30,
      stiffness: 300
    }
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, damping: 20, stiffness: 300 }
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================================
// Component
// ============================================================================

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarRef = useRef<HTMLElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  const {
    isOpen,
    isCollapsed,
    isMobile,
    close,
    setCollapsed,
    sidebarWidth,
  } = useSidebar();

  const { companySettings, switchCompany, companyId } = useCompany();
  const { user, signOut } = useAuth();
  const { planCode } = useCompanyPlan();
  const { role, permissions } = useRolePermissions();

  const isFree = planCode === 'FREE';
  const baseNavigationSections = isFree ? navigationSectionsFree : navigationSectionsPaid;

  const isLocked = (href: string) => !hasAccessToRoute(href, planCode);

  // ── Incomplete settings alerts ─────────────────────────────────────────────
  const hasOpomnikiPlan = planCode === 'JEDRO_PLUS' || planCode === 'JEDRO_PRO' || planCode === 'JEDRO_PREMIUM';
  const hasChatbotPlan = planCode === 'JEDRO_PRO' || planCode === 'JEDRO_PREMIUM';

  const opomniki_incomplete = hasOpomnikiPlan && (
    !String(companySettings?.['from_name'] ?? companySettings?.['From_name'] ?? '').trim() ||
    !String(companySettings?.['reply_to'] ?? companySettings?.['reply_to_email'] ?? '').trim()
  );
  const rezervacije_incomplete = hasOpomnikiPlan && !String(companySettings?.['main_booking_link'] ?? '').trim();
  const chatbot_incomplete = hasChatbotPlan && !String(companySettings?.['chatbot_link'] ?? '').trim();
  const any_incomplete = opomniki_incomplete || rezervacije_incomplete || chatbot_incomplete;

  const getAlertBadge = (href: string): boolean => {
    if (href === '/reminders') return opomniki_incomplete;
    if (href === '/rezervacije') return rezervacije_incomplete;
    if (href === '/chatbot-plus') return chatbot_incomplete;
    return false;
  };

  // ── Role-based nav filtering ─────────────────────────────────────────────

  /**
   * Returns true if this nav item should be visible for the current role.
   * Owner → always visible.
   * Admin → everything except /billing.
   * Staff → filtered by staff_role_permissions.
   */
  function isNavVisible(href: string): boolean {
    if (role === 'owner' || role === null) return true;

    if (role === 'admin') {
      return href !== '/billing';
    }

    if (role === 'staff') {
      // /billing is always hidden for staff (nav shows "Paketi" item added separately below)
      if (href === '/billing') return false;

      if (!permissions) return true; // no perms record → allow (fallback)

      const staffMap: Partial<Record<string, keyof StaffPermissions>> = {
        '/analytics': 'can_view_analytics',
        '/asistent': 'can_access_asistent_plus',
        '/chatbot-plus': 'can_access_chatbot_plus',
        '/komunikacija': 'can_access_komunikacija',
        '/reminders': 'can_access_opomniki',
        '/rezervacije': 'can_access_rezervacije',
        '/lost-leads': 'can_access_lost_leads',
      };

      const key = staffMap[href];
      if (key) return permissions[key] === true;

      return true;
    }

    return true;
  }

  // Build filtered sections + staff "Paketi" item
  const navigationSections = baseNavigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isNavVisible(item.href)),
    }))
    .filter((section) => section.items.length > 0);

  // Staff gets a "Paketi" item in place of "Paketi in kvote"
  const staffPaketiSection: NavSection | null =
    role === 'staff'
      ? { label: 'Račun', items: [{ name: 'Paketi', href: '/billing', icon: Package }] }
      : null;

  // User info
  const companyName = String(companySettings?.['Naziv Podjetja'] || companySettings?.['ID Podjetja'] || 'Moje Podjetje');
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Uporabnik';
  const userEmail = user?.email || '';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // -------------------------------------------------------------------------
  // Scroll active nav item into view on route change
  // -------------------------------------------------------------------------

  useEffect(() => {
    const desktopNav = desktopNavRef.current;
    if (!desktopNav) return;
    requestAnimationFrame(() => {
      const activeEl = desktopNav.querySelector('[data-active="true"]') as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    });
  }, [pathname]);

  // -------------------------------------------------------------------------
  // Active route check
  // -------------------------------------------------------------------------

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // Check if the page is an AI page (should have gradient styling)
  const isAIPage = (href: string) => {
    return href === '/asistent' || href === '/chatbot-plus' || href === '/receptionist-plus';
  };

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleLogout = async () => {
    close();
    await signOut?.();
    router.replace('/login');
  };

  const handleSwitchCompany = () => {
    close();
    switchCompany();
  };

  // -------------------------------------------------------------------------
  // Determine effective width
  // -------------------------------------------------------------------------

  const effectiveWidth = isCollapsed ? 80 : sidebarWidth;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Desktop sidebar
  const DesktopSidebar = (
    <aside
      ref={sidebarRef}
      style={{ width: effectiveWidth }}
      className={cn(
        'hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col transition-all duration-300 overflow-hidden',
        'bg-white border-r border-gray-200'
      )}
    >
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex-shrink-0"
              >
                <Image src="/brand/logo.png" alt="Jedro+" width={56} height={56} priority />
              </motion.div>
              <div className="min-w-0 flex-1">
                <h1
                  className="text-lg font-bold"
                  style={{
                    background: 'linear-gradient(90deg, #7C75FC 0%, #50C3D2 50%, #44D0C6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Jedro+
                </h1>
                <p className="text-xs text-gray-500 truncate">{companyName}</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setCollapsed(true)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2"
              aria-label="Skrči sidebar"
            >
              <CaretLeft className="w-4 h-4 text-gray-400" />
            </motion.button>
          </>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCollapsed(false)}
            className="w-full flex justify-center"
            aria-label="Razširi sidebar"
          >
            <Image src="/brand/logo.png" alt="Jedro+" width={48} height={48} priority />
          </motion.button>
        )}
      </div>

      {/* User info card - only when not collapsed */}
      {!isCollapsed && (
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-br from-violet-500 to-cyan-500">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                  <span className="text-sm font-semibold text-gray-700">{userInitials}</span>
                </div>
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav ref={desktopNavRef} className="flex-1 overflow-y-auto py-4 px-3">
        {[...navigationSections, ...(staffPaketiSection ? [staffPaketiSection] : [])].map((section) => (
          <div key={section.label} className="mb-6">
            {!isCollapsed && (
              <div className="px-3 pb-2">
                <h3 className="text-[11px] font-semibold text-gray-400 tracking-wider">
                  {section.label.toUpperCase()}
                </h3>
              </div>
            )}

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const useGradient = isAIPage(item.href);
                const locked = isLocked(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={active ? 'true' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                      isCollapsed && 'justify-center',
                      locked && 'opacity-50',
                      active
                        ? 'bg-gray-100'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:scale-[1.01]'
                    )}
                  >
                    {active ? (
                      <Icon className="w-5 h-5 flex-shrink-0 text-gray-900" weight="fill" />
                    ) : (
                      <Icon
                        className="w-5 h-5 transition-all flex-shrink-0 text-gray-500 group-hover:text-gray-700"
                        weight="regular"
                      />
                    )}

                    {!isCollapsed && (
                      <>
                        {active ? (
                          <span className="font-semibold text-sm flex-1 text-gray-900">
                            {item.name}
                          </span>
                        ) : (
                          <span className="font-medium text-sm flex-1">
                            {item.name}
                          </span>
                        )}

                        {locked ? (
                          <Lock className="w-3.5 h-3.5 text-gray-400" weight="regular" />
                        ) : getAlertBadge(item.href) ? (
                          <span className="w-5 h-5 flex items-center justify-center text-white bg-orange-500 rounded-full text-[10px] font-bold flex-shrink-0">!</span>
                        ) : item.badge ? (
                          <span className="px-2 py-0.5 text-[10px] font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full">
                            {item.badge}
                          </span>
                        ) : null}
                      </>
                    )}

                    {/* Alert dot for collapsed state */}
                    {isCollapsed && getAlertBadge(item.href) && (
                      <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full border border-white" />
                    )}

                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                        {item.name}
                        {locked ? (
                          <Lock className="inline-block ml-1.5 w-3 h-3" weight="regular" />
                        ) : getAlertBadge(item.href) ? (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-orange-500/80 rounded font-bold">!</span>
                        ) : item.badge ? (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-white/20 rounded">
                            {item.badge}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
        {/* Settings */}
        <Link
          href="/nastavitve"
          className={cn(
            'group relative flex items-center gap-3 px-3 py-2.5 mx-3 rounded-xl transition-all duration-200',
            isCollapsed && 'justify-center px-0 mx-0',
            isActive('/nastavitve')
              ? 'bg-gray-100'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          )}
        >
          <div className="relative flex-shrink-0">
            {isActive('/nastavitve') ? (
              <Gear className="w-5 h-5 text-gray-900" weight="fill" />
            ) : (
              <Gear className="w-5 h-5 transition-all text-gray-500" weight="regular" />
            )}
            {any_incomplete && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border border-white" />
            )}
          </div>
          {!isCollapsed && (
            <>
              {isActive('/nastavitve') ? (
                <span className="font-semibold text-sm text-gray-900 flex-1">
                  Nastavitve
                </span>
              ) : (
                <span className="font-medium text-sm flex-1">Nastavitve</span>
              )}
              {any_incomplete && (
                <span className="w-5 h-5 flex items-center justify-center text-white bg-orange-500 rounded-full text-[10px] font-bold flex-shrink-0">!</span>
              )}
            </>
          )}

          {isCollapsed && (
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
              Nastavitve
              {any_incomplete && <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-orange-500/80 rounded font-bold">!</span>}
            </div>
          )}
        </Link>

        {/* Logout button */}
        {!isCollapsed ? (
          <div className="px-4 py-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <SignOut className="w-4 h-4" />
              <span>Odjava</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex justify-center py-3 hover:bg-gray-100 transition-all group relative"
          >
            <SignOut className="w-5 h-5 text-red-500" />
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
              Odjava
            </div>
          </button>
        )}

        {/* Version info */}
        {!isCollapsed && (
          <div className="px-6 py-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>v1.0.0</span>
              <div className="flex items-center gap-2">
                <button className="hover:text-gray-600 transition-colors">
                  <Question className="w-4 h-4" />
                </button>
                <button className="hover:text-gray-600 transition-colors">
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </aside>
  );

  // Mobile sidebar (overlay) - WHITE BACKGROUND
  const MobileSidebar = (
    <AnimatePresence>
      {isMobile && isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={close}
          />

          {/* Sidebar - WHITE BACKGROUND */}
          <motion.aside
            ref={sidebarRef}
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed left-0 top-0 bottom-0 w-80 bg-white border-r border-gray-200 z-50 flex flex-col overflow-hidden md:hidden"
          >
            {/* Header - WHITE */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100 flex-shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <Image src="/brand/logo.png" alt="Jedro+" width={56} height={56} priority />
                <span
                  className="text-xl font-bold"
                  style={{
                    background: 'linear-gradient(90deg, #7C75FC 0%, #50C3D2 50%, #44D0C6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Jedro+
                </span>
              </div>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                type="button"
              >
                <X className="w-5 h-5 text-gray-600" weight="bold" />
              </motion.button>
            </div>

            {/* User info card - WHITE */}
            <div className="p-5 border-b border-gray-100 flex-shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-r from-violet-500 to-cyan-500">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    <span className="text-gray-700 font-bold">{userInitials}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 font-semibold truncate">{userName}</div>
                  <div className="text-xs text-gray-500 truncate">{userEmail}</div>
                </div>
              </div>
            </div>

            {/* Navigation - WHITE */}
            <nav ref={mobileNavRef} className="flex-1 p-4 overflow-y-auto bg-white">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.05,
                    },
                  },
                }}
              >
                {[...navigationSections, ...(staffPaketiSection ? [staffPaketiSection] : [])].map((section) => (
                  <div key={section.label} className="mb-6">
                    <div className="text-xs font-semibold text-gray-400 tracking-wider mb-2 px-3">
                      {section.label.toUpperCase()}
                    </div>

                    {section.items.map((item) => {
                      const active = isActive(item.href);
                      const Icon = item.icon;
                      const useGradient = isAIPage(item.href);
                      const locked = isLocked(item.href);

                      return (
                        <motion.div key={item.href} variants={itemVariants}>
                          <Link
                            href={item.href}
                            onClick={close}
                            className={cn(
                              'flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-all',
                              locked && 'opacity-50',
                              active
                                ? 'bg-gray-100'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            )}
                          >
                            {active ? (
                              <Icon className="w-5 h-5 text-gray-900" weight="fill" />
                            ) : (
                              <Icon className="w-5 h-5 text-gray-500" weight="regular" />
                            )}
                            {active ? (
                              <span className="flex-1 font-semibold text-gray-900">{item.name}</span>
                            ) : (
                              <span className="flex-1 font-medium">{item.name}</span>
                            )}
                            {locked ? (
                              <Lock className="w-3.5 h-3.5 text-gray-400" weight="regular" />
                            ) : getAlertBadge(item.href) ? (
                              <span className="w-5 h-5 flex items-center justify-center text-white bg-orange-500 rounded-full text-[10px] font-bold flex-shrink-0">!</span>
                            ) : item.badge ? (
                              <span className="px-2 py-0.5 text-[10px] font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full">
                                {item.badge}
                              </span>
                            ) : null}
                            {active && (
                              useGradient ? (
                                <span
                                  style={{
                                    background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                  }}
                                >
                                  <CaretRight className="w-4 h-4" weight="bold" />
                                </span>
                              ) : (
                                <CaretRight className="w-4 h-4 text-gray-900" weight="bold" />
                              )
                            )}
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                ))}

                {/* Settings in mobile nav */}
                <motion.div variants={itemVariants}>
                  <Link
                    href="/nastavitve"
                    onClick={close}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
                      isActive('/nastavitve')
                        ? 'bg-gray-100'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      {isActive('/nastavitve') ? (
                        <Gear className="w-5 h-5 text-gray-900" weight="fill" />
                      ) : (
                        <Gear className="w-5 h-5 text-gray-500" weight="regular" />
                      )}
                      {any_incomplete && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border border-white" />
                      )}
                    </div>
                    {isActive('/nastavitve') ? (
                      <span className="flex-1 font-semibold text-gray-900">
                        Nastavitve
                      </span>
                    ) : (
                      <span className="flex-1 font-medium">Nastavitve</span>
                    )}
                    {any_incomplete && (
                      <span className="w-5 h-5 flex items-center justify-center text-white bg-orange-500 rounded-full text-[10px] font-bold flex-shrink-0">!</span>
                    )}
                    {isActive('/nastavitve') && (
                      <CaretRight className="w-4 h-4 text-gray-900" weight="bold" />
                    )}
                  </Link>
                </motion.div>
              </motion.div>
            </nav>

            {/* Footer - WHITE */}
            <div className="p-5 border-t border-gray-100 flex-shrink-0 bg-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>{companyName}</span>
                <span>v1.0.0</span>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <SignOut className="w-4 h-4" weight="bold" />
                <span>Odjava</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  // Spacer for content
  const Spacer = (
    <div
      className="hidden md:block flex-shrink-0 transition-all duration-300"
      style={{ width: effectiveWidth }}
    />
  );

  return (
    <>
      {DesktopSidebar}
      {MobileSidebar}
      {Spacer}
    </>
  );
}
