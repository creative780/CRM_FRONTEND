/**
 * Environment configuration utility
 * Centralizes access to environment variables with proper fallbacks
 */

// Client-side safe environment variable access
export const getEnvVar = (key: string, fallback: string = ''): string => {
  // Only access process.env on server-side or for NEXT_PUBLIC_ variables
  if (typeof window === 'undefined') {
    return process.env[key] || fallback;
  }
  
  // For client-side, only NEXT_PUBLIC_ variables are available
  if (key.startsWith('NEXT_PUBLIC_')) {
    return process.env[key] || fallback;
  }
  
  // For non-NEXT_PUBLIC variables on client-side, return fallback
  return fallback;
};

// Development/Production checks
export const isDevelopment = getEnvVar('NODE_ENV', 'production') === 'development';
export const isProduction = getEnvVar('NODE_ENV', 'production') === 'production';

// API Configuration - Force localhost in development
const isDev = typeof window !== 'undefined' ? 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') :
  (process.env.NODE_ENV === 'development');

// Debug logging
if (typeof window !== 'undefined') {
  console.log('Environment Debug:', {
    NODE_ENV: getEnvVar('NODE_ENV', 'production'),
    isDevelopment,
    isProduction,
    hostname: window.location.hostname,
    isDev: isDev,
    NEXT_PUBLIC_API_BASE: getEnvVar('NEXT_PUBLIC_API_BASE', 'not-set'),
    NEXT_PUBLIC_API_URL: getEnvVar('NEXT_PUBLIC_API_URL', 'not-set'),
  });
}

export const API_CONFIG = {
  BASE_URL: isDev ? 'http://localhost:8000' : 'https://api.crm.click2print.store',
  MONITORING_BASE_URL: isDev ? 'http://localhost:8000' : 'https://api.crm.click2print.store',
  API_URL: isDev ? 'http://localhost:8000/api' : 'https://api.crm.click2print.store/api',
  WS_URL: isDev ? 'ws://localhost:8000/ws' : 'wss://api.crm.click2print.store/ws',
};

// Debug API configuration
if (typeof window !== 'undefined') {
  console.log('API Configuration Debug:', API_CONFIG);
}

// Helper function to get API base URL
export const getApiBaseUrl = (isMonitoring: boolean = false): string => {
  if (isMonitoring) {
    return API_CONFIG.MONITORING_BASE_URL;
  }
  return API_CONFIG.BASE_URL;
};

// Helper function to get WebSocket URL
export const getWebSocketUrl = (): string => {
  return API_CONFIG.WS_URL;
};
