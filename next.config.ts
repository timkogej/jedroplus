import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// 🔒 Glavne varnostne nastavitve - za večino strani
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://n8n.jedroplus.com https://tikej.app.n8n.cloud wss://*.supabase.co",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

// 🔓 Nastavitve za EMBEDDABLE widgete (chatbot, booking)
// Te strani SE SMEJO prikazati v iframe na straneh strank
const embeddableHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://n8n.jedroplus.com https://tikej.app.n8n.cloud wss://*.supabase.co",
      "frame-ancestors *", // Dovoli embedding iz vseh domen
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      // 🔓 Chatbot subdomena — vse poti so embeddable (chatbot.jedroplus.com/*)
      {
        source: "/:path*",
        has: [{ type: "host", value: "chatbot.jedroplus.com" }],
        headers: embeddableHeaders,
      },
      // 🔓 Booking subdomena — vse poti so embeddable (booking.jedroplus.com/*)
      {
        source: "/:path*",
        has: [{ type: "host", value: "booking.jedroplus.com" }],
        headers: embeddableHeaders,
      },
      // 🔓 Embeddable poti po URL poti (za primer ko je na isti domeni)
      {
        source: "/chatbot/:path*",
        headers: embeddableHeaders,
      },
      {
        source: "/booking/:path*",
        headers: embeddableHeaders,
      },

      // 🔒 Vse ostale poti - stroga varnost
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
};

export default withNextIntl(nextConfig);
