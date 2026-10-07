import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const authStorageKey = `sb-${projectRef}-auth-token`;
const rememberKey = "cibo_remember_me";

const authStorage = {
  getItem: (key) => {
    if (key !== authStorageKey) return localStorage.getItem(key);
    return localStorage.getItem(rememberKey) === "true"
      ? localStorage.getItem(key)
      : null;
  },
  setItem: (key, value) => {
    if (key !== authStorageKey) {
      localStorage.setItem(key, value);
      return;
    }

    if (localStorage.getItem(rememberKey) === "true") {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storage: authStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
