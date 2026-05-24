import { createClient } from '@supabase/supabase-js';

// Load initial configuration from environment variables
// Note: Vite exposes VITE_ prefix.
let envUrl = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || "";
let envKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || "";

// Check for user-defined configuration overrides in localStorage for instant testing
const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('supabase_url_override') || "" : "";
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('supabase_key_override') || "" : "";

let activeUrl = storedUrl || envUrl;
let activeKey = storedKey || envKey;

export let supabase = activeUrl && activeKey 
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

// Dynamically configuration helper called from App initialization
export function configureSupabase(url: string, key: string, forceEnvSource: boolean = false) {
  if (url && key) {
    activeUrl = url;
    activeKey = key;
    if (forceEnvSource) {
      envUrl = url;
      envKey = key;
    }
    supabase = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
  } else {
    // If we're clearing, default back
    activeUrl = storedUrl || envUrl;
    activeKey = storedKey || envKey;
    supabase = activeUrl && activeKey
      ? createClient(activeUrl, activeKey, { auth: { persistSession: false } })
      : null;
  }
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
const envLkUrl = ((import.meta as any).env?.VITE_LIVEKIT_URL as string) || "";
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
