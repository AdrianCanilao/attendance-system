import { supabase } from "../supabaseClient";

export const logAudit = async ({
  user_id,
  user_name,
  role,
  action,
  description,
}) => {
  try {
    const { error } = await supabase.from("audit_logs").insert([
      {
        user_id,
        user_name,
        role,
        action,
        description,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("Audit log failed:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error("Audit log failed:", err);
    return { success: false, error: err };
  }
};

export const logCurrentUserAudit = async ({
  action,
  description,
  role,
}) => {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    console.error("Audit user lookup failed:", error);
    return { success: false, error };
  }

  return logAudit({
    user_id: data.user.id,
    user_name: data.user.email || "Unknown user",
    role: role || localStorage.getItem("role") || "unknown",
    action,
    description,
  });
};
