import { supabase } from "../supabaseClient";

export async function logAudit({
  user_id,
  user_name,
  role,
  action,
  description,
}) {
  try {
    const { error } = await supabase
      .from("audit_logs")
      .insert([
        {
          user_id,
          user_name,
          role,
          action,
          description,
        },
      ]);

    if (error) {
      console.error("AUDIT LOG ERROR:", error);
    }

    return { error };
  } catch (err) {
    console.error("AUDIT LOG EXCEPTION:", err);
    return { error: err };
  }
}
