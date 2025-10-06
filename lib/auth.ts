import { Role } from "@/types/api";
import { getApiBaseUrl } from "./env";

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export function getRole(): Role {
  if (typeof window === 'undefined') return 'sales';
  const r = (localStorage.getItem('admin_role') || 'sales') as Role;
  const allowed: Role[] = ['admin', 'sales', 'designer', 'production', 'delivery', 'finance'];
  return allowed.includes(r) ? r : 'sales';
}

// Add function to fetch device ID from agent
async function fetchDeviceIdFromAgent(): Promise<string | null> {
  const agentUrls = [
    'http://127.0.0.1:47114/device-id',  // Agent API server
    'http://localhost:47114/device-id',
    'http://127.0.0.1:47113/device-id',  // HostAgent fallback
    'http://localhost:47113/device-id'
  ];
  
  for (const url of agentUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000); // Increased timeout
      
      const response = await fetch(url, { 
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CRM-Frontend/1.0'
        }
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        if (data.device_id && (data.status === 'active' || data.status === 'online')) {
          console.log('✅ Agent is running - Device ID:', data.device_id);
          return data.device_id;
        } else {
          console.warn('⚠️ Agent responded but status is not active:', data.status);
        }
      } else {
        console.debug(`Agent at ${url} returned status:`, response.status);
      }
    } catch (error) {
      // Continue to next URL
      console.debug('❌ Agent not reachable at', url, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.warn('❌ No monitoring agent found running on this device');
  return null;
}

export async function login(username: string, password: string, role: Role) {
  const base = getApiBaseUrl();
  
  // For non-admin users, we MUST have a running agent
  let deviceId = null;
  if (typeof window !== 'undefined') {
    console.log('🔍 Checking for monitoring agent...');
    
    // First try to get from running agent (this is the most reliable)
    deviceId = await fetchDeviceIdFromAgent();
    
    // For non-admin users, we require the agent to be running
    if (!deviceId && role !== 'admin') {
      console.error('❌ No monitoring agent found - login blocked for non-admin user');
      throw new Error('DEVICE_REQUIRED:Monitoring agent must be running to login');
    }
    
    // For admin users, we can fallback to stored device ID
    if (!deviceId && role === 'admin') {
      console.log('⚠️ No running agent found, using stored device ID for admin user');
      deviceId = localStorage.getItem('device_id');
      
      // Fallback to cookies for admin users
      if (!deviceId) {
        const cookies = document.cookie.split(';');
        const deviceCookie = cookies.find(cookie => cookie.trim().startsWith('device_id='));
        if (deviceCookie) {
          deviceId = deviceCookie.split('=')[1];
        }
      }
    }
    
    // Store device ID in localStorage for future use
    if (deviceId) {
      localStorage.setItem('device_id', deviceId);
      console.log('✅ Using device ID:', deviceId);
    }
  }
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (deviceId) {
    headers['X-Device-ID'] = deviceId;
  }
  
  console.log('🔐 Attempting login with role:', role, 'device ID:', deviceId ? 'present' : 'none');
  
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', 
    headers, 
    body: JSON.stringify({ username, password, role })
  });
  
  if (res.status === 412) {
    // Device agent required
    const data = await res.json();
    console.error('❌ Login blocked - device verification failed:', data.error);
    throw new Error(`DEVICE_REQUIRED:${data.enrollment_token}`);
  }
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('❌ Login failed:', errorData.detail || 'Unknown error');
    throw new Error(errorData.detail || 'Login failed');
  }
  
  const data = await res.json();
  console.log('✅ Login successful for user:', data.username || username);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_username', data.username || username);
    localStorage.setItem('admin_role', data.role || role);
  }
  return data;
}

// Simple client-side guard helper (for use in useEffect of protected pages)
export function requireAuthClient(): boolean {
  if (typeof window === 'undefined') return false;
  const tok = getToken();
  if (!tok) { window.location.href = '/admin/login'; return false; }
  return true;
}

