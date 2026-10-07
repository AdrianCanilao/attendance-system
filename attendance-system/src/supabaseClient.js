import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const authStorageKey = `sb-${projectRef}-auth-token`;
const rememberKey = "cibo_remember_me";

const getRememberMe = () =>
  localStorage.getItem(rememberKey) === "true";

const authStorage = {
  getItem: (key) => {
    if (key !== authStorageKey) {
      return localStorage.getItem(key);
    }

    // Always expose the active session to Supabase.
    // Remember Me controls WHERE the session is persisted:
    // localStorage = remembered, sessionStorage = current browser session only.
    return getRememberMe()
      ? localStorage.getItem(key)
      : sessionStorage.getItem(key);
  },

  setItem: (key, value) => {
    if (key !== authStorageKey) {
      localStorage.setItem(key, value);
      return;
    }

    if (getRememberMe()) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },

  removeItem: (key) => {
    if (key === authStorageKey) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      return;
    }

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
