'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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

// ============================================================================
// Search items
// ============================================================================

const searchItems: SearchItem[] = [
  // Pages
  { id: 'dashboard', name: 'Dashboard', href: '/dashboard', icon: ChartBar, category: 'Strani', keywords: ['pregled', 'home', 'domov'] },
  { id: 'koledar', name: 'Koledar', href: '/koledar', icon: CalendarBlank, category: 'Strani', keywords: ['calendar', 'schedule', 'urnik'] },
  { id: 'termini', name: 'Termini', href: '/termini', icon: ClipboardText, category: 'Strani', keywords: ['appointments', 'booking', 'rezervacije'] },
  { id: 'clients', name: 'Stranke', href: '/clients', icon: Users, category: 'Strani', keywords: ['customers', 'clients', 'uporabniki'] },
  { id: 'services', name: 'Storitve', href: '/services', icon: Briefcase, category: 'Strani', keywords: ['services', 'offerings'] },
  { id: 'staff', name: 'Osebje', href: '/staff', icon: UserCircle, category: 'Strani', keywords: ['employees', 'team', 'zaposleni'] },
  { id: 'reminders', name: 'Opomniki', href: '/reminders', icon: Bell, category: 'Strani', keywords: ['notifications', 'alerts', 'obvestila'] },
  { id: 'lost-leads', name: 'Lost Leads', href: '/lost-leads', icon: TrendDown, category: 'Strani', keywords: ['leads', 'izgubljeni'] },
  { id: 'analytics', name: 'Analitika', href: '/analytics', icon: ChartLine, category: 'Strani', keywords: ['reports', 'statistics', 'poročila'] },
  // Asistent+ - začasno skrito: { id: 'asistent', name: 'Asistent+', href: '/asistent', icon: Sparkle, category: 'Strani', keywords: ['ai', 'assistant', 'help'] },
  { id: 'nastavitve', name: 'Nastavitve', href: '/nastavitve', icon: Gear, category: 'Strani', keywords: ['settings', 'preferences', 'config'] },

  // Quick actions
  { id: 'new-booking', name: 'Nov termin', href: '/koledar?action=new', icon: CalendarBlank, category: 'Hitri dostop', keywords: ['new', 'booking', 'nova rezervacija'] },
  { id: 'new-client', name: 'Nova stranka', href: '/clients?action=new', icon: Users, category: 'Hitri dostop', keywords: ['new', 'client', 'nov uporabnik'] },
  { id: 'new-service', name: 'Nova storitev', href: '/services?action=new', icon: Briefcase, category: 'Hitri dostop', keywords: ['new', 'service'] },
];

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
  const { isSearchOpen, closeSearch } = useSidebar();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

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
                  placeholder="Išči strani, akcije..."
                  className="flex-1 text-base outline-none bg-transparent placeholder:text-gray-400"
                />
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium">ESC</span>
                  <span>zapri</span>
                </div>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
                {flatItems.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <MagnifyingGlass className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Ni rezultatov za "{query}"</p>
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
                      Nedavna iskanja
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
                      <span className="ml-1">navigacija</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-medium">↵</span>
                      <span className="ml-1">odpri</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Command className="w-3 h-3" />
                    <span>K za iskanje</span>
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
