'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname, Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import {
  List,
  X,
  MagnifyingGlass,
  Bell,
  Gear,
  CaretRight,
  User,
  SignOut,
  CaretDown,
  Command,
  Package,
  Compass,
} from '@phosphor-icons/react';
import { useSidebar } from './sidebar-context';
import { useAuth } from '@/app/auth-context';
import { useCompany } from '@/app/company-context';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useOptionalTour } from '@/components/guide/TourProvider';
import { useRolePermissions } from '@/app/role-permission-context';

// ============================================================================
// Types
// ============================================================================

interface BreadcrumbItem {
  label: string;
  href?: string;
}

// ============================================================================
// Route to breadcrumb mapping
// ============================================================================

function getBreadcrumbs(pathname: string, labels: Record<string, string>): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = labels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
    breadcrumbs.push({ label, href: currentPath });
  }
  return breadcrumbs;
}

// ============================================================================
// Utility
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Component
// ============================================================================

export function AppBar() {
  const pathname = usePathname();
  const tour = useOptionalTour();
  const { role } = useRolePermissions();
  const t = useTranslations('layout');
  const { toggle, isMobile, isOpen, isCollapsed, openSearch, notificationCount } = useSidebar();
  const { user, signOut } = useAuth();
  const { companySettings, switchCompany } = useCompany();

  const leftOffset = isMobile ? 0 : isCollapsed ? 64 : 240;

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const routeLabels = useMemo<Record<string, string>>(() => ({
    '/dashboard': t('appbar.breadcrumbs.dashboard'),
    '/koledar': t('appbar.breadcrumbs.calendar'),
    '/termini': t('appbar.breadcrumbs.appointments'),
    '/clients': t('appbar.breadcrumbs.clients'),
    '/services': t('appbar.breadcrumbs.services'),
    '/storitve': t('appbar.breadcrumbs.services'),
    '/resursi': t('appbar.breadcrumbs.resources'),
    '/promotions': t('appbar.breadcrumbs.promotions'),
    '/komunikacija': t('appbar.breadcrumbs.communication'),
    '/receptionist-plus': t('appbar.breadcrumbs.receptionistPlus'),
    '/qr-koda': t('appbar.breadcrumbs.qrCode'),
    '/promotions/discounts': t('appbar.breadcrumbs.discounts'),
    '/promotions/happy-hours': t('appbar.breadcrumbs.happyHours'),
    '/promotions/add-ons': t('appbar.breadcrumbs.serviceAddOns'),
    '/rezervacije/zahteve': t('appbar.breadcrumbs.requests'),
    '/nastavitve/paketi': t('appbar.breadcrumbs.plans'),
    '/nastavitve/addoni': t('appbar.breadcrumbs.addons'),
    '/nastavitve/clani': t('appbar.breadcrumbs.team'),
    '/nastavitve/podjetje': t('appbar.breadcrumbs.company'),
    '/nastavitve/splosno': t('appbar.breadcrumbs.general'),
    '/nastavitve/sporocila': t('appbar.breadcrumbs.messages'),
    '/nastavitve/zgodovina': t('appbar.breadcrumbs.history'),
    '/staff': t('appbar.breadcrumbs.staff'),
    '/reminders': t('appbar.breadcrumbs.reminders'),
    '/lost-leads': t('appbar.breadcrumbs.lostLeads'),
    '/analytics': t('appbar.breadcrumbs.analytics'),
    '/asistent': t('appbar.breadcrumbs.asistent'),
    '/chatbot-plus': t('appbar.breadcrumbs.chatbotPlus'),
    '/nastavitve': t('appbar.breadcrumbs.settings'),
    '/billing': t('appbar.breadcrumbs.billing'),
    '/obvestila': t('appbar.breadcrumbs.notifications'),
    '/rezervacije': t('appbar.breadcrumbs.reservations'),
  }), [t]);

  const breadcrumbs = getBreadcrumbs(pathname, routeLabels);

  // User info
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
  // Click outside to close profile dropdown
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleLogout = async () => {
    setIsProfileOpen(false);
    await signOut?.();
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <header
      style={{ left: leftOffset }}
      className="glass-bar hairline-b fixed top-0 right-0 z-50 h-14 transition-all duration-300"
    >
      <div className="h-full px-4 md:px-5 flex items-center justify-between gap-4">

        {/* Left: hamburger (mobile) + logo text (mobile) + breadcrumbs (desktop) */}
        <div className="flex items-center gap-2 min-w-0 flex-1">

          {/* Hamburger — mobile only */}
          <button
            onClick={toggle}
            className="md:hidden -ml-1.5 flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
            aria-label={isOpen ? t('appbar.aria.closeMenu') : t('appbar.aria.openMenu')}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isOpen ? (
                <motion.span
                  key="close"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.12 }}
                  className="block"
                >
                  <X weight="regular" className="w-5 h-5" />
                </motion.span>
              ) : (
                <motion.span
                  key="open"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.12 }}
                  className="block"
                >
                  <List weight="regular" className="w-5 h-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Brand name — mobile only */}
          <Link href="/dashboard" className="md:hidden flex items-center">
            <span className="bg-gradient-to-r from-[#7B4BEA] via-[#4C74E0] to-[#35D2D2] bg-clip-text text-lg font-bold text-transparent">Jedro+</span>
          </Link>

          {/* Breadcrumbs — desktop only */}
          <nav className="hidden md:flex items-center gap-1.5 min-w-0 text-sm" aria-label="Breadcrumb">
            <Link
              href="/dashboard"
              className="text-gray-400 hover:text-gray-700 transition-colors font-medium"
            >
              {t('appbar.home')}
            </Link>

            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href || index} className="flex min-w-0 items-center gap-1.5">
                <CaretRight weight="regular" className="w-3 h-3 text-gray-300 flex-shrink-0" />
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-gray-900 truncate">{crumb.label}</span>
                ) : (
                  <Link
                    href={crumb.href || '#'}
                    className="text-gray-400 hover:text-gray-700 transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Right: search, bell, settings, profile */}
        <div className="flex flex-shrink-0 items-center gap-1">

          {/* Search bar — desktop */}
          <button
            onClick={openSearch}
            className="group mr-1.5 hidden items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-sm transition-colors hover:bg-gray-100 md:flex"
          >
            <MagnifyingGlass weight="regular" className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0 transition-colors" />
            <span className="hidden min-w-[132px] text-left text-gray-500 transition-colors group-hover:text-gray-700 lg:inline">
              {t('appbar.search')}
            </span>
            <kbd className="ml-1 flex items-center gap-0.5 rounded border border-gray-200 bg-white/70 px-1 py-px font-sans text-[10px] text-gray-400">
              <Command weight="regular" className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          {/* Search icon — mobile */}
          <button
            onClick={openSearch}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 md:hidden"
            aria-label={t('appbar.aria.search')}
          >
            <MagnifyingGlass weight="regular" className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <Link href="/obvestila">
            <span className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200">
              <Bell weight="regular" className="w-5 h-5" />
              {notificationCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="tnum absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white ring-2 ring-white"
                >
                  {notificationCount > 99 ? '99+' : notificationCount}
                </motion.span>
              )}
            </span>
          </Link>

          {/* Settings — desktop only */}
          <Link href="/nastavitve" className="hidden md:flex">
            <span className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200">
              <Gear weight="regular" className="w-5 h-5" />
            </span>
          </Link>

          {/* Profile */}
          <div ref={profileRef} className="relative ml-1">
            <button
              data-tour="user-menu"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-gray-100 active:bg-gray-200"
            >
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-[11px] font-medium text-gray-700">{userInitials}</span>
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[96px] truncate">
                {userName}
              </span>
              <CaretDown
                weight="regular"
                className={cn(
                  'hidden md:block w-3.5 h-3.5 text-gray-400 transition-transform duration-150',
                  isProfileOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                  style={{ transformOrigin: 'top right' }}
                  className="absolute right-0 top-full mt-1.5 w-60 overflow-hidden rounded-xl border border-gray-100 bg-white/85 shadow-lg backdrop-blur-xl backdrop-saturate-150"
                >
                  {/* User header */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-gray-700">{userInitials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                        <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="py-1">
                    <Link
                      href="/nastavitve"
                      onClick={() => setIsProfileOpen(false)}
                      className="mx-1 flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    >
                      <User weight="regular" className="w-4 h-4" />
                      <span>{t('appbar.profile')}</span>
                    </Link>
                    <Link
                      href="/nastavitve/paketi"
                      onClick={() => setIsProfileOpen(false)}
                      className="mx-1 flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    >
                      <Package weight="regular" className="w-4 h-4" />
                      <span>{t('appbar.plans')}</span>
                    </Link>
                    {tour && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          tour.startTour(pathname.includes('/koledar') ? 'calendar' : role === 'staff' ? 'staff' : 'dashboard');
                        }}
                        className="mx-1 flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
                      >
                        <Compass weight="regular" className="w-4 h-4" />
                        <span>{t('guide.menuItem')}</span>
                      </button>
                    )}
                  </div>

                  {/* Language switcher */}
                  <div className="border-t border-gray-100 my-1" />
                  <LanguageSwitcher />
                  <div className="border-t border-gray-100 my-1" />

                  {/* Logout */}
                  <div className="border-t border-gray-100 py-1">
                    <button
                      onClick={handleLogout}
                      className="mx-1 flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    >
                      <SignOut weight="regular" className="w-4 h-4" />
                      <span>{t('appbar.signOut')}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
