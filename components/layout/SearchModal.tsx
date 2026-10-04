'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import {
  MagnifyingGlass,
  X,
  ArrowRight,
  ChartBar,
  CalendarBlank,
  Users,
  ClipboardText,
  Briefcase,
  UserCircle,
  TrendDown,
  ChartLine,
  Gear,
  Bell,
  Sparkle,
  Command,
  Clock,
  CalendarCheck,
  CreditCard,
  PuzzlePiece,
  UsersThree,
  Buildings,
} from '@phosphor-icons/react';
import { useSidebar } from './sidebar-context';

// ============================================================================
// Types
// ============================================================================

interface SearchItem {
  id: string;
  name: string;
  href: string;
  icon: React.ElementType;
  category: string;
  keywords?: string[];
}

// searchItems are built inside the component to support translations

// ============================================================================
// Utility
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Component
// ============================================================================

export function SearchModal() {
  const router = useRouter();
  const t = useTranslations('layout');
  const { isSearchOpen, closeSearch } = useSidebar();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const searchItems = useMemo<SearchItem[]>(() => [
    // Pages
    { id: 'dashboard', name: t('sidebar.items.dashboard'), href: '/dashboard', icon: ChartBar, category: t('search.categories.pages'), keywords: ['pregled', 'home', 'domov'] },
    { id: 'koledar', name: t('sidebar.items.calendar'), href: '/koledar', icon: CalendarBlank, category: t('search.categories.pages'), keywords: ['calendar', 'schedule', 'urnik'] },
    { id: 'termini', name: t('sidebar.items.appointments'), href: '/termini', icon: ClipboardText, category: t('search.categories.pages'), keywords: ['appointments', 'booking', 'rezervacije'] },
    { id: 'clients', name: t('sidebar.items.clients'), href: '/clients', icon: Users, category: t('search.categories.pages'), keywords: ['customers', 'clients', 'uporabniki'] },
    { id: 'services', name: t('sidebar.items.services'), href: '/storitve', icon: Briefcase, category: t('search.categories.pages'), keywords: ['services', 'offerings'] },
    { id: 'staff', name: t('sidebar.items.staff'), href: '/staff', icon: UserCircle, category: t('search.categories.pages'), keywords: ['employees', 'team', 'zaposleni'] },
    { id: 'reminders', name: t('sidebar.items.reminders'), href: '/reminders', icon: Bell, category: t('search.categories.pages'), keywords: ['notifications', 'alerts', 'obvestila'] },
    { id: 'lost-leads', name: t('sidebar.items.lostLeads'), href: '/lost-leads', icon: TrendDown, category: t('search.categories.pages'), keywords: ['leads', 'izgubljeni', 'lost leads'] },
    { id: 'analytics', name: t('sidebar.items.analytics'), href: '/analytics', icon: ChartLine, category: t('search.categories.pages'), keywords: ['reports', 'statistics', 'poročila'] },
    // Asistent+ - začasno skrito: { id: 'asistent', name: 'Asistent+', href: '/asistent', icon: Sparkle, category: t('search.categories.pages'), keywords: ['ai', 'assistant', 'help'] },
    { id: 'nastavitve', name: t('sidebar.items.settings'), href: '/nastavitve', icon: Gear, category: t('search.categories.pages'), keywords: ['settings', 'preferences', 'config'] },
    { id: 'rezervacije', name: t('sidebar.items.reservations'), href: '/rezervacije', icon: CalendarCheck, category: t('search.categories.pages'), keywords: ['booking', 'online', 'spletno naročanje', 'povezava'] },
    { id: 'paketi', name: t('search.items.plans'), href: '/nastavitve/paketi', icon: CreditCard, category: t('search.categories.settings'), keywords: ['plan', 'naročnina', 'subscription', 'plačilo', 'račun', 'billing', 'cena'] },
    { id: 'addoni', name: t('search.items.addons'), href: '/nastavitve/addoni', icon: PuzzlePiece, category: t('search.categories.settings'), keywords: ['sms', 'dodatki', 'add-on', 'prijave', 'seats'] },
    { id: 'clani', name: t('search.items.team'), href: '/nastavitve/clani', icon: UsersThree, category: t('search.categories.settings'), keywords: ['povabi', 'invite', 'ekipa', 'team', 'dostop', 'pravice', 'permissions'] },
    { id: 'podjetje', name: t('search.items.company'), href: '/nastavitve/podjetje', icon: Buildings, category: t('search.categories.settings'), keywords: ['company', 'naslov', 'delovni čas', 'opening hours', 'logo'] },

    // Quick actions
    { id: 'new-booking', name: t('sidebar.items.newAppointment'), href: '/koledar?action=new', icon: CalendarBlank, category: t('search.categories.quickActions'), keywords: ['new', 'booking', 'nova rezervacija'] },
    { id: 'new-client', name: t('sidebar.items.newClient'), href: '/clients?action=new', icon: Users, category: t('search.categories.quickActions'), keywords: ['new', 'client', 'nov uporabnik'] },
    { id: 'new-service', name: t('sidebar.items.newService'), href: '/storitve?action=new', icon: Briefcase, category: t('search.categories.quickActions'), keywords: ['new', 'service'] },
  ], [t]);

  // -------------------------------------------------------------------------
  // Load recent searches from localStorage
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jedroplus-recent-searches');
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  // -------------------------------------------------------------------------
  // Focus input when modal opens
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isSearchOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isSearchOpen]);

  // -------------------------------------------------------------------------
  // Filter results
  // -------------------------------------------------------------------------

  const filteredItems = useMemo(() => {
    if (!query.trim()) return searchItems;

    const lowerQuery = query.toLowerCase();
    return searchItems.filter((item) => {
      if (item.name.toLowerCase().includes(lowerQuery)) return true;
      if (item.category.toLowerCase().includes(lowerQuery)) return true;
      if (item.keywords?.some((kw) => kw.toLowerCase().includes(lowerQuery))) return true;
      return false;
    });
  }, [query]);

  // Group by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};
    for (const item of filteredItems) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    }
    return groups;
  }, [filteredItems]);

  const flatItems = useMemo(() => filteredItems, [filteredItems]);

  // -------------------------------------------------------------------------
  // Keyboard navigation
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isSearchOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatItems[selectedIndex]) {
            handleSelect(flatItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          closeSearch();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, selectedIndex, flatItems, closeSearch]);

  // -------------------------------------------------------------------------
  // Scroll selected item into view
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // -------------------------------------------------------------------------
  // Handle selection
  // -------------------------------------------------------------------------

  const handleSelect = (item: SearchItem) => {
    // Save to recent searches
    if (query.trim()) {
      const newRecent = [query, ...recentSearches.filter((s) => s !== query)].slice(0, 5);
      setRecentSearches(newRecent);
      localStorage.setItem('jedroplus-recent-searches', JSON.stringify(newRecent));
    }

    closeSearch();
    router.push(item.href);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
            onClick={closeSearch}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-[15%] -translate-x-1/2 w-full max-w-xl z-[61] px-4"
          >
            <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white/90 shadow-[0_30px_80px_-20px_rgba(15,15,40,0.45)] backdrop-blur-2xl">
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-gray-200/70 px-4 py-3.5">
                <MagnifyingGlass className="h-5 w-5 flex-shrink-0 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder={t('search.placeholder')}
                  className="flex-1 bg-transparent text-[17px] text-gray-900 outline-none placeholder:text-gray-400"
                />
                <div className="hidden items-center gap-1 text-xs text-gray-400 sm:flex">
                  <span className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500">ESC</span>
                  <span>{t('search.escHint')}</span>
                </div>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[min(400px,60dvh)] overflow-y-auto p-2">
                {flatItems.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <MagnifyingGlass className="mx-auto mb-3 h-9 w-9 text-gray-300" />
                    <p className="text-sm">{t('search.empty', { query })}</p>
                  </div>
                ) : (
                  Object.entries(groupedItems).map(([category, items]) => (
                    <div key={category} className="mb-3 last:mb-0">
                      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        {category}
                      </div>
                      {items.map((item) => {
                        const globalIndex = flatItems.indexOf(item);
                        const isSelected = globalIndex === selectedIndex;
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.id}
                            data-index={globalIndex}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={cn(
                              'w-full flex items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-colors',
                              isSelected
                                ? 'bg-[#7C78FA] text-white'
                                : 'text-gray-900'
                            )}
                          >
                            <Icon
                              className={cn('h-[18px] w-[18px] flex-shrink-0', isSelected ? 'text-white' : 'text-gray-500')}
                              weight="regular"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium">
                                {item.name}
                              </p>
                            </div>
                            {isSelected && (
                              <ArrowRight className="h-4 w-4 flex-shrink-0 text-white/80" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}

                {/* Recent searches */}
                {!query && recentSearches.length > 0 && (
                  <div className="mt-2 border-t border-gray-200/70 pt-2">
                    <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      <Clock className="w-3 h-3" />
                      {t('search.categories.recent')}
                    </div>
                    {recentSearches.map((search, idx) => (
                      <button
                        key={idx}
                        onClick={() => setQuery(search)}
                        className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-sm text-gray-900 transition-colors hover:bg-black/[0.04]"
                      >
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{search}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="hidden border-t border-gray-200/70 px-4 py-2.5 sm:block">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <span className="rounded-md border border-gray-200 bg-white px-1 py-0.5 text-[10px] font-medium text-gray-500">↑</span>
                      <span className="rounded-md border border-gray-200 bg-white px-1 py-0.5 text-[10px] font-medium text-gray-500">↓</span>
                      <span className="ml-1">{t('search.navHint')}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500">↵</span>
                      <span className="ml-1">{t('search.openHint')}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Command className="w-3 h-3" />
                    <span>{t('search.shortcutHint')}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
