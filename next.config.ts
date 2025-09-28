import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    // static assets
    {
      urlPattern: ({ request }: any) => request.destination === "image",
      handler: "CacheFirst",
      options: { cacheName: "images", expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 3600} }
    },
    // pages / same-origin HTML
    {
      urlPattern: ({ request, sameOrigin }: any) => sameOrigin && request.destination === "document",
      handler: "NetworkFirst",
      options: { cacheName: "pages" }
    },
    // explicit do not cache api
    {
      urlPattern: ({ url }: any) => url.pathname.startsWith("/api/"),
      handler: "NetworkOnly"
    }
  ]
});

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
  //CSP: tweak sources to match app
  { key: "Content-Security-Policy", value:
    [
      "default-src 'self'",
      // next injects some inline scripts/styles; keep as unsafe unless adding nonces
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // PWA bits
      "worker-src 'self'",
      "manifest-src 'self'",
      // media + images
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // API calls (clickup) - add orther to call out more origins
      "connect-src 'self' https://api.clickup.com", 
      // lock these down
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join("; ")
  } 
  // Optional, but good:
  // { key: "X-DNS-Prefetch-Control", value: "on" },
  // HSTS is usually handled by Vercel automatically over HTTPS,
  // but you can add it if you manage your own domain/proxy:
  // { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const config: NextConfig = {
  // react strict mode is good practice
  reactStrictMode: true,

  // add headers in same config that PWA wraps
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withPWA(config);
