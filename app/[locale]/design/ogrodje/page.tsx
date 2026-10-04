'use client';

/**
 * ZAČASNA predogledna stran za ogrodje aplikacije (stranska in zgornja
 * vrstica) — ista postavitev kot LayoutContent v ProtectedLayout, z dolgo
 * vsebino, da se vidi, ali se vsebina začne na vrhu in ali stranska
 * vrstica ostane na mestu. Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import type { User } from '@supabase/supabase-js';
import { Sidebar, AppBar, SidebarProvider, useSidebar } from '@/components/layout';
import { AuthContext, useAuth } from '@/app/auth-context';
import { RolePermissionContext } from '@/app/role-permission-context';

function Shell() {
  const { isMobile, isCollapsed } = useSidebar();
  const contentMargin = isMobile ? 0 : isCollapsed ? 64 : 240;
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <div className="flex min-h-screen flex-col transition-all duration-300" style={{ marginLeft: contentMargin }}>
        <AppBar />
        <main className="flex-1 overflow-hidden pt-14">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
            <h1 id="vsebina-zacetek" className="text-2xl font-semibold text-gray-900">Začetek vsebine</h1>
            <p className="mt-1 text-gray-500">Ta naslov mora biti takoj pod zgornjo vrstico, ne pod stransko.</p>
            {Array.from({ length: 40 }).map((_, i) => (
              <p key={i} className="mt-4 rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-700">
                Vrstica vsebine {i + 1}
              </p>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function OgrodjePreview() {
  const auth = useAuth();
  return (
    <AuthContext.Provider value={{ ...auth, user: { id: 'u-owner', email: 'maja@salonmaja.si' } as User, loading: false }}>
      <RolePermissionContext.Provider value={{ role: 'owner', personId: null, permissions: null, loading: false }}>
        <SidebarProvider>
          <Shell />
        </SidebarProvider>
      </RolePermissionContext.Provider>
    </AuthContext.Provider>
  );
}
