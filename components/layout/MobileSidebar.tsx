'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  X,
  House,
  CalendarBlank,
  ClipboardText,
  Users,
  Briefcase,
  UserCircle,
  ChartLine,
  TrendDown,
  Bell,
  Gear,
  SignOut,
  CaretRight,
  Sparkle,
} from '@phosphor-icons/react';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { fetchAllTableRows, fetchTableRows } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import { detectBookingSchema, pickFirst } from '@/lib/dashboardHelpers';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  group: string;
}

// navItems and groupOrder are built inside the component to support translations

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const pathnameWithoutLocale = pathname.replace(/^\/(sl|en)(?=\/|$)/, '') || '/';
  const router = useRouter();
  const t = useTranslations('layout');
  const { companyId, companySettings } = useCompany();
  const { user, signOut } = useAuth();

  const navItems: NavItem[] = [
    // Glavno
    { name: t('sidebar.items.dashboard'), href: '/dashboard', icon: House, group: 'main' },
    { name: t('sidebar.items.calendar'), href: '/koledar', icon: CalendarBlank, group: 'main' },
    // AI
    // Asistent+ - začasno skrito: { name: 'Asistent+', href: '/asistent', icon: Sparkle, group: 'ai' },
    // Komunikacija
    { name: t('sidebar.items.reminders'), href: '/reminders', icon: Bell, group: 'communication' },
    { name: 'Lost Leads', href: '/lost-leads', icon: TrendDown, group: 'communication' },
    // Moduli
    { name: t('sidebar.items.appointments'), href: '/termini', icon: ClipboardText, group: 'modules' },
    { name: t('sidebar.items.clients'), href: '/clients', icon: Users, group: 'modules' },
    { name: t('sidebar.items.services'), href: '/storitve', icon: Briefcase, group: 'modules' },
    { name: t('sidebar.items.staff'), href: '/staff', icon: UserCircle, group: 'modules' },
    // Analitika
    { name: t('sidebar.items.analytics'), href: '/analytics', icon: ChartLine, group: 'analytics' },
    // Nastavitve
    { name: t('sidebar.items.settings'), href: '/nastavitve', icon: Gear, group: 'settings' },
  ];

  const groupLabels: Record<string, string> = {
    main: t('sidebar.sections.main'),
    ai: t('sidebar.sections.ai'),
    communication: t('sidebar.sections.communication'),
    modules: t('sidebar.sections.modules'),
    analytics: t('sidebar.sections.analytics'),
    settings: t('sidebar.sections.settings'),
  };

  const groupOrder = ['main', 'ai', 'communication', 'modules', 'analytics', 'settings'];

  // Stats state for appointment counts
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  // Fetch appointment stats for the logged-in user
  const fetchUserStats = useCallback(async () => {
    if (!companyId || !user?.email) return;

    setStatsLoading(true);
    try {
      // Fetch staff to find the employee matching user email
      const staffRes = await fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 200);
      const staffRows = staffRes.data ?? [];

      // Find employee with matching email
      let employeeId: string | null = null;
      for (const row of staffRows) {
        const email = String(pickFirst(row, ['Email', 'email', 'e-mail', 'E-mail']) ?? '').toLowerCase();
        if (email === user.email.toLowerCase()) {
          employeeId = String(pickFirst(row, ['id', 'ID osebja', 'ID osebe', 'ID Osebe', 'person_id', 'partner_id']) ?? '');
          break;
        }
      }

      if (!employeeId) {
        setStats({ today: 0, week: 0, month: 0 });
        setStatsLoading(false);
        return;
      }

      // Fetch all bookings
      const bookingsRes = await fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId);
      const bookings = bookingsRes.data ?? [];

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let todayCount = 0;
      let weekCount = 0;
      let monthCount = 0;

      for (const row of bookings) {
        // Check if this booking belongs to the employee
        const bookingEmployeeId = String(pickFirst(row, ['ID osebja', 'ID Osebe', 'ID osebe', 'assigned_person_id', 'oseba_id', 'person_id']) ?? '');
        if (bookingEmployeeId !== employeeId) continue;

        // Parse date
        const schema = detectBookingSchema(row);
        let bookingDate: Date | null = null;

        if (schema.startAtField) {
          const startAt = row[schema.startAtField];
          if (startAt) bookingDate = new Date(String(startAt));
        } else if (schema.dateField) {
          const dateValue = row[schema.dateField];
          if (dateValue) bookingDate = new Date(String(dateValue));
        }

        if (!bookingDate || isNaN(bookingDate.getTime())) continue;

        // Count by period
        if (bookingDate >= todayStart) {
          todayCount++;
        }
        if (bookingDate >= weekStart) {
          weekCount++;
        }
        if (bookingDate >= monthStart) {
          monthCount++;
        }
      }

      setStats({ today: todayCount, week: weekCount, month: monthCount });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [companyId, user?.email]);

  // Fetch stats when sidebar opens
  useEffect(() => {
    if (isOpen) {
      fetchUserStats();
    }
  }, [isOpen, fetchUserStats]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleLogout = async () => {
    onClose();
    await signOut?.();
    router.replace('/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathnameWithoutLocale === '/dashboard' || pathnameWithoutLocale === '/';
    }
    return pathnameWithoutLocale === href || pathnameWithoutLocale.startsWith(`${href}/`);
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('fallbacks.userName');
  const userEmail = user?.email || '';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Group nav items
  const groupedItems = groupOrder.map((group) => ({
    label: groupLabels[group] ?? group,
    items: navItems.filter((item) => item.group === group),
  }));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Sidebar - WHITE THEME */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 h-full w-80 bg-white border-r border-gray-200 z-50 overflow-y-auto flex flex-col shadow-2xl"
          >
            {/* Header - WHITE */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 flex-shrink-0">
              {/* NO J+ logo circle - just text */}
              <span className="text-xl font-bold text-gray-900">
                Jedro+
              </span>

              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-900" weight="bold" />
              </button>
            </div>

            {/* User Card - WHITE */}
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-900 font-bold">{userInitials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 font-semibold truncate">{userName}</div>
                  <div className="text-xs text-gray-600 truncate">{userEmail}</div>
                </div>
              </div>

              {/* Quick Stats - Real data from employee appointments */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-gray-900 font-bold">
                    {statsLoading ? '...' : stats.today}
                  </div>
                  <div className="text-xs text-gray-600">{t('sidebar.stats.today')}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-gray-900 font-bold">
                    {statsLoading ? '...' : stats.week}
                  </div>
                  <div className="text-xs text-gray-600">{t('sidebar.stats.week')}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-gray-900 font-bold">
                    {statsLoading ? '...' : stats.month}
                  </div>
                  <div className="text-xs text-gray-600">{t('sidebar.stats.month')}</div>
                </div>
              </div>
            </div>

            {/* Navigation - WHITE */}
            <nav className="flex-1 p-4 overflow-y-auto">
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
                {groupedItems.map((group) => (
                  <div key={group.label} className="mb-6">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
                      {group.label}
                    </div>

                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      const Icon = item.icon;

                      return (
                        <motion.div
                          key={item.href}
                          variants={{
                            hidden: { opacity: 0, x: -20 },
                            visible: { opacity: 1, x: 0 },
                          }}
                        >
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all',
                              active
                                ? 'bg-gray-100 text-gray-900 font-semibold'
                                : 'text-gray-600 hover:bg-gray-50'
                            )}
                          >
                            <Icon className="w-5 h-5" weight="regular" />
                            <span className="flex-1">{item.name}</span>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </motion.div>
            </nav>

            {/* Footer - NO LOGOUT BUTTON */}
            <div className="p-6 border-t border-gray-200 flex-shrink-0">
              <div className="text-xs text-gray-500">
                Version 1.0.0
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
