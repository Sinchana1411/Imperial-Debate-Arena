import { createClient } from '@supabase/supabase-js';

// Load initial configuration from environment variables
// Note: Vite exposes VITE_ prefix.
const envUrl = (import.meta.env?.VITE_SUPABASE_URL as string) || "";
const envKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || "";

// Check for user-defined configuration overrides in localStorage for instant testing
const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('supabase_url_override') || "" : "";
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('supabase_key_override') || "" : "";

const activeUrl = storedUrl || envUrl;
const activeKey = storedKey || envKey;

export const supabase = activeUrl && activeKey 
  ? createClient(activeUrl, activeKey, {
      auth: {
        persistSession: false // client-side session logic is kept light
      }
    }) 
  : null;

export function getSupabaseConfig() {
  const isOk = !!supabase && activeUrl.startsWith('https://');
  return {
    url: activeUrl,
    key: activeKey ? `${activeKey.substring(0, 10)}...` : "",
    isConfigured: isOk,
    source: storedUrl ? 'user-override' : (envUrl ? 'env' : 'none')
  };
}

export function saveSupabaseOverride(url: string, key: string) {
  if (url && key) {
    localStorage.setItem('supabase_url_override', url.trim());
    localStorage.setItem('supabase_key_override', key.trim());
  } else {
    localStorage.removeItem('supabase_url_override');
    localStorage.removeItem('supabase_key_override');
  }
  window.location.reload(); // Reload to re-instantiate client state
}

// LiveKit URL handling
const envLkUrl = (import.meta.env?.VITE_LIVEKIT_URL as string) || "";
const storedLkUrl = typeof window !== 'undefined' ? localStorage.getItem('livekit_url_override') || "" : "";
export const getLiveKitConfig = () => {
  const activeLkUrl = storedLkUrl || envLkUrl;
  return {
    url: activeLkUrl,
    isConfigured: !!activeLkUrl,
    source: storedLkUrl ? 'user-override' : (envLkUrl ? 'env' : 'none')
  };
};

export function saveLiveKitOverride(url: string) {
  if (url) {
    localStorage.setItem('livekit_url_override', url.trim());
  } else {
    localStorage.removeItem('livekit_url_override');
  }
  window.location.reload();
}
