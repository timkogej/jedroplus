'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  List,
  X,
  MagnifyingGlass,
  Bell,
  Gear,
  CaretRight,
  User,
  SignOut,
  Briefcase,
  CaretDown,
  Command,
  Package,
} from '@phosphor-icons/react';
import { useSidebar } from './sidebar-context';
import { useAuth } from '@/app/auth-context';
import { useCompany } from '@/app/company-context';

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

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/koledar': 'Koledar',
  '/termini': 'Termini',
  '/clients': 'Stranke',
  '/services': 'Storitve',
  '/staff': 'Osebje',
  '/reminders': 'Opomniki',
  '/lost-leads': 'Lost Leads',
  '/analytics': 'Analitika',
  '/asistent': 'Asistent+',
  '/nastavitve': 'Nastavitve',
  '/billing': 'Paketi',
  '/obvestila': 'Obvestila',
  '/rezervacije': 'Rezervacije',
};

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = routeLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
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
  const { toggle, isMobile, isOpen, isCollapsed, sidebarWidth, openSearch, notificationCount, toggleNotifications } = useSidebar();
  const { user, signOut } = useAuth();
  const { companySettings, switchCompany } = useCompany();

  // Calculate left offset based on sidebar state
  const leftOffset = isMobile ? 0 : (isCollapsed ? 80 : sidebarWidth);

  // Scroll state for enhanced shadow
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const breadcrumbs = getBreadcrumbs(pathname);
  const currentPage = breadcrumbs[breadcrumbs.length - 1]?.label || 'Dashboard';

  // User info
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Uporabnik';
  const userEmail = user?.email || '';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const userRole = companySettings?.['Naziv Podjetja'] || 'Administrator';

  // -------------------------------------------------------------------------
  // Scroll detection
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const handleSwitchCompany = () => {
    setIsProfileOpen(false);
    switchCompany();
  };

  return (
    <header
      style={{ left: leftOffset }}
      className={cn(
        'fixed top-0 right-0 z-50 h-16 transition-all duration-300',
        // White background
        'bg-white',
        'border-b border-gray-200',
        // Enhanced shadow when scrolled
        isScrolled
          ? 'shadow-md'
          : 'shadow-sm'
      )}
    >
      <div className="h-full px-4 md:px-6 flex items-center justify-between gap-4">
        {/* ----------------------------------------------------------------- */}
        {/* Left Section: Menu Button (mobile) + Logo/Breadcrumbs */}
        {/* ----------------------------------------------------------------- */}

        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger menu - mobile only */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggle}
            className="md:hidden p-1 -ml-1 transition-colors"
            aria-label={isOpen ? 'Zapri meni' : 'Odpri meni'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isOpen ? (
                <motion.div
                  key="close"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="w-6 h-6 text-gray-700" weight="bold" />
                </motion.div>
              ) : (
                <motion.div
                  key="open"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.15 }}
                >
                  <List className="w-6 h-6 text-gray-700" weight="bold" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Text only - mobile only (NO LOGO) */}
          <Link
            href="/dashboard"
            className="md:hidden"
          >
            <h1
              className="text-xl font-bold"
              style={{
                background: 'linear-gradient(90deg, #7C75FC 0%, #50C3D2 50%, #44D0C6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Jedro+
            </h1>
          </Link>

          {/* Breadcrumbs - desktop only */}
          <nav className="hidden md:flex items-center gap-2 min-w-0" aria-label="Breadcrumb">
            <Link
              href="/dashboard"
              className="text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium"
            >
              Domov
            </Link>

            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href || index} className="flex items-center gap-2">
                <CaretRight className="w-3 h-3 text-gray-400" weight="bold" />
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href || '#'}
                    className="text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium truncate"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Right Section: Search, Notifications, Settings, Profile */}
        {/* ----------------------------------------------------------------- */}

        <div className="flex items-center gap-2 md:gap-3">
          {/* Search bar - desktop */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openSearch}
            className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all group min-w-[200px]"
          >
            <MagnifyingGlass className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            <span className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors flex-1 text-left">
              Iskanje...
            </span>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </motion.button>

          {/* Search icon - mobile */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openSearch}
            className="md:hidden p-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
            aria-label="Iskanje"
          >
            <MagnifyingGlass className="w-5 h-5 text-gray-600" />
          </motion.button>

          {/* Notifications */}
          <Link href="/obvestila">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative p-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
              aria-label="Obvestila"
            >
              <Bell className="w-5 h-5 text-gray-600" weight="regular" />

              {/* Notification badge - only show when count > 0 */}
              {notificationCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-gradient-to-r from-red-500 to-rose-500 rounded-full shadow-lg"
                >
                  {notificationCount > 99 ? '99+' : notificationCount}
                </motion.span>
              )}
            </motion.div>
          </Link>

          {/* Settings - desktop only */}
          <Link href="/nastavitve">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="hidden md:flex p-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
            >
              <Gear className="w-5 h-5 text-gray-600" />
            </motion.div>
          </Link>

          {/* Profile dropdown */}
          <div ref={profileRef} className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 md:gap-3 p-1.5 md:p-2 md:pr-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all"
            >
              {/* Avatar with gradient border like Sidebar */}
              <div className="relative">
                <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    <span className="text-xs font-semibold text-gray-700">{userInitials}</span>
                  </div>
                </div>
                {/* Online dot */}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
              </div>

              {/* Name and role - desktop only */}
              <div className="hidden md:block text-left min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[100px]">
                  {userName}
                </p>
                <p className="text-[10px] text-gray-500 truncate max-w-[100px]">
                  {userRole}
                </p>
              </div>

              <CaretDown
                className={cn(
                  'hidden md:block w-4 h-4 text-gray-500 transition-transform',
                  isProfileOpen && 'rotate-180'
                )}
              />
            </motion.button>

            {/* Dropdown menu */}
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-64 py-2 rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden"
                >
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 flex-shrink-0">
                        <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                          <span className="text-xs font-semibold text-gray-700">{userInitials}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
                        <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      href="/nastavitve"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>Moj profil</span>
                    </Link>

                    <button
                      onClick={handleSwitchCompany}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <Briefcase className="w-4 h-4" />
                      <span>Zamenjaj podjetje</span>
                    </button>

                    <Link
                      href="/billing"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <Package className="w-4 h-4" />
                      <span>Paketi</span>
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="pt-1 border-t border-gray-100">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <SignOut className="w-4 h-4" />
                      <span>Odjava</span>
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
