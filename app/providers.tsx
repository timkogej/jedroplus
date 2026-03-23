"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "./auth-context";
import { CompanyProvider } from "./company-context";
import { RolePermissionProvider } from "./role-permission-context";
import { Toaster } from "sonner";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <CompanyProvider>
      <AuthProvider>
        <RolePermissionProvider>
          {children}
        </RolePermissionProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'white',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            },
          }}
        />
      </AuthProvider>
    </CompanyProvider>
  );
}
