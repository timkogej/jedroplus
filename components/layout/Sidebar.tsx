'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  Lock,
  Tag,
  CaretLeft,
  CaretDown,
  Cube,
  Phone,
} from '@phosphor-icons/react';
import { useSidebar } from './sidebar-context';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { hasAccessToRoute } from '@/lib/planAccess';
import { useBillingUsage } from '@/hooks/useBillingUsage';
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

type T = ReturnType<typeof useTranslations<'layout'>>;

function buildNavigationSectionsPaid(t: T): NavSection[] {
  return [
    {
      label: t('sidebar.sections.main'),
      items: [
        { name: t('sidebar.items.dashboard'), href: '/dashboard', icon: ChartBar },
        { name: t('sidebar.items.calendar'), href: '/koledar', icon: CalendarBlank },
        { name: t('sidebar.items.appointments'), href: '/termini', icon: ClipboardText },
        { name: t('sidebar.items.clients'), href: '/clients', icon: Users },
      ],
    },
    {
      label: t('sidebar.sections.communication'),
      items: [
        { name: t('sidebar.items.communication'), href: '/komunikacija', icon: Envelope },
        { name: t('sidebar.items.reminders'), href: '/reminders', icon: Bell },
        { name: t('sidebar.items.reservations'), href: '/rezervacije', icon: CalendarCheck },
        { name: t('sidebar.items.lostLeads'), href: '/lost-leads', icon: TrendDown },
      ],
    },
    {
      label: t('sidebar.sections.ai'),
      items: [
        { name: t('sidebar.items.receptionistPlus'), href: '/receptionist-plus', icon: Phone },
        // Asistent+ - začasno skrito, logika ohranjena v /asistent
        // { name: 'Asistent+', href: '/asistent', icon: Robot, badge: 'new' },
        // Chatbot+ - začasno skrito, bo dodano kasneje
        // { name: 'Chatbot+', href: '/chatbot-plus', icon: ChatCircleDots, badge: 'new' },
      ],
    },
    {
      label: t('sidebar.sections.modules'),
      items: [
        { name: t('sidebar.items.services'), href: '/storitve', icon: Briefcase },
        { name: t('sidebar.items.resources'), href: '/resursi', icon: Cube },
        { name: t('sidebar.items.staff'), href: '/staff', icon: UserCircle },
      ],
    },
    {
      label: t('sidebar.sections.promotions'),
      items: [
        { name: t('sidebar.items.promotions'), href: '/promotions', icon: Tag },
      ],
    },
    {
      label: t('sidebar.sections.analytics'),
      items: [
        { name: t('sidebar.items.analytics'), href: '/analytics', icon: ChartLine },
      ],
    },
  ];
}

function buildNavigationSectionsFree(t: T): NavSection[] {
  return [
    {
      label: t('sidebar.sections.main'),
      items: [
        { name: t('sidebar.items.dashboard'), href: '/dashboard', icon: ChartBar },
        { name: t('sidebar.items.calendar'), href: '/koledar', icon: CalendarBlank },
        { name: t('sidebar.items.appointments'), href: '/termini', icon: ClipboardText },
        { name: t('sidebar.items.clients'), href: '/clients', icon: Users },
      ],
    },
    {
      label: t('sidebar.sections.modules'),
      items: [
        { name: t('sidebar.items.services'), href: '/storitve', icon: Briefcase },
        { name: t('sidebar.items.resources'), href: '/resursi', icon: Cube },
        { name: t('sidebar.items.staff'), href: '/staff', icon: UserCircle },
      ],
    },
    {
      label: t('sidebar.sections.promotions'),
      items: [
        { name: t('sidebar.items.promotions'), href: '/promotions', icon: Tag },
      ],
    },
    {
      label: t('sidebar.sections.communication'),
      items: [
        { name: t('sidebar.items.communication'), href: '/komunikacija', icon: Envelope },
        { name: t('sidebar.items.reminders'), href: '/reminders', icon: Bell },
        { name: t('sidebar.items.reservations'), href: '/rezervacije', icon: CalendarCheck },
        { name: t('sidebar.items.lostLeads'), href: '/lost-leads', icon: TrendDown },
      ],
    },
    {
      label: t('sidebar.sections.ai'),
      items: [
        { name: t('sidebar.items.receptionistPlus'), href: '/receptionist-plus', icon: Phone },
      ],
    },
    {
      label: t('sidebar.sections.analytics'),
      items: [
        { name: t('sidebar.items.analytics'), href: '/analytics', icon: ChartLine },
      ],
    },
  ];
}

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
  const t = useTranslations('layout');
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-active={active ? 'true' : undefined}
      data-tour={`nav-${item.href.replace(/^\//, '')}`}
      onClick={onClick}
      title={collapsed ? item.name : undefined}
      className={cn(
        'group relative flex items-center rounded-md text-sm transition-colors duration-150 max-md:rounded-lg max-md:text-[16px]',
        collapsed ? 'justify-center py-2' : 'gap-2.5 px-2 py-1.5 max-md:gap-3 max-md:px-2.5 max-md:py-2.5',
        active
          ? 'font-medium text-gray-900'
          : 'text-gray-700 hover:bg-gray-100/70',
        locked && 'opacity-40'
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-fill"
          className="absolute inset-0 -z-10 rounded-md bg-gray-100 max-md:rounded-lg"
          transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        />
      )}

      <div className="relative flex-shrink-0">
        <Icon
          weight="regular"
          className={cn(
            'h-[18px] w-[18px] transition-colors max-md:h-5 max-md:w-5',
            active ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'
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
          ) : item.badge === 'new' ? (
            <span className="ml-auto rounded-full bg-[#6D5EF7]/10 px-1.5 py-px text-[10px] font-medium tracking-normal text-[#6D5EF7]">
              {t('sidebar.items.new')}
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
  const pathnameWithoutLocale = pathname.replace(/^\/(sl|en)(?=\/|$)/, '') || '/';
  const router = useRouter();
  const desktopNavRef = useRef<HTMLElement>(null);
  const t = useTranslations('layout');

  const { isOpen, isMobile, close, isCollapsed, toggleCollapse } = useSidebar();

  const { companySettings } = useCompany();
  const { user, signOut } = useAuth();
  const { planCode } = useCompanyPlan();
  const { role, permissions } = useRolePermissions();

  const isFree = planCode === 'FREE';
  const baseNavigationSections = isFree ? buildNavigationSectionsFree(t) : buildNavigationSectionsPaid(t);

  // Free accounts with a one-time reminder quota can open Opomniki.
  const { usage: billingUsage } = useBillingUsage();
  const freeReminderTrial =
    isFree && Boolean(billingUsage && (billingUsage.sms.total > 0 || billingUsage.email.total > 0));
  const isLocked = (href: string) =>
    !(hasAccessToRoute(href, planCode) || (href === '/reminders' && freeReminderTrial));

  // ── Incomplete settings alerts ─────────────────────────────────────────────
  const hasOpomnikiPlan = planCode === 'JEDRO_PLUS' || planCode === 'JEDRO_PRO' || planCode === 'JEDRO_PREMIUM';
  const hasChatbotPlan = planCode === 'JEDRO_PRO' || planCode === 'JEDRO_PREMIUM';

  const opomniki_incomplete = hasOpomnikiPlan && (
    !String(companySettings?.['from_name'] ?? companySettings?.['From_name'] ?? '').trim() ||
    !String(companySettings?.['reply_to'] ?? companySettings?.['reply_to_email'] ?? '').trim()
  );
  const bookingEnabledValue = companySettings?.['booking_omogocen'] ?? companySettings?.['Booking_omogocen'];
  const bookingEnabled = bookingEnabledValue !== false && bookingEnabledValue !== 'false';
  const hasAnyBookingLink = [
    'booking_link_1',
    'Booking_link_1',
    'booking_link_2',
    'Booking_link_2',
    'booking_link_3',
    'Booking_link_3',
    'booking_link_4',
    'Booking_link_4',
    'booking_link_5',
    'Booking_link_5',
    'booking_link_6',
    'Booking_link_6',
  ].some((key) => String(companySettings?.[key] ?? '').trim());
  const rezervacije_incomplete =
    hasOpomnikiPlan && bookingEnabled && hasAnyBookingLink && !String(companySettings?.['main_booking_link'] ?? '').trim();
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
      return true;
    }

    if (role === 'staff') {
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

  // User info
  const companyName = String(companySettings?.['Naziv Podjetja'] || companySettings?.['ID Podjetja'] || t('fallbacks.companyName'));
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('fallbacks.userName');
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
        // Center it so the scroll fades never cover the current page.
        const top = activeEl.offsetTop - desktopNav.clientHeight / 2 + activeEl.clientHeight / 2;
        if (top > 0 && desktopNav.scrollHeight > desktopNav.clientHeight) desktopNav.scrollTop = top;
      }
    });
  }, [pathnameWithoutLocale]);

  // -------------------------------------------------------------------------
  // On short screens the menu scrolls; fade the edges so it's clear there is
  // more above/below (the scrollbar itself is hidden).
  // -------------------------------------------------------------------------

  const [navOverflow, setNavOverflow] = useState({ above: false, below: false });

  useEffect(() => {
    const nav = desktopNavRef.current;
    if (!nav) return;
    const update = () => {
      const above = nav.scrollTop > 4;
      const below = nav.scrollTop + nav.clientHeight < nav.scrollHeight - 4;
      setNavOverflow((prev) => (prev.above === above && prev.below === below ? prev : { above, below }));
    };
    update();
    nav.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => {
      nav.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [isCollapsed]);

  // -------------------------------------------------------------------------
  // Active route check
  // -------------------------------------------------------------------------

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathnameWithoutLocale === '/dashboard' || pathnameWithoutLocale === '/';
    }
    return pathnameWithoutLocale === href || pathnameWithoutLocale.startsWith(`${href}/`);
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

  const allSections = navigationSections;

  // -------------------------------------------------------------------------
  // Desktop sidebar
  // -------------------------------------------------------------------------

  const DesktopSidebar = (
    <motion.aside
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ type: 'spring', damping: 25, stiffness: 280 }}
      className="hairline-r fixed bottom-0 left-0 top-0 z-40 hidden flex-col overflow-hidden bg-white md:flex"
    >
      {/* Header */}
      <div className={cn(
        'flex items-center hairline-b flex-shrink-0',
        isCollapsed ? 'justify-center p-4' : 'gap-3 p-5'
      )}>
        <img src="/icon.png" alt="Jedro+" width={28} height={28} className="flex-shrink-0 rounded-md" />
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="truncate bg-gradient-to-r from-[#7B4BEA] via-[#4C74E0] to-[#35D2D2] bg-clip-text text-lg font-bold text-transparent">Jedro+</p>
            <p className="text-xs text-gray-400 truncate">{companyName}</p>
          </div>
        )}
      </div>

      {/* User card */}
      <div className={cn(
        'flex items-center hairline-b flex-shrink-0',
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
      <div className="relative flex min-h-0 flex-1 flex-col">
      {navOverflow.above && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-white to-transparent" aria-hidden="true" />
      )}
      <nav ref={desktopNavRef} className={cn('flex-1 overflow-y-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', isCollapsed ? 'px-1' : 'px-3')}>
        {allSections.map((section) => (
          <div key={section.label} className={isCollapsed ? 'mb-1' : 'mb-4'}>
            {!isCollapsed && (
              <h3 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.04em] text-gray-400">
                {section.label}
              </h3>
            )}
            <div className="space-y-px">
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
      {navOverflow.below && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-10 items-end justify-center bg-gradient-to-t from-white via-white/80 to-transparent pb-1" aria-hidden="true">
          <CaretDown className="h-3.5 w-3.5 text-gray-400" weight="bold" />
        </div>
      )}
      </div>

      {/* Footer */}
      <div className={cn('hairline-t flex-shrink-0 space-y-px', isCollapsed ? 'p-1' : 'p-3')}>
        <Link
          href="/nastavitve"
          data-tour="nav-nastavitve"
          title={isCollapsed ? t('sidebar.items.settings') : undefined}
          className={cn(
            'group relative flex items-center rounded-md text-sm transition-colors duration-150',
            isCollapsed ? 'justify-center py-2' : 'gap-2.5 px-2 py-1.5',
            isActive('/nastavitve')
              ? 'font-medium text-gray-900'
              : 'text-gray-700 hover:bg-gray-100/70'
          )}
        >
          {isActive('/nastavitve') && (
            <motion.span
              layoutId="sidebar-active-fill"
              className="absolute inset-0 -z-10 rounded-md bg-gray-100"
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            />
          )}
          <div className="relative flex-shrink-0">
            <Gear
              weight="regular"
              className={cn(
                'h-[18px] w-[18px] transition-colors',
                isActive('/nastavitve') ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'
              )}
            />
            {any_incomplete && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
            )}
          </div>
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate">{t('sidebar.items.settings')}</span>
              {any_incomplete && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              )}
            </>
          )}
        </Link>

        <button
          onClick={handleLogout}
          title={isCollapsed ? t('sidebar.items.signOut') : undefined}
          className={cn(
            'flex w-full items-center rounded-md text-sm text-gray-700 transition-colors duration-150 hover:bg-gray-100/70 hover:text-gray-900',
            isCollapsed ? 'justify-center py-2' : 'gap-2.5 px-2 py-1.5'
          )}
        >
          <SignOut weight="regular" className="h-[18px] w-[18px] text-gray-500" />
          {!isCollapsed && <span>{t('sidebar.items.signOut')}</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          title={isCollapsed ? t('sidebar.tooltips.expand') : t('sidebar.tooltips.collapse')}
          className={cn(
            'flex w-full items-center rounded-md text-sm text-gray-400 transition-colors duration-150 hover:bg-gray-100/70 hover:text-gray-700',
            isCollapsed ? 'justify-center py-2' : 'gap-2.5 px-2 py-1.5'
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
            className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm md:hidden"
            onClick={close}
          />

          {/* Panel */}
          <motion.aside
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="hairline-r fixed bottom-0 left-0 top-0 z-[56] flex w-[min(320px,86vw)] flex-col overflow-hidden bg-white shadow-xl md:hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 hairline-b flex-shrink-0">
              <div className="flex items-center gap-3">
                <img src="/icon.png" alt="Jedro+" width={28} height={28} className="flex-shrink-0 rounded-md" />
                <div className="flex-1 min-w-0">
                  <p className="bg-gradient-to-r from-[#7B4BEA] via-[#4C74E0] to-[#35D2D2] bg-clip-text text-lg font-bold text-transparent">Jedro+</p>
                  <p className="truncate text-[13px] text-gray-400">{companyName}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                }}
                className="-mr-1.5 flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                type="button"
              >
                <X weight="regular" className="w-5 h-5" />
              </button>
            </div>

            {/* User card */}
            <div className="flex items-center gap-3 px-4 py-3.5 hairline-b flex-shrink-0">
              <div className="relative flex-shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <span className="text-sm font-medium text-gray-700">{userInitials}</span>
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[16px] font-medium text-gray-900">{userName}</p>
                <p className="truncate text-[13px] text-gray-500">{userEmail}</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-3 px-3">
              {allSections.map((section) => (
                <div key={section.label} className="mb-4">
                  <h3 className="px-2.5 pb-1 pt-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-gray-400">
                    {section.label}
                  </h3>
                  <div className="space-y-px">
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
            <div className="hairline-t flex-shrink-0 space-y-px p-4">
              <Link
                href="/nastavitve"
                onClick={close}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-[16px] transition-colors duration-150',
                  isActive('/nastavitve')
                    ? 'font-medium text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100/70'
                )}
              >
                {isActive('/nastavitve') && (
                  <motion.span
                    layoutId="sidebar-active-fill-mobile"
                    className="absolute inset-0 -z-10 rounded-lg bg-gray-100"
                    transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                  />
                )}
                <div className="relative flex-shrink-0">
                  <Gear
                    weight="regular"
                    className={cn(
                      'h-5 w-5 transition-colors',
                      isActive('/nastavitve') ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'
                    )}
                  />
                  {any_incomplete && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  )}
                </div>
                <span className="flex-1 truncate">{t('sidebar.items.settings')}</span>
                {any_incomplete && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                )}
              </Link>

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-[16px] text-gray-700 transition-colors duration-150 hover:bg-gray-100/70 hover:text-gray-900"
              >
                <SignOut weight="regular" className="h-5 w-5 text-gray-500" />
                <span>{t('sidebar.items.signOut')}</span>
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
