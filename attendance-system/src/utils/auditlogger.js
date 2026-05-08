import { supabase } from "../supabaseClient";

export const logAudit = async ({
  user_id,
  user_name,
  role,
  action,
  description,
}) => {
  try {
    await supabase.from("audit_logs").insert([
      {
        user_id,
        user_name,
        role,
        action,
        description,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (err) {
    console.error("Audit log failed:", err);
  }
};