'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MagnifyingGlass, X, Plus, User, Check } from '@phosphor-icons/react';
import type { Client } from '@/lib/supabase/clients';
import { searchClients } from '@/lib/supabase/clients';
import { useCompany } from '@/app/company-context';
import ClientInfoCard from './ClientInfoCard';

interface ClientSearchProps {
  selectedClient: Client | null;
  onSelect: (client: Client | null) => void;
  placeholder?: string;
  onCreateNew?: () => void;
}

function ClientSearch({
  selectedClient,
  onSelect,
  placeholder = 'Išči stranko po imenu, emailu ali telefonu...',
  onCreateNew,
}: ClientSearchProps) {
  const { companyId } = useCompany();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!companyId || !searchQuery.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await searchClients(companyId, searchQuery);
        if (error) {
          console.error('Search error:', error);
          setResults([]);
        } else {
          setResults(data ?? []);
        }
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [companyId]
  );

  // Handle query change with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim()) {
      debounceRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === 'ArrowDown' && query) {
        setIsOpen(true);
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        event.preventDefault();
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        }
        break;
    }
  };

  const handleSelect = (client: Client) => {
    onSelect(client);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    if (query.trim() && results.length > 0) {
      setIsOpen(true);
    }
  };

  // Animation variants
  const dropdownVariants = {
    hidden: { opacity: 0, y: -8, scale: 0.96 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring' as const, stiffness: 500, damping: 30 },
    },
    exit: { opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.15 } },
  };

  return (
    <div className="space-y-3">
      {/* Search container */}
      <div ref={containerRef} className="relative">
        {/* Selected client display or search input */}
        {selectedClient ? (
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <span className="text-lg font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
              {selectedClient.ime.charAt(0)}
              {selectedClient.priimek.charAt(0)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[#1A1F36]">
                {selectedClient.ime} {selectedClient.priimek}
              </p>
              <p className="text-xs text-gray-500 truncate">{selectedClient.email}</p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400
                         transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" weight="bold" />
            </button>
          </div>
        ) : (
          <>
            {/* Search input */}
            <div className="relative">
              <MagnifyingGlass
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                weight="regular"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                  setHighlightedIndex(-1);
                }}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4
                           text-sm text-[#1A1F36] placeholder-gray-400 transition-all
                           focus:border-[#1A1F36]/30 focus:outline-none focus:ring-2
                           focus:ring-[#1A1F36]/10"
              />
              {isLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#1A1F36]" />
                </div>
              )}
            </div>

            {/* Search results dropdown */}
            <AnimatePresence>
              {isOpen && (query.trim() || results.length > 0) && (
                <motion.div
                  key="dropdown"
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-gray-100
                             bg-white shadow-lg shadow-gray-200/50"
                >
                  <div className="max-h-64 overflow-y-auto p-1.5 custom-scrollbar">
                    {results.length > 0 ? (
                      <>
                        {results.map((client, index) => (
                          <motion.button
                            key={`cs-${index}-${client.id}`}
                            type="button"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => handleSelect(client)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left
                                       transition-colors
                                       ${highlightedIndex === index ? 'bg-[#1A1F36]/5' : ''}
                                       hover:bg-[#1A1F36]/5`}
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-full
                                            bg-gradient-to-br from-gray-200 to-gray-300 text-gray-600">
                              <User className="h-4 w-4" weight="regular" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[#1A1F36]">
                                {client.ime} {client.priimek}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {client.email || client.telefon || 'Ni podatkov'}
                              </p>
                            </div>
                          </motion.button>
                        ))}
                        {/* Always show "Add new client" at the bottom of results */}
                        {onCreateNew && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onCreateNew();
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left
                                       transition-colors hover:bg-violet-50 border-t border-gray-100 mt-1 pt-2.5"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-full
                                            bg-gradient-to-r from-violet-500 to-cyan-500 text-white">
                              <Plus className="h-4 w-4" weight="bold" />
                            </div>
                            <p className="text-sm font-medium text-violet-600">Dodaj novo stranko</p>
                          </button>
                        )}
                      </>
                    ) : query.trim() && !isLoading ? (
                      <div className="px-3 py-4 text-center">
                        <p className="text-sm text-gray-500">Ni rezultatov za "{query}"</p>
                        {onCreateNew && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onCreateNew();
                            }}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r
                                       from-pink-500 to-purple-600 px-4 py-2 text-sm font-medium
                                       text-white transition-all hover:shadow-lg"
                          >
                            <Plus className="h-4 w-4" weight="bold" />
                            Dodaj novo stranko
                          </button>
                        )}
                      </div>
                    ) : isLoading ? (
                      <div className="px-3 py-4 text-center">
                        <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-[#1A1F36]" />
                        <p className="mt-2 text-sm text-gray-500">Iščem...</p>
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Client info cards */}
      {selectedClient && (selectedClient.telefon || selectedClient.email) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3"
        >
          <ClientInfoCard
            icon="phone"
            label="Telefon"
            value={selectedClient.telefon || ''}
          />
          <ClientInfoCard
            icon="email"
            label="Email"
            value={selectedClient.email}
          />
        </motion.div>
      )}
    </div>
  );
}

export default memo(ClientSearch);
