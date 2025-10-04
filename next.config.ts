import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.crm.click2print.store/api',
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || 'https://api.crm.click2print.store',
    NEXT_PUBLIC_MONITORING_API_BASE: process.env.NEXT_PUBLIC_MONITORING_API_BASE || 'https://api.crm.click2print.store',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.crm.click2print.store/ws',
  },
};

export default nextConfig;
