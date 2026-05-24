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
    { id: 'services', name: t('sidebar.items.services'), href: '/services', icon: Briefcase, category: t('search.categories.pages'), keywords: ['services', 'offerings'] },
    { id: 'staff', name: t('sidebar.items.staff'), href: '/staff', icon: UserCircle, category: t('search.categories.pages'), keywords: ['employees', 'team', 'zaposleni'] },
    { id: 'reminders', name: t('sidebar.items.reminders'), href: '/reminders', icon: Bell, category: t('search.categories.pages'), keywords: ['notifications', 'alerts', 'obvestila'] },
    { id: 'lost-leads', name: 'Lost Leads', href: '/lost-leads', icon: TrendDown, category: t('search.categories.pages'), keywords: ['leads', 'izgubljeni', 'lost leads'] },
    { id: 'analytics', name: t('sidebar.items.analytics'), href: '/analytics', icon: ChartLine, category: t('search.categories.pages'), keywords: ['reports', 'statistics', 'poročila'] },
    // Asistent+ - začasno skrito: { id: 'asistent', name: 'Asistent+', href: '/asistent', icon: Sparkle, category: t('search.categories.pages'), keywords: ['ai', 'assistant', 'help'] },
    { id: 'nastavitve', name: t('sidebar.items.settings'), href: '/nastavitve', icon: Gear, category: t('search.categories.pages'), keywords: ['settings', 'preferences', 'config'] },

    // Quick actions
    { id: 'new-booking', name: t('sidebar.items.newAppointment'), href: '/koledar?action=new', icon: CalendarBlank, category: t('search.categories.quickActions'), keywords: ['new', 'booking', 'nova rezervacija'] },
    { id: 'new-client', name: t('sidebar.items.newClient'), href: '/clients?action=new', icon: Users, category: t('search.categories.quickActions'), keywords: ['new', 'client', 'nov uporabnik'] },
    { id: 'new-service', name: t('sidebar.items.newService'), href: '/services?action=new', icon: Briefcase, category: t('search.categories.quickActions'), keywords: ['new', 'service'] },
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
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
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
                <MagnifyingGlass className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder={t('search.placeholder')}
                  className="flex-1 text-base outline-none bg-transparent placeholder:text-gray-400"
                />
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium">ESC</span>
                  <span>{t('search.escHint')}</span>
                </div>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
                {flatItems.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <MagnifyingGlass className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{t('search.empty', { query })}</p>
                  </div>
                ) : (
                  Object.entries(groupedItems).map(([category, items]) => (
                    <div key={category} className="mb-4 last:mb-0">
                      <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left',
                              isSelected
                                ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-gray-900'
                                : 'text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            <div
                              className={cn(
                                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                                isSelected
                                  ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
                                  : 'bg-gray-100 text-gray-500'
                              )}
                            >
                              <Icon className="w-4 h-4" weight={isSelected ? 'fill' : 'regular'} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm font-medium truncate', isSelected && 'font-semibold')}>
                                {item.name}
                              </p>
                            </div>
                            {isSelected && (
                              <ArrowRight className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}

                {/* Recent searches */}
                {!query && recentSearches.length > 0 && (
                  <div className="border-t border-gray-100 pt-2 mt-2">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {t('search.categories.recent')}
                    </div>
                    {recentSearches.map((search, idx) => (
                      <button
                        key={idx}
                        onClick={() => setQuery(search)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors text-left"
                      >
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{search}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <span className="px-1 py-0.5 bg-gray-200 rounded text-[10px] font-medium">↑</span>
                      <span className="px-1 py-0.5 bg-gray-200 rounded text-[10px] font-medium">↓</span>
                      <span className="ml-1">{t('search.navHint')}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-medium">↵</span>
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
