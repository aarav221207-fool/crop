/**
 * TerraTwin - Supabase Client Configuration
 * 
 * Strict Browser Security Contract:
 * - Uses ONLY the public Supabase URL and Anon / Publishable key in client code from environment variables.
 * - NEVER reads or saves credentials in localStorage.
 * - NEVER imports or exposes SUPABASE_SERVICE_ROLE_KEY in the browser.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read public credentials strictly from environment variables
const ENV_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const ENV_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export function getSupabaseCredentials(): { url: string; anonKey: string; isConfigured: boolean } {
  const url = ENV_SUPABASE_URL.trim();
  const anonKey = ENV_SUPABASE_ANON_KEY.trim();

  const isConfigured = Boolean(
    url &&
    anonKey &&
    !url.includes('your-project') &&
    url.startsWith('https://')
  );

  return { url, anonKey, isConfigured };
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
