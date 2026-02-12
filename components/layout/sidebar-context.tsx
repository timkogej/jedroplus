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
  // Sidebar state
  isOpen: boolean;
  isCollapsed: boolean;
  isMobile: boolean;

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;

  // Search
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;

  // Notifications
  isNotificationsOpen: boolean;
  openNotifications: () => void;
  closeNotifications: () => void;
  toggleNotifications: () => void;
  notificationCount: number;
  setNotificationCount: (count: number) => void;

  // Width (for resize feature)
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  COLLAPSED: 'jedroplus-sidebar-collapsed',
  WIDTH: 'jedroplus-sidebar-width',
} as const;

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 240;
const MAX_WIDTH = 400;
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

  // Initialize state with lazy initializers to read from localStorage synchronously
  // This prevents the flash/expansion issue on navigation
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsedState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.COLLAPSED) === 'true';
  });
  const [isMobile, setIsMobile] = useState(false);

  // Search panel state
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Notifications panel state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // Resize state - also initialize from localStorage
  const [sidebarWidth, setSidebarWidthState] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDTH;
    const saved = localStorage.getItem(STORAGE_KEYS.WIDTH);
    if (saved !== null) {
      const width = parseInt(saved, 10);
      if (!isNaN(width) && width >= MIN_WIDTH && width <= MAX_WIDTH) {
        return width;
      }
    }
    return DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);

  // -------------------------------------------------------------------------
  // Detect mobile/desktop
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // -------------------------------------------------------------------------
  // Close mobile sidebar on route change
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
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
      // Cmd/Ctrl + B: Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        if (isMobile) {
          setIsOpen((prev) => !prev);
        } else {
          setIsCollapsedState((prev) => {
            const newValue = !prev;
            localStorage.setItem(STORAGE_KEYS.COLLAPSED, String(newValue));
            return newValue;
          });
        }
      }

      // Cmd/Ctrl + K: Toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }

      // Escape: Close overlays
      if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else if (isNotificationsOpen) {
          setIsNotificationsOpen(false);
        } else if (isMobile && isOpen) {
          setIsOpen(false);
        }
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

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed);
    localStorage.setItem(STORAGE_KEYS.COLLAPSED, String(collapsed));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsedState((prev) => {
      const newValue = !prev;
      localStorage.setItem(STORAGE_KEYS.COLLAPSED, String(newValue));
      return newValue;
    });
  }, []);

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const toggleSearch = useCallback(() => setIsSearchOpen((prev) => !prev), []);

  const openNotifications = useCallback(() => setIsNotificationsOpen(true), []);
  const closeNotifications = useCallback(() => setIsNotificationsOpen(false), []);
  const toggleNotifications = useCallback(() => setIsNotificationsOpen((prev) => !prev), []);

  const setSidebarWidth = useCallback((width: number) => {
    const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
    setSidebarWidthState(clampedWidth);
    localStorage.setItem(STORAGE_KEYS.WIDTH, String(clampedWidth));
  }, []);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  const value = useMemo<SidebarContextValue>(
    () => ({
      isOpen,
      isCollapsed,
      isMobile,
      open,
      close,
      toggle,
      setCollapsed,
      toggleCollapsed,
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
      sidebarWidth,
      setSidebarWidth,
      isResizing,
      setIsResizing,
    }),
    [
      isOpen,
      isCollapsed,
      isMobile,
      open,
      close,
      toggle,
      setCollapsed,
      toggleCollapsed,
      isSearchOpen,
      openSearch,
      closeSearch,
      toggleSearch,
      isNotificationsOpen,
      openNotifications,
      closeNotifications,
      toggleNotifications,
      notificationCount,
      sidebarWidth,
      setSidebarWidth,
      isResizing,
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

export { MIN_WIDTH, MAX_WIDTH, DEFAULT_WIDTH, MOBILE_BREAKPOINT };
