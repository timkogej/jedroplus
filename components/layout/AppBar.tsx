'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname } from '@/i18n/navigation';
import Link from 'next/link';
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
} from '@phosphor-icons/react';
import { useSidebar } from './sidebar-context';
import { useAuth } from '@/app/auth-context';
import { useCompany } from '@/app/company-context';
import { LanguageSwitcher } from './LanguageSwitcher';

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
      className="fixed top-0 right-0 z-50 h-14 bg-white border-b border-gray-100 transition-all duration-300"
    >
      <div className="h-full px-4 md:px-5 flex items-center justify-between gap-4">

        {/* Left: hamburger (mobile) + logo text (mobile) + breadcrumbs (desktop) */}
        <div className="flex items-center gap-2 min-w-0">

          {/* Hamburger — mobile only */}
          <button
            onClick={toggle}
            className="md:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
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
              <div key={crumb.href || index} className="flex items-center gap-1.5">
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
        <div className="flex items-center gap-1">

          {/* Search bar — desktop */}
          <button
            onClick={openSearch}
            className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-colors group text-sm mr-1"
          >
            <MagnifyingGlass weight="regular" className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0 transition-colors" />
            <span className="text-gray-400 group-hover:text-gray-600 transition-colors min-w-[120px] text-left">
              {t('appbar.search')}
            </span>
            <span className="flex items-center gap-0.5 text-[11px] text-gray-300 ml-1">
              <Command weight="regular" className="w-3 h-3" />
              K
            </span>
          </button>

          {/* Search icon — mobile */}
          <button
            onClick={openSearch}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            aria-label={t('appbar.aria.search')}
          >
            <MagnifyingGlass weight="regular" className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <Link href="/obvestila">
            <span className="relative flex p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer">
              <Bell weight="regular" className="w-5 h-5" />
              {notificationCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] font-semibold text-white bg-red-500 rounded-full"
                >
                  {notificationCount > 99 ? '99+' : notificationCount}
                </motion.span>
              )}
            </span>
          </Link>

          {/* Settings — desktop only */}
          <Link href="/nastavitve" className="hidden md:flex">
            <span className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer">
              <Gear weight="regular" className="w-5 h-5" />
            </span>
          </Link>

          {/* Profile */}
          <div ref={profileRef} className="relative ml-1">
            <button
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
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
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden"
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
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <User weight="regular" className="w-4 h-4" />
                      <span>{t('appbar.profile')}</span>
                    </Link>
                    <Link
                      href="/nastavitve/paketi"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <Package weight="regular" className="w-4 h-4" />
                      <span>{t('appbar.plans')}</span>
                    </Link>
                  </div>

                  {/* Language switcher */}
                  <div className="border-t border-gray-100 my-1" />
                  <LanguageSwitcher />
                  <div className="border-t border-gray-100 my-1" />

                  {/* Logout */}
                  <div className="border-t border-gray-100 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
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
