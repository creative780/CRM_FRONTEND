import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:8000/api' : 'https://api.crm.click2print.store/api'),
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : 'https://api.crm.click2print.store'),
    NEXT_PUBLIC_MONITORING_API_BASE: process.env.NEXT_PUBLIC_MONITORING_API_BASE || (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : 'https://api.crm.click2print.store'),
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || (process.env.NODE_ENV === 'development' ? 'ws://localhost:8000/ws' : 'wss://api.crm.click2print.store/ws'),
  },
};

export default nextConfig;
