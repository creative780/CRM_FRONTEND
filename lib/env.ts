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

// API Configuration
export const API_CONFIG = {
  BASE_URL: getEnvVar('NEXT_PUBLIC_API_BASE', 'https://api.crm.click2print.store'),
  MONITORING_BASE_URL: getEnvVar('NEXT_PUBLIC_MONITORING_API_BASE', 'https://api.crm.click2print.store'),
  API_URL: getEnvVar('NEXT_PUBLIC_API_URL', 'https://api.crm.click2print.store/api'),
  WS_URL: getEnvVar('NEXT_PUBLIC_WS_URL', 'wss://api.crm.click2print.store/ws'),
};

// Development/Production checks
export const isDevelopment = getEnvVar('NODE_ENV', 'production') === 'development';
export const isProduction = getEnvVar('NODE_ENV', 'production') === 'production';

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
