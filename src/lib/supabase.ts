/**
 * CropTwin - Supabase Client Configuration
 * 
 * Strict Browser Security Contract:
 * - Uses ONLY the public Supabase URL and Anon / Publishable key in client code.
 * - NEVER imports or exposes SUPABASE_SERVICE_ROLE_KEY in the browser.
 */

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

// Read public credentials from environment
const ENV_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const ENV_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Fallback to locally stored settings if configured via System panel
const STORED_URL_KEY = 'croptwin_supabase_url';
const STORED_ANON_KEY = 'croptwin_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string; isConfigured: boolean } {
  let url = ENV_SUPABASE_URL;
  let anonKey = ENV_SUPABASE_ANON_KEY;

  if (typeof window !== 'undefined') {
    const savedUrl = localStorage.getItem(STORED_URL_KEY);
    const savedKey = localStorage.getItem(STORED_ANON_KEY);
    if (savedUrl && savedKey) {
      url = savedUrl;
      anonKey = savedKey;
    }
  }

  const isConfigured = Boolean(
    url &&
    anonKey &&
    !url.includes('your-project') &&
    url.startsWith('https://')
  );

  return { url, anonKey, isConfigured };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORED_URL_KEY, url.trim());
    localStorage.setItem(STORED_ANON_KEY, anonKey.trim());
  }
}

export function clearSupabaseCredentials(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORED_URL_KEY);
    localStorage.removeItem(STORED_ANON_KEY);
  }
}

// Singleton client initialization
let clientInstance: SupabaseClient | null = null;
let currentConfiguredUrl = '';
let currentConfiguredKey = '';

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseCredentials();

  if (!isConfigured) {
    return null;
  }

  if (!clientInstance || currentConfiguredUrl !== url || currentConfiguredKey !== anonKey) {
    clientInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    currentConfiguredUrl = url;
    currentConfiguredKey = anonKey;
  }

  return clientInstance;
}

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseCredentials().isConfigured;
};
