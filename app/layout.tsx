// Minimal root layout — the <html> shell lives in app/[locale]/layout.tsx
// so it can set lang={locale} correctly.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
