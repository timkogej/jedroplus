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
  X,
  SignOut,
  Bell,
  Envelope,
  Package,
  Lock,
  Tag,
  CaretLeft,
} from '@phosphor-icons/react';
import { useSidebar } from './sidebar-context';
import { JedroLogo } from '@/components/ui/JedroLogo';
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
    label: 'Promocije',
    items: [
      { name: 'Promocije', href: '/promotions', icon: Tag },
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
  {
    label: 'Promocije',
    items: [
      { name: 'Promocije', href: '/promotions', icon: Tag },
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
    transition: { type: 'spring' as const, damping: 25, stiffness: 300 },
  },
  exit: {
    x: '-100%',
    transition: { type: 'spring' as const, damping: 30, stiffness: 300 },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================================
// NavItem sub-component
// ============================================================================

interface NavItemProps {
  item: NavItem;
  active: boolean;
  locked: boolean;
  hasAlert: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

function NavItemLink({ item, active, locked, hasAlert, collapsed, onClick }: NavItemProps) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-active={active ? 'true' : undefined}
      onClick={onClick}
      title={collapsed ? item.name : undefined}
      className={cn(
        'group relative flex items-center rounded-lg text-sm transition-colors duration-150',
        collapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2',
        active
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50',
        locked && 'opacity-50'
      )}
    >
      {!collapsed && active && (
        <motion.span
          layoutId="sidebar-active-bar"
          className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#6D5EF7] rounded-r-full"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
        />
      )}

      <div className="relative flex-shrink-0">
        <Icon
          weight="regular"
          className={cn(
            'w-5 h-5 transition-colors',
            active ? 'text-[#6D5EF7]' : 'text-gray-400 group-hover:text-gray-700'
          )}
        />
        {collapsed && hasAlert && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
        )}
      </div>

      {!collapsed && (
        <>
          <span className="truncate flex-1">{item.name}</span>
          {locked ? (
            <Lock weight="regular" className="ml-auto w-3.5 h-3.5 text-gray-400" />
          ) : hasAlert ? (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
          ) : item.badge === 'Novo' ? (
            <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium text-[#6D5EF7] bg-[#6D5EF7]/10 rounded-full">
              Novo
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
}

// ============================================================================
// Component
// ============================================================================

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const desktopNavRef = useRef<HTMLElement>(null);

  const { isOpen, isMobile, close, isCollapsed, toggleCollapse } = useSidebar();

  const { companySettings } = useCompany();
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

  function isNavVisible(href: string): boolean {
    if (role === 'owner' || role === null) return true;

    if (role === 'admin') {
      return href !== '/billing';
    }

    if (role === 'staff') {
      if (href === '/billing') return false;

      if (!permissions) return true;

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

  const navigationSections = baseNavigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isNavVisible(item.href)),
    }))
    .filter((section) => section.items.length > 0);

  const staffPaketiSection: NavSection | null =
    role === 'staff'
      ? { label: 'Račun', items: [{ name: 'Paketi', href: '/billing', icon: Package }] }
      : null;

  // User info
  const companyName = String(companySettings?.['Naziv Podjetja'] || companySettings?.['ID Podjetja'] || 'Moje Podjetje');
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Uporabnik';
  const userEmail = user?.email || '';
  const userInitials = userName
    .split(/\s+/)
    .filter(Boolean)
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

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleLogout = async () => {
    close();
    await signOut?.();
    router.replace('/login');
  };

  // -------------------------------------------------------------------------
  // Shared nav sections list
  // -------------------------------------------------------------------------

  const allSections = [...navigationSections, ...(staffPaketiSection ? [staffPaketiSection] : [])];

  // -------------------------------------------------------------------------
  // Desktop sidebar
  // -------------------------------------------------------------------------

  const DesktopSidebar = (
    <motion.aside
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ type: 'spring', damping: 25, stiffness: 280 }}
      className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 bg-white border-r border-gray-100 z-40 overflow-hidden"
    >
      {/* Header */}
      <div className={cn(
        'flex items-center border-b border-gray-100 flex-shrink-0',
        isCollapsed ? 'justify-center p-4' : 'gap-3 p-5'
      )}>
        <JedroLogo size={28} className="flex-shrink-0" />
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Jedro+</p>
            <p className="text-xs text-gray-400 truncate">{companyName}</p>
          </div>
        )}
      </div>

      {/* User card */}
      <div className={cn(
        'flex items-center border-b border-gray-100 flex-shrink-0',
        isCollapsed ? 'justify-center py-3.5 px-0' : 'gap-3 px-4 py-3.5'
      )}>
        <div className="relative flex-shrink-0" title={isCollapsed ? userName : undefined}>
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700">{userInitials}</span>
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
        </div>
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-gray-500 truncate">{userEmail}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav ref={desktopNavRef} className={cn('flex-1 overflow-y-auto py-3 [&::-webkit-scrollbar]:hidden', isCollapsed ? 'px-1' : 'px-3')}>
        {allSections.map((section) => (
          <div key={section.label} className={isCollapsed ? 'mb-1' : 'mb-4'}>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItemLink
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  locked={isLocked(item.href)}
                  hasAlert={getAlertBadge(item.href)}
                  collapsed={isCollapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn('border-t border-gray-100 space-y-0.5 flex-shrink-0', isCollapsed ? 'p-1' : 'p-3')}>
        <Link
          href="/nastavitve"
          title={isCollapsed ? 'Nastavitve' : undefined}
          className={cn(
            'group relative flex items-center rounded-lg text-sm transition-colors duration-150',
            isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2',
            isActive('/nastavitve')
              ? 'bg-gray-100 text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          )}
        >
          {!isCollapsed && isActive('/nastavitve') && (
            <motion.span
              layoutId="sidebar-active-bar"
              className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#6D5EF7] rounded-r-full"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
            />
          )}
          <div className="relative flex-shrink-0">
            <Gear
              weight="regular"
              className={cn(
                'w-5 h-5 transition-colors',
                isActive('/nastavitve') ? 'text-[#6D5EF7]' : 'text-gray-400 group-hover:text-gray-700'
              )}
            />
            {any_incomplete && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
            )}
          </div>
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate">Nastavitve</span>
              {any_incomplete && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              )}
            </>
          )}
        </Link>

        <button
          onClick={handleLogout}
          title={isCollapsed ? 'Odjava' : undefined}
          className={cn(
            'w-full flex items-center rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-150',
            isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'
          )}
        >
          <SignOut weight="regular" className="w-5 h-5 text-gray-400" />
          {!isCollapsed && <span>Odjava</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          title={isCollapsed ? 'Razširi' : 'Skrči'}
          className={cn(
            'w-full flex items-center rounded-lg text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors duration-150',
            isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'
          )}
        >
          <CaretLeft
            weight="regular"
            className={cn('w-4 h-4 transition-transform duration-200', isCollapsed && 'rotate-180')}
          />
        </button>
      </div>
    </motion.aside>
  );

  // -------------------------------------------------------------------------
  // Mobile sidebar
  // -------------------------------------------------------------------------

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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
            onClick={close}
          />

          {/* Panel */}
          <motion.aside
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed left-0 top-0 bottom-0 w-72 bg-white border-r border-gray-100 z-50 flex flex-col overflow-hidden shadow-lg md:hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <JedroLogo size={28} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Jedro+</p>
                  <p className="text-xs text-gray-400 truncate">{companyName}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                }}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                type="button"
              >
                <X weight="regular" className="w-5 h-5" />
              </button>
            </div>

            {/* User card */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 flex-shrink-0">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-700">{userInitials}</span>
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                <p className="text-xs text-gray-500 truncate">{userEmail}</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-3 px-3">
              {allSections.map((section) => (
                <div key={section.label} className="mb-4">
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <NavItemLink
                        key={item.href}
                        item={item}
                        active={isActive(item.href)}
                        locked={isLocked(item.href)}
                        hasAlert={getAlertBadge(item.href)}
                        onClick={close}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 space-y-0.5 flex-shrink-0">
              <Link
                href="/nastavitve"
                onClick={close}
                className={cn(
                  'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                  isActive('/nastavitve')
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                {isActive('/nastavitve') && (
                  <motion.span
                    layoutId="sidebar-active-bar-mobile"
                    className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#6D5EF7] rounded-r-full"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                  />
                )}
                <div className="relative flex-shrink-0">
                  <Gear
                    weight="regular"
                    className={cn(
                      'w-5 h-5 transition-colors',
                      isActive('/nastavitve') ? 'text-[#6D5EF7]' : 'text-gray-400 group-hover:text-gray-700'
                    )}
                  />
                  {any_incomplete && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  )}
                </div>
                <span className="flex-1 truncate">Nastavitve</span>
                {any_incomplete && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                )}
              </Link>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-150"
              >
                <SignOut weight="regular" className="w-5 h-5 text-gray-400" />
                <span>Odjava</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  // Spacer for content offset
  const Spacer = (
    <motion.div
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ type: 'spring', damping: 25, stiffness: 280 }}
      className="hidden md:block flex-shrink-0"
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
