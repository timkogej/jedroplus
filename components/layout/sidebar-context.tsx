'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

// ============================================================================
// Types
// ============================================================================

interface SidebarContextValue {
  isOpen: boolean;
  isMobile: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  isNotificationsOpen: boolean;
  openNotifications: () => void;
  closeNotifications: () => void;
  toggleNotifications: () => void;
  notificationCount: number;
  setNotificationCount: (count: number) => void;
}

// ============================================================================
// Constants
// ============================================================================

const MOBILE_BREAKPOINT = 768;

// ============================================================================
// Context
// ============================================================================

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

export function SidebarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // -------------------------------------------------------------------------
  // Detect mobile/desktop
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // -------------------------------------------------------------------------
  // Close mobile sidebar on route change
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [pathname, isMobile]);

  // -------------------------------------------------------------------------
  // Lock body scroll when mobile sidebar is open
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isOpen]);

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        if (isMobile) setIsOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        if (isSearchOpen) setIsSearchOpen(false);
        else if (isNotificationsOpen) setIsNotificationsOpen(false);
        else if (isMobile && isOpen) setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, isOpen, isSearchOpen, isNotificationsOpen]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebar-collapsed', String(next));
      }
      return next;
    });
  }, []);

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const toggleSearch = useCallback(() => setIsSearchOpen((prev) => !prev), []);

  const openNotifications = useCallback(() => setIsNotificationsOpen(true), []);
  const closeNotifications = useCallback(() => setIsNotificationsOpen(false), []);
  const toggleNotifications = useCallback(() => setIsNotificationsOpen((prev) => !prev), []);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  const value = useMemo<SidebarContextValue>(
    () => ({
      isOpen,
      isMobile,
      open,
      close,
      toggle,
      isCollapsed,
      toggleCollapse,
      isSearchOpen,
      openSearch,
      closeSearch,
      toggleSearch,
      isNotificationsOpen,
      openNotifications,
      closeNotifications,
      toggleNotifications,
      notificationCount,
      setNotificationCount,
    }),
    [
      isOpen,
      isMobile,
      open,
      close,
      toggle,
      isCollapsed,
      toggleCollapse,
      isSearchOpen,
      openSearch,
      closeSearch,
      toggleSearch,
      isNotificationsOpen,
      openNotifications,
      closeNotifications,
      toggleNotifications,
      notificationCount,
    ]
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}

// ============================================================================
// Exports
// ============================================================================

export { MOBILE_BREAKPOINT };
