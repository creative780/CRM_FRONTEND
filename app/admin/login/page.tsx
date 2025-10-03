"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
// Switched from Firebase demo auth to backend JWT auth
import { toast } from "react-hot-toast";

type Role = "admin" | "sales" | "designer" | "production";;
const ROLES: Role[] = ["admin", "sales", "designer", "production"];
const DEFAULT_ROLE: Role = "sales";

type UserDoc = {
  username: string;
  password: string; // demo only; don't use plaintext in prod
  role: Role;
  createdAt?: any;
  lastLogin?: any;
};

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>(DEFAULT_ROLE);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Preparing your dashboard…");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const busyRef = useRef(false);

  // Try to detect/store device name for logging headers (no UI changes)
  useEffect(() => {
    const AGENT_URLS = [
      "http://127.0.0.1:47113/hostname",
      "http://localhost:47113/hostname",
    ];
    (async () => {
      try {
        // if already set, keep it
        const existing = localStorage.getItem("attendance_device_name");
        if (existing && existing.trim()) return;
        for (const u of AGENT_URLS) {
          try {
            const r = await fetch(u, { cache: "no-store" });
            if (r.ok) {
              const name = (await r.text()).trim();
              if (name) {
                localStorage.setItem("attendance_device_name", name);
                break;
              }
            }
          } catch {}
        }
      } catch {}
    })();
  }, []);

  // Prefetch & warm-up
  useEffect(() => {
    router.prefetch("/admin/dashboard");
    // getDoc(doc(db, "__warmup__", "ping")).catch(() => {}); // This line was removed as per the edit hint
  }, [router]);

  // Show logout toast if present
  useEffect(() => {
    const logoutMsg = sessionStorage.getItem("logout_message");
    if (logoutMsg) {
      toast.success(logoutMsg);
      sessionStorage.removeItem("logout_message");
    }
  }, []);

  // Enter submits (when not loading)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !loading) {
        const target = e.target as HTMLElement | null;
        const tag = (target?.tagName || "").toLowerCase();
        const isButtonLike =
          tag === "button" ||
          (tag === "a" && (target as HTMLAnchorElement).href) ||
          target?.getAttribute("role") === "button";
        if (isButtonLike) return;
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading]);

  // Loading messages
  useEffect(() => {
    if (!loading) return;
    const messages = [
      `Hi${username ? `, ${username}` : ""} — signing you in…`,
      "Securing your session…",
      "Fetching your settings…",
      "Heading to dashboard…",
    ];
    let i = 0;
    setLoadingMsg(messages[i]);
    const id = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingMsg(messages[i]);
    }, 1200);
    return () => clearInterval(id);
  }, [loading, username]);

  // Resolve and cache public IP (for accurate activity logs)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      try {
        const existing = localStorage.getItem('attendance_device_ip');
        if (existing && existing.trim() && existing !== '127.0.0.1') return;
        const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        const ip = (data?.ip || '').toString().trim();
        if (ip) localStorage.setItem('attendance_device_ip', ip);
      } catch {}
    })();
  }, []);

  // Function to fetch device ID from agent API (always fresh, no localStorage)
  const fetchDeviceIdFromAgent = async (): Promise<string | null> => {
    const agentUrls = [
      'http://127.0.0.1:47114/device-id',
      'http://localhost:47114/device-id',
      'http://127.0.0.1:47113/device-id',
      'http://localhost:47113/device-id'
    ];
    
    for (const url of agentUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000); // Increased timeout
        
        const response = await fetch(url, { 
          signal: controller.signal,
          method: 'GET'
        });
        
        clearTimeout(timeout);
        
        if (response.ok) {
          const data = await response.json();
          if (data.device_id && data.status === 'active') {
            console.log('✅ Got device ID from agent:', data.device_id);
            return data.device_id;
          }
        }
      } catch (error) {
        console.debug('❌ Agent not reachable at', url);
      }
    }
    
    console.warn('⚠️ No agent found - device ID will be null');
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busyRef.current) return;
    setError("");

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError("Username, password, and role are required");
      return;
    }

    try {
      busyRef.current = true;
      setLoading(true);

      const role: Role = selectedRole || DEFAULT_ROLE;
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "https://api.crm.click2print.store";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      // ALWAYS fetch device ID from agent API (no localStorage fallback)
      console.log('🔄 Fetching device ID from agent...');
      const deviceId = await fetchDeviceIdFromAgent();
      
      const deviceName = typeof window !== 'undefined' ? (localStorage.getItem('attendance_device_name') || '') : '';
      
      // DEBUG: Log what we're getting
      console.log('DEBUG: Device ID resolution:', {
        from_agent: !!deviceId,
        final_device_id: deviceId,
        attendance_device_name: deviceName
      });
      
      if (deviceId) {
        headers['X-Device-ID'] = deviceId;
        console.log('✅ Added X-Device-ID header:', deviceId);
      } else {
        console.log('⚠️ No device ID found - login may fail if agent is required');
      }
      if (deviceName) headers['X-Device-Name'] = deviceName;
      const requestBody = { 
        username: trimmedUsername, 
        password: trimmedPassword, 
        role,
        device_id: deviceId || undefined,
        device_name: deviceName || undefined,
        ip: (typeof window !== 'undefined' ? localStorage.getItem('attendance_device_ip') : null) || undefined,
      };
      
      console.log('Login request:', {
        url: `${apiBase}/api/auth/login`,
        headers,
        body: requestBody
      });
      
      
      const resp = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });
      console.log('Login response status:', resp.status);
      
      if (!resp.ok) {
        const msg = await resp.json().catch(() => ({} as any));
        console.log('Login error response:', msg);
        
        // Handle device agent requirement (412 status)
        if (resp.status === 412) {
          const enrollmentToken = (msg as any)?.enrollment_token;
          console.log('412 response received, enrollment token:', enrollmentToken);
          if (enrollmentToken) {
            console.log('Device required - redirecting to install-agent with token:', enrollmentToken);
            try {
              router.push(`/install-agent?token=${enrollmentToken}`);
              console.log('Router.push called successfully');
              return;
            } catch (error) {
              console.error('Router.push failed:', error);
              // Fallback to window.location
              window.location.href = `/install-agent?token=${enrollmentToken}`;
              return;
            }
          } else {
            console.error('No enrollment token found in 412 response');
          }
        }
        
        setError((msg as any)?.detail || (msg as any)?.error || "Login failed");
        toast.error((msg as any)?.detail || (msg as any)?.error || "Login failed");
        return;
      }
      const data = await resp.json();
      localStorage.setItem("admin_logged_in", "true");
      localStorage.setItem("admin_username", data.username || trimmedUsername);
      localStorage.setItem("admin_role", data.role || role);
      localStorage.setItem("admin_token", data.token);

      await new Promise((r) => setTimeout(r, 150));
      router.push("/admin/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("Login failed. Please try again.");
      toast.error("Login failed. Please try again.");
    } finally {
      busyRef.current = false;
      setTimeout(() => setLoading(false), 400);
    }
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-pink-100 px-4 py-12 relative overflow-hidden">
      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="text-center px-8 py-10 rounded-3xl shadow-2xl bg-white/80 border border-white/60"
            >
              <div className="mx-auto mb-5 h-12 w-12 rounded-full border-4 border-black/10 border-t-black animate-spin" />
              <h2 className="text-xl font-semibold text-gray-800">{loadingMsg}</h2>
              {username ? (
                <p className="mt-2 text-sm text-gray-600">
                  Logged in as <span className="font-medium">{username}</span>
                </p>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative"
      >
        <div className="relative bg-[#891F1A] rounded-3xl shadow-2xl p-8 sm:p-12 border border-white/30">
          <h1 className="text-3xl font-extrabold text-white text-center mb-8 tracking-wide">
            CreativePrints
          </h1>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-white mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                className="w-full rounded-xl bg-transparent border border-white text-white placeholder-white/80 py-3 px-4 focus:outline-none focus:ring-2 focus:ring-white shadow-sm disabled:opacity-60"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={submitOnEnter}
                disabled={loading}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-xl bg-transparent border border-white text-white placeholder-white/80 py-3 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-white shadow-sm disabled:opacity-60"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={submitOnEnter}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white"
                  aria-label="Toggle password visibility"
                  disabled={loading}
                >
                  {showPassword ? <AiOutlineEyeInvisible size={20} /> : <AiOutlineEye size={20} />}
                </button>
              </div>
            </div>

            {/* Role Dropdown */}
            <div>
              <label htmlFor="role" className="block text-sm font-semibold text-white mb-2">
                Role
              </label>
              <select
                id="role"
                className="w-full rounded-xl bg-transparent border border-white text-white py-3 px-4 focus:outline-none focus:ring-2 focus:ring-white shadow-sm disabled:opacity-60"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as Role)}
                disabled={loading}
                required
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} className="text-black">
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
              <p className="text-white/70 text-xs mt-1">
                This controls which Order Lifecycle tabs you’ll see after login.
              </p>
            </div>

            {/* Device Agent Requirement Notice */}
            <div className="bg-white/10 rounded-xl p-3 border border-white/20">
              <p className="text-white/80 text-xs text-center">
                Device agent required for login.
              </p>
            </div>

            {/* Error */}
            {error && <p className="text-red-300 text-sm text-center">{error}</p>}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 font-semibold text-white bg-white/20 hover:bg-white/30 transition duration-300 shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Log In"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
