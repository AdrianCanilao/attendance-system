import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

// Remove any auth session that was previously persisted by the old client configuration.
// The application now keeps the Supabase session in memory only.
try {
  localStorage.removeItem("sb-gncvkqqmreufoarakjmj-auth-token");
} catch {
  // Ignore storage access errors; Supabase can still operate without persisted storage.
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
