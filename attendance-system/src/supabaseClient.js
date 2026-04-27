import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gncvkqqmreufoarakjmj.supabase.co";
const supabaseKey = "sb_publishable_o2igaNv9uPIf3iM6nmgN4w_b8DyuYtZ";

export const supabase = createClient(supabaseUrl, supabaseKey);